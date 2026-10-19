//! Sound in for a recorded call: the microphone, and what the computer plays
//! (the other people), each turned into 16 kHz mono, plus the WAV files a call
//! is kept in until its transcript is written.
//!
//! The computer's sound is WASAPI's loopback: cpal opens the default output
//! device as an input and turns on `AUDCLNT_STREAMFLAGS_LOOPBACK` by itself
//! (cpal 0.16, `host/wasapi/device.rs`). WASAPI sends nothing at all while the
//! computer is silent, so the capture fills those gaps with silence against
//! the wall clock: both recordings keep the same timeline.

use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc};
use std::time::{Duration, Instant};

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{FromSample, SizedSample};
use rtrb::RingBuffer;

use crate::audio_toolkit::audio::FrameResampler;

/// Every model works on 16 kHz mono.
pub const SAMPLE_RATE: u32 = 16_000;
const RATE: usize = SAMPLE_RATE as usize;

/// Samples of silence standing for the time a device took to open.
fn lead_in(opening: Duration) -> usize {
    (opening.as_secs_f64() * RATE as f64).round() as usize
}

/// Where the sound comes from.
#[derive(Debug, Clone, PartialEq)]
pub enum Source {
    /// A microphone by name, or the default one.
    Mic(Option<String>),
    /// What the computer plays (loopback of the default output).
    System,
}

/// An open input. Dropping it (or `stop`) closes the device.
pub struct Capture {
    stop: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
    failed: Arc<AtomicBool>,
}

fn open_device(source: &Source) -> Result<(cpal::Device, cpal::SupportedStreamConfig), String> {
    let host = crate::audio_toolkit::get_cpal_host();
    match source {
        Source::Mic(name) => {
            let named = name.as_ref().and_then(|wanted| {
                host.input_devices()
                    .ok()?
                    .find(|d| d.name().map(|n| n == *wanted).unwrap_or(false))
            });
            let device = named
                .or_else(|| host.default_input_device())
                .ok_or("no microphone")?;
            let config = device.default_input_config().map_err(|e| e.to_string())?;
            Ok((device, config))
        }
        Source::System => {
            // Tests of the microphone-only fallback, without touching the devices.
            #[cfg(debug_assertions)]
            if std::env::var_os("JECOUTE_FAIL_SYSTEM_AUDIO").is_some() {
                return Err("computer sound disabled by JECOUTE_FAIL_SYSTEM_AUDIO".into());
            }
            if !cfg!(windows) {
                return Err("the computer's sound is only recorded on Windows for now".into());
            }
            let device = host.default_output_device().ok_or("no output device")?;
            // WASAPI turns an output opened for input into its loopback.
            let config = device.default_output_config().map_err(|e| e.to_string())?;
            Ok((device, config))
        }
    }
}

