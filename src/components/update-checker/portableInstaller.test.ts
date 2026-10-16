// Standalone assert check (no JS unit-test runner in this repo). Run with:
//   bun src/components/update-checker/portableInstaller.test.ts
import assert from "node:assert";
import {
  installerMatch,
  isWindowsInstallerUrl,
  resolvePortableInstallerUrl,
  PORTABLE_RELEASES_URL,
} from "./portableInstaller";

const RELEASE =
  "https://github.com/ponthieutheo/jecoute/releases/download/v0.1.0";

// Asset names as published by the release workflow.
const X64_SETUP = `${RELEASE}/Jecoute_0.1.0_x64-setup.exe`;
const ARM64_SETUP = `${RELEASE}/Jecoute_0.1.0_arm64-setup.exe`;
const X64_MSI = `${RELEASE}/Jecoute_0.1.0_x64_en-US.msi`;
const ARM64_MSI = `${RELEASE}/Jecoute_0.1.0_arm64_en-US.msi`;

// Trimmed copy of a latest.json as served from the updater endpoint.
const manifest = {
  version: "0.1.0",
  platforms: {
    "windows-x86_64": { url: X64_MSI, signature: "…" },
    "windows-x86_64-nsis": { url: X64_SETUP, signature: "…" },
    "windows-x86_64-msi": { url: X64_MSI, signature: "…" },
    "windows-aarch64": { url: ARM64_MSI, signature: "…" },
    "windows-aarch64-nsis": { url: ARM64_SETUP, signature: "…" },
    "windows-aarch64-msi": { url: ARM64_MSI, signature: "…" },
    "darwin-aarch64": { url: `${RELEASE}/Jecoute_aarch64.app.tar.gz` },
  },
};

const only = (platforms: Record<string, { url: unknown }>) => ({ platforms });

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

// generic entry points at the NSIS setup, no bundle-specific entry -> used
assert.equal(
  resolvePortableInstallerUrl(
    only({ "windows-x86_64": { url: X64_SETUP } }),
    "windows",
    "x86_64",
  ),
  X64_SETUP,
);

// only an .msi for this arch -> releases page
assert.equal(
  resolvePortableInstallerUrl(
    only({ "windows-x86_64": { url: X64_MSI } }),
    "windows",
    "x86_64",
  ),
  PORTABLE_RELEASES_URL,
);

// setup filed under an unexpected key -> found by its file name...
assert.equal(
  resolvePortableInstallerUrl(
    only({
      "windows-x86_64": { url: X64_MSI },
      "windows-x86_64-setup": { url: X64_SETUP },
    }),
    "windows",
    "x86_64",
  ),
  X64_SETUP,
);

// ...but never another architecture's setup
assert.equal(
  resolvePortableInstallerUrl(
    only({ "windows-aarch64-nsis": { url: ARM64_SETUP } }),
    "windows",
    "x86_64",
  ),
  PORTABLE_RELEASES_URL,
);
assert.equal(
  resolvePortableInstallerUrl(
    only({ "windows-x86_64-nsis": { url: ARM64_SETUP } }),
    "windows",
    "x86_64",
  ),
  PORTABLE_RELEASES_URL,
);

// the canonical name wins over a looser match from another entry
assert.equal(
  resolvePortableInstallerUrl(
    only({
      "windows-x86_64-nsis": { url: `${RELEASE}/setup.exe` },
      "windows-x86_64-setup": { url: X64_SETUP },
    }),
    "windows",
    "x86_64",
  ),
  X64_SETUP,
);

// lenient on names the workflow does not produce, as long as the entry is
// keyed to this arch: product-name prefix kept verbatim (percent-encoded),
// rewritten by GitHub, other casing
for (const name of [
  "J%E2%80%99%C3%A9coute_0.1.0_x64-setup.exe",
  "J.coute_0.1.0_x64-setup.exe",
  "JECOUTE_0.1.0_X64-SETUP.EXE",
  "jecoute-setup.exe",
]) {
  const url = `${RELEASE}/${name}`;
  assert.equal(
    resolvePortableInstallerUrl(
      only({ "windows-x86_64-nsis": { url } }),
      "windows",
      "x86_64",
    ),
    url,
    name,
  );
}

// match levels
assert.equal(installerMatch(X64_SETUP, "x86_64"), 3);
assert.equal(
  installerMatch(`${RELEASE}/J.coute_0.1.0_x64-setup.exe`, "x86_64"),
  2,
);
assert.equal(installerMatch(`${RELEASE}/setup.exe`, "x86_64"), 1);
assert.equal(installerMatch(ARM64_SETUP, "x86_64"), 0);
assert.equal(installerMatch(X64_MSI, "x86_64"), 0);

// broken percent-encoding still counts: only the ".exe" tail matters
assert.ok(isWindowsInstallerUrl(`${RELEASE}/J%E9coute_0.1.0_x64-setup.exe`));

// API asset URL (no file name, serves JSON in a browser) -> releases page
assert.equal(
  resolvePortableInstallerUrl(
    only({
      "windows-x86_64-nsis": {
        url: "https://api.github.com/repos/ponthieutheo/jecoute/releases/assets/123",
      },
    }),
    "windows",
    "x86_64",
  ),
  PORTABLE_RELEASES_URL,
);

// non-https or unparsable URLs are never opened
assert.equal(
  isWindowsInstallerUrl(X64_SETUP.replace("https:", "http:")),
  false,
);
assert.equal(isWindowsInstallerUrl("Jecoute_0.1.0_x64-setup.exe"), false);
assert.equal(isWindowsInstallerUrl(42), false);

console.log("portableInstaller: all assertions passed");
