//! Writing a call once it has ended: both tracks cut at the pauses (and where
//! the voice changes), each piece transcribed by the user's model, the lines
//! given to their people, the tracks deleted; then the notes by the AI.

use std::collections::HashSet;
use std::sync::Arc;
use std::time::Instant;

use tauri::{AppHandle, Manager};

use super::audio::load_track;
use super::diarize::Diarizer;
use super::segment::{self, Span, MAX_PIECE_SECONDS};
use super::store::CallStatus;
use super::transcript::{self, Line, Names, ME, OTHERS};
use super::{
    recorder, summary, CallRecorder, Wording, ERR_AUDIO_GONE, ERR_NO_MODEL, MIC_TRACK, RATE,
    SYSTEM_TRACK,
};
use crate::managers::transcription::TranscriptionManager;
use crate::settings::get_settings;

/// Speech, in seconds, a side needs before it counts.
const ENOUGH_FOR_A_CALL: f64 = 1.0;
/// Talk on the microphone, in seconds, worth looking for several voices.
const ENOUGH_FOR_A_ROOM: f64 = 8.0;
/// Words the computer's sound must carry for the recording to be a call.
const WORDS_FOR_A_CALL: usize = 5;

/// One side of the call, read back from its track.
struct Side {
    sound: Vec<f32>,
    spans: Vec<Span>,
}

impl Side {
    fn read(path: &std::path::Path) -> Result<Side, String> {
        let sound = if path.exists() {
            load_track(path)?
        } else {
            Vec::new()
        };
        let spans = segment::speech_spans(&sound);
        Ok(Side { sound, spans })
    }

    fn speech_seconds(&self) -> f64 {
        self.spans.iter().map(Span::len).sum::<usize>() as f64 / RATE as f64
    }

    /// The pieces to transcribe, none longer than the model takes.
    fn pieces(&self) -> Vec<Span> {
        self.spans
            .iter()
            .flat_map(|s| segment::split_long(&self.sound, *s, MAX_PIECE_SECONDS))
            .collect()
    }

    /// The pieces, also cut where the voice changes, each with its voice
    /// (None without the separator, or where it heard nobody).
    fn pieces_by_voice(&self, separator: Option<&mut Diarizer>) -> Vec<(Span, Option<usize>)> {
        let turns = match separator {
            Some(d) => d.diarize(&self.sound).unwrap_or_else(|err| {
                log::warn!("calls: the voices could not be told apart: {err}");
                Vec::new()
            }),
            None => Vec::new(),
        };
        if turns.is_empty() {
            return self.pieces().into_iter().map(|p| (p, None)).collect();
        }
        segment::split_by_voice(&self.pieces(), &turns)
            .into_iter()
            .flat_map(|(span, voice)| {
                segment::split_long(&self.sound, span, MAX_PIECE_SECONDS)
                    .into_iter()
                    .map(move |p| (p, voice))
            })
            .collect()
    }
}

/// Transcribes pieces one by one, counting the seconds done for the page.
struct Writer<'a> {
    tm: &'a TranscriptionManager,
    rec: &'a CallRecorder,
    id: &'a str,
    seconds_total: f64,
    seconds_done: f64,
}

impl Writer<'_> {
    fn piece(&mut self, side: &Side, span: Span, speaker: String) -> Result<Option<Line>, String> {
        let mut sound = side.sound[span.start..span.end].to_vec();
        // Under a second, some models hear nothing: pad with silence.
        if sound.len() < RATE {
            sound.resize(RATE, 0.0);
        }
        let text = match self.tm.transcribe_background(sound.clone()) {
            Ok(text) => text,
            // One more try: a model reload or a busy engine can fail once.
            Err(err) => {
                log::warn!("calls: a piece failed once ({err})");
                self.tm
                    .transcribe_background(sound)
                    .map_err(|e| e.to_string())?
            }
        };
        let (start, end) = span.seconds();
        self.seconds_done += end - start;
        let fraction = (self.seconds_done / self.seconds_total.max(1.0)).min(1.0);
        self.rec.report_work(self.id, "transcript", fraction);
        let text = text.trim();
        Ok((!text.is_empty()).then(|| Line {
            id: transcript::unique_id(),
            speaker,
            start,
            end,
            text: text.to_string(),
        }))
    }

    fn side(
        &mut self,
        side: &Side,
        plan: &[(Span, Option<usize>)],
        label: impl Fn(Option<usize>) -> String,
    ) -> Result<Vec<Line>, String> {
        let mut lines = Vec::new();
        for (span, voice) in plan {
            if let Some(line) = self.piece(side, *span, label(*voice))? {
                lines.push(line);
            }
        }
        Ok(lines)
    }
}

fn voice_label(fallback: &'static str) -> impl Fn(Option<usize>) -> String {
    move |voice| voice.map_or_else(|| fallback.to_string(), |v| format!("v{v}"))
}

