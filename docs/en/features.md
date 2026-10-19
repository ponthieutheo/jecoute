# Everything you can do in J’écoute

[Français](../fonctionnalites.md) · **English**

_Every picture in this guide is a screenshot of the app, taken with made-up dictations. The calls are a dialogue
played by synthetic voices, and their summary was written for the demo; the statistics are made up. Full screens
follow your GitHub theme (light or dark); close-ups are in the dark theme._

- [Keyboard shortcuts](#keyboard-shortcuts)
- [Home](#home)
- [Settings](#settings): [Dictation](#dictation), [Sound](#sound), [Text](#text), [AI correction](#ai-correction),
  [App](#app), [About](#about)
- [History](#history)
- [Calls](#calls)
- [Statistics](#statistics)
- [Models](#models)
- [First launch](#first-launch)

## Keyboard shortcuts

| Keys                         | What it does                                                                            | Where to change it                              |
| ---------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| **Ctrl+Space**               | hold: dictate, release: write; or press once to start, once more to stop                | Settings › Dictation › “Dictation shortcut”     |
| **Esc**                      | during a dictation: cancels it without writing anything                                 | Settings › Dictation › “Cancel a dictation”     |
| **Ctrl+Shift+Space**         | dictates, then has the AI review the text (if AI correction is on)                      | Settings › Text › “Shortcut with AI correction” |
| **Ctrl+Shift+D**             | in the window: shows or hides the debug tools                                           |                                                 |
| **Ctrl+F**                   | in the history: jumps to the search box                                                 |                                                 |
| **Esc**                      | in the history: back to home; in the settings: closes the model list, then the settings |                                                 |
| **←** **→** **Home** **End** | in the settings: moves from tab to tab                                                  |                                                 |

The dictation shortcut and the AI correction shortcut work everywhere, even when the J’écoute window is hidden.

## Home

The character in the middle, and below it what J’écoute is doing, in one sentence.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/accueil-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/accueil-clair.png">
    <img src="../media/en/accueil-sombre.png" width="696" alt="Home: the character, the “Ready” status, the shortcut reminder, the model and language pills, recent dictations">
  </picture>
</p>

During a dictation, the home screen follows along: the character leans in to listen, the status turns to
“Listening…”.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/accueil-ecoute-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/accueil-ecoute-clair.png">
    <img src="../media/en/accueil-ecoute-sombre.png" width="696" alt="Home during a dictation: the character listens, “Listening…”, “Release Ctrl+Space when you’re done.”">
  </picture>
</p>

| Status                           | What it tells you                                                                         |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| “Ready”                          | “Hold Ctrl+Space and speak: I write wherever your cursor is.”                             |
| “Listening…”                     | “Release Ctrl+Space when you’re done.”                                                    |
| “Writing…”                       | the model transcribing your sentence                                                      |
| “Polishing…”                     | “The AI is reviewing your dictation.”                                                     |
| “Pasted”                         | “Find it in your recent dictations.”                                                      |
| “Loading the model…”             | “A few seconds after startup, then I stay ready.”                                         |
| “Downloading Cohere Transcribe…” | the download percentage and speed                                                         |
| “I can’t hear anything”          | no microphone found; the “Choose a microphone” button opens the right setting             |
| “I can’t use the microphone”     | Windows is blocking the microphone; the “Open microphone settings” button takes you there |
| “Choose a model”                 | no model yet; the “Choose a model” button opens the list                                  |
| “The model didn’t load”          | the “Change model” button opens the list                                                  |

The character takes the matching mood: ready, loading, no microphone, error, listening, typing or whispering (see
[character.md](character.md#its-moods)).

Top right: “Calls” (see [Calls](#calls)), “History”, “Statistics” (see [Statistics](#statistics)), the settings gear,
and the “Update” button when a new version is ready.

### The pills

Below the status, two pills: the active model and the spoken language. A click opens a menu to switch models (among
the ones you downloaded, or “All models”) or languages (with a search box). During a download, a third pill shows its
progress.

<p align="center"><img src="../media/en/fonctions/pastilles.png" width="445" alt="The model and language pills, with the model menu open"></p>

### Recent dictations

“Recent dictations”: the three latest, as cards. A click on a card copies its text (“Copied to clipboard”). An “AI”
tag marks a dictation corrected by the AI, a star marks a favorite. “All history” opens the history.

<p align="center"><img src="../media/en/fonctions/cartes.png" width="684" alt="The three recent dictations as cards, with the time, the AI tag and the Copy button"></p>

## Settings

The gear opens the settings, in five tabs: Dictation, Sound, Text, App, About. The character moves aside and reads
along with you. “Every change applies right away.”

### Dictation

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/reglages-dictee-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/reglages-dictee-clair.png">
    <img src="../media/en/reglages-dictee-sombre.png" width="696" alt="The Dictation tab: shortcut, behavior, cancel, transcription model, spoken language">
  </picture>
</p>

#### Dictation shortcut

“Hold to talk, release to write.” The keys are drawn as keycaps. The pencil (“Change”) records a new shortcut: press
the keys you want. The arrow (“Restore the default shortcut”) goes back to Ctrl+Space.

<p align="center"><img src="../media/en/fonctions/raccourci.png" width="455" alt="The dictation shortcut: Ctrl and Space keycaps, the pencil and the reset arrow"></p>

#### Shortcut behavior

“Choose how the transcribe shortcut starts and stops recording.”

| Option           | What it does                                                |
| ---------------- | ----------------------------------------------------------- |
| “Auto” (default) | “Hold to dictate, or press once to start and once to stop.” |
| “Hold”           | “I listen as long as you hold the keys.”                    |
| “Press to start” | “One press to start, another to stop.”                      |

<p align="center"><img src="../media/en/fonctions/comportement.png" width="455" alt="Shortcut behavior: Auto, Hold, Press to start"></p>

#### Cancel a dictation

“Stops without writing anything.” Default: Esc, during a dictation.

<p align="center"><img src="../media/en/fonctions/annuler.png" width="455" alt="The cancel shortcut: the Esc key"></p>

#### Transcription model

The active model, its size and how many languages it understands. “Change” opens the [model list](#models).

<p align="center"><img src="../media/en/fonctions/modele.png" width="455" alt="The active model card: its name, Active, its size, its languages, the Change button"></p>

#### Spoken language

“Auto” or a specific language, with a search box. This row only shows up when the model understands several
languages. A model that cannot detect the language on its own uses the Windows language, if it knows it: the option
then reads “Auto (English)”.

<p align="center"><img src="../media/en/fonctions/langue.png" width="455" alt="The spoken language and its list with the search box"></p>

#### Translate to English

“What you say in another language is written in English.” This row only shows up with a model that can translate (for
example Canary 180M Flash or Whisper Medium).

### Sound

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/reglages-son-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/reglages-son-clair.png">
    <img src="../media/en/reglages-son-sombre.png" width="696" alt="The Sound tab: microphone, mute, sound signal, volume, signal sound and output">
  </picture>
</p>

#### Microphone

“The microphone that listens to you.” “System default” or a specific microphone. During a dictation, its level shows
under the list (“I can hear you.”). With an audio interface that has several inputs, “Input channel” picks the input,
or “Average all channels”.

<p align="center"><img src="../media/en/fonctions/micro.png" width="455" alt="The microphone picker and its level during a dictation"></p>

#### Mute the computer

“Music and videos go quiet during a dictation.”

<p align="center"><img src="../media/en/fonctions/couper-son.png" width="455" alt="The Mute the computer switch"></p>

#### Sound signal

“A short sound when a dictation starts and ends.” Off by default. Once on: “Signal volume”, “Signal sound” (Marimba or
Pop, with “Play the signal”) and “Signal output” (where it plays).

<p align="center"><img src="../media/en/fonctions/signal-sonore.png" width="455" alt="The sound signal turned on, its volume, its sound and its output"></p>

### Text

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/reglages-texte-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/reglages-texte-clair.png">
    <img src="../media/en/reglages-texte-sombre.png" width="696" alt="The Text tab: write the text, clipboard, submit, filler words, space, words to recognize, AI correction">
  </picture>
</p>

#### Write the text

“How the dictation reaches your app.”

| Option                                         | What it does                                                    |
| ---------------------------------------------- | --------------------------------------------------------------- |
| “Paste (Ctrl+V)” (default)                     | pastes the text in one go, through the clipboard                |
| “Type the text”                                | types the text letter by letter, without touching the clipboard |
| “Paste (Ctrl+Shift+V)”, “Paste (Shift+Insert)” | for apps that paste differently (terminals, for example)        |
| “Don’t write”                                  | the dictation only goes to the history                          |

<p align="center"><img src="../media/en/fonctions/ecrire-texte.png" width="455" alt="The Write the text list, open"></p>

#### Clipboard

“After pasting.” “Restore previous content” (default) or “Keep the dictation” on the clipboard.

<p align="center"><img src="../media/en/fonctions/presse-papiers.png" width="455" alt="The clipboard setting"></p>

#### Submit after the text

“Presses a key for you, to send a message.” “Off” (default), “Enter”, “Ctrl+Enter” or “Super+Enter”.

<p align="center"><img src="../media/en/fonctions/valider.png" width="455" alt="Submit after the text: Off, Enter, Ctrl+Enter, Super+Enter"></p>

#### Remove filler words

““uh”, “um”, “er”…” disappear from the text. On by default.

<p align="center"><img src="../media/en/fonctions/hesitations.png" width="455" alt="The Remove filler words switch"></p>

#### Space after the text

“Adds a space after each dictation.” Useful for chaining sentences. Off by default.

<p align="center"><img src="../media/en/fonctions/espace-final.png" width="455" alt="The Space after the text switch"></p>

#### Words to recognize

“Names and technical terms I should spell right.” Type a word, “Add”: it becomes a tag, removed with one click.
J’écoute then corrects the close-sounding words the model hears.

<p align="center"><img src="../media/en/fonctions/mots.png" width="455" alt="Words to recognize as tags, and the Add a word field"></p>

Under “Advanced options”, “Chinese script” picks Simplified or Traditional characters for Mandarin and Cantonese.

### AI correction

“An online AI reviews the dictation before pasting it. Needs an API key (OpenRouter, Anthropic, OpenAI…).” Off by
default: the switch is in the Text tab, below the words to recognize. Once it is on, the normal shortcut does not
change: the second shortcut, Ctrl+Shift+Space, is the one that has the text reviewed.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/reglages-texte-ia-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/reglages-texte-ia-clair.png">
    <img src="../media/en/reglages-texte-ia-sombre.png" width="696" alt="AI correction turned on: shortcut, provider, API key, model, instructions">
  </picture>
</p>

#### Shortcut and provider

- “Shortcut with AI correction”: “Dictates and always has the AI review the text.” Ctrl+Shift+Space by default.
- “AI provider”, then “Provider” (“An OpenAI-compatible service.”): OpenAI, Z.AI, OpenRouter, Anthropic, Groq,
  Cerebras, AWS Bedrock (Mantle), or Custom. Custom opens “API address”: a server of your own, including on your PC
  (`http://localhost:11434/v1` to start with).
- “API key”: “Your account key with this provider.”
- “Model”: a model offered by the provider, or its name typed by hand; “Refresh models” reloads the list.

<p align="center"><img src="../media/en/fonctions/correction-ia.png" width="455" alt="The shortcut with AI correction, the provider, the API key and the model"></p>

#### Instructions

“What the AI does with the text. ${output} stands for your dictation.” Pick an instruction, edit it, or write your own
with “Create new prompt” (a “Prompt label”, “Prompt instructions”, then “Create prompt”). The bundled one, Improve
Transcriptions, fixes spelling and punctuation, writes numbers as digits and removes filler words, without changing
the meaning or the language of the dictation.

<p align="center"><img src="../media/en/fonctions/consignes.png" width="455" alt="Instructions: the selected one, its label and its text"></p>

In the history, each corrected dictation keeps both versions: see [Raw or corrected](#raw-or-corrected).

### App

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/reglages-application-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/reglages-application-clair.png">
    <img src="../media/en/reglages-application-sombre.png" width="696" alt="The App tab: appearance, interface language, startup, during a dictation, memory, history, recordings">
  </picture>
</p>

#### Appearance

“Choose whether J’écoute follows your system theme or stays light or dark”: “System”, “Light” or “Dark”.

<p align="center"><img src="../media/en/fonctions/apparence.png" width="455" alt="Appearance: System, Light, Dark"></p>

#### Interface language

The interface comes in 26 languages. By default, the Windows one.

<p align="center"><img src="../media/en/fonctions/langue-interface.png" width="455" alt="The list of interface languages"></p>

#### Startup

- “Launch at startup”: “J’écoute starts when you sign in.” Off by default.
- “Start hidden”: “Start in the taskbar without opening the window.”
- “Taskbar icon”: “In the notification area, next to the clock.” Its menu: copy the last transcript, record a call,
  switch models, unload the model, open the settings, check for updates, quit.

<p align="center"><img src="../media/en/fonctions/demarrage.png" width="455" alt="Launch at startup, Start hidden, Taskbar icon"></p>

#### During a dictation

“What shows on screen.”

| Option                | What shows up                                                                                           |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| “Character” (default) | the character pops up, listens, types and slips away                                                    |
| “Live text”           | a card that shows the text while you speak (with a model that writes live; otherwise, the minimal pill) |
| “Minimal”             | a small pill: a status light, your voice level and a cross to cancel                                    |
| “None”                | nothing                                                                                                 |

With a model that writes live, “Character” also shows the live text card, instead of the character. “Position on
screen”: “Bottom” (default) or “Top”.

<p align="center"><img src="../media/en/fonctions/pendant-dictee.png" width="455" alt="During a dictation: None, Minimal, Live text, Character; Position on screen"></p>

<p align="center"><img src="../media/perso/styles-overlay.png" width="696" alt="The styles side by side: the character, the live text card, the minimal pill"></p>

#### Free up memory

“Unloads the model when you stop dictating.” “Never” (default), “Immediately”, or after 2, 5, 10, 15 minutes or 1 hour.
The model loads again on the next dictation.

<p align="center"><img src="../media/en/fonctions/memoire.png" width="455" alt="Free up memory and its delays"></p>

#### History size

“How many dictations are kept when “Keep dictations” is set to the latest. Favorites don’t count.” 50 by default.

<p align="center"><img src="../media/en/fonctions/historique-limite.png" width="455" alt="How many dictations the history keeps"></p>

#### Keep dictations

“Older dictations (text and audio) are erased, favorites are kept.” “Latest 50” (by default: the number set in
“History”), “Forever” (nothing is erased), “3 days”, “2 weeks” or “3 months”. An erased dictation goes with its
recording; favorites always stay.

<p align="center"><img src="../media/en/fonctions/enregistrements.png" width="455" alt="Keep dictations: the retention options"></p>

#### Updates and what’s new

“Check for updates” (on by default) looks for new versions at startup. “Show what’s new” opens the release note after
an update. Installing happens in [About](#about).

#### Advanced options

- “Voice detection”: “Ignores silence before and after speech.” On by default.
- “Experimental features”: “Features still in development.” Once on: keyboard handling, acceleration (graphics
  card or processor), “Keep the mic open between dictations” and the voice detector.
- “Debug mode”: “Shows the debug tools. Also Ctrl+Shift+D.” The “Debug” section adds the logs, the paste delays,
  “Reliable Paste (Beta)” and other fine-tuning settings.

### About

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/reglages-a-propos-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/reglages-a-propos-clair.png">
    <img src="../media/en/reglages-a-propos-sombre.png" width="696" alt="The About tab: version, updates, source code, folders, credits">
  </picture>
</p>

#### Updates

The version (“Version 0.1.0, up to date”) and “Updates”: “Check”, then “Install” when a version is available. J’écoute
restarts on the new version.

<p align="center"><img src="../media/en/fonctions/mises-a-jour.png" width="455" alt="The Updates row and its Check button"></p>

#### Folders and credits

“Source code” (github.com/ponthieutheo/jecoute), “App data” (“Models, settings, recordings.”) and “Logs” open with
one click. Below, “Based on Handy by CJ Pais”, the thanks to ggml and the character’s license.

<p align="center"><img src="../media/en/fonctions/credits.png" width="455" alt="The Based on Handy by CJ Pais credit, the acknowledgments and the character’s license"></p>

## History

“History”, at the top of the home screen (or “All history”): every dictation kept, grouped by day, updated live.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/historique-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/historique-clair.png">
    <img src="../media/en/historique-sombre.png" width="696" alt="The history: search, filters, dictations by day with their time">
  </picture>
</p>

Each row has its buttons: “Play”, “Copy”, the star (“Add to favorites”) and “More”, which expands it: the player,
“Re-transcribe” (the same recording, transcribed again with the active model, and reviewed by the AI again if the
original was) and the trash can (“Delete”). At the bottom, the number of dictations and “Recordings folder”.

### Search

“Search”, or Ctrl+F: looks in the final text and in the raw text, across the whole history.

<p align="center"><img src="../media/en/fonctions/recherche.png" width="696" alt="Searching the history and the matching dictations"></p>

### Favorites

The star keeps a dictation for good: favorites are never erased, whatever the history limit. The “All”, “Favorites”
and “AI-corrected” filters sort the list.

<p align="center"><img src="../media/en/fonctions/favoris.png" width="696" alt="The Favorites filter and starred dictations"></p>

### Raw or corrected

A dictation reviewed by the AI carries the “AI” tag. Expanded, it shows the “Corrected by AI” box with the name of the
instruction, and two versions: “Corrected” (what was pasted, with the AI’s additions highlighted) and “Raw” (what the
model heard, with what the AI removed struck through).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/historique-brut-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/historique-brut-clair.png">
    <img src="../media/en/historique-brut-sombre.png" width="696" alt="A corrected dictation, expanded, in its Raw version: the words removed by the AI struck through">
  </picture>
</p>

<p align="center"><img src="../media/en/fonctions/brut-corrige.png" width="600" alt="The Corrected by AI box: Corrected or Raw, highlighted and struck-through words"></p>

### Playback

▶ expands the row and plays the recording. Only one plays at a time; the bar lets you skip ahead or back.

<p align="center"><img src="../media/en/fonctions/lecture.png" width="692" alt="The player of an expanded dictation, Re-transcribe and the trash can"></p>

## Calls

“Calls”, at the top of the home screen: J’écoute records a call (Discord, Meet, Teams…) and puts it into words. It keeps
your microphone and the computer’s sound, that is, the other people’s voices. No bot joins the call: nothing changes for
the others, so tell them you are recording.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/appels-direct-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/appels-direct-clair.png">
    <img src="../media/en/appels-direct-sombre.png" width="696" alt="The Calls page during a call: “Stop” with the length, “Live” and the sentences coming in">
  </picture>
</p>

### Start and stop

Three ways to start recording, and the same ones to stop:

- “Record a call”, at the top of the Calls page, then “Stop” (with the length);
- “Record a call” in the tray icon menu, next to the clock, then “Stop recording the call”;
- `jecoute.exe --toggle-call`, for a shortcut or a script: it starts the call, or stops it if one is being recorded.

During the call, the home screen shows it: the timer in red instead of “Calls”, “Recording a call” under the character,
the last sentence heard, “Stop” and “See the call”.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/accueil-appel-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/accueil-appel-clair.png">
    <img src="../media/en/accueil-appel-sombre.png" width="696" alt="Home during a call: the timer at the top, “Recording a call”, the last sentence heard, Stop and See the call">
  </picture>
</p>

Dictation keeps working during a call, and it goes first: your shortcut writes your sentence as usual, the call waits
its turn.

### Live

On the Calls page, “Live”: “Each sentence appears here a few seconds after it is said.” “Me” is your microphone, “The
others” the computer’s sound. “The final version is written again when the call ends.”

### The transcript

When you stop: “Putting the call into words…”. The whole call is transcribed again with your model, person by person.
“Me” is always your microphone; the others become “Person 2”, “Person 3”… with “Separate the voices” (otherwise, “The
others”). Voices are also told apart when several people talk in front of the same PC, without a call.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/appels-transcription-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/appels-transcription-clair.png">
    <img src="../media/en/appels-transcription-sombre.png" width="696" alt="A written call, Transcript tab: each sentence with its time and the person’s first name">
  </picture>
</p>

Click a person to give them a name (“Click to give a name”): the transcript, the copy and the export use it. The call’s
title is changed the same way.

<p align="center"><img src="../media/en/fonctions/appels-personnes.png" width="456" alt="The people in the call, named, and the field to rename one"></p>

### The summary and the tasks

Once the call is written, the AI takes notes: a title, a summary in a few sentences, the “Key points” and the “Tasks”,
with who does what and when. Check a task off when it is done: the call list shows how many are left. “Redo the
summary” writes it again, for example after naming the people.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/appels-resume-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/appels-resume-clair.png">
    <img src="../media/en/appels-resume-sombre.png" width="696" alt="A written call, Summary tab: the title, the people, the summary, the key points">
  </picture>
</p>

<p align="center"><img src="../media/en/fonctions/appels-taches.png" width="458" alt="The call’s tasks to check off, with who does them and when"></p>

The summary is written by the AI provider set up for [AI correction](#ai-correction): J’écoute sends it the transcript,
never the sound. Without a provider, “No summary without AI”: the call keeps its transcript, with no summary or tasks.
The details: [privacy.md](privacy.md#calls).

### Copy, export, delete

“Copy” puts the call on the clipboard, in Markdown: the date, the length, the people, the summary, the key points, the
tasks, then the transcript. “Export” writes the same text to a `.md` file in your Documents folder, and shows it to you
in File Explorer. The trash can deletes the call, after you confirm.

### Call settings

The settings icon, at the top right of the Calls page:

- “Computer sound”: “Also records what the computer plays: the other people’s voices. Off: your microphone only.” On by
  default.
- “Separate the voices”: it needs a small model (29 MB), downloaded once from Hugging Face with “Download”. On by
  default.
- “AI summary”: the provider and the model that write it, or “No AI provider is set up”. On by default.
- “The microphone is the dictation one.”: “Change microphone” opens Settings › Sound.

<p align="center"><img src="../media/en/fonctions/appels-reglages.png" width="348" alt="The call settings: computer sound, separate the voices, AI summary, microphone"></p>

If J’écoute stops in the middle of a call (crash, “Quit”), the call is written at the next launch.

## Statistics

“Statistics”, at the top of the home screen: what dictation does for you, in numbers. Everything is counted on your
computer (“Counted on this computer, never sent.”).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/statistiques-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/statistiques-clair.png">
    <img src="../media/en/statistiques-sombre.png" width="696" alt="The Statistics page: days in a row, words dictated, time saved, speed, dictations, the chart of words per day and Where you dictate">
  </picture>
</p>

### The numbers

Pick the period at the top: “Week” (7 days), “Month” (30 days) or “All”.

| Number           | What it counts                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------- |
| “Words dictated” | the words in your dictations                                                                  |
| “Time saved”     | the time it would have taken to type them at 45 words/min, minus the time spent saying them   |
| “Speed”          | your words per minute when you dictate                                                        |
| “Dictations”     | the number of dictations                                                                      |
| “days in a row”  | “Days in a row with at least one dictation, up to today or yesterday.” (the pill, at the top) |

<p align="center"><img src="../media/en/fonctions/stats-chiffres.png" width="684" alt="The numbers: words dictated, time saved, speed, dictations, and the days-in-a-row pill"></p>

### The chart and “Where you dictate”

The chart shows your words per day (per week or per month over a long period); hover a bar to see its number. “Where
you dictate” lists the apps your dictations were pasted into, from the most used to the least: the app in the
foreground when pasting, only the program’s name.

<p align="center"><img src="../media/en/fonctions/stats-applis.png" width="269" alt="Where you dictate: the apps and their share of the words dictated"></p>

### Where the numbers come from

The statistics have their own counter: clearing the history does not erase them. On the first launch of 0.2.0,
J’écoute picks up the dictations still in your history with their recording (without the apps, which it did not know).
Before your first dictation, the page says “No numbers yet”.

<p align="center"><img src="../media/en/fonctions/stats-vide.png" width="456" alt="The Statistics page before the first dictation: No numbers yet"></p>

“Reset”, at the bottom, erases all the numbers, after you confirm. Your dictation history is not touched.

<p align="center"><img src="../media/en/fonctions/stats-remise-a-zero.png" width="496" alt="Reset the statistics? The confirmation"></p>

## Models

“Change” (Settings › Dictation), “All models” (model pill) or “Choose a model” open the list: the 69 models of the
catalog, “Sorted for English.” (for the Windows language). “Downloaded models” at the top, “Available to download”
below. How to choose: [models.md](models.md).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/modeles-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/modeles-clair.png">
    <img src="../media/en/modeles-sombre.png" width="696" alt="The model list: search, filters, Downloaded models, Available to download, accuracy and speed">
  </picture>
</p>

Each model shows its tags (“Recommended”, “Live text”), its description, its “Accuracy” and “Speed” bars,
“Translates to English” if it can translate, its size and languages (“1.6 GB, 14 languages”).

### Filters

“Search” by name. The icons filter: the globe by language (“All languages” or one language), the waves (“Filter models
that support live streaming transcription”), translation (“Filter models that support translation to English”). The
circular arrow: “Rescan for models added to the models folder or Hugging Face cache outside J’écoute”.

<p align="center"><img src="../media/en/fonctions/modeles-filtres.png" width="455" alt="The search box and filters of the model list"></p>

### Download, use, delete

“Download”: the bar moves, with the speed, and “Cancel”. Then “Verifying...” and the model moves to “Downloaded
Models”. A model that finishes downloading becomes the active model. “Use” picks another one; the trash can deletes it
(after confirmation).

<p align="center"><img src="../media/en/fonctions/modele-telechargement.png" width="455" alt="A model downloading: the bar, the percentage, the speed, Cancel"></p>

## First launch

“Welcome to J’écoute”: “Choose the model that transcribes your voice. It runs on your computer, nothing goes online.”
Three models are suggested for your language and your machine (“Recommended for English” on the first one); “See the
69 models” opens the rest. The button says what it will do: “Download Cohere Transcribe (1.6 GB)”. You follow the
download right there, then the home screen opens.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/bienvenue-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/bienvenue-clair.png">
    <img src="../media/en/bienvenue-sombre.png" width="696" alt="Welcome to J’écoute: the character, three recommended models, the Download button">
  </picture>
</p>

If Windows blocks microphone access, a “Permissions required” step is added, with a button that opens the right
Windows settings.
