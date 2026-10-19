//! Who speaks when: the voice separator of the call recorder.
//!
//! Two small ONNX models, run through `ort`, the ONNX Runtime binding
//! J’écoute already ships for its ONNX speech models (a library bringing its
//! own, statically linked onnxruntime, such as sherpa-onnx, would clash):
//! - pyannote segmentation-3.0 (MIT, CNRS): in each 10 s window, up to three
//!   local voices every 17 ms (a "powerset" of 7 classes);
//! - 3D-Speaker CAM++ zh-en "advanced" (Apache-2.0, Alibaba): a voice print
//!   of each local voice.
//!
//! The voice prints are grouped (agglomerative clustering, cosine distance,
//! two voices of one window never merged), then each moment of the recording
//! goes to the voice heard there in most windows.
//!
//! The files come from Hugging Face at a pinned revision, only when the user
//! asks, and are checked against their SHA-256.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use anyhow::{anyhow, Result};
use ort::session::{builder::GraphOptimizationLevel, Session};
use ort::value::Tensor;
use sha2::{Digest, Sha256};

use super::audio::SAMPLE_RATE;
use super::fbank::{fbank, NUM_BINS};
use super::transcript::Turn;

const RATE: usize = SAMPLE_RATE as usize;

pub struct ModelFile {
    pub name: &'static str,
    url: &'static str,
    pub size: u64,
    sha256: &'static str,
}

/// About 30 MB, downloaded once.
pub static FILES: [ModelFile; 2] = [
    ModelFile {
        name: "segmentation.int8.onnx",
        url: "https://huggingface.co/csukuangfj/sherpa-onnx-pyannote-segmentation-3-0/resolve/9403a6902bb58e3d5ae8c7e77c3422de279db2e0/model.int8.onnx",
        size: 1_540_506,
        sha256: "d582f4b4c6b48205de7e0643c57df0df5615a3c176189be3fc461e9d18827b5d",
    },
    ModelFile {
        name: "embedding.onnx",
        url: "https://huggingface.co/csukuangfj/speaker-embedding-models/resolve/0743f301363dec56491a490f6d6cbc9d67f9a3bf/3dspeaker_speech_campplus_sv_zh_en_16k-common_advanced.onnx",
        size: 28_281_164,
        sha256: "aa3cfc16963a10586a9393f5035d6d6b57e98d358b347f80c2a30bf4f00ceba2",
    },
];

pub fn total_size() -> u64 {
    FILES.iter().map(|f| f.size).sum()
}

/// Every file is there with its size (the hash was checked when it came in).
pub fn is_present(dir: &Path) -> bool {
    FILES.iter().all(|f| {
        std::fs::metadata(dir.join(f.name))
            .map(|m| m.len() == f.size)
            .unwrap_or(false)
    })
}

/// Downloads what is missing, calling `progress` with the fraction done.
pub async fn download(dir: &Path, progress: impl Fn(f64)) -> Result<(), String> {
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let client = reqwest::Client::builder()
        .connect_timeout(Duration::from_secs(20))
        .read_timeout(Duration::from_secs(60))
        .user_agent(concat!("Jecoute/", env!("CARGO_PKG_VERSION")))
        .build()
        .map_err(|e| e.to_string())?;
    let total = total_size() as f64;
    let mut done: u64 = 0;
    let mut last = Instant::now();
    for file in &FILES {
        let path = dir.join(file.name);
        if std::fs::metadata(&path)
            .map(|m| m.len() == file.size)
            .unwrap_or(false)
        {
            done += file.size;
            continue;
        }
        let part = dir.join(format!("{}.part", file.name));
        let mut response = client
            .get(file.url)
            .send()
            .await
            .map_err(|e| e.to_string())?;
        if !response.status().is_success() {
            return Err(format!(
                "{}: HTTP {}",
                file.name,
                response.status().as_u16()
            ));
        }
        let mut out = std::fs::File::create(&part).map_err(|e| e.to_string())?;
        let mut hash = Sha256::new();
        let mut got: u64 = 0;
        while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
            out.write_all(&chunk).map_err(|e| e.to_string())?;
            hash.update(&chunk);
            got += chunk.len() as u64;
            if got > file.size {
                break;
            }
            if last.elapsed() > Duration::from_millis(250) {
                last = Instant::now();
                progress((done + got) as f64 / total);
            }
        }
        out.flush().map_err(|e| e.to_string())?;
        drop(out);
        let hex: String = hash.finalize().iter().map(|b| format!("{b:02x}")).collect();
        if got != file.size || hex != file.sha256 {
            let _ = std::fs::remove_file(&part);
            return Err(format!(
                "{}: the file that came in is not the expected one",
                file.name
            ));
        }
        std::fs::rename(&part, &path).map_err(|e| e.to_string())?;
        done += file.size;
        progress(done as f64 / total);
    }
    Ok(())
}

