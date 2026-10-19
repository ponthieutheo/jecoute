//! The call recorder. While a call goes on, two tracks are kept on disk (the
//! microphone, and the sound the computer plays: the other people), and the
//! live transcript fills in as people pause. When it ends, the whole call is
//! put into words again with the user's model, person by person, then the AI
//! provider of post-processing writes notes about it (see `writeup`).
//!
//! Only text is kept, in `calls.db`; the tracks (`calls/<id>/*.wav` in the
//! app's data folder) are deleted once the call is written. A call cut short
//! by a crash or a quit is written at the next launch. Nobody joins the call:
//! the people in it should be told it is recorded.

pub mod audio;
pub mod commands;
pub mod diarize;
pub mod fbank;
pub mod segment;
pub mod store;
pub mod summary;
pub mod transcript;
mod writeup;

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{AppHandle, Manager};
use tauri_specta::Event;

use crate::managers::model::ModelManager;
use crate::managers::transcription::TranscriptionManager;
use crate::settings::get_settings;
use audio::{Capture, Source, TrackFile, SAMPLE_RATE};
use segment::LiveCutter;
use store::{Call, CallListItem, CallStatus, CallStore};
use summary::SummaryAvailability;
use transcript::{Line, ME, OTHERS};

const RATE: usize = SAMPLE_RATE as usize;
/// The two tracks of a call.
const MIC_TRACK: &str = "mic.wav";
const SYSTEM_TRACK: &str = "system.wav";

/// Something about the calls changed (a live line, a transcript, notes, the
/// voice model…): the page reads the state again.
#[derive(Clone, Debug, Serialize, Deserialize, Type, tauri_specta::Event)]
pub struct CallsChanged {
    pub id: Option<String>,
}

/// The call being recorded.
#[derive(Debug, Clone, Serialize, Type)]
pub struct RecordingInfo {
    pub id: String,
    pub started_at: i64,
    /// The computer's sound is recorded too (false: the microphone alone).
    pub system_audio: bool,
    /// A device stopped answering during the call (unplugged…).
    pub device_lost: bool,
}

/// A call being written: "transcript" (with `fraction` done) or "summary".
#[derive(Debug, Clone, Serialize, Type)]
pub struct CallWork {
    pub id: String,
    pub step: String,
    pub fraction: f64,
}

#[derive(Debug, Clone, Serialize, Type)]
pub struct VoiceSeparationState {
    /// "missing", "downloading", "ready" or "failed".
    pub state: String,
    pub fraction: f64,
    pub error: Option<String>,
    pub size_mb: u32,
    /// The setting "Tell the voices apart".
    pub enabled: bool,
}

/// Everything the page shows, read in one go.
#[derive(Debug, Clone, Serialize, Type)]
pub struct CallsState {
    pub calls: Vec<CallListItem>,
    pub recording: Option<RecordingInfo>,
    pub working: Vec<CallWork>,
    pub voice_separation: VoiceSeparationState,
    pub summary: SummaryAvailability,
    pub system_audio: bool,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum CallOption {
    SystemAudio,
    VoiceSeparation,
    Summary,
}

/// Codes of the reasons a call can't start or be written; the page turns
/// them into sentences.
pub const ERR_NO_MODEL: &str = "no-model";
pub const ERR_MIC: &str = "mic";
pub const ERR_BUSY: &str = "busy";
pub const ERR_AUDIO_GONE: &str = "audio-gone";

/// One side of the call: its file, and the sound the live transcript has
/// not used yet.
struct Track {
    label: &'static str,
    file: Option<TrackFile>,
    live: LiveCutter,
}

impl Track {
    fn open(dir: &std::path::Path, name: &str, label: &'static str) -> Result<Track, String> {
        Ok(Track {
            label,
            file: Some(TrackFile::create(&dir.join(name))?),
            live: LiveCutter::default(),
        })
    }

    fn feed(&mut self, samples: &[f32]) {
        if let Some(file) = self.file.as_mut() {
            if let Err(err) = file.append(samples) {
                log::warn!("calls: a track could not be written: {err}");
            }
        }
        self.live.push(samples);
    }

