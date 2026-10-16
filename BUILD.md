# Compiler J’écoute

J’écoute est publié pour **Windows x64**. Ce guide couvre ce cas ; les releases officielles sont construites par
GitHub Actions (voir [`.github/RELEASE.md`](.github/RELEASE.md)).

## Prérequis (Windows 10/11 x64)

- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) 2022 ou plus récent,
  charge de travail « Développement Desktop en C++ » (MSVC et SDK Windows) ;
- [CMake](https://cmake.org/download/) dans le `PATH` : `winget install Kitware.CMake` ;
- le [SDK Vulkan](https://vulkan.lunarg.com/sdk/home) de LunarG, pour le backend GPU (en-têtes, `glslc`) :
  `winget install KhronosGroup.VulkanSDK` (il définit `VULKAN_SDK`) ;
- [Rust](https://rustup.rs/) stable ;
- [Bun](https://bun.sh/).

Ouvre un nouveau terminal après ces installations pour que `PATH` et `VULKAN_SDK` soient à jour. WebView2 est déjà
présent sous Windows 11. Versions vérifiées : Visual Studio Build Tools 2026, CMake 4.4, SDK Vulkan 1.4.363
(1.4.309 dans la CI), Rust 1.99, Bun 1.3.12.

> [!NOTE]
> Si la CLI Tauri ne trouve pas `cargo` alors que `cargo --version` marche, vérifie qu'aucune entrée du `PATH` ne
> contient de guillemet (certains installeurs laissent par exemple `C:\Program Files\Tailscale"`) : la CLI lit alors
> tout le reste du `PATH` comme une seule entrée. Retire le guillemet dans les variables d'environnement de Windows.

## Développement

```powershell
git clone https://github.com/ponthieutheo/jecoute.git
cd jecoute
bun install
bun run tauri dev
```

La première compilation prend une vingtaine de minutes (ggml avec Vulkan). Avant de proposer une modification :
`bun run lint`, `bun run format:check`, `bun run build`, et `cargo test` dans `src-tauri/` si le code Rust change.

## Installeurs

```powershell
bun run tauri build
```

Résultat : `src-tauri\target\release\bundle\nsis\J’écoute_<version>_x64-setup.exe` et
`bundle\msi\J’écoute_<version>_x64_en-US.msi` (renommés `Jecoute_…` dans les releases).

- **Clé de mise à jour.** `tauri.conf.json` active `createUpdaterArtifacts` : `tauri build` signe les fichiers de
  mise à jour et a besoin de `TAURI_SIGNING_PRIVATE_KEY` (le contenu de la clé, sur une seule ligne) et de
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Sans la clé, désactive ces fichiers pour ton build : crée
  `src-tauri\tauri.local.conf.json` (ignoré par git) contenant `{"bundle": {"createUpdaterArtifacts": false}}`, puis
  `bun run tauri build --config src-tauri/tauri.local.conf.json`.
- **Comme une release officielle.** La CI ajoute deux réglages lus par `src-tauri/build.rs` : `HANDY_VC_REDIST_DIRS`
  (dossiers du runtime VC++ de Visual Studio, copié à côté de l'exe pour les PC sans redistribuable récent) et
  `ORT_LIB_LOCATION` + `ORT_PREFER_DYNAMIC_LINK=1` (ONNX Runtime officiel de Microsoft en DLL, au lieu de la
  version embarquée compilée en AVX2, qui plante au démarrage sur les processeurs Intel antérieurs à Haswell
  (2013) et les anciens AMD). Voir les étapes
  correspondantes de [`.github/workflows/release.yml`](.github/workflows/release.yml).
- `bun run tauri build --no-bundle` compile seulement `jecoute.exe`, sans installeur.

## Dépannage

### Erreurs de longueur de chemin (`MSB3491`, `FTK1011`, `MSB6003`)

Le générateur de shaders Vulkan de ggml crée une arborescence très profonde sous
`target\release\build\<crate>-<hash>\out\build\...`, qui peut dépasser la limite de 260 caractères de Windows.
transcribe-cpp contourne le problème tout seul en compilant à travers une jonction NTFS courte sous
`%LOCALAPPDATA%\tcs`. Si l'erreur apparaît quand même (jonction refusée, ou dépôt cloné très profondément ; le
journal contient alors `transcribe-cpp-sys: could not create short build junction`), utilise un dossier cible
court :

```powershell
$env:CARGO_TARGET_DIR = "C:\t"
bun run tauri build
```

Les fichiers produits sont alors sous `C:\t\release\`. Activer les chemins longs de Windows ne suffit pas :
l'outil de suivi de MSBuild ne les prend pas en compte.

## Linux et macOS

Le code, repris de [Handy](https://github.com/cjpais/Handy), compile aussi sous Linux et macOS, mais J’écoute ne
publie pas encore ces versions et ne les teste pas. Les prérequis de ces systèmes sont dans le
[BUILD.md de Handy](https://github.com/cjpais/Handy/blob/v0.9.8/BUILD.md) ; ce qu'il faudrait pour les publier est
décrit dans [`.github/RELEASE.md`](.github/RELEASE.md).
