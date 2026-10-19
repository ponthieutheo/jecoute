//! Cutting a call into pieces the model transcribes one by one: the stretches
//! where someone speaks, split at the pauses (1.4 s, the line rule), never
//! longer than the model takes at once, and split again where the voice
//! changes. Each piece keeps its place in the recording, which gives every
//! line of the transcript its time, whatever the model (Cohere, for one, has
//! no timestamps).

use super::audio::SAMPLE_RATE;
use super::transcript::{Turn, PAUSE};

const RATE: usize = SAMPLE_RATE as usize;
/// Earshot works on 16 ms frames.
const FRAME: usize = 256;
/// A frame counts as speech above this Earshot score…
const VOICE_SCORE: f32 = 0.5;
/// …and when it is not near-silent (Earshot alone can fire on hiss).
const MIN_RMS: f32 = 0.004;
/// Longest piece given to the model at once (whisper-family models take 30 s).
pub const MAX_PIECE_SECONDS: f64 = 28.0;

/// A stretch of the recording, in samples.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Span {
    pub start: usize,
    pub end: usize,
}

impl Span {
    pub fn len(&self) -> usize {
        self.end - self.start
    }

    pub fn seconds(&self) -> (f64, f64) {
        (
            self.start as f64 / RATE as f64,
            self.end as f64 / RATE as f64,
        )
    }
}

/// Which 16 ms frames hold speech.
pub fn voiced_frames(samples: &[f32]) -> Vec<bool> {
    let mut detector = earshot::Detector::default_boxed();
    let mut frame = [0.0f32; FRAME];
    samples
        .chunks(FRAME)
        .map(|chunk| {
            frame.fill(0.0);
            for (dst, &src) in frame.iter_mut().zip(chunk) {
                *dst = if src.is_finite() {
                    src.clamp(-1.0, 1.0)
                } else {
                    0.0
                };
            }
            let rms = (frame.iter().map(|s| s * s).sum::<f32>() / FRAME as f32).sqrt();
            let score = detector.predict_f32(&frame);
            score >= VOICE_SCORE && rms >= MIN_RMS
        })
        .collect()
}

/// The stretches where someone speaks: voiced frames closer than the pause
/// make one stretch, a little margin is kept around, and stretches with almost
/// no speech are dropped.
pub fn speech_spans(samples: &[f32]) -> Vec<Span> {
    let voiced = voiced_frames(samples);
    let pause_frames = (PAUSE * RATE as f64 / FRAME as f64) as usize;
    let min_voiced = (0.25 * RATE as f64 / FRAME as f64) as usize;
    let mut spans: Vec<(usize, usize, usize)> = Vec::new(); // first, last, voiced count
    for (i, &v) in voiced.iter().enumerate() {
        if !v {
            continue;
        }
        match spans.last_mut() {
            Some((_, last, count)) if i - *last <= pause_frames => {
                *last = i;
                *count += 1;
            }
            _ => spans.push((i, i, 1)),
        }
    }
    let before = RATE / 4;
    let after = RATE * 3 / 10;
    let mut out: Vec<Span> = Vec::new();
    for (first, last, count) in spans {
        if count < min_voiced {
            continue;
        }
        let mut start = (first * FRAME).saturating_sub(before);
        let end = ((last + 1) * FRAME + after).min(samples.len());
        if let Some(prev) = out.last() {
            start = start.max(prev.end);
        }
        if end > start {
            out.push(Span { start, end });
        }
    }
    out
}

/// Where to end a piece that must stop before `limit`: in the middle of the
/// longest silent run of frames found in the last 6 s before it, or, when
/// nobody pauses, on the 16 ms frame with the least energy.
fn cut_point(samples: &[f32], from: usize, limit: usize) -> usize {
    let zone_start = limit.saturating_sub(6 * RATE).max(from + RATE);
    if zone_start + FRAME >= limit {
        return limit;
    }
    let zone = &samples[zone_start..limit];
    let voiced = voiced_frames(zone);
    // Longest silent run (first frame, length).
    let mut best_run = (0usize, 0usize);
    let mut run_start = None;
    for (i, &v) in voiced.iter().chain(std::iter::once(&true)).enumerate() {
        match (v, run_start) {
            (false, None) => run_start = Some(i),
            (true, Some(s)) => {
                if i - s > best_run.1 {
                    best_run = (s, i - s);
                }
                run_start = None;
            }
            _ => {}
        }
    }
    if best_run.1 >= 3 {
        let middle = best_run.0 * FRAME + best_run.1 * FRAME / 2;
        return (zone_start + middle).min(limit);
    }
    let quietest = zone
        .chunks(FRAME)
        .enumerate()
        .map(|(i, f)| (i, f.iter().map(|s| s * s).sum::<f32>()))
        .min_by(|a, b| a.1.total_cmp(&b.1))
        .map_or(0, |(i, _)| i);
    (zone_start + quietest * FRAME + FRAME / 2).min(limit)
}