// ── The separator ─────────────────────────────────────────────────────────────

/// pyannote segmentation-3.0 as exported by sherpa-onnx: 10 s windows, one
/// frame every 270 samples, a receptive field of 991 samples.
const WINDOW: usize = 10 * RATE;
const FRAME_SHIFT: usize = 270;
const FRAME_FIELD: usize = 991;
/// Local voice of each powerset class (none, A, B, C, A+B, A+C, B+C).
const POWERSET: [&[usize]; 7] = [&[], &[0], &[1], &[2], &[0, 1], &[0, 2], &[1, 2]];
/// Two voice prints closer than this (cosine distance) are the same voice.
pub const DEFAULT_THRESHOLD: f32 = 0.6;

pub struct Diarizer {
    segmentation: Session,
    embedding: Session,
    threshold: f32,
}

fn session(path: &Path) -> Result<Session> {
    let threads = std::thread::available_parallelism()
        .map(|n| n.get().clamp(1, 4))
        .unwrap_or(2);
    Session::builder()
        .map_err(|e| anyhow!("{e}"))?
        .with_optimization_level(GraphOptimizationLevel::Level3)
        .map_err(|e| anyhow!("{e}"))?
        .with_intra_threads(threads)
        .map_err(|e| anyhow!("{e}"))?
        .commit_from_file(path)
        .map_err(|e| anyhow!("{}: {e}", path.display()))
}

/// One local voice of one window.
struct Local {
    window: usize,
    voice: usize,
    print: Vec<f32>,
    seconds: f32,
}

fn normalize(v: &mut [f32]) {
    let n = v.iter().map(|x| x * x).sum::<f32>().sqrt();
    if n > 0.0 {
        for x in v.iter_mut() {
            *x /= n;
        }
    }
}

fn cosine_distance(a: &[f32], b: &[f32]) -> f32 {
    1.0 - a.iter().zip(b).map(|(x, y)| x * y).sum::<f32>()
}

/// Average-linkage agglomerative clustering. Two prints from the same window
/// are different voices by construction and never end up together. Returns
/// the cluster of each print.
pub fn cluster(prints: &[Vec<f32>], windows: &[usize], threshold: f32) -> Vec<usize> {
    let n = prints.len();
    let mut members: Vec<Vec<usize>> = (0..n).map(|i| vec![i]).collect();
    let mut alive: Vec<bool> = vec![true; n];
    // Average distance between clusters, kept up to date on each merge
    // (Lance-Williams), and whether two clusters share a window.
    let mut dist: Vec<Vec<f32>> = (0..n)
        .map(|i| {
            (0..n)
                .map(|j| cosine_distance(&prints[i], &prints[j]))
                .collect()
        })
        .collect();
    let mut clash: Vec<Vec<bool>> = (0..n)
        .map(|i| (0..n).map(|j| i != j && windows[i] == windows[j]).collect())
        .collect();
    loop {
        let mut best: Option<(usize, usize, f32)> = None;
        for a in 0..n {
            if !alive[a] {
                continue;
            }
            for b in (a + 1)..n {
                if !alive[b] || clash[a][b] {
                    continue;
                }
                let d = dist[a][b];
                if d < threshold && best.is_none_or(|(_, _, bd)| d < bd) {
                    best = Some((a, b, d));
                }
            }
        }
        let Some((a, b, _)) = best else { break };
        let (na, nb) = (members[a].len() as f32, members[b].len() as f32);
        for k in 0..n {
            if !alive[k] || k == a || k == b {
                continue;
            }
            let d = (na * dist[a][k] + nb * dist[b][k]) / (na + nb);
            dist[a][k] = d;
            dist[k][a] = d;
            let c = clash[a][k] || clash[b][k];
            clash[a][k] = c;
            clash[k][a] = c;
        }
        let moved = std::mem::take(&mut members[b]);
        members[a].extend(moved);
        alive[b] = false;
    }
    let mut label = vec![0usize; n];
    for (c, group) in members.iter().filter(|m| !m.is_empty()).enumerate() {
        for &i in group {
            label[i] = c;
        }
    }
    label
}

