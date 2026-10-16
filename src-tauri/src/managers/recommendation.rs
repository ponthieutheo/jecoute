//! Language-aware ordering of the model list.
//!
//! The bundled catalog ranks models for an English speaker (its top pick is an
//! English-only model). This module reorders the registry for the *system*
//! language instead, generically for any language:
//!
//! 1. With a usable GPU, the most accurate curated model that handles the
//!    language comes first.
//! 2. Then the most accurate curated *light* model (≤ [`LIGHT_MODEL_MAX_MB`])
//!    that handles the language without configuration: it detects the language
//!    itself, or that language is the only one it knows.
//! 3. Then every other model that handles the language, in the editorial order;
//!    then models with no declared languages (custom files); then the models
//!    that cannot transcribe the language at all.
//!
//! `is_recommended` is recomputed to match: the two picks, plus the catalog's
//! curated recommendations that handle the language. A language no curated
//! model handles falls back to English, like transcription itself does.

use super::model::{find_supported_language, ModelInfo};
use std::cmp::Ordering;

/// Upper bound for the "light" pick (MB), so it stays a quick download that
/// runs well without a GPU.
pub const LIGHT_MODEL_MAX_MB: u64 = 1024;

const FALLBACK_LANGUAGE: &str = "en";

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
enum LanguageFit {
    Supported,
    /// No declared languages (custom/unprobed files): can't tell.
    Unknown,
    Unsupported,
}

fn language_fit(model: &ModelInfo, language: &str) -> LanguageFit {
    if model.supported_languages.is_empty() {
        LanguageFit::Unknown
    } else if find_supported_language(&model.supported_languages, language).is_some() {
        LanguageFit::Supported
    } else {
        LanguageFit::Unsupported
    }
}

/// Handles `language` with the language setting left on "auto": the model
/// detects the spoken language, or `language` is the only one it knows.
fn zero_config_for(model: &ModelInfo, language: &str) -> bool {
    model.supports_language_detection
        || model
            .supported_languages
            .iter()
            .all(|code| find_supported_language(std::slice::from_ref(code), language).is_some())
}

/// The editorial order the catalog defines (rank, then curated, then scores).
fn editorial_cmp(a: &ModelInfo, b: &ModelInfo, rank_of: &impl Fn(&str) -> u32) -> Ordering {
    rank_of(&a.id)
        .cmp(&rank_of(&b.id))
        .then((!a.is_recommended).cmp(&(!b.is_recommended)))
        .then(b.accuracy_score.total_cmp(&a.accuracy_score))
        .then(b.speed_score.total_cmp(&a.speed_score))
        .then_with(|| a.name.cmp(&b.name))
}

/// Most accurate model among `candidates` (already in editorial order, so the
/// first one wins a tie).
fn most_accurate<'a>(candidates: impl Iterator<Item = &'a ModelInfo>) -> Option<&'a ModelInfo> {
    candidates.fold(None, |best: Option<&ModelInfo>, model| match best {
        Some(b) if b.accuracy_score >= model.accuracy_score => Some(b),
        _ => Some(model),
    })
}