    fn close(&mut self) {
        if let Some(file) = self.file.take() {
            if let Err(err) = file.close() {
                log::warn!("calls: a track could not be closed: {err}");
            }
        }
    }
}

type SharedTrack = Arc<Mutex<Track>>;

/// A call taken for work (see `CallRecorder::claim`), given back on drop.
struct WorkClaim<'a> {
    rec: &'a CallRecorder,
    id: String,
}

impl Drop for WorkClaim<'_> {
    fn drop(&mut self) {
        self.rec.work_done(&self.id);
    }
}

/// The call in progress.
struct Ongoing {
    id: String,
    started_at: i64,
    /// The microphone first, then the computer's sound when it opened.
    captures: Vec<Capture>,
    tracks: Vec<SharedTrack>,
    halt: Arc<AtomicBool>,
}

#[derive(Default)]
struct Download {
    running: bool,
    fraction: f64,
    error: Option<String>,
}

pub struct CallRecorder {
    app: AppHandle,
    store: CallStore,
    /// `calls/` in the app's data folder, one folder of tracks per call.
    tracks_dir: PathBuf,
    voices_dir: PathBuf,
    ongoing: Mutex<Option<Ongoing>>,
    opening: AtomicBool,
    work: Mutex<Vec<CallWork>>,
    download: Mutex<Download>,
    /// Calls are written one after the other.
    writing: Mutex<()>,
    /// One change of a stored call at a time (read, change, save).
    edits: Mutex<()>,
}

/// Ids of calls are short lower-case hexadecimal strings (see
/// `transcript::unique_id`). Anything else coming from the page is refused.
pub fn valid_id(id: &str) -> bool {
    (8..=32).contains(&id.len()) && id.bytes().all(|b| matches!(b, b'0'..=b'9' | b'a'..=b'f'))
}

/// The folder of a call's tracks inside `base`. None for anything but a
/// well-formed id that is one plain path component (never `..`, a drive, a
/// root or a separator): nothing outside `base` can be touched.
fn track_folder(base: &std::path::Path, id: &str) -> Option<PathBuf> {
    let mut parts = std::path::Path::new(id).components();
    let single = matches!(
        (parts.next(), parts.next()),
        (Some(std::path::Component::Normal(_)), None)
    );
    (valid_id(id) && single).then(|| base.join(id))
}

fn now_ms() -> i64 {
    chrono::Utc::now().timestamp_millis()
}

fn recorder(app: &AppHandle) -> Option<Arc<CallRecorder>> {
    app.try_state::<Arc<CallRecorder>>()
        .map(|s| s.inner().clone())
}

pub fn is_recording(app: &AppHandle) -> bool {
    recorder(app).is_some_and(|r| r.ongoing.lock().unwrap().is_some())
}

/// Words written into a call in the app's language (French, else English);
/// the page lets the user rename everything.
struct Wording {
    french: bool,
}

impl Wording {
    fn of(app: &AppHandle) -> Wording {
        Wording {
            french: get_settings(app).app_language.starts_with("fr"),
        }
    }

    fn me(&self) -> &'static str {
        if self.french {
            "Moi"
        } else {
            "Me"
        }
    }

    fn others(&self) -> &'static str {
        if self.french {
            "Les autres"
        } else {
            "The others"
        }
    }

    fn person(&self, n: usize) -> String {
        if self.french {
            format!("Personne {n}")
        } else {
            format!("Person {n}")
        }
    }

    fn title(&self, ms: i64) -> String {
        let at = chrono::DateTime::from_timestamp_millis(ms)
            .unwrap_or_default()
            .with_timezone(&chrono::Local);
        let pattern = if self.french {
            "Appel du %d/%m à %H:%M"
        } else {
            "Call · %m/%d %H:%M"
        };
        at.format(pattern).to_string()
    }
}

impl CallRecorder {
    fn notify(&self, id: Option<&str>) {
        let _ = CallsChanged {
            id: id.map(str::to_string),
        }
        .emit(&self.app);
    }

