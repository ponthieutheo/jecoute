// Portable installs can't self-update in place (no installer, and Windows won't
// let a running exe replace itself). Instead of dumping the user on the releases
// page to hand-pick one of the assets, deep-link the NSIS setup.exe for their
// platform and architecture.
//
// The URL comes straight out of the updater manifest (`Update.rawJson`) rather
// than being rebuilt here: it is the URL GitHub actually serves, pinned to the
// immutable `releases/download/v<version>/…` tag URL.
//
// Release assets carry ASCII names, `Jecoute_<version>_<x64|arm64>-setup.exe`
// for the NSIS setups (`Jecoute_<version>_<arch>_en-US.msi` for the MSIs). The
// checks below prefer that shape but stay lenient: an entry already keyed to the
// right architecture is accepted as long as it links an https `.exe` that is not
// labelled for another architecture, whatever the file is called (a product-name
// prefix such as "J’écoute", raw, percent-encoded or rewritten by GitHub).

const REPO_URL = "https://github.com/ponthieutheo/jecoute";

export const PORTABLE_RELEASES_URL = `${REPO_URL}/releases/latest`;

/** Architecture tag NSIS file names use for each `arch()` value. */
const NSIS_ARCH_TAG: Record<string, string> = {
  x86_64: "x64",
  aarch64: "arm64",
  x86: "x86",
};

/** `<anything>_<arch>-setup.exe`, case-insensitive. */
const SETUP_ARCH = /_(x64|arm64|x86)-setup\.exe$/i;

/** Last path segment of an https URL, percent-decoded when it decodes cleanly. */
function urlFileName(url: string): string | null {
  let pathname: string;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return null;
    pathname = parsed.pathname;
  } catch {
    return null;
  }
  const raw = pathname.slice(pathname.lastIndexOf("/") + 1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/**
 * True when `url` is an https link to a Windows `.exe` installer. Rejects the
 * `.msi`, archives, and API asset URLs (`…/releases/assets/<id>`), which carry
 * no file name and would download JSON metadata in a browser.
 */
export function isWindowsInstallerUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  const name = urlFileName(url);
  return name !== null && /\.exe$/i.test(name);
}

/**
 * How well `url` fits as the NSIS setup for `archName`:
 * 3 = `Jecoute_<version>_<arch>-setup.exe`, 2 = some `…_<arch>-setup.exe`,
 * 1 = an `.exe` with no architecture in its name, 0 = unusable (not an https
 * `.exe`, or a setup labelled for another architecture).
 */
export function installerMatch(url: unknown, archName: string): number {
  if (!isWindowsInstallerUrl(url)) return 0;
  const name = urlFileName(url) ?? "";
  const tag = SETUP_ARCH.exec(name)?.[1]?.toLowerCase();
  if (tag === undefined) return 1;
  if (tag !== NSIS_ARCH_TAG[archName]) return 0;
  return /^jecoute_[^_]+_/i.test(name) ? 3 : 2;
}

/**
 * Pick the NSIS installer URL for the running target out of the update manifest.
 * Falls back to the generic releases page whenever there is no usable entry —
 * e.g. a portable install on a platform J’écoute ships no NSIS bundle for.
 *
 * Candidates, best match first (ties keep this order): the bundle-specific
 * `windows-<arch>-nsis` entry, the generic `windows-<arch>` entry (which points
 * at the NSIS setup too when NSIS is the primary updater bundle), then any other
 * `windows-*` entry whose file name is explicitly a setup for this architecture.
 *
 * @param rawJson `Update.rawJson`, the deserialized `latest.json` manifest
 * @param platformName value from `@tauri-apps/plugin-os` `platform()`
 * @param archName value from `@tauri-apps/plugin-os` `arch()` ("x86_64", "aarch64")
 */
export function resolvePortableInstallerUrl(
  rawJson: Record<string, unknown> | undefined,
  platformName: string,
  archName: string,
): string {
  // NSIS is a Windows-only bundle; nothing else has an installer to link to.
  if (platformName !== "windows") return PORTABLE_RELEASES_URL;

  const platforms = rawJson?.platforms;
  if (!platforms || typeof platforms !== "object") return PORTABLE_RELEASES_URL;
  const entries = platforms as Record<string, unknown>;

  const archKeys = [`windows-${archName}-nsis`, `windows-${archName}`];
  const otherKeys = Object.keys(entries).filter(
    (key) => key.startsWith("windows-") && !archKeys.includes(key),
  );

  let best: { url: string; score: number } | null = null;
  for (const key of [...archKeys, ...otherKeys]) {
    const entry = entries[key];
    if (!entry || typeof entry !== "object") continue;
    const url = (entry as Record<string, unknown>).url;
    const score = installerMatch(url, archName);
    // Entries not keyed to this architecture only count when the file name says so.
    const minimum = archKeys.includes(key) ? 1 : 2;
    if (score >= minimum && (best === null || score > best.score)) {
      best = { url: url as string, score };
    }
  }
  return best?.url ?? PORTABLE_RELEASES_URL;
}