impl Diarizer {
    pub fn load(dir: &Path) -> Result<Diarizer> {
        Ok(Diarizer {
            segmentation: session(&dir.join(FILES[0].name))?,
            embedding: session(&dir.join(FILES[1].name))?,
            threshold: DEFAULT_THRESHOLD,
        })
    }

    /// Local voices of one 10 s window: for each frame, which of the three
    /// local voices speak.
    fn segment(&mut self, window: &[f32]) -> Result<Vec<[bool; 3]>> {
        let input = Tensor::from_array(([1usize, 1, window.len()], window.to_vec()))
            .map_err(|e| anyhow!("{e}"))?;
        let outputs = self
            .segmentation
            .run(ort::inputs![input])
            .map_err(|e| anyhow!("{e}"))?;
        let (shape, data) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| anyhow!("{e}"))?;
        let classes = *shape.last().unwrap_or(&7) as usize;
        if classes != POWERSET.len() {
            return Err(anyhow!("unexpected segmentation output {shape:?}"));
        }
        Ok(data
            .chunks_exact(classes)
            .map(|row| {
                let best = row
                    .iter()
                    .enumerate()
                    .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
                    .map(|(i, _)| i)
                    .unwrap_or(0);
                let mut active = [false; 3];
                for &v in POWERSET[best] {
                    active[v] = true;
                }
                active
            })
            .collect())
    }

    /// The voice print of a stretch of audio (L2-normalized).
    fn print(&mut self, samples: &[f32]) -> Result<Vec<f32>> {
        let feats = fbank(samples);
        if feats.is_empty() {
            return Err(anyhow!("too short"));
        }
        let frames = feats.len();
        let flat: Vec<f32> = feats.into_iter().flatten().collect();
        let input =
            Tensor::from_array(([1usize, frames, NUM_BINS], flat)).map_err(|e| anyhow!("{e}"))?;
        let outputs = self
            .embedding
            .run(ort::inputs![input])
            .map_err(|e| anyhow!("{e}"))?;
        let (_, data) = outputs[0]
            .try_extract_tensor::<f32>()
            .map_err(|e| anyhow!("{e}"))?;
        let mut v = data.to_vec();
        normalize(&mut v);
        Ok(v)
    }

    /// The voices of a recording, as turns with voices 0, 1… Empty when it
    /// can't tell (too short, nobody speaks).
    pub fn diarize(&mut self, samples: &[f32]) -> Result<Vec<Turn>> {
        if samples.len() < RATE * 2 {
            return Ok(Vec::new());
        }
        let started = Instant::now();
        // Half-overlapping windows; a long call steps a full window to stay quick.
        let step = if samples.len() > 20 * 60 * RATE {
            WINDOW
        } else {
            WINDOW / 2
        };
        let mut starts = Vec::new();
        let mut at = 0;
        loop {
            starts.push(at);
            if at + WINDOW >= samples.len() {
                break;
            }
            at += step;
        }
        let mut activity: Vec<Vec<[bool; 3]>> = Vec::with_capacity(starts.len());
        let mut locals: Vec<Local> = Vec::new();
        let mut window = vec![0.0f32; WINDOW];
        for (w, &start) in starts.iter().enumerate() {
            let end = (start + WINDOW).min(samples.len());
            window.fill(0.0);
            window[..end - start].copy_from_slice(&samples[start..end]);
            let frames = self.segment(&window)?;
            // Each local voice: its audio where it speaks alone (or with others
            // when it never speaks alone long enough).
            for voice in 0..3 {
                let mut alone: Vec<f32> = Vec::new();
                let mut any: Vec<f32> = Vec::new();
                for (f, act) in frames.iter().enumerate() {
                    if !act[voice] {
                        continue;
                    }
                    let a = (f * FRAME_SHIFT + FRAME_FIELD / 2).saturating_sub(FRAME_SHIFT / 2);
                    let b = (a + FRAME_SHIFT).min(end - start);
                    if a >= b {
                        continue;
                    }
                    any.extend_from_slice(&window[a..b]);
                    if act.iter().filter(|x| **x).count() == 1 {
                        alone.extend_from_slice(&window[a..b]);
                    }
                }
                let audio = if alone.len() >= RATE / 2 { alone } else { any };
                if audio.len() < RATE * 2 / 5 {
                    continue;
                }
                match self.print(&audio) {
                    Ok(print) => locals.push(Local {
                        window: w,
                        voice,
                        print,
                        seconds: audio.len() as f32 / RATE as f32,
                    }),
                    Err(err) => log::debug!("calls: voice print skipped: {err}"),
                }
            }
            activity.push(frames);
        }
        if locals.is_empty() {
            return Ok(Vec::new());
        }
        let prints: Vec<Vec<f32>> = locals.iter().map(|l| l.print.clone()).collect();
        let windows: Vec<usize> = locals.iter().map(|l| l.window).collect();
        let mut labels = cluster(&prints, &windows, self.threshold);
        // A voice heard less than a second in all is folded into the nearest one.
        let count = labels.iter().copied().max().unwrap_or(0) + 1;
        let seconds: Vec<f32> = (0..count)
            .map(|c| {
                locals
                    .iter()
                    .zip(&labels)
                    .filter(|(_, l)| **l == c)
                    .map(|(x, _)| x.seconds)
                    .sum()
            })
            .collect();
        if count > 1 {
            let centroid = |c: usize| -> Vec<f32> {
                let mut v = vec![0.0f32; prints[0].len()];
                for (p, _) in prints.iter().zip(&labels).filter(|(_, l)| **l == c) {
                    for (a, b) in v.iter_mut().zip(p) {
                        *a += b;
                    }
                }
                normalize(&mut v);
                v
            };
            let big: Vec<usize> = (0..count).filter(|&c| seconds[c] >= 1.0).collect();
            if !big.is_empty() {
                let centroids: Vec<Vec<f32>> = (0..count).map(centroid).collect();
                for label in labels.iter_mut() {
                    if seconds[*label] < 1.0 {
                        let nearest = big
                            .iter()
                            .min_by(|&&a, &&b| {
                                cosine_distance(&centroids[*label], &centroids[a])
                                    .partial_cmp(&cosine_distance(
                                        &centroids[*label],
                                        &centroids[b],
                                    ))
                                    .unwrap_or(std::cmp::Ordering::Equal)
                            })
                            .copied()
                            .unwrap_or(*label);
                        *label = nearest;
                    }
                }
            }
        }
        // Each global frame: votes of every window covering it.
        let total_frames = samples.len() / FRAME_SHIFT + 1;
        let voices = labels.iter().copied().max().unwrap_or(0) + 1;
        let mut votes = vec![vec![0u16; voices]; total_frames];
        let mut covered = vec![0u16; total_frames];
        let mut speech = vec![0u16; total_frames];
        let mut local_label: Vec<[Option<usize>; 3]> = vec![[None; 3]; activity.len()];
        for (local, &label) in locals.iter().zip(&labels) {
            local_label[local.window][local.voice] = Some(label);
        }
        for (w, frames) in activity.iter().enumerate() {
            let start = starts[w];
            let end = (start + WINDOW).min(samples.len());
            for (f, act) in frames.iter().enumerate() {
                let at = start + f * FRAME_SHIFT + FRAME_FIELD / 2;
                if at >= end {
                    break;
                }
                let g = at / FRAME_SHIFT;
                if g >= total_frames {
                    break;
                }
                covered[g] += 1;
                if act.iter().any(|x| *x) {
                    speech[g] += 1;
                }
                for (voice, &on) in act.iter().enumerate() {
                    if !on {
                        continue;
                    }
                    if let Some(label) = local_label[w][voice] {
                        votes[g][label] += 1;
                    }
                }
            }
        }
        let frame_seconds = FRAME_SHIFT as f64 / RATE as f64;
        let mut turns: Vec<Turn> = Vec::new();
        for g in 0..total_frames {
            if covered[g] == 0 || speech[g] * 2 < covered[g] {
                continue;
            }
            let Some((voice, &n)) = votes[g].iter().enumerate().max_by_key(|(_, n)| **n) else {
                continue;
            };
            if n == 0 {
                continue;
            }
            let t = g as f64 * frame_seconds;
            match turns.last_mut() {
                Some(last) if last.speaker == voice && t - last.end < 0.5 => {
                    last.end = t + frame_seconds
                }
                _ => turns.push(Turn {
                    speaker: voice,
                    start: t,
                    end: t + frame_seconds,
                }),
            }
        }
        turns.retain(|t| t.end - t.start >= 0.2);
        // Number the voices in the order they first speak.
        let mut order: Vec<usize> = Vec::new();
        for t in &turns {
            if !order.contains(&t.speaker) {
                order.push(t.speaker);
            }
        }
        for t in turns.iter_mut() {
            t.speaker = order.iter().position(|&v| v == t.speaker).unwrap_or(0);
        }
        log::info!(
            "calls: {} voices in {:.0} s of audio ({} windows, {} prints) in {:.1} s",
            order.len(),
            samples.len() as f64 / RATE as f64,
            starts.len(),
            locals.len(),
            started.elapsed().as_secs_f64()
        );
        Ok(turns)
    }
}