impl Capture {
    /// Opens `source` and calls `sink` with 16 kHz mono samples (from a
    /// capture thread, never from the audio callback). `t0` is the start of
    /// the recording: silent stretches are filled so that the samples given
    /// to `sink` always follow the wall clock from `t0`.
    pub fn start(
        source: Source,
        t0: Instant,
        mut sink: impl FnMut(&[f32]) + Send + 'static,
    ) -> Result<Capture, String> {
        let (ready_tx, ready_rx) = mpsc::channel::<Result<(), String>>();
        let stop = Arc::new(AtomicBool::new(false));
        let failed = Arc::new(AtomicBool::new(false));
        let thread_stop = stop.clone();
        let thread_failed = failed.clone();
        let label = match source {
            Source::Mic(_) => "call-mic",
            Source::System => "call-system",
        };
        let thread = std::thread::Builder::new()
            .name(label.into())
            .spawn(move || {
                let (device, config) = match open_device(&source) {
                    Ok(x) => x,
                    Err(err) => {
                        let _ = ready_tx.send(Err(err));
                        return;
                    }
                };
                let channels = config.channels().max(1) as usize;
                let in_rate = config.sample_rate().0 as usize;
                // Two seconds of mono audio at the device rate.
                let (producer, mut consumer) = RingBuffer::<f32>::new(in_rate * 2);
                let stream =
                    match build_stream(&device, &config, channels, producer, thread_failed.clone())
                    {
                        Ok(s) => s,
                        Err(err) => {
                            let _ = ready_tx.send(Err(err));
                            return;
                        }
                    };
                if let Err(err) = stream.play() {
                    let _ = ready_tx.send(Err(err.to_string()));
                    return;
                }
                log::info!(
                    "calls: {label} open ({:?}, {} Hz, {} channels)",
                    device.name().unwrap_or_default(),
                    in_rate,
                    channels
                );
                // Opening the device took a moment: the track starts with that
                // much silence, so its sample 0 is `t0`, like the other track's.
                let mut produced = lead_in(t0.elapsed());
                if produced > 0 {
                    sink(&vec![0.0; produced]);
                }
                let _ = ready_tx.send(Ok(()));

                let mut resampler = FrameResampler::new(in_rate, RATE, Duration::from_millis(20));
                let mut out: Vec<f32> = Vec::with_capacity(RATE);
                let mut last_input = Instant::now();
                let mut raw: Vec<f32> = Vec::with_capacity(in_rate);
                while !thread_stop.load(Ordering::Relaxed) {
                    std::thread::sleep(Duration::from_millis(10));
                    raw.clear();
                    let available = consumer.slots();
                    if available > 0 {
                        if let Ok(chunk) = consumer.read_chunk(available) {
                            let (a, b) = chunk.as_slices();
                            raw.extend_from_slice(a);
                            raw.extend_from_slice(b);
                            chunk.commit_all();
                        }
                    }
                    out.clear();
                    if !raw.is_empty() {
                        last_input = Instant::now();
                        resampler.push(&raw, |frame| out.extend_from_slice(frame));
                    } else if last_input.elapsed() > Duration::from_millis(250) {
                        // Nothing comes in (the loopback is silent, or the
                        // device stalled): keep up with the clock with silence.
                        let expected = (t0.elapsed().as_secs_f64() * RATE as f64) as usize;
                        let behind = expected.saturating_sub(produced + RATE / 20);
                        if behind > 0 {
                            out.resize(behind, 0.0);
                        }
                    }
                    if !out.is_empty() {
                        produced += out.len();
                        sink(&out);
                    }
                }
                drop(stream);
                // The last samples still in the resampler.
                out.clear();
                resampler.finish(|frame| out.extend_from_slice(frame));
                if !out.is_empty() {
                    sink(&out);
                }
            })
            .map_err(|e| e.to_string())?;
        match ready_rx.recv_timeout(Duration::from_secs(6)) {
            Ok(Ok(())) => Ok(Capture {
                stop,
                thread: Some(thread),
                failed,
            }),
            Ok(Err(err)) => {
                let _ = thread.join();
                Err(err)
            }
            Err(_) => {
                stop.store(true, Ordering::Relaxed);
                Err("the audio device did not answer".into())
            }
        }
    }

    /// The device reported an error (unplugged, taken over…).
    pub fn has_failed(&self) -> bool {
        self.failed.load(Ordering::Relaxed)
    }

