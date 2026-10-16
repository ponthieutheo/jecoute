//! The operating system's language, used as the recognition-language hint when
//! the user leaves the language on "auto" but the model cannot detect it, and
//! to put the models that handle that language first.

use std::sync::OnceLock;

/// Reduce an OS locale tag to the lowercase ISO 639 base code used for language
/// matching: `fr-FR` → `fr`, `pt_BR.UTF-8` → `pt`, `zh-Hans-CN` → `zh`.
/// Returns `None` for tags that carry no language (`C`, `POSIX`, empty).
pub fn base_language_from_locale(locale: &str) -> Option<String> {
    let base = locale
        .trim()
        .split(['-', '_', '.', '@'])
        .next()
        .unwrap_or("")
        .to_ascii_lowercase();
    let is_language_code =
        (2..=3).contains(&base.len()) && base.chars().all(|c| c.is_ascii_alphabetic());
    if !is_language_code || base == "c" {
        return None;
    }
    Some(base)
}

static SYSTEM_LANGUAGE: OnceLock<Option<String>> = OnceLock::new();

/// The system language as a base code (`fr`), read once from the OS locale
/// (Windows user locale, macOS preferred language, `LANG`/`LC_*` on Linux) —
/// the same source the interface uses for its own language detection.
pub fn system_language() -> Option<&'static str> {
    SYSTEM_LANGUAGE
        .get_or_init(|| {
            let locale = tauri_plugin_os::locale();
            let language = locale.as_deref().and_then(base_language_from_locale);
            log::info!(
                "System locale {:?} → recognition language hint {:?}",
                locale,
                language
            );
            language
        })
        .as_deref()
}

#[cfg(test)]
mod tests {
    use super::base_language_from_locale;

    #[test]
    fn locale_tags_reduce_to_their_base_language() {
        assert_eq!(base_language_from_locale("fr-FR").as_deref(), Some("fr"));
        assert_eq!(base_language_from_locale("fr").as_deref(), Some("fr"));
        assert_eq!(
            base_language_from_locale("pt_BR.UTF-8").as_deref(),
            Some("pt")
        );
        assert_eq!(
            base_language_from_locale("zh-Hans-CN").as_deref(),
            Some("zh")
        );
        assert_eq!(base_language_from_locale("DE-de").as_deref(), Some("de"));
        assert_eq!(
            base_language_from_locale("ca_ES@valencia").as_deref(),
            Some("ca")
        );
        assert_eq!(base_language_from_locale("fil-PH").as_deref(), Some("fil"));
    }

    #[test]
    fn locales_without_a_language_give_none() {
        assert_eq!(base_language_from_locale(""), None);
        assert_eq!(base_language_from_locale("C"), None);
        assert_eq!(base_language_from_locale("C.UTF-8"), None);
        assert_eq!(base_language_from_locale("POSIX"), None);
        assert_eq!(base_language_from_locale("x"), None);
        assert_eq!(base_language_from_locale("123"), None);
    }
}
