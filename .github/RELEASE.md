# Publier une version de J’écoute

Les releases sont construites par GitHub Actions ([`workflows/release.yml`](workflows/release.yml)), pour
**Windows x64 uniquement** pour l'instant. Le workflow crée toujours une release **brouillon** : rien n'est visible
des utilisateurs ni de la mise à jour automatique tant qu'elle n'est pas publiée à la main.

Fichiers d'une release :

| Fichier                           | Rôle                                                    |
| --------------------------------- | ------------------------------------------------------- |
| `Jecoute_<version>_x64-setup.exe` | installeur NSIS, celui que le README conseille          |
| `Jecoute_<version>_x64_en-US.msi` | installeur MSI                                          |
| `.sig` de chacun                  | signatures de mise à jour (clé de mise à jour de Tauri) |
| `latest.json`                     | manifeste lu par la mise à jour automatique             |
| `SHA256SUMS.txt`                  | sommes de contrôle                                      |

Les installeurs ne sont pas signés (pas de certificat de signature de code) : SmartScreen affiche un
avertissement, expliqué dans le README et dans le texte de la release.

## Une seule fois, après la création du dépôt

1. **Secrets** (Settings > Secrets and variables > Actions > New repository secret) :
   - `TAURI_SIGNING_PRIVATE_KEY` : le **contenu** du fichier de clé privée de mise à jour (une ligne base64), pas
     son chemin ;
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` : le mot de passe de cette clé.

   Avec la CLI GitHub, depuis le PC qui a la clé :

   ```powershell
   gh secret set TAURI_SIGNING_PRIVATE_KEY --repo ponthieutheo/jecoute --body (Get-Content <clé>.key -Raw).Trim()
   gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --repo ponthieutheo/jecoute --body (Get-Content <clé>.password -Raw).Trim()
   ```

   La clé doit correspondre à la clé publique de `src-tauri/tauri.conf.json` (`plugins.updater.pubkey`). Le
   workflow le vérifie avant de créer le brouillon : une autre clé casserait la mise à jour de toutes les
   installations. Ne jamais perdre cette clé : sans elle, les installations existantes ne pourront plus se mettre
   à jour.

2. **Actions** (Settings > Actions > General) :
   - _Actions permissions_ : « Allow all actions », ou bien GitHub + ces actions tierces : `oven-sh/setup-bun`,
     `dtolnay/rust-toolchain`, `swatinem/rust-cache`, `humbletim/install-vulkan-sdk` ;
   - _Workflow permissions_ : « Read repository contents » suffit. Les deux jobs qui écrivent (voir les
     brouillons existants, créer le brouillon) demandent eux-mêmes `contents: write`.

3. Facultatif : une règle (Settings > Rules > Rulesets) qui réserve la création des tags `v*` au propriétaire, car
   pousser un tag `v*` lance une release.

## Publier une version

1. Changer la version au même endroit dans `src-tauri/tauri.conf.json`, `package.json` et `src-tauri/Cargo.toml`
   (puis `cargo check` pour mettre `Cargo.lock` à jour), commiter et pousser sur GitHub. Le workflow refuse des
   versions différentes.
2. Lancer **Actions > Release > Run workflow** sur `main` (notes de version facultatives), ou pousser le tag
   `v<version>`. Décocher « Créer la release brouillon » donne seulement les fichiers, en artefact du workflow.
3. Le workflow vérifie les versions, les secrets et l'absence d'une release du même nom, construit avec Vulkan,
   contrôle le contenu des deux installeurs (installation portable silencieuse et extraction du MSI, puis
   `jecoute.exe --list-devices`), renomme les fichiers en ASCII, écrit `latest.json`, vérifie chaque signature
   contre la clé publique, puis crée le brouillon `v<version>`.
4. Relire le brouillon (fichiers, texte), tester l'installeur, puis **Publish release**. Ne pas cocher
   « pre-release » : la mise à jour automatique lit `releases/latest/download/latest.json`, qui ignore les
   brouillons et les pre-releases.

Les outils utilisés par le workflow :

- [`scripts/prepare-release.ps1`](scripts/prepare-release.ps1) : noms ASCII, `latest.json`, `SHA256SUMS.txt`,
  texte de la release ;
- [`tools/verify-updater-sig`](tools/verify-updater-sig) : relit `latest.json` et vérifie les signatures avec le
  même code que le plugin de mise à jour de Tauri ;
- [`scripts/test-release-tools.ps1`](scripts/test-release-tools.ps1) : les teste sans secret (job
  `outils-release` de `ci.yml`).

## Plus tard

### Signer les installeurs Windows

Avec un certificat de signature de code : `bundle.windows.certificateThumbprint` ou `bundle.windows.signCommand`
dans `tauri.conf.json`, et le certificat en secret. Handy utilisait Azure Trusted Signing (`trusted-signing-cli`
et les secrets `AZURE_*`), retiré ici.

### Réactiver Linux, macOS ou Windows ARM64

Point de départ : le workflow de Handy v0.9.8, `.github/workflows/build.yml` (`git show v0.9.8:.github/workflows/build.yml`
dans ce dépôt, ou [sur le dépôt de Handy](https://github.com/cjpais/Handy/blob/v0.9.8/.github/workflows/build.yml)).
Il faudra ensuite étendre `prepare-release.ps1` (noms ASCII et entrées de `latest.json` : `linux-x86_64`,
`darwin-aarch64`, `windows-aarch64-nsis`…) et la liste `--require` de la vérification.

- **Linux** (`ubuntu-22.04` pour le .deb, `ubuntu-24.04` pour AppImage et .rpm, `ubuntu-24.04-arm`) : paquets apt
  (webkit2gtk 4.1, appindicator, rsvg, patchelf, ALSA, OpenBLAS, X11, gtk-layer-shell), SDK Vulkan de LunarG,
  ONNX Runtime pour le .deb 22.04 (Handy le prenait sur son propre serveur : utiliser la release officielle de
  Microsoft, avec sa somme SHA-256), pré-build pour exposer `libtranscribe.so` à linuxdeploy,
  `LINUXDEPLOY_EXCLUDED_LIBRARIES=libvulkan.so*;libwayland-client.so*`, contrôles des paquets avec
  `--list-devices` sous xvfb. Renommer d'abord ensemble le dossier `/usr/lib/Handy` de `tauri.conf.json` et le
  rpath de `src-tauri/build.rs`. Le binaire s'appelle `jecoute` (`/usr/bin/jecoute`).
- **macOS** (`macos-26` pour Apple Silicon, `macos-latest` pour Intel) : certificat Developer ID et notarisation
  (secrets `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `KEYCHAIN_PASSWORD`, `APPLE_ID`, `APPLE_PASSWORD`,
  `APPLE_TEAM_ID`), ONNX Runtime en dylib pour Intel. Le binaire est `J’écoute.app/Contents/MacOS/jecoute`.
- **Windows ARM64** (`windows-11-arm`) : compilation avec clang-cl et Ninja, `TRANSCRIBE_CMAKE_ARGS=-DGGML_NATIVE=OFF
-DGGML_OPENMP=OFF`, `bun install --cpu=arm64`, chemin de `signtool`, sans Vulkan (CPU seulement). Le README
  mentionne déjà `Jecoute_<version>_arm64-setup.exe`.