/// Sort `models` for a speaker of `system_language` and recompute
/// `is_recommended`. `rank_of` gives the catalog's editorial rank (`u32::MAX`
/// for models outside the curated set); only curated models can be picked.
/// On entry `is_recommended` carries the catalog's curated flag.
pub fn order_for_language(
    models: &mut [ModelInfo],
    system_language: Option<&str>,
    gpu_usable: bool,
    rank_of: impl Fn(&str) -> u32,
) {
    models.sort_by(|a, b| editorial_cmp(a, b, &rank_of));

    let is_curated = |m: &ModelInfo| rank_of(&m.id) != u32::MAX;
    let curated_support = |language: &str| {
        models
            .iter()
            .any(|m| is_curated(m) && language_fit(m, language) == LanguageFit::Supported)
    };
    let language = match system_language {
        Some(lang) if curated_support(lang) => lang,
        _ => FALLBACK_LANGUAGE,
    };

    let candidates = || {
        models
            .iter()
            .filter(|m| is_curated(m) && language_fit(m, language) == LanguageFit::Supported)
    };
    let accurate_id = if gpu_usable {
        most_accurate(candidates()).map(|m| m.id.clone())
    } else {
        None
    };
    let light_id = most_accurate(candidates().filter(|m| {
        Some(&m.id) != accurate_id.as_ref()
            && m.size_mb <= LIGHT_MODEL_MAX_MB
            && zero_config_for(m, language)
    }))
    .map(|m| m.id.clone());

    let pick_position = |m: &ModelInfo| {
        if Some(&m.id) == accurate_id.as_ref() {
            0
        } else if Some(&m.id) == light_id.as_ref() {
            1
        } else {
            2
        }
    };
    // Stable sort: the editorial order survives inside each group.
    models.sort_by_key(|m| (pick_position(m), language_fit(m, language)));

    for model in models.iter_mut() {
        let fit = language_fit(model, language);
        model.is_recommended = pick_position(model) < 2
            || (model.is_recommended && is_curated(model) && fit == LanguageFit::Supported);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::managers::model::{DiskStatus, EngineType, ModelSource};

    fn model(id: &str, languages: &[&str], detect: bool, size_mb: u64, accuracy: f32) -> ModelInfo {
        ModelInfo {
            id: id.to_string(),
            name: id.to_string(),
            description: String::new(),
            filename: format!("{id}.gguf"),
            source: ModelSource::HuggingFace {
                repo_id: format!("org/{id}"),
                revision: "main".to_string(),
            },
            size_mb,
            is_downloaded: false,
            is_downloading: false,
            partial_size: 0,
            is_directory: false,
            engine_type: EngineType::TranscribeCpp,
            accuracy_score: accuracy,
            speed_score: 0.5,
            supports_translation: false,
            is_recommended: false,
            supported_languages: languages.iter().map(|l| l.to_string()).collect(),
            supports_language_selection: languages.len() > 1,
            is_custom: false,
            supports_streaming: false,
            supports_language_detection: detect,
        }
    }

    const EU: &[&str] = &["en", "fr", "de", "es", "it", "pt", "nl", "pl", "ru", "uk"];
    const COHERE: &[&str] = &[
        "en", "fr", "de", "es", "it", "pt", "nl", "pl", "el", "ar", "ja", "zh", "vi", "ko",
    ];

    /// A miniature of the bundled catalog: (model, editorial rank, curated).
    fn fixture() -> (Vec<ModelInfo>, Vec<(&'static str, u32)>) {
        let mut english = model("parakeet-unified-en", &["en"], false, 700, 0.90);
        english.is_recommended = true;
        let mut nemotron = model("nemotron", EU, true, 715, 0.82);
        nemotron.is_recommended = true;
        let mut canary = model("canary-180m", &["en", "de", "es", "fr"], false, 210, 0.88);
        canary.is_recommended = true;
        let mut cohere = model("cohere", COHERE, false, 1688, 0.92);
        cohere.is_recommended = true;
        let parakeet_v3 = model("parakeet-v3", EU, true, 705, 0.88);
        let english_v2 = model("parakeet-v2", &["en"], false, 700, 0.89);
        let huge = model("voxtral-24b", EU, true, 16_000, 0.95); // not curated
        let custom = model("my-custom", &[], false, 300, 0.0);
        let ranks = vec![
            ("parakeet-unified-en", 1),
            ("nemotron", 2),
            ("canary-180m", 3),
            ("cohere", 4),
            ("parakeet-v3", 7),
            ("parakeet-v2", 8),
        ];
        (
            vec![
                huge,
                custom,
                english_v2,
                parakeet_v3,
                cohere,
                canary,
                nemotron,
                english,
            ],
            ranks,
        )
    }

    fn ordered(language: Option<&str>, gpu: bool) -> Vec<ModelInfo> {
        let (mut models, ranks) = fixture();
        order_for_language(&mut models, language, gpu, |id| {
            ranks
                .iter()
                .find(|(r, _)| *r == id)
                .map(|(_, rank)| *rank)
                .unwrap_or(u32::MAX)
        });
        models
    }

    fn ids(models: &[ModelInfo]) -> Vec<&str> {
        models.iter().map(|m| m.id.as_str()).collect()
    }

    fn recommended(models: &[ModelInfo]) -> Vec<&str> {
        models
            .iter()
            .filter(|m| m.is_recommended)
            .map(|m| m.id.as_str())
            .collect()
    }

    #[test]
    fn french_with_gpu_puts_most_accurate_then_light_multilingual_first() {
        let models = ordered(Some("fr"), true);
        assert_eq!(
            ids(&models),
            [
                "cohere",
                "parakeet-v3",
                "nemotron",
                "canary-180m",
                "voxtral-24b",
                "my-custom",
                "parakeet-unified-en",
                "parakeet-v2",
            ]
        );
        assert_eq!(
            recommended(&models),
            ["cohere", "parakeet-v3", "nemotron", "canary-180m"]
        );
    }

    #[test]
    fn french_without_gpu_starts_with_the_light_model() {
        let models = ordered(Some("fr"), false);
        assert_eq!(
            ids(&models)[..4],
            ["parakeet-v3", "nemotron", "canary-180m", "cohere"]
        );
        // English-only models are neither first nor recommended.
        assert!(!recommended(&models).contains(&"parakeet-unified-en"));
        assert_eq!(models.last().unwrap().id, "parakeet-v2");
    }

    #[test]
    fn english_prefers_the_english_specialist_as_light_pick() {
        let models = ordered(Some("en"), true);
        assert_eq!(
            ids(&models)[..3],
            ["cohere", "parakeet-unified-en", "nemotron"]
        );
        assert!(recommended(&models).contains(&"parakeet-unified-en"));
    }

    #[test]
    fn other_languages_follow_the_same_rules() {
        // Russian: Cohere doesn't know it, so it is not first even with a GPU.
        let models = ordered(Some("ru"), true);
        assert_eq!(ids(&models)[..2], ["parakeet-v3", "nemotron"]);
        assert!(!recommended(&models).contains(&"cohere"));
        // Japanese: only Cohere knows it among the curated models.
        let models = ordered(Some("ja"), true);
        assert_eq!(ids(&models)[0], "cohere");
    }

    #[test]
    fn unknown_or_unsupported_system_language_falls_back_to_english() {
        let english = ids(&ordered(Some("en"), true))
            .into_iter()
            .map(String::from)
            .collect::<Vec<_>>();
        for language in [None, Some("sw")] {
            assert_eq!(
                ids(&ordered(language, true)),
                english,
                "system language {language:?}"
            );
        }
    }

    #[test]
    fn uncurated_models_are_never_picked() {
        // voxtral-24b is the most accurate French model but not curated.
        let models = ordered(Some("fr"), true);
        assert_ne!(models[0].id, "voxtral-24b");
        assert!(!models
            .iter()
            .any(|m| m.id == "voxtral-24b" && m.is_recommended));
    }

    #[test]
    fn real_catalog_french_order() {
        let mut models: Vec<ModelInfo> = crate::catalog::CATALOG
            .iter()
            .map(|d| d.to_model_info(&DiskStatus::default()))
            .collect();
        order_for_language(&mut models, Some("fr"), true, crate::catalog::rank_of);
        assert_eq!(models[0].name, "Cohere Transcribe");
        assert_eq!(models[1].name, "Parakeet TDT 0.6B v3");
        let top: Vec<&ModelInfo> = models.iter().filter(|m| m.is_recommended).collect();
        assert!(top.len() >= 2);
        for m in &top {
            assert!(
                find_supported_language(&m.supported_languages, "fr").is_some(),
                "{} is recommended but cannot transcribe French",
                m.name
            );
        }

        order_for_language(&mut models, Some("fr"), false, crate::catalog::rank_of);
        assert_eq!(models[0].name, "Parakeet TDT 0.6B v3");
    }
}