/// Where the separator's files live.
pub fn models_dir(app_data: &Path) -> PathBuf {
    app_data.join("models").join("voice-separation")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_download_is_small_and_pinned() {
        assert!(total_size() < 40_000_000);
        for f in &FILES {
            assert_eq!(f.sha256.len(), 64, "{}", f.name);
            assert!(f.url.starts_with("https://huggingface.co/"), "{}", f.name);
            assert!(f.url.contains("/resolve/"), "{}", f.name);
        }
    }

    #[test]
    fn two_voices_of_one_window_are_never_merged() {
        let a = vec![1.0, 0.0];
        let a2 = vec![0.99, 0.141];
        let b = vec![0.0, 1.0];
        let prints = vec![a.clone(), a2.clone(), b.clone(), a];
        // 0 and 1 are close but in the same window: kept apart.
        let windows = vec![0, 0, 1, 2];
        let labels = cluster(&prints, &windows, 0.6);
        assert_ne!(labels[0], labels[1]);
        assert_ne!(labels[0], labels[2]);
        // The print of window 2 joins one of the "a" voices.
        assert!(labels[3] == labels[0] || labels[3] == labels[1]);
    }

    /// With the models and a recording: `JECOUTE_DIARIZE_WAV=… JECOUTE_DIARIZE_MODELS=…
    /// cargo test -- --ignored diarize_a_recording --nocapture`.
    #[test]
    #[ignore]
    fn diarize_a_recording() {
        let wav = std::env::var("JECOUTE_DIARIZE_WAV").expect("JECOUTE_DIARIZE_WAV");
        let dir = std::env::var("JECOUTE_DIARIZE_MODELS").expect("JECOUTE_DIARIZE_MODELS");
        let samples = crate::audio_toolkit::read_wav_samples(&wav).expect("16 kHz mono wav");
        let mut d = Diarizer::load(Path::new(&dir)).unwrap();
        let turns = d.diarize(&samples).unwrap();
        for t in &turns {
            println!("{:>7.2} {:>7.2}  voice {}", t.start, t.end, t.speaker);
        }
        assert!(!turns.is_empty());
    }
}