/// Cuts a span the model can't take at once into pieces of at most
/// `max_seconds`, each ending where nobody speaks if possible.
pub fn split_long(samples: &[f32], span: Span, max_seconds: f64) -> Vec<Span> {
    let max = (max_seconds * RATE as f64) as usize;
    let mut pieces = Vec::new();
    let mut from = span.start;
    while span.end - from > max {
        let to = cut_point(samples, from, from + max);
        pieces.push(Span {
            start: from,
            end: to,
        });
        from = to;
    }
    if span.end > from {
        pieces.push(Span {
            start: from,
            end: span.end,
        });
    }
    pieces
}

fn speaker_at(turns: &[Turn], t: f64) -> Option<usize> {
    // The voice speaking at that moment; with two at once, the one whose turn
    // started last (the one cutting in).
    let mut best: Option<&Turn> = None;
    for turn in turns {
        if t >= turn.start && t <= turn.end && best.is_none_or(|b| turn.start > b.start) {
            best = Some(turn);
        }
    }
    if let Some(b) = best {
        return Some(b.speaker);
    }
    // Otherwise the nearest one, within 1.5 s.
    turns
        .iter()
        .map(|turn| {
            let d = if t < turn.start {
                turn.start - t
            } else {
                t - turn.end
            };
            (d, turn.speaker)
        })
        .filter(|(d, _)| *d < 1.5)
        .min_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(_, s)| s)
}

/// Splits each span where the voice changes, and gives each part its voice
/// (None when the separator found nobody near it). Parts shorter than 0.6 s
/// go to their neighbour.
pub fn split_by_voice(spans: &[Span], turns: &[Turn]) -> Vec<(Span, Option<usize>)> {
    let step = RATE / 10;
    let min_part = RATE * 6 / 10;
    let mut out = Vec::new();
    for span in spans {
        // The voice every 100 ms.
        let mut runs: Vec<(usize, usize, Option<usize>)> = Vec::new();
        let mut at = span.start;
        while at < span.end {
            let next = (at + step).min(span.end);
            let mid = (at + next) as f64 / 2.0 / RATE as f64;
            let who = speaker_at(turns, mid);
            match runs.last_mut() {
                Some((_, end, w)) if *w == who || who.is_none() => *end = next,
                _ => runs.push((at, next, who)),
            }
            at = next;
        }
        // Short runs join the run before (or after, for the first one).
        let mut merged: Vec<(usize, usize, Option<usize>)> = Vec::new();
        for run in runs {
            match merged.last_mut() {
                Some(last) if run.1 - run.0 < min_part || last.2 == run.2 => last.1 = run.1,
                Some(last) if last.1 - last.0 < min_part => {
                    last.1 = run.1;
                    last.2 = run.2;
                }
                _ => merged.push(run),
            }
        }
        for (start, end, who) in merged {
            out.push((Span { start, end }, who));
        }
    }
    out
}

// ── Hearing the echo ─────────────────────────────────────────────────────────

/// Loudness is compared on 20 ms frames.
const ENV_FRAME: usize = RATE / 50;
/// Quieter than this (dB) is silence.
const ENV_FLOOR_DB: f32 = -60.0;
/// The echo reaches the microphone up to 300 ms after the computer played it
/// (or 100 ms before, two devices never quite agree on the time).
const ENV_LAG_AFTER: isize = 15;
const ENV_LAG_BEFORE: isize = 5;
/// Correlation of the two loudness curves above which they are one sound.
const ENV_MATCH: f32 = 0.5;
/// Shortest stretch, in frames, worth comparing (0.5 s).
const ENV_MIN_FRAMES: usize = 25;

/// Loudness in dB of `count` frames of `samples` from frame `first` (frames
/// before the start or past the end are silence).
fn loudness(samples: &[f32], first: isize, count: usize) -> Vec<f32> {
    (0..count as isize)
        .map(|i| {
            let at = first + i;
            if at < 0 {
                return ENV_FLOOR_DB;
            }
            let from = at as usize * ENV_FRAME;
            let Some(frame) = samples.get(from..from + ENV_FRAME) else {
                return ENV_FLOOR_DB;
            };
            let power = frame.iter().map(|s| s * s).sum::<f32>() / ENV_FRAME as f32;
            (10.0 * power.max(1e-12).log10()).max(ENV_FLOOR_DB)
        })
        .collect()
}