    pub fn stop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

impl Drop for Capture {
    fn drop(&mut self) {
        self.stop();
    }
}

fn build_stream(
    device: &cpal::Device,
    config: &cpal::SupportedStreamConfig,
    channels: usize,
    producer: rtrb::Producer<f32>,
    failed: Arc<AtomicBool>,
) -> Result<cpal::Stream, String> {
    let stream_config: cpal::StreamConfig = config.clone().into();
    match config.sample_format() {
        cpal::SampleFormat::F32 => {
            typed_stream::<f32>(device, &stream_config, channels, producer, failed)
        }
        cpal::SampleFormat::I16 => {
            typed_stream::<i16>(device, &stream_config, channels, producer, failed)
        }
        cpal::SampleFormat::I32 => {
            typed_stream::<i32>(device, &stream_config, channels, producer, failed)
        }
        cpal::SampleFormat::U16 => {
            typed_stream::<u16>(device, &stream_config, channels, producer, failed)
        }
        cpal::SampleFormat::U8 => {
            typed_stream::<u8>(device, &stream_config, channels, producer, failed)
        }
        cpal::SampleFormat::I8 => {
            typed_stream::<i8>(device, &stream_config, channels, producer, failed)
        }
        other => Err(format!("unsupported sample format {other:?}")),
    }
}

fn typed_stream<T>(
    device: &cpal::Device,
    config: &cpal::StreamConfig,
    channels: usize,
    mut producer: rtrb::Producer<f32>,
    failed: Arc<AtomicBool>,
) -> Result<cpal::Stream, String>
where
    T: SizedSample + Send + 'static,
    f32: FromSample<T>,
{
    // The callback only averages the channels into the ring: no allocation,
    // no lock. What does not fit (the consumer stalled for 2 s) is dropped.
    device
        .build_input_stream::<T, _, _>(
            config,
            move |data: &[T], _| {
                for frame in data.chunks_exact(channels) {
                    let mut acc = 0.0f32;
                    for &s in frame {
                        acc += s.to_sample::<f32>();
                    }
                    let _ = producer.push(acc / channels as f32);
                }
            },
            move |err| {
                log::warn!("calls: audio stream error: {err}");
                failed.store(true, Ordering::Relaxed);
            },
            None,
        )
        .map_err(|e| e.to_string())
}

// ── Recording to disk ─────────────────────────────────────────────────────────

/// One side of a call on disk: 16 kHz mono, 16 bits. Every second of sound
/// written, the samples and the sizes in the header are pushed to the disk
/// by `append` itself (from the capture thread, which never waits for the
/// model), so a crash loses about a second of the call, never the file.
pub struct TrackFile {
    writer: hound::WavWriter<std::io::BufWriter<std::fs::File>>,
    /// Samples written since the header was last brought up to date.
    unsynced: usize,
}

/// How much sound, in samples, may wait in memory before reaching the disk.
const SYNC_EVERY: usize = RATE;

fn track_spec() -> hound::WavSpec {
    hound::WavSpec {
        channels: 1,
        sample_rate: SAMPLE_RATE,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    }
}

impl TrackFile {
    pub fn create(path: &Path) -> Result<TrackFile, String> {
        hound::WavWriter::create(path, track_spec())
            .map(|writer| TrackFile {
                writer,
                unsynced: 0,
            })
            .map_err(|e| e.to_string())
    }

    pub fn append(&mut self, samples: &[f32]) -> Result<(), String> {
        for &s in samples {
            let v = (s.clamp(-1.0, 1.0) * i16::MAX as f32).round() as i16;
            self.writer.write_sample(v).map_err(|e| e.to_string())?;
        }
        self.unsynced += samples.len();
        if self.unsynced >= SYNC_EVERY {
            self.sync()?;
        }
        Ok(())
    }

    pub fn sync(&mut self) -> Result<(), String> {
        self.unsynced = 0;
        self.writer.flush().map_err(|e| e.to_string())
    }

    pub fn close(self) -> Result<(), String> {
        self.writer.finalize().map_err(|e| e.to_string())
    }
}

/// Reads a side of a call back as samples in [-1, 1].
pub fn load_track(path: &Path) -> Result<Vec<f32>, String> {
    let mut reader = hound::WavReader::open(path).map_err(|e| e.to_string())?;
    reader
        .samples::<i16>()
        .map(|s| s.map(|v| v as f32 / 32768.0).map_err(|e| e.to_string()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_late_device_starts_with_silence() {
        assert_eq!(lead_in(Duration::ZERO), 0);
        assert_eq!(lead_in(Duration::from_millis(250)), RATE / 4);
        assert_eq!(lead_in(Duration::from_secs(2)), 2 * RATE);
    }

    #[test]
    fn a_track_reaches_the_disk_every_second_by_itself() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("system.wav");
        let mut track = TrackFile::create(&path).unwrap();
        // 2.5 s in 10 ms blocks, as the capture threads hand them over.
        for _ in 0..250 {
            track.append(&[0.1; RATE / 100]).unwrap();
        }
        // The app is killed here: nobody called `sync` or `close`.
        let back = load_track(&path).unwrap();
        assert!(back.len() >= 2 * RATE, "{} samples", back.len());
        drop(track);
    }

    #[test]
    fn a_track_survives_a_crash_after_a_sync() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("mic.wav");
        let mut track = TrackFile::create(&path).unwrap();
        track.append(&[0.0, 0.5, -0.5, 1.0]).unwrap();
        track.sync().unwrap();
        // The app dies here: the file is readable as it is.
        let back = load_track(&path).unwrap();
        assert_eq!(back.len(), 4);
        assert!((back[1] - 0.5).abs() < 1e-3 && (back[2] + 0.5).abs() < 1e-3);
        track.append(&[0.25; 6]).unwrap();
        track.close().unwrap();
        assert_eq!(load_track(&path).unwrap().len(), 10);
    }
}
