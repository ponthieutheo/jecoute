// Portable installs can't self-update in place (no installer, and Windows won't
// let a running exe replace itself). Instead of dumping the user on the releases
// page to hand-pick one of the assets, deep-link the NSIS setup.exe for their
// platform and architecture.
//
// The URL comes straight out of the updater manifest (`Update.rawJson`) rather
// than being rebuilt from the bundler's file-naming convention. Asset names start
// with the product name, "J'écoute", and GitHub rewrites characters it does not
// allow in asset names when they are uploaded (the apostrophe and the accent end
// up as ".", e.g. "J.coute_0.1.0_x64-setup.exe"), so a name rebuilt here could
// easily point at nothing. The manifest URL is the one GitHub actually serves,
// pinned to the immutable `releases/download/v<version>/…` tag URL.
//
// The only thing checked in that URL is that it ends in ".exe": NSIS setups are
// the only Windows bundle with that extension (the other one is the ".msi"),
// whatever the product name turned into, percent-encoded or not.

const REPO_URL = "https://github.com/ponthieutheo/jecoute";

export const PORTABLE_RELEASES_URL = `${REPO_URL}/releases/latest`;

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
 * Pick the NSIS installer URL for the running target out of the update manifest.
 * Falls back to the generic releases page whenever there is no usable entry —
 * e.g. a portable install on a platform J'écoute ships no NSIS bundle for.
 *
 * Looks at the bundle-specific `windows-<arch>-nsis` entry first, then at the
 * generic `windows-<arch>` entry (which the manifest points at the NSIS setup
 * too when NSIS is the primary updater bundle).
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

  for (const key of [`windows-${archName}-nsis`, `windows-${archName}`]) {
    const entry = (platforms as Record<string, unknown>)[key];
    if (!entry || typeof entry !== "object") continue;
    const url = (entry as Record<string, unknown>).url;
    if (isWindowsInstallerUrl(url)) return url;
  }
  return PORTABLE_RELEASES_URL;
}