fn correlation(a: &[f32], b: &[f32]) -> f32 {
    let n = a.len().min(b.len()) as f32;
    if n < 2.0 {
        return 0.0;
    }
    let mean_a = a.iter().sum::<f32>() / n;
    let mean_b = b.iter().sum::<f32>() / n;
    let (mut ab, mut aa, mut bb) = (0.0f32, 0.0f32, 0.0f32);
    for (x, y) in a.iter().zip(b) {
        let (x, y) = (x - mean_a, y - mean_b);
        ab += x * y;
        aa += x * x;
        bb += y * y;
    }
    if aa <= f32::EPSILON || bb <= f32::EPSILON {
        return 0.0;
    }
    ab / (aa * bb).sqrt()
}

/// Whether, between `start` and `end` (seconds), the microphone's loudness
/// rises and falls with the computer's sound, a little later: the microphone
/// then hears the speakers. False when the computer was silent there. True
/// when the stretch is too short to tell (the words decide alone).
pub fn sounds_alike(mic: &[f32], system: &[f32], start: f64, end: f64) -> bool {
    let first = (start.max(0.0) * RATE as f64) as usize / ENV_FRAME;
    let last = ((end.max(0.0) * RATE as f64) as usize).min(mic.len()) / ENV_FRAME;
    let count = last.saturating_sub(first);
    if count < ENV_MIN_FRAMES {
        return true;
    }
    let heard = loudness(mic, first as isize, count);
    let played = loudness(
        system,
        first as isize - ENV_LAG_AFTER,
        count + (ENV_LAG_AFTER + ENV_LAG_BEFORE) as usize,
    );
    if played.iter().all(|db| *db <= ENV_FLOOR_DB + 10.0) {
        return false;
    }
    // `played[k]` is the computer's frame `first - ENV_LAG_AFTER + k`: the
    // microphone's frame `first + i` heard it `lag` frames later.
    let best = (-ENV_LAG_BEFORE..=ENV_LAG_AFTER)
        .map(|lag| {
            let offset = (ENV_LAG_AFTER - lag) as usize;
            correlation(&heard, &played[offset..offset + count])
        })
        .fold(f32::MIN, f32::max);
    best >= ENV_MATCH
}

/// The sound of one side not yet sent to the live transcript. A stretch is
/// handed over once someone stops talking for half a second (when it holds
/// 1.5 s or more), or when it reaches 12 s without a break.
pub struct LiveCutter {
    detector: Box<earshot::Detector>,
    frame: Vec<f32>,
    buffer: Vec<f32>,
    /// Where `buffer` starts, in samples from the start of the recording.
    buffer_start: usize,
    /// Samples since the last voiced frame.
    quiet: usize,
    voiced: usize,
}

impl Default for LiveCutter {
    fn default() -> Self {
        Self {
            detector: earshot::Detector::default_boxed(),
            frame: Vec::with_capacity(FRAME),
            buffer: Vec::new(),
            buffer_start: 0,
            quiet: 0,
            voiced: 0,
        }
    }
}

impl LiveCutter {
    pub fn push(&mut self, samples: &[f32]) {
        for &s in samples {
            self.frame.push(if s.is_finite() {
                s.clamp(-1.0, 1.0)
            } else {
                0.0
            });
            if self.frame.len() == FRAME {
                let rms = (self.frame.iter().map(|s| s * s).sum::<f32>() / FRAME as f32).sqrt();
                let voiced =
                    self.detector.predict_f32(&self.frame) >= VOICE_SCORE && rms >= MIN_RMS;
                self.buffer.extend_from_slice(&self.frame);
                self.frame.clear();
                if voiced {
                    self.voiced += FRAME;
                    self.quiet = 0;
                } else {
                    self.quiet += FRAME;
                }
            }
        }
    }

    /// A stretch ending on a pause (or a long one), with its start in seconds.
    /// Stretches without speech are dropped.
    pub fn take(&mut self) -> Option<(f64, Vec<f32>)> {
        if self.buffer.len() < RATE * 3 / 2 {
            return None;
        }
        if self.quiet < RATE / 2 && self.buffer.len() < RATE * 12 {
            return None;
        }
        let start = self.buffer_start as f64 / RATE as f64;
        let chunk = std::mem::take(&mut self.buffer);
        self.buffer_start += chunk.len();
        let voiced = std::mem::take(&mut self.voiced);
        if voiced < RATE * 3 / 10 {
            return None;
        }
        Some((start, chunk))
    }
}

