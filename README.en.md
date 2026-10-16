# J’écoute

**You talk, it types.** J’écoute turns your voice into text right where your cursor is, and nothing ever leaves your computer.

[Version française](README.md)

## What it does

Hold a shortcut, speak, let go: your words appear in the app you are using, as if you had typed them. Email, documents, chat, terminal, web forms: it works anywhere you can type.

Meanwhile, a small red horned character pops up at the bottom of the screen. It leans in to listen while you speak, then whistles while it writes your sentence, or whispers when an AI polishes it. Once the text is pasted, it slips away.

- **100% local and private**: transcription runs on your machine. No account, no cloud, no subscription, and it works offline.
- **Fast**: models run on your graphics card (Vulkan on Windows and Linux, Metal on Mac), or on the CPU otherwise.
- **Free and open**: the code is MIT licensed.

## Install

1. Open the [Releases](https://github.com/ponthieutheo/jecoute/releases/latest) page and download the installer for the latest version. On Windows, that is `Jecoute_<version>_x64-setup.exe` (`Jecoute_<version>_arm64-setup.exe` on an ARM PC).
2. Run it. The installer is not signed, so Windows SmartScreen may say "Windows protected your PC": click "More info", then "Run anyway".
3. Pick a normal install, or a portable one (a self-contained folder that keeps its settings and models next to the app).
4. On first launch, pick a transcription model (see below). It is downloaded once; after that, everything works offline.

J’écoute then offers new versions on its own.

## Use

1. Put your cursor where you want to write.
2. Hold **Ctrl+Space** (**Option+Space** on Mac), speak, then let go: the text is pasted.
3. Rather not keep the key down? Tap once to start, tap again to stop.

Both ways work out of the box ("Auto" mode). You can force "Hold" or "Toggle", and change the shortcut, in **Settings > General**.

AI post-processing is optional and off by default. Once enabled in **Settings > Advanced** (and set up in the **Post Process** section), **Ctrl+Shift+Space** (**Option+Shift+Space** on Mac) transcribes and then has the text polished (punctuation, rewording…) by the provider you pick: a local model, or an online service that only receives the text.

## Which model for French

- **Cohere Transcribe**: the most accurate. It is heavier and shines with a graphics card.
- **Parakeet V3**: lighter and very fast, even on a modest machine. It detects the spoken language on its own, handy if you switch between French and English.

You can download several and switch between them in **Settings > Models**.

## Troubleshooting

<a id="macos-secure-input"></a>

### macOS: the shortcut stopped responding (Secure Input)

**Symptom**: a shortcut that includes a regular key (for example Option+Space) no longer triggers, while a modifier-only shortcut (fn alone, Left Ctrl alone) still works. This is macOS Secure Input: when a password field or an app turns it on, macOS stops sending keystrokes to other apps, J’écoute included.

**Finding the culprit**: J’écoute then shows a banner in its settings and a ⚠ in its menu bar menu. The banner names the app holding Secure Input when it can; that name is a best guess, not a certainty. To check by hand, in Terminal:

```bash
ioreg -l -w 0 | grep -o 'kCGSSessionSecureInputPID"=[0-9]*' | grep -o '[0-9]*' | head -1 | xargs ps -o pid,comm -p
```

The command prints nothing if the offending app has already quit. In the **Debug** section (Cmd+Shift+D), the **Keyboard Diagnostic** shows whether keystrokes reach J’écoute at all.

**Fixes, in order**:

1. **Terminal or iTerm2**: turn off "Secure Keyboard Entry" in the app's menu.
2. **Password manager**: quit or update it. Some releases of 1Password and KeePassXC keep Secure Input on in the background.
3. **Otherwise** (stuck login window, an app that quit without releasing Secure Input): lock the screen with Ctrl+Cmd+Q, then log back in by typing your password (Touch ID is not enough). If that does not help, log out and back in.

Until then, J’écoute routes the affected shortcuts through a fallback, with a few limits: fn + key shortcuts stop working entirely, a one-sided modifier (Right Option, for example) responds on both sides, and new shortcuts cannot be recorded. Modifier-only shortcuts are never affected, which makes them a good choice if this keeps happening.

### The wrong text gets pasted

If the transcription is right in **History** but J’écoute pastes something you copied earlier: J’écoute pastes through the clipboard, then puts your previous clipboard back after a short delay. A slow app may read the clipboard too late.

1. Open the **Debug** section with Ctrl+Shift+D (Cmd+Shift+D on Mac).
2. On Windows and macOS, turn on **Reliable Paste (Beta)**.
3. If that is not enough, increase **Paste Delay (After)**.

### Ctrl+Space does nothing

Another app may already use that shortcut: input method switching (Chinese, Japanese, Korean), a launcher, or another dictation tool. Pick a different shortcut in **Settings > General > J’écoute Shortcuts**.

## Credits

J’écoute is based on [Handy](https://github.com/cjpais/Handy) by CJ Pais. Thanks as well to the projects that make local transcription possible: ggml and transcribe.cpp, Whisper, Parakeet, Cohere Transcribe and Silero VAD.

## Licenses

- **Code**: MIT license, see [LICENSE](LICENSE) (copyright CJ Pais and Théo Ponthieu).
- **Character** (3D model, face, character images): [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), noncommercial use only. Copyright (c) 2026 Théo Ponthieu. This covers the files in `src/character/` and the icons; each folder concerned carries its own license file.