    /// Changes a call as it is stored now, saves it and tells the page.
    /// Changes are made one at a time: two threads (the live transcript and
    /// the end of the call, say) never save over each other's change.
    fn update(&self, id: &str, edit: impl FnOnce(&mut Call)) -> Option<Call> {
        let call = {
            let _one_at_a_time = self.edits.lock().unwrap_or_else(|e| e.into_inner());
            let mut call = self.store.get(id).ok().flatten()?;
            edit(&mut call);
            if let Err(err) = self.store.save(&call) {
                log::error!("calls: {id} could not be saved: {err}");
            }
            call
        };
        self.notify(Some(id));
        Some(call)
    }

    fn folder(&self, id: &str) -> Option<PathBuf> {
        track_folder(&self.tracks_dir, id)
    }

    fn report_work(&self, id: &str, step: &str, fraction: f64) {
        {
            let mut work = self.work.lock().unwrap();
            work.retain(|w| w.id != id);
            work.push(CallWork {
                id: id.into(),
                step: step.into(),
                fraction,
            });
        }
        self.notify(Some(id));
    }

    /// Takes the call for one step of work ("transcript" or "summary"),
    /// unless something already works on it: checked and taken under one
    /// lock, so two threads never write the same call. The work is given
    /// back when the returned guard is dropped, whatever happens.
    fn claim(&self, id: &str, step: &str) -> Option<WorkClaim<'_>> {
        {
            let mut work = self.work.lock().unwrap();
            if work.iter().any(|w| w.id == id) {
                return None;
            }
            work.push(CallWork {
                id: id.into(),
                step: step.into(),
                fraction: 0.0,
            });
        }
        self.notify(Some(id));
        Some(WorkClaim {
            rec: self,
            id: id.to_string(),
        })
    }

    fn work_done(&self, id: &str) {
        self.work.lock().unwrap().retain(|w| w.id != id);
        self.notify(Some(id));
    }

    fn busy_with(&self, id: &str) -> bool {
        self.work.lock().unwrap().iter().any(|w| w.id == id)
    }

    fn recording_info(&self) -> Option<RecordingInfo> {
        let ongoing = self.ongoing.lock().unwrap();
        let o = ongoing.as_ref()?;
        Some(RecordingInfo {
            id: o.id.clone(),
            started_at: o.started_at,
            system_audio: o.captures.len() > 1,
            device_lost: o.captures.iter().any(Capture::has_failed),
        })
    }

    fn voice_separation(&self, enabled: bool) -> VoiceSeparationState {
        let d = self.download.lock().unwrap();
        let state = match (d.running, diarize::is_present(&self.voices_dir), &d.error) {
            (true, _, _) => "downloading",
            (false, true, _) => "ready",
            (false, false, Some(_)) => "failed",
            (false, false, None) => "missing",
        };
        VoiceSeparationState {
            state: state.into(),
            fraction: d.fraction,
            error: d.error.clone(),
            size_mb: (diarize::total_size() / 1_000_000) as u32,
            enabled,
        }
    }

    pub fn state(&self) -> CallsState {
        let settings = get_settings(&self.app);
        CallsState {
            calls: self.store.list().unwrap_or_default(),
            recording: self.recording_info(),
            working: self.work.lock().unwrap().clone(),
            voice_separation: self.voice_separation(settings.call_diarization),
            summary: summary::availability(&settings),
            system_audio: settings.call_system_audio,
        }
    }
}

/// Opens the calls, and writes in the background those the last run could
/// not finish (it quit or crashed during the call or while writing it).
pub fn setup(app: &AppHandle) -> anyhow::Result<()> {
    let data = crate::portable::app_data_dir(app)?;
    let tracks_dir = data.join("calls");
    std::fs::create_dir_all(&tracks_dir)?;
    let store = CallStore::open(&data.join("calls.db"))?;
    let left_over = store.unfinished().unwrap_or_default();
    let rec = Arc::new(CallRecorder {
        app: app.clone(),
        store,
        tracks_dir,
        voices_dir: diarize::models_dir(&data),
        ongoing: Mutex::new(None),
        opening: AtomicBool::new(false),
        work: Mutex::new(Vec::new()),
        download: Mutex::new(Download::default()),
        writing: Mutex::new(()),
        edits: Mutex::new(()),
    });
    app.manage(rec.clone());
    for mut call in left_over {
        log::info!("calls: {} was left unfinished, writing it now", call.id);
        if call.status == CallStatus::Recording {
            // It lasted as long as its microphone track.
            let bytes = rec
                .folder(&call.id)
                .and_then(|f| std::fs::metadata(f.join(MIC_TRACK)).ok())
                .map_or(0, |m| m.len());
            let seconds = bytes.saturating_sub(44) / 2 / RATE as u64;
            call.ended_at
                .get_or_insert(call.started_at + seconds as i64 * 1000);
            call.status = CallStatus::Processing;
            let _ = rec.store.save(&call);
        }
        let app = app.clone();
        std::thread::spawn(move || writeup::write_call(&app, &call.id));
    }
    Ok(())
}