/// Test sound: noise shaped like speech (bursts of 120 to 300 ms, each
/// with its own loudness, and short gaps).
#[cfg(test)]
pub(crate) fn babble(seed: u64, seconds: f64) -> Vec<f32> {
    let mut state = seed;
    let mut next = move || {
        state = state
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        ((state >> 33) as f32 / (1u64 << 31) as f32) * 2.0 - 1.0
    };
    let total = (RATE as f64 * seconds) as usize;
    let mut out = Vec::with_capacity(total);
    while out.len() < total {
        let burst = RATE / 1000 * (120 + (next().abs() * 180.0) as usize);
        let level = 0.05 + next().abs() * 0.3;
        out.extend((0..burst).map(|_| next() * level));
        let gap = RATE / 1000 * (30 + (next().abs() * 120.0) as usize);
        out.extend((0..gap).map(|_| next() * 0.002));
    }
    out.truncate(total);
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tone(freq: f64, seconds: f64) -> Vec<f32> {
        (0..(RATE as f64 * seconds) as usize)
            .map(|i| {
                (2.0 * std::f64::consts::PI * freq * i as f64 / RATE as f64).sin() as f32 * 0.5
            })
            .collect()
    }

    #[test]
    fn long_audio_is_cut_in_the_quiet() {
        let mut samples = tone(300.0, 25.0);
        samples.extend(vec![0.0; RATE]); // a pause from 25 s to 26 s
        samples.extend(tone(300.0, 20.0));
        let parts = split_long(
            &samples,
            Span {
                start: 0,
                end: samples.len(),
            },
            28.0,
        );
        assert_eq!(parts.len(), 2);
        let cut = parts[1].start as f64 / RATE as f64;
        assert!((25.0..=26.0).contains(&cut), "cut at {cut}");
        assert_eq!(parts.iter().map(|p| p.len()).sum::<usize>(), samples.len());
    }

    #[test]
    fn a_span_is_split_where_the_voice_changes() {
        let span = Span {
            start: 0,
            end: RATE * 10,
        };
        let turns = [
            Turn {
                speaker: 0,
                start: 0.0,
                end: 4.0,
            },
            Turn {
                speaker: 1,
                start: 4.2,
                end: 10.0,
            },
            // A blip that should not make its own part.
            Turn {
                speaker: 2,
                start: 7.0,
                end: 7.2,
            },
        ];
        let parts = split_by_voice(&[span], &turns);
        assert_eq!(parts.len(), 2, "{parts:?}");
        assert_eq!(parts[0].1, Some(0));
        assert_eq!(parts[1].1, Some(1));
        let cut = parts[1].0.start as f64 / RATE as f64;
        assert!((3.9..=4.3).contains(&cut), "cut at {cut}");
        assert_eq!(parts[1].0.end, RATE * 10);
    }

    #[test]
    fn the_echo_is_heard_and_another_voice_is_not() {
        let played = babble(1, 6.0);
        // The speakers, 40 ms later and quieter, plus the room's hiss.
        let delay = RATE * 40 / 1000;
        let hiss = babble(9, 6.0);
        let echo: Vec<f32> = (0..played.len())
            .map(|i| {
                let late = i.checked_sub(delay).map_or(0.0, |j| played[j]);
                late * 0.3 + hiss[i] * 0.01
            })
            .collect();
        assert!(sounds_alike(&echo, &played, 1.0, 5.0));
        // Someone else, on the microphone, while the computer plays.
        let other = babble(2, 6.0);
        assert!(!sounds_alike(&other, &played, 1.0, 5.0));
        // The computer silent: nothing to echo.
        assert!(!sounds_alike(&other, &vec![0.0; played.len()], 1.0, 5.0));
    }

    #[test]
    fn silence_has_no_speech() {
        assert!(speech_spans(&vec![0.0; RATE * 5]).is_empty());
        let mut live = LiveCutter::default();
        live.push(&vec![0.0; RATE * 3]);
        assert!(live.take().is_none());
        // The silence was consumed: the next stretch starts at 3 s.
        live.push(&vec![0.0; RATE * 2]);
        assert!(live.take().is_none());
        // Whole 16 ms frames only: within one frame of 5 s.
        assert!(RATE * 5 - live.buffer_start < 256);
    }
}
