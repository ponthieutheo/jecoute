//! The summary of a call (title, 2-4 sentences, up to 6 key points, the to-dos
//! with who and when), written by the AI provider already set up for
//! post-processing (Settings → Text). No other key is needed. The transcript
//! is sent to that provider; nothing is sent when none is set up.

use std::time::Duration;

use serde::Serialize;
use specta::Type;

use super::transcript::{self, Notes};
use crate::settings::{AppSettings, PostProcessProvider, APPLE_INTELLIGENCE_PROVIDER_ID};

/// The longest transcript sent, in bytes (about 3 h of talk).
const MAX_TRANSCRIPT: usize = 200_000;
/// The longest wait for the notes, both tries included: a provider that
/// never answers must not leave the call "being summarised" forever.
pub const SUMMARY_TIMEOUT: Duration = Duration::from_secs(120);

/// Whether a summary can be written, and by whom (shown on the page).
#[derive(Debug, Clone, Serialize, Type)]
pub struct SummaryAvailability {
    /// A provider with a model (and a key when it needs one) is set up.
    pub ready: bool,
    /// The setting "Summary by AI" for calls.
    pub enabled: bool,
    pub provider: Option<String>,
    pub model: Option<String>,
    /// The provider runs on this computer (localhost): the transcript does
    /// not leave it.
    pub local: bool,
}

pub struct Provider {
    pub provider: PostProcessProvider,
    pub model: String,
    pub api_key: String,
}

/// The post-processing provider, when it can answer.
pub fn provider(settings: &AppSettings) -> Option<Provider> {
    let provider = settings.active_post_process_provider()?.clone();
    if provider.id == APPLE_INTELLIGENCE_PROVIDER_ID {
        return None;
    }
    let model = settings
        .post_process_models
        .get(&provider.id)
        .cloned()
        .unwrap_or_default();
    if model.trim().is_empty() {
        return None;
    }
    let api_key = settings
        .post_process_api_keys
        .get(&provider.id)
        .cloned()
        .unwrap_or_default();
    // A local server ("custom") may need no key; the others do.
    if api_key.trim().is_empty() && provider.id != "custom" {
        return None;
    }
    Some(Provider {
        provider,
        model,
        api_key,
    })
}

pub fn availability(settings: &AppSettings) -> SummaryAvailability {
    let p = provider(settings);
    SummaryAvailability {
        ready: p.is_some(),
        enabled: settings.call_summary,
        provider: p.as_ref().map(|p| p.provider.label.clone()),
        model: p.as_ref().map(|p| p.model.clone()),
        local: p.as_ref().is_some_and(|p| is_local(&p.provider.base_url)),
    }
}

/// Whether an address points at this computer (localhost, 127.x.x.x, ::1).
fn is_local(base_url: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(base_url.trim()) else {
        return false;
    };
    let Some(host) = url.host_str() else {
        return false;
    };
    let bare = host.trim_start_matches('[').trim_end_matches(']');
    match bare.parse::<std::net::IpAddr>() {
        Ok(ip) => ip.is_loopback(),
        Err(_) => host.eq_ignore_ascii_case("localhost"),
    }
}

/// Cuts the transcript to what is sent (on a character boundary).
fn capped(mut transcript: String) -> String {
    if transcript.len() > MAX_TRANSCRIPT {
        let mut cut = MAX_TRANSCRIPT;
        while !transcript.is_char_boundary(cut) {
            cut -= 1;
        }
        transcript.truncate(cut);
    }
    transcript
}

/// Asks the provider for the notes of the call, for at most
/// [`SUMMARY_TIMEOUT`]. (The correction of dictations by the same provider
/// keeps its own behaviour: it does not go through here.)
pub async fn summarize(p: &Provider, transcript: String) -> Result<Notes, String> {
    summarize_within(p, transcript, SUMMARY_TIMEOUT).await
}

async fn summarize_within(
    p: &Provider,
    transcript: String,
    limit: Duration,
) -> Result<Notes, String> {
    tokio::time::timeout(limit, ask(p, transcript))
        .await
        .unwrap_or_else(|_| {
            Err(format!(
                "the AI did not answer within {} s",
                limit.as_secs_f64()
            ))
        })
}

