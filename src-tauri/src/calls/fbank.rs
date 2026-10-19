//! Kaldi-style log-mel filter banks (80 bands, 25 ms frames every 10 ms), the
//! input of the 3D-Speaker CAM++ voice-print model. Same settings as the
//! model's training (`torchaudio.compliance.kaldi.fbank`, no dither, povey
//! window, pre-emphasis 0.97, DC offset removed, power spectrum), then the
//! per-band mean removed over the whole stretch ("global-mean").

use rustfft::{num_complex::Complex32, FftPlanner};

const FRAME_LEN: usize = 400;
const FRAME_SHIFT: usize = 160;
const FFT_LEN: usize = 512;
pub const NUM_BINS: usize = 80;

fn mel(f: f64) -> f64 {
    1127.0 * (1.0 + f / 700.0).ln()
}

/// The 80 triangular filters over the 256 FFT bins (Kaldi's MelBanks).
fn mel_banks() -> Vec<(usize, Vec<f32>)> {
    let sample_rate = 16_000.0;
    let low = 20.0;
    let high = sample_rate / 2.0;
    let bin_width = sample_rate / FFT_LEN as f64;
    let (mel_low, mel_high) = (mel(low), mel(high));
    let delta = (mel_high - mel_low) / (NUM_BINS + 1) as f64;
    (0..NUM_BINS)
        .map(|b| {
            let left = mel_low + b as f64 * delta;
            let center = mel_low + (b + 1) as f64 * delta;
            let right = mel_low + (b + 2) as f64 * delta;
            let mut first = None;
            let mut weights = Vec::new();
            for i in 0..FFT_LEN / 2 {
                let m = mel(bin_width * i as f64);
                if m > left && m < right {
                    let w = if m <= center {
                        (m - left) / (center - left)
                    } else {
                        (right - m) / (right - center)
                    };
                    first.get_or_insert(i);
                    weights.push(w as f32);
                }
            }
            (first.unwrap_or(0), weights)
        })
        .collect()
}

/// Filter banks of 16 kHz audio, one row of 80 values per frame, the mean of
/// each band removed. Empty when the audio is shorter than one frame.
pub fn fbank(samples: &[f32]) -> Vec<[f32; NUM_BINS]> {
    if samples.len() < FRAME_LEN {
        return Vec::new();
    }
    let frames = 1 + (samples.len() - FRAME_LEN) / FRAME_SHIFT;
    let banks = mel_banks();
    let window: Vec<f32> = (0..FRAME_LEN)
        .map(|i| {
            let a = 2.0 * std::f64::consts::PI * i as f64 / (FRAME_LEN - 1) as f64;
            (0.5 - 0.5 * a.cos()).powf(0.85) as f32
        })
        .collect();
    let fft = FftPlanner::<f32>::new().plan_fft_forward(FFT_LEN);
    let mut buf = vec![Complex32::new(0.0, 0.0); FFT_LEN];
    let mut frame = [0.0f32; FRAME_LEN];
    let mut power = [0.0f32; FFT_LEN / 2 + 1];
    let mut out: Vec<[f32; NUM_BINS]> = Vec::with_capacity(frames);
    for f in 0..frames {
        let at = f * FRAME_SHIFT;
        frame.copy_from_slice(&samples[at..at + FRAME_LEN]);
        let mean = frame.iter().sum::<f32>() / FRAME_LEN as f32;
        for s in frame.iter_mut() {
            *s -= mean;
        }
        for i in (1..FRAME_LEN).rev() {
            frame[i] -= 0.97 * frame[i - 1];
        }
        frame[0] -= 0.97 * frame[0];
        for (i, c) in buf.iter_mut().enumerate() {
            *c = if i < FRAME_LEN {
                Complex32::new(frame[i] * window[i], 0.0)
            } else {
                Complex32::new(0.0, 0.0)
            };
        }
        fft.process(&mut buf);
        for (k, p) in power.iter_mut().enumerate() {
            *p = buf[k].norm_sqr();
        }
        let mut row = [0.0f32; NUM_BINS];
        for (b, (first, weights)) in banks.iter().enumerate() {
            let energy: f32 = weights
                .iter()
                .enumerate()
                .map(|(j, w)| w * power[first + j])
                .sum();
            row[b] = energy.max(f32::EPSILON).ln();
        }
        out.push(row);
    }
    let n = out.len() as f32;
    let mut means = [0.0f32; NUM_BINS];
    for row in &out {
        for (m, v) in means.iter_mut().zip(row) {
            *m += v / n;
        }
    }
    for row in out.iter_mut() {
        for (v, m) in row.iter_mut().zip(&means) {
            *v -= m;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn frames_and_bands() {
        // Half a second of a 1 kHz tone, then half a second of near silence.
        let tone: Vec<f32> = (0..16_000)
            .map(|i| {
                let a = if i < 8_000 { 0.3 } else { 0.001 };
                (2.0 * std::f32::consts::PI * 1000.0 * i as f32 / 16_000.0).sin() * a
            })
            .collect();
        let feats = fbank(&tone);
        assert_eq!(feats.len(), 1 + (16_000 - 400) / 160);
        // A 1 kHz tone lights the bands around 1 kHz, not the top ones.
        let row = feats[feats.len() / 4];
        let loudest = row
            .iter()
            .enumerate()
            .max_by(|a, b| a.1.partial_cmp(b.1).unwrap())
            .unwrap()
            .0;
        assert!((15..35).contains(&loudest), "band {loudest}");
        // The mean of each band is removed.
        let mean0: f32 = feats.iter().map(|r| r[0]).sum::<f32>() / feats.len() as f32;
        assert!(mean0.abs() < 1e-3);
        assert!(fbank(&[0.0; 100]).is_empty());
    }
}
