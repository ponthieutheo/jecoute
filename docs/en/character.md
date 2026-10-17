# The J’écoute character

[Français](../personnage.md) · **English**

A red horned ball, in 3D, with a painted face and two small hands. It plays in two scenes: the dictation window,
which pops up at the bottom of the screen while you speak, and the home screen of the main window, where it lives
between dictations.

_The animations below are recordings of the app, on a transparent background._

## During a dictation

You hold Ctrl+Space: it pops up with an elastic bounce, straightens up, eyes wide open, and waits for your voice.

<table>
  <tr>
    <td width="280" align="center"><img src="../media/perso/apparition.webp" width="260" alt="The character pops up at the bottom of the screen, then slips away"></td>
    <td><b>It pops up, then slips away.</b> At the end, a smile and a nod. If you cancel, it shrugs, with a drop of sweat. If something goes wrong, an “oops”.</td>
  </tr>
  <tr>
    <td width="280" align="center"><img src="../media/perso/ecoute.webp" width="260" alt="It cups its ear and listens, nodding"></td>
    <td><b>It leans in to listen</b>, a hand cupped to its ear. Sound arcs follow your voice, and it nods now and then while you speak.</td>
  </tr>
  <tr>
    <td width="280" align="center"><img src="../media/perso/frappe.webp" width="260" alt="It types on a tiny black keyboard"></td>
    <td><b>It types your sentence</b> during transcription: a tiny black keyboard pops up under it, the keys go down under its hands.</td>
  </tr>
  <tr>
    <td width="280" align="center"><img src="../media/perso/chuchote.webp" width="260" alt="It whispers behind its hand"></td>
    <td><b>It whispers</b> behind its hand while the AI reviews the text (with Ctrl+Shift+Space).</td>
  </tr>
</table>

Typing lasts at least one second, even when transcription is faster. Only the animation waits: the text is already
pasted.

With a model that writes live, the dictation window shows your text while you speak, instead of the character. The
other options are in Settings › App › “During a dictation”: “Character” (default), “Live text”, “Minimal” or “None”.

<p align="center"><img src="../media/perso/styles-overlay.png" width="696" alt="The dictation window styles side by side: the character, the live text card, the minimal pill"></p>

## In the window

Between dictations, it stays in the middle of the home screen. It breathes, blinks, floats a little.

<table>
  <tr>
    <td width="280" align="center"><img src="../media/perso/repos.webp" width="260" alt="Its idle scenes"></td>
    <td><b>Its little scenes.</b> Every 8 to 20 seconds, never the same one twice in a row: it looks around, stretches, yawns, spins around, drums its fingers, waves, listens to the silence or hums.</td>
  </tr>
  <tr>
    <td width="280" align="center"><img src="../media/perso/regard.webp" width="260" alt="It follows a cursor with its eyes"></td>
    <td><b>It follows your mouse</b>, even outside the window: the eyes jump from point to point, the head follows smoothly. When you open the settings, it moves aside and reads them with you.</td>
  </tr>
  <tr>
    <td width="280" align="center"><img src="../media/perso/clic.webp" width="260" alt="Its reactions to a click"></td>
    <td><b>Click on it</b>: a jump, a fit of giggles, an “ouch” or a spin. Three clicks in a row annoy it: it sulks, head turned away.</td>
  </tr>
  <tr>
    <td width="280" align="center"><img src="../media/perso/dodo.webp" width="260" alt="It gets drowsy, then falls asleep"></td>
    <td><b>It falls asleep</b> after 75 seconds of nothing, and wakes up with a start when the mouse moves. If you come back after more than 20 seconds away, it waves at you.</td>
  </tr>
</table>

## Its moods

Outside a dictation, it takes the mood of the home screen: ready, loading (it watches the bar move, drums, sighs), no
microphone (it listens and hears nothing, taps its ear, puzzled) or error (embarrassed, after the “oops”). During a
dictation: listening, typing, whispering.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/perso/etats-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/perso/etats-clair.png">
    <img src="../media/perso/etats-sombre.png" width="760" alt="Its moods: ready, loading, no microphone, error, listening, typing, whispering">
  </picture>
</p>

| Mood          | When                                                                 |
| ------------- | -------------------------------------------------------------------- |
| ready         | “Ready”, or right after “Pasted”                                     |
| loading       | the model is loading or downloading                                  |
| no microphone | no microphone, microphone blocked by Windows, or no model chosen yet |
| error         | the model didn’t load                                                |
| listening     | you are speaking                                                     |
| typing        | transcription                                                        |
| whispering    | the AI review                                                        |

## Light when nobody is watching

It runs in 3D in the window (WebGL), at 60 frames per second, or 30 if the machine struggles. It stops completely
when the window is hidden or minimized, and the dictation window only runs while it is on screen. Without WebGL, a 2D
head replaces it in the window, and the dictation window falls back to the minimal pill.

## The character’s license

The character (its 3D model, face, animations and all its images) is licensed under
**[PolyForm Noncommercial 1.0.0](../../src/character/LICENSE)**:

> Required Notice: Copyright (c) 2026 Théo Ponthieu

You may use, change and share it freely for **noncommercial** purposes. Every copy must come with these terms and
the notice above. It is not part of the MIT code: for commercial use of the app, remove it or get its author’s
permission.

The folders concerned each carry this license file: `src/character/` (the 3D code and the face),
`src/assets/perso/`, `docs/media/perso/` (the pictures on this page), `src-tauri/icons/`, `src-tauri/resources/` and
`src-tauri/nsis/` (the icons). The rest of J’écoute is under the [MIT license](../../LICENSE).

For developers: the contract between the app and the character is described (in French) in
[src/character/README.md](../../src/character/README.md).