/// Starts or stops, for the tray and `--toggle-call`. Opening the devices
/// takes a moment: never on the caller's thread (the tray's is the main one).
pub fn toggle(app: &AppHandle) {
    let app = app.clone();
    std::thread::spawn(move || {
        if is_recording(&app) {
            stop(&app);
        } else if let Err(err) = start(&app) {
            log::warn!("calls: the call could not start: {err}");
            let _ = CallsChanged { id: None }.emit(&app);
        }
    });
}

pub fn start(app: &AppHandle) -> Result<String, String> {
    let rec = recorder(app).ok_or("not ready")?;
    if rec.ongoing.lock().unwrap().is_some() || rec.opening.swap(true, Ordering::AcqRel) {
        return Err(ERR_BUSY.into());
    }
    let started = open_call(app, &rec);
    rec.opening.store(false, Ordering::Release);
    if started.is_ok() {
        crate::tray::update_tray_menu(app);
    }
    started
}

/// Opens one capture writing into a new track of `dir`.
fn open_track(
    dir: &std::path::Path,
    name: &str,
    label: &'static str,
    source: Source,
    t0: Instant,
) -> Result<(Capture, SharedTrack), String> {
    let track = Arc::new(Mutex::new(Track::open(dir, name, label)?));
    let sink = track.clone();
    match Capture::start(source, t0, move |s| sink.lock().unwrap().feed(s)) {
        Ok(capture) => Ok((capture, track)),
        Err(err) => {
            track.lock().unwrap().close();
            let _ = std::fs::remove_file(dir.join(name));
            Err(err)
        }
    }
}

fn open_call(app: &AppHandle, rec: &Arc<CallRecorder>) -> Result<String, String> {
    let settings = get_settings(app);
    let have_model = app
        .state::<Arc<ModelManager>>()
        .get_model_info(&settings.selected_model)
        .is_some_and(|m| m.is_downloaded);
    if !have_model {
        return Err(ERR_NO_MODEL.into());
    }
    let id = transcript::unique_id();
    let dir = rec.folder(&id).ok_or("bad id")?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let t0 = Instant::now();
    let started_at = now_ms();

    let mic_source = Source::Mic(settings.selected_microphone.clone());
    let (mic, mic_track) = open_track(&dir, MIC_TRACK, ME, mic_source, t0).map_err(|err| {
        log::warn!("calls: no microphone: {err}");
        let _ = std::fs::remove_dir_all(&dir);
        ERR_MIC.to_string()
    })?;
    let mut captures = vec![mic];
    let mut tracks = vec![mic_track];
    // Without the computer's sound the call goes on with the microphone alone.
    if settings.call_system_audio {
        match open_track(&dir, SYSTEM_TRACK, OTHERS, Source::System, t0) {
            Ok((capture, track)) => {
                captures.push(capture);
                tracks.push(track);
            }
            Err(err) => log::warn!("calls: no computer sound, microphone only: {err}"),
        }
    }

    let call = Call {
        id: id.clone(),
        title: Wording::of(app).title(started_at),
        title_edited: false,
        started_at,
        ended_at: None,
        status: CallStatus::Recording,
        system_audio: captures.len() > 1,
        speakers: Vec::new(),
        lines: Vec::new(),
        summary: None,
        key_points: Vec::new(),
        todos: Vec::new(),
        summary_error: None,
        error: None,
    };
    rec.store.save(&call).map_err(|e| e.to_string())?;
    let halt = Arc::new(AtomicBool::new(false));
    run_live_transcript(app, rec.clone(), id.clone(), tracks.clone(), halt.clone());
    *rec.ongoing.lock().unwrap() = Some(Ongoing {
        id: id.clone(),
        started_at,
        captures,
        tracks,
        halt,
    });
    // The model loads while the first words come in.
    app.state::<Arc<TranscriptionManager>>()
        .initiate_model_load();
    rec.notify(Some(&id));
    log::info!(
        "calls: {id} started ({})",
        if call.system_audio {
            "microphone and computer sound"
        } else {
            "microphone only"
        }
    );
    Ok(id)
}

