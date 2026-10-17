# Choosing a model

[Français](../modeles.md) · **English**

J’écoute runs a speech recognition model on your PC. The catalog holds 69 of them, from 33 MB to 16 GB, all in GGUF
format, downloaded from Hugging Face and run with ggml (transcribe.cpp). You can keep several and switch with one
click, from the model pill on the home screen.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="../media/en/modeles-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="../media/en/modeles-clair.png">
    <img src="../media/en/modeles-sombre.png" width="696" alt="The model list, sorted for English, with accuracy and speed bars">
  </picture>
</p>

## What matters

1. **Your language.** A model only transcribes the languages it knows: a single one for Parakeet Unified EN 0.6B
   (English), up to 100 for Whisper Large v3. Some detect the language on their own (Parakeet TDT 0.6B v3, Nemotron
   Streaming 3.5, Whisper). The others use the language picked in “Spoken language”, or the Windows one if you leave
   it on “Auto”.
2. **Your machine.** With a graphics card (Vulkan), even a large, accurate model stays fast. On the processor alone,
   a model under 1 GB feels better.
3. **Live text.** “Live text” models write while you speak. The dictation window then shows the text, instead of the
   character.
4. **Translation.** Some models write in English what you say in another language (“Translate to English”, in
   Settings › Dictation).

In the list, each model has two bars, “Accuracy” and “Speed”: these are the catalog’s scores, out of 100, from
benchmarks. The tables below list them.

## What J’écoute picks for you

The list is sorted for the Windows language (“Sorted for English.”), from a selection of ten models:

1. **with a graphics card**, the most accurate model of the selection that knows your language;
2. then the most accurate light model (up to 1 GB) that works without any setting for your language: it detects it
   on its own, or it is the only one it knows;
3. then the other models that know your language, and finally the ones that don’t.

On first launch, the first three are suggested, the first one tagged “Recommended for English”. If J’écoute finds no
graphics card, step 1 is skipped: the light model goes first.

## For English

The models tagged “Recommended” on an English Windows, in list order with a graphics card:

| Model                        | Size   | Languages | Accuracy | Speed | What stands out                                                                                                             |
| ---------------------------- | ------ | --------- | -------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| **Cohere Transcribe**        | 1.6 GB | 14        | 92       | 63    | the most accurate; best with a graphics card. It does not detect the language: it uses the one you pick, or the Windows one |
| **Parakeet Unified EN 0.6B** | 697 MB | 1         | 90       | 79    | English only, live, fast and accurate: the pick without a graphics card                                                     |
| **Nemotron Streaming 3.5**   | 716 MB | 28        | 82       | 84    | live text, detects the language on its own                                                                                  |
| **Canary 180M Flash**        | 208 MB | 4         | 88       | 98    | tiny and instant; English, French, German, Spanish; translates to English                                                   |
| **Whisper Medium**           | 793 MB | 99        | 84       | 42    | the most languages, translates to English, slower                                                                           |

On first launch: Cohere Transcribe, Parakeet Unified EN 0.6B and Nemotron Streaming 3.5 with a graphics card;
Parakeet Unified EN 0.6B, Nemotron Streaming 3.5 and Canary 180M Flash without. Another option for English only,
without live text: Parakeet TDT 0.6B v2 (695 MB, accuracy 89, speed 85).

## For French

On a French Windows:

| Model                      | Size   | Languages | Accuracy | Speed | What stands out                                                                                                      |
| -------------------------- | ------ | --------- | -------- | ----- | -------------------------------------------------------------------------------------------------------------------- |
| **Cohere Transcribe**      | 1.6 GB | 14        | 92       | 63    | the most accurate; best with a graphics card                                                                         |
| **Parakeet TDT 0.6B v3**   | 705 MB | 25        | 88       | 79    | fast, detects the language on its own: the pick without a graphics card, or if you switch between French and English |
| **Nemotron Streaming 3.5** | 716 MB | 28        | 82       | 84    | live text, detects the language on its own                                                                           |
| **Canary 180M Flash**      | 208 MB | 4         | 88       | 98    | tiny and instant, translates to English                                                                              |
| **Whisper Medium**         | 793 MB | 99        | 84       | 42    | the most languages, translates to English, slower                                                                    |

On first launch: Cohere Transcribe, Parakeet TDT 0.6B v3 and Nemotron Streaming 3.5 with a graphics card; Parakeet
TDT 0.6B v3, Nemotron Streaming 3.5 and Canary 180M Flash without.

## Other options

| If you want           | Look at                                                                                  |
| --------------------- | ---------------------------------------------------------------------------------------- |
| the lightest possible | Moonshine Tiny (33 MB, English), Whisper Tiny (43 MB, 99 languages)                      |
| the most languages    | Whisper Large v3 (1.1 GB, 100 languages, translates to English)                          |
| live text, in English | Moonshine Streaming Small (189 MB), Moonshine Streaming Medium (282 MB)                  |
| another language      | the language filter (the globe) of the model list: it only keeps the models that know it |

## Where models are stored

| Install  | Downloaded models                                                                        | Models added by hand                              |
| -------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------- |
| normal   | `%USERPROFILE%\.cache\huggingface\hub` (the Hugging Face cache, shared with other tools) | `%APPDATA%\io.github.ponthieutheo.jecoute\models` |
| portable | `Data\huggingface\hub`, next to `jecoute.exe`                                            | `Data\models`                                     |

A catalog model already in the Hugging Face cache is not downloaded again, and other compatible GGUF files found there
show up in the list.

To add a model by hand, copy its `.gguf` file into the `models` folder of the app data (Settings › About ›
“App data”), then click the circular arrow of the list (“Rescan for models added to the models folder or Hugging
Face cache outside J’écoute”): it shows up with the “Custom” tag.

A model’s trash can deletes it from disk, Hugging Face cache included. “Free up memory” (Settings › App) unloads it
from memory when you stop dictating, without deleting it.