fn put_into_words(app: &AppHandle, rec: &CallRecorder, id: &str) -> Result<(), String> {
    let began = Instant::now();
    let folder = rec.folder(id).ok_or(ERR_AUDIO_GONE)?;
    if !folder.join(MIC_TRACK).exists() {
        return Err(ERR_AUDIO_GONE.into());
    }
    let tm = app.state::<Arc<TranscriptionManager>>().inner().clone();
    tm.ensure_model_loaded()
        .map_err(|_| ERR_NO_MODEL.to_string())?;
    let mic = Side::read(&folder.join(MIC_TRACK))?;
    let system = Side::read(&folder.join(SYSTEM_TRACK))?;

    let settings = get_settings(app);
    let mut separator = (settings.call_diarization && super::diarize::is_present(&rec.voices_dir))
        .then(|| Diarizer::load(&rec.voices_dir))
        .and_then(|loaded| {
            loaded
                .map_err(|err| log::warn!("calls: no voice separator: {err}"))
                .ok()
        });

    let system_plan = if system.speech_seconds() >= ENOUGH_FOR_A_CALL {
        system.pieces_by_voice(separator.as_mut())
    } else {
        Vec::new()
    };
    let mut writer = Writer {
        tm: &tm,
        rec,
        id,
        seconds_total: system.speech_seconds() + mic.speech_seconds(),
        seconds_done: 0.0,
    };
    let theirs = writer.side(&system, &system_plan, voice_label(OTHERS))?;
    let heard: usize = theirs
        .iter()
        .map(|l| l.text.split_whitespace().count())
        .sum();

    let wording = Wording::of(app);
    let person = |n: usize| wording.person(n);
    let names = Names {
        me: wording.me(),
        others: wording.others(),
        person: &person,
    };
    // Nobody on the computer's sound: maybe several people around this
    // computer. Their voices are told apart on the microphone.
    let room_plan = (heard < WORDS_FOR_A_CALL && mic.speech_seconds() >= ENOUGH_FOR_A_ROOM)
        .then(|| separator.as_mut().map(|d| mic.pieces_by_voice(Some(d))))
        .flatten()
        .filter(|plan| {
            plan.iter()
                .filter_map(|(_, v)| *v)
                .collect::<HashSet<_>>()
                .len()
                > 1
        });
    let (speakers, lines) = match room_plan {
        Some(plan) => {
            let pieces = writer.side(&mic, &plan, voice_label("v0"))?;
            transcript::cast_room(pieces, &names)
        }
        None => {
            let plan: Vec<(Span, Option<usize>)> =
                mic.pieces().into_iter().map(|p| (p, None)).collect();
            let mine = writer.side(&mic, &plan, |_| ME.to_string())?;
            transcript::cast_call(mine, theirs, &names)
        }
    };

    let count = lines.len();
    rec.update(id, |call| {
        call.speakers = speakers;
        call.lines = lines;
        call.status = CallStatus::Ready;
        call.error = None;
    });
    // The sound is not kept, only the text.
    if let Err(err) = std::fs::remove_dir_all(&folder) {
        log::warn!("calls: the tracks of {id} could not be deleted: {err}");
    }
    log::info!(
        "calls: {id} written: {count} lines from {:.0} s of sound in {:.1} s",
        mic.sound.len().max(system.sound.len()) as f64 / RATE as f64,
        began.elapsed().as_secs_f64()
    );
    Ok(())
}

/// Writes a call that has ended (or was left unfinished), then its notes.
pub fn write_call(app: &AppHandle, id: &str) {
    let Some(rec) = recorder(app) else { return };
    if rec.busy_with(id) {
        return;
    }
    rec.report_work(id, "transcript", 0.0);
    let outcome = {
        let _turn = rec.writing.lock().unwrap_or_else(|e| e.into_inner());
        put_into_words(app, &rec, id)
    };
    app.state::<Arc<TranscriptionManager>>()
        .maybe_unload_immediately("call transcript");
    rec.work_done(id);
    match outcome {
        Ok(()) => {
            let settings = get_settings(app);
            if settings.call_summary && summary::provider(&settings).is_some() {
                write_notes(app, id);
            }
        }
        Err(err) => {
            log::error!("calls: {id} could not be written: {err}");
            rec.update(id, |call| {
                call.status = CallStatus::Failed;
                call.error = Some(err);
            });
        }
    }
}

/// Asks the AI for the notes of a call (title, summary, key points, tasks).
pub fn write_notes(app: &AppHandle, id: &str) {
    let Some(rec) = recorder(app) else { return };
    let Some(call) = rec.store.get(id).ok().flatten() else {
        return;
    };
    if call.lines.is_empty() || rec.busy_with(id) {
        return;
    }
    let Some(provider) = summary::provider(&get_settings(app)) else {
        rec.update(id, |c| c.summary_error = Some("no-provider".into()));
        return;
    };
    rec.report_work(id, "summary", 0.0);
    let text = transcript::as_plain_text(&call.speakers, &call.lines);
    match tauri::async_runtime::block_on(summary::summarize(&provider, text)) {
        Ok(notes) => {
            rec.update(id, |c| {
                if !c.title_edited {
                    if let Some(title) = notes.title {
                        c.title = title;
                    }
                }
                c.summary = Some(notes.summary);
                c.key_points = notes.key_points;
                c.todos = notes.todos;
                c.summary_error = None;
            });
            log::info!(
                "calls: notes of {id} written by {}",
                provider.provider.label
            );
        }
        Err(err) => {
            log::warn!("calls: no notes for {id}: {err}");
            rec.update(id, |c| c.summary_error = Some(err));
        }
    }
    rec.work_done(id);
}
