# Privacy

[Français](../confidentialite.md) · **English**

**Transcription is 100% local.** Your voice is recorded and transcribed on your PC, by the model you downloaded; the
audio never leaves your machine. J’écoute has no account, no server of its own, no usage statistics and no ads.

## What leaves your PC, and when

| What                      | To                                  | When                                                                                                                      | To avoid it                                                        |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| downloading a model       | Hugging Face                        | when you click “Download”, on first launch or in the model list                                                           | once the model is on your PC, nothing leaves to transcribe         |
| checking for updates      | GitHub (this repository’s releases) | at startup, when you click “Check”, then the download if you click “Install”                                              | Settings › App › “Check for updates”                               |
| the text of a dictation   | the AI provider you picked          | only if AI correction is on, and only when you dictate with Ctrl+Shift+Space (or re-transcribe a dictation made that way) | leave AI correction off (the default), or pick a server on your PC |
| the provider’s model list | the AI provider                     | when you pick the provider, or with “Refresh models”                                                                      |                                                                    |

The normal shortcut, Ctrl+Space, never sends anything: even with AI correction on, only Ctrl+Shift+Space has the text
reviewed.

## AI correction

It is off by default. Once on (Settings › Text › “AI correction”), this is what the provider receives on each
Ctrl+Shift+Space:

- the transcribed text, placed in your instruction (`${output}` in the instructions);
- your API key, to identify you;
- the app name (`Jecoute`) and the address of this repository, in the request headers.

Never the audio. What the provider does with the text depends on its own terms: read them before choosing. To keep
everything on your machine, pick “Custom” and the address of an OpenAI-compatible server running on your PC
(`http://localhost:11434/v1` to start with).

The API key is saved with your settings, on your PC, in `settings_store.json` (in plain text, like the rest of the
settings). It is masked in the logs.

## Where your data lives

Nothing is stored anywhere else: everything is in these folders.

| What                                                | Normal install                                                 | Portable install           |
| --------------------------------------------------- | -------------------------------------------------------------- | -------------------------- |
| settings, words to recognize, instructions, API key | `%APPDATA%\io.github.ponthieutheo.jecoute\settings_store.json` | `Data\settings_store.json` |
| history (the dictated text)                         | `%APPDATA%\io.github.ponthieutheo.jecoute\history.db`          | `Data\history.db`          |
| audio recordings (WAV)                              | `%APPDATA%\io.github.ponthieutheo.jecoute\recordings\`         | `Data\recordings\`         |
| models added by hand                                | `%APPDATA%\io.github.ponthieutheo.jecoute\models\`             | `Data\models\`             |
| downloaded models                                   | `%USERPROFILE%\.cache\huggingface\hub\`                        | `Data\huggingface\hub\`    |
| logs                                                | `%LOCALAPPDATA%\io.github.ponthieutheo.jecoute\logs\`          | `Data\logs\`               |

In a portable install, `Data\` sits next to `jecoute.exe`. Settings › About › “App data” and “Logs” open these folders.

## What the history keeps

- **By default, your last 5 dictations**, with their recording, plus your favorites. Older ones are erased.
- **The rule is set** in Settings › App › “Audio recordings”: “Keep latest 5” (the number set in “History”), “Never”
  (nothing is erased), or erase what is older than 3 days, 2 weeks or 3 months. An erased dictation goes with its
  recording; favorites always stay.
- **A dictation’s trash can** (“Delete”) erases its text and its recording.
- **A dictation corrected by the AI** keeps both versions, raw and corrected.

## Good to know: the clipboard

To paste, J’écoute goes through the Windows clipboard, then puts your previous content back. If you turned on Windows
clipboard history (Win+V) or its sync across devices, the dictation may end up there. To avoid it: “Type the text”
(Settings › Text › “Write the text”) does not touch the clipboard, and “Reliable Paste (Beta)”, in the “Debug”
section, marks the dictation so that Windows adds it neither to the history nor to the sync (with “Restore previous
content”, the default clipboard setting).

## Erasing everything

Uninstall J’écoute with “Delete the application data” checked, then remove its models from the Hugging Face cache:
see [installation.md](installation.md#7-uninstall). For a portable install, delete the app’s folder.
