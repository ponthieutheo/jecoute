# Privacy

[Français](../confidentialite.md) · **English**

**Transcription is 100% local.** Your voice is recorded and transcribed on your PC, by the model you downloaded; the
audio never leaves your machine. J’écoute has no account, no server of its own and no ads, and sends no usage
statistics: your [dictation statistics](#statistics) stay on your PC.

## What leaves your PC, and when

| What                                          | To                                  | When                                                                                                                              | To avoid it                                                                            |
| --------------------------------------------- | ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| downloading a model                           | Hugging Face                        | when you click “Download”, on first launch or in the model list                                                                   | once the model is on your PC, nothing leaves to transcribe                             |
| checking for updates                          | GitHub (this repository’s releases) | at startup, when you click “Check”, then the download if you click “Install”                                                      | Settings › App › “Check for updates”                                                   |
| the text of a dictation                       | the AI provider you picked          | only if AI correction is on, and only when you dictate with Ctrl+Shift+Space (or re-transcribe a dictation made that way)         | leave AI correction off (the default), or pick a server on your PC                     |
| the provider’s model list                     | the AI provider                     | when you pick the provider, or with “Refresh models”                                                                              |                                                                                        |
| a call’s transcript (the text, not the sound) | the AI provider you picked          | at the end of a call, if a provider is set up and “AI summary” is on; or when you click “Write the summary” or “Redo the summary” | turn off “AI summary” (call settings), set up no provider, or pick a server on your PC |
| downloading the voice model (29 MB)           | Hugging Face                        | once, when you click “Download” to separate the voices of a call                                                                  | do not download it: the others stay “The others”                                       |

The normal shortcut, Ctrl+Space, never sends anything: even with AI correction on, only Ctrl+Shift+Space has the text
reviewed. Dictation statistics never leave.

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

| What                                                                   | Normal install                                                 | Portable install           |
| ---------------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------- |
| settings, words to recognize, instructions, API key                    | `%APPDATA%\io.github.ponthieutheo.jecoute\settings_store.json` | `Data\settings_store.json` |
| history (the dictated text)                                            | `%APPDATA%\io.github.ponthieutheo.jecoute\history.db`          | `Data\history.db`          |
| calls (the text: transcript, summary, tasks)                           | `%APPDATA%\io.github.ponthieutheo.jecoute\calls.db`            | `Data\calls.db`            |
| sound of a call being recorded (WAV, deleted once the call is written) | `%APPDATA%\io.github.ponthieutheo.jecoute\calls\`              | `Data\calls\`              |
| dictation statistics (numbers)                                         | `%APPDATA%\io.github.ponthieutheo.jecoute\stats.db`            | `Data\stats.db`            |
| audio recordings (WAV)                                                 | `%APPDATA%\io.github.ponthieutheo.jecoute\recordings\`         | `Data\recordings\`         |
| models added by hand, voice model                                      | `%APPDATA%\io.github.ponthieutheo.jecoute\models\`             | `Data\models\`             |
| downloaded models                                                      | `%USERPROFILE%\.cache\huggingface\hub\`                        | `Data\huggingface\hub\`    |
| logs                                                                   | `%LOCALAPPDATA%\io.github.ponthieutheo.jecoute\logs\`          | `Data\logs\`               |

In a portable install, `Data\` sits next to `jecoute.exe`. Settings › About › “App data” and “Logs” open these folders.

## What the history keeps

- **By default, your last 50 dictations**, with their recording, plus your favorites. Older ones are erased.
- **The rule is set** in Settings › App › “Keep dictations”: “Latest 50” (the number set in “History”), “Forever”
  (nothing is erased), or erase what is older than 3 days, 2 weeks or 3 months. An erased dictation goes with its
  recording; favorites always stay.
- **A dictation’s trash can** (“Delete”) erases its text and its recording.
- **A dictation corrected by the AI** keeps both versions, raw and corrected.

## Calls

The call recorder (the “Calls” page) does not join the call: the others see nothing. **Always tell the people you are
recording**; depending on where you live, recording someone without telling them may be against the law.

- **What is recorded**: your microphone, and everything the computer plays if “Computer sound” is on (the other
  people’s voices, but also a video or a notification that rings during the call).
- **The sound stays on your PC**, in two WAV files in the `calls\` folder of the app data, for the length of the call.
  It is deleted as soon as the call is written. If J’écoute stops in the middle of a call, the sound waits for the
  next launch: the call is written then, and the sound deleted.
- **The text is kept** in `calls.db`: the title, the date, the length, the people’s names, the transcript, the summary,
  the key points and the tasks. It stays until you delete the call (the trash can), which also erases whatever is left
  of its sound.
- **The transcript and the voices are done on your PC**, with your transcription model and, to separate the voices, a
  small model (29 MB) downloaded once from Hugging Face, at a pinned version whose SHA-256 checksum J’écoute checks.
- **The summary** is written by the AI provider set up for [AI correction](#ai-correction). It gets the call’s
  transcript (with the people’s names), the instructions asking for the notes, your API key and the same headers as
  for the correction. Never the sound. Without a provider, nothing leaves: the call keeps its transcript, with no
  summary. To keep everything on your machine and still get a summary, pick a server on your PC (“Custom”).
- **Copy and export**: “Copy” goes through the clipboard (see below), “Export” writes a `.md` file to your Documents
  folder. That file is yours: J’écoute does not erase it, even if you delete the call.

## Statistics

The “Statistics” page is computed on your PC and kept in `stats.db`. Nothing is sent, to anyone.

- **What it keeps**: for each day, the number of words dictated, the dictation time and the number of dictations; for
  each app and each day, the number of words and the program’s name (“Outlook”, “Chrome”…). Never the text of your
  dictations, never the window titles or what they contain.
- **The app** is the one in the foreground when your dictation is pasted. J’écoute itself and the parts of Windows
  (taskbar, Start menu, search…) do not count.
- **On the first launch of 0.2.0**, the dictations still in the history (with their recording) are picked up, without
  the apps.
- **Clearing the history does not erase them.** “Reset”, at the bottom of the page, erases all the numbers, after you
  confirm.

## Good to know: the clipboard

To paste, J’écoute goes through the Windows clipboard, then puts your previous content back. If you turned on Windows
clipboard history (Win+V) or its sync across devices, the dictation may end up there. To avoid it: “Type the text”
(Settings › Text › “Write the text”) does not touch the clipboard, and “Reliable Paste (Beta)”, in the “Debug”
section, marks the dictation so that Windows adds it neither to the history nor to the sync (with “Restore previous
content”, the default clipboard setting).

## Erasing everything

Uninstall J’écoute with “Delete the application data” checked, then remove its models from the Hugging Face cache:
see [installation.md](installation.md#7-uninstall). For a portable install, delete the app’s folder.
