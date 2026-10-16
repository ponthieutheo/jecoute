import { useEffect, useState } from "react";
import { locale } from "@tauri-apps/plugin-os";

// Reduce an OS locale tag to its base language code, like the backend's
// `base_language_from_locale`: "fr-FR" → "fr", "pt_BR.UTF-8" → "pt"; null for
// tags without a language ("C", "POSIX").
const baseLanguage = (tag: string | null): string | null => {
  const base = (tag ?? "")
    .trim()
    .split(/[-_.@]/)[0]
    .toLowerCase();
  return /^[a-z]{2,3}$/.test(base) && base !== "c" ? base : null;
};

// Read once, as soon as this module loads, so the first render already knows
// it (no "Auto (English)" → "Auto (French)" jump). The backend reads the same
// OS locale to resolve "auto" for models that can't detect the language.
let systemLanguage: string | null | undefined;
const systemLanguagePromise: Promise<string | null> = (async () => {
  try {
    systemLanguage = baseLanguage(await locale());
  } catch {
    systemLanguage = null;
  }
  return systemLanguage;
})();

/** The system language as a base code ("fr"), or null when unknown. */
export function useSystemLanguage(): string | null {
  const [language, setLanguage] = useState<string | null>(
    systemLanguage ?? null,
  );

  useEffect(() => {
    if (systemLanguage !== undefined) return;
    let active = true;
    systemLanguagePromise.then((value) => {
      if (active) setLanguage(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return language;
}
