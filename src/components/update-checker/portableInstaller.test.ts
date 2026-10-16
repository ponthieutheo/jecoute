// Standalone assert check (no JS unit-test runner in this repo). Run with:
//   bun src/components/update-checker/portableInstaller.test.ts
import assert from "node:assert";
import {
  isWindowsInstallerUrl,
  resolvePortableInstallerUrl,
  PORTABLE_RELEASES_URL,
} from "./portableInstaller";

const RELEASE = "https://github.com/ponthieutheo/jecoute/releases/download/v0.1.0";

// GitHub turns the apostrophe and the accent of "J'écoute" into "." on upload,
// so this is what the manifest's browser download URLs look like.
const X64_SETUP = `${RELEASE}/J.coute_0.1.0_x64-setup.exe`;
const ARM64_SETUP = `${RELEASE}/J.coute_0.1.0_arm64-setup.exe`;
const X64_MSI = `${RELEASE}/J.coute_0.1.0_x64_en-US.msi`;

// Trimmed copy of a latest.json as served from the updater endpoint.
const manifest = {
  version: "0.1.0",
  platforms: {
    "windows-x86_64": { url: X64_MSI, signature: "…" },
    "windows-x86_64-nsis": { url: X64_SETUP, signature: "…" },
    "windows-x86_64-msi": { url: X64_MSI, signature: "…" },
    "windows-aarch64-nsis": { url: ARM64_SETUP, signature: "…" },
    "darwin-aarch64": {
      url: `${RELEASE}/J.coute_aarch64.app.tar.gz`,
    },
  },
};

// x64 Windows -> the x64 NSIS asset, pinned to the release tag
assert.equal(
  resolvePortableInstallerUrl(manifest, "windows", "x86_64"),
  X64_SETUP,
);

// arm64 Windows -> the arm64 NSIS asset
assert.equal(
  resolvePortableInstallerUrl(manifest, "windows", "aarch64"),
  ARM64_SETUP,
);

// no manifest (check() failed or returned no update) -> releases page fallback
assert.equal(
  resolvePortableInstallerUrl(undefined, "windows", "x86_64"),
  PORTABLE_RELEASES_URL,
);

// no NSIS bundle for this arch -> releases page fallback
assert.equal(
  resolvePortableInstallerUrl(manifest, "windows", "x86"),
  PORTABLE_RELEASES_URL,
);

// non-Windows portable install -> releases page, never a Windows .exe
assert.equal(
  resolvePortableInstallerUrl(manifest, "macos", "aarch64"),
  PORTABLE_RELEASES_URL,
);

// malformed manifest -> releases page fallback
assert.equal(
  resolvePortableInstallerUrl({ platforms: "nope" }, "windows", "x86_64"),
  PORTABLE_RELEASES_URL,
);

// the fallback is the fork's own releases page
assert.equal(
  PORTABLE_RELEASES_URL,
  "https://github.com/ponthieutheo/jecoute/releases/latest",
);

// asset name kept verbatim by GitHub (percent-encoded apostrophe and accent)
const ENCODED_SETUP = `${RELEASE}/J%27%C3%A9coute_0.1.0_x64-setup.exe`;
assert.equal(
  resolvePortableInstallerUrl(
    { platforms: { "windows-x86_64-nsis": { url: ENCODED_SETUP } } },
    "windows",
    "x86_64",
  ),
  ENCODED_SETUP,
);

// broken percent-encoding still counts: only the ".exe" tail matters
assert.ok(isWindowsInstallerUrl(`${RELEASE}/J%E9coute_0.1.0_x64-setup.exe`));

// no bundle-specific entry, generic entry points at the NSIS setup -> used
assert.equal(
  resolvePortableInstallerUrl(
    { platforms: { "windows-x86_64": { url: X64_SETUP } } },
    "windows",
    "x86_64",
  ),
  X64_SETUP,
);

// generic entry points at the .msi and there is no NSIS entry -> releases page
assert.equal(
  resolvePortableInstallerUrl(
    { platforms: { "windows-x86_64": { url: X64_MSI } } },
    "windows",
    "x86_64",
  ),
  PORTABLE_RELEASES_URL,
);

// API asset URL (no file name, serves JSON in a browser) -> releases page
assert.equal(
  resolvePortableInstallerUrl(
    {
      platforms: {
        "windows-x86_64-nsis": {
          url: "https://api.github.com/repos/ponthieutheo/jecoute/releases/assets/123",
        },
      },
    },
    "windows",
    "x86_64",
  ),
  PORTABLE_RELEASES_URL,
);

// non-https or unparsable URLs are never opened
assert.equal(isWindowsInstallerUrl(X64_SETUP.replace("https:", "http:")), false);
assert.equal(isWindowsInstallerUrl("J'écoute_0.1.0_x64-setup.exe"), false);
assert.equal(isWindowsInstallerUrl(42), false);

console.log("portableInstaller: all assertions passed");