/// Once a second during the call, each stretch that ended on a pause is
/// transcribed for the live view (the tracks reach the disk on their own,
/// from the capture threads: see `TrackFile`). The
/// final transcript does not use these lines: it is written again from the
/// whole tracks at the end.
fn run_live_transcript(
    app: &AppHandle,
    rec: Arc<CallRecorder>,
    id: String,
    tracks: Vec<SharedTrack>,
    halt: Arc<AtomicBool>,
) {
    let tm = app.state::<Arc<TranscriptionManager>>().inner().clone();
    let spawned = std::thread::Builder::new()
        .name("call-live".into())
        .spawn(move || {
            while !halt.load(Ordering::Relaxed) {
                std::thread::sleep(Duration::from_secs(1));
                // A call keeps the model loaded however long it lasts.
                tm.touch_activity();
                for track in &tracks {
                    let (label, ready) = {
                        let mut t = track.lock().unwrap();
                        (t.label, t.live.take())
                    };
                    let Some((start, sound)) = ready else {
                        continue;
                    };
                    let end = start + sound.len() as f64 / RATE as f64;
                    let said = match tm.transcribe_background(sound) {
                        Ok(text) => text.trim().to_string(),
                        Err(err) => {
                            log::debug!("calls: a live stretch was skipped: {err}");
                            continue;
                        }
                    };
                    if said.is_empty() || halt.load(Ordering::Relaxed) {
                        continue;
                    }
                    rec.update(&id, |call| {
                        if call.status != CallStatus::Recording {
                            return;
                        }
                        let at = call.lines.partition_point(|l| l.start <= start);
                        call.lines.insert(
                            at,
                            Line {
                                id: transcript::unique_id(),
                                speaker: label.into(),
                                start,
                                end,
                                text: said,
                            },
                        );
                    });
                }
            }
        });
    if let Err(err) = spawned {
        log::error!("calls: no live transcript: {err}");
    }
}

/// Stops the devices and closes the tracks; the call is then waiting to be
/// written. Returns its id.
fn end_capture(rec: &CallRecorder) -> Option<String> {
    let ongoing = rec.ongoing.lock().unwrap().take()?;
    ongoing.halt.store(true, Ordering::Relaxed);
    // Stopping a capture hands over its last samples before returning.
    for mut capture in ongoing.captures {
        capture.stop();
    }
    for track in &ongoing.tracks {
        track.lock().unwrap().close();
    }
    rec.update(&ongoing.id, |call| {
        call.ended_at = Some(now_ms());
        call.status = CallStatus::Processing;
    });
    Some(ongoing.id)
}

pub fn stop(app: &AppHandle) {
    let Some(rec) = recorder(app) else { return };
    let Some(id) = end_capture(&rec) else { return };
    crate::tray::update_tray_menu(app);
    log::info!("calls: {id} ended, writing it");
    let app = app.clone();
    std::thread::spawn(move || writeup::write_call(&app, &id));
}

/// The app quits during a call: the tracks are closed properly and the call
/// is written at the next launch.
pub fn on_exit(app: &AppHandle) {
    if let Some(id) = recorder(app).and_then(|rec| end_capture(&rec)) {
        log::info!("calls: {id} closed on exit, it will be written at the next launch");
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_call_folder_never_leaves_the_calls_folder() {
        let base = std::path::Path::new(r"C:\data\calls");
        let bad = [
            "..",
            r"..\..",
            "../x",
            r"C:\Windows",
            r"\server\share",
            "/etc",
            "a/b",
            "",
        ];
        for id in bad {
            assert!(track_folder(base, id).is_none(), "{id:?} accepted");
        }
        let ok = transcript::unique_id();
        assert_eq!(track_folder(base, &ok), Some(base.join(&ok)));
    }
}