async fn ask(p: &Provider, transcript: String) -> Result<Notes, String> {
    let user = format!("<transcript>\n{}\n</transcript>", capped(transcript));
    let disable_reasoning = matches!(p.provider.id.as_str(), "custom" | "openrouter");
    let schema = p
        .provider
        .supports_structured_output
        .then(transcript::notes_schema);
    let first = crate::llm_client::send_chat_completion_with_schema(
        &p.provider,
        p.api_key.clone(),
        &p.model,
        user.clone(),
        Some(transcript::NOTES_PROMPT.to_string()),
        schema.clone(),
        disable_reasoning,
    )
    .await;
    // Some endpoints refuse a JSON schema: ask again without it.
    let reply = match first {
        Err(err) if schema.is_some() => {
            log::warn!("calls: summary with a schema failed ({err}), retrying without");
            crate::llm_client::send_chat_completion_with_schema(
                &p.provider,
                p.api_key.clone(),
                &p.model,
                user,
                Some(transcript::NOTES_PROMPT.to_string()),
                None,
                disable_reasoning,
            )
            .await
        }
        other => other,
    }?;
    let reply = reply.ok_or_else(|| "the AI answered nothing".to_string())?;
    // Reasoning models may wrap their answer in <think>…</think>.
    let reply = match reply.rfind("</think>") {
        Some(at) => reply[at + "</think>".len()..].to_string(),
        None => reply,
    };
    transcript::read_notes(&reply).ok_or_else(|| "the AI's answer could not be read".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::settings::get_default_settings;

    #[test]
    fn no_provider_no_summary() {
        let mut s = get_default_settings();
        assert!(!availability(&s).ready);
        // A provider with a model and a key can answer.
        let id = s.post_process_provider_id.clone();
        s.post_process_models
            .insert(id.clone(), "some-model".into());
        assert!(provider(&s).is_none() || id == "custom");
        s.post_process_api_keys.insert(id, "key".into());
        if s.active_post_process_provider()
            .is_some_and(|p| p.id != APPLE_INTELLIGENCE_PROVIDER_ID)
        {
            assert!(availability(&s).ready);
        }
    }

    #[test]
    fn only_this_computer_counts_as_local() {
        for local in [
            "http://localhost:11434/v1",
            "http://LOCALHOST/v1",
            "http://127.0.0.1:8080/v1",
            "http://127.1.2.3/v1",
            "http://[::1]:1234/v1",
        ] {
            assert!(is_local(local), "{local}");
        }
        for remote in [
            "https://api.openai.com/v1",
            "http://192.168.1.73:11434/v1",
            "http://localhost.example.com/v1",
            "http://127.0.0.1.nip.io/v1",
            "not a url",
        ] {
            assert!(!is_local(remote), "{remote}");
        }
    }

    #[test]
    fn a_provider_that_never_answers_is_given_up() {
        let runtime = tokio::runtime::Runtime::new().unwrap();
        runtime.block_on(async {
            // A server that takes the request and never answers.
            let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
            let port = listener.local_addr().unwrap().port();
            tokio::spawn(async move {
                let mut held = Vec::new();
                while let Ok((socket, _)) = listener.accept().await {
                    held.push(socket);
                }
            });
            let p = Provider {
                provider: PostProcessProvider {
                    id: "custom".into(),
                    label: "Local".into(),
                    base_url: format!("http://127.0.0.1:{port}/v1"),
                    allow_base_url_edit: true,
                    models_endpoint: None,
                    supports_structured_output: false,
                },
                model: "m".into(),
                api_key: String::new(),
            };
            let began = std::time::Instant::now();
            let outcome =
                summarize_within(&p, "Moi: salut".into(), Duration::from_millis(400)).await;
            let err = outcome.err().unwrap();
            assert!(err.contains("did not answer"), "{err}");
            assert!(began.elapsed() < Duration::from_secs(5));
        });
    }

    #[test]
    fn a_long_transcript_is_cut_on_a_character() {
        let t = "é".repeat(MAX_TRANSCRIPT);
        let c = capped(t);
        assert!(c.len() <= MAX_TRANSCRIPT);
        assert!(c.chars().all(|ch| ch == 'é'));
    }
}
