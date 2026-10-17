# Contribuer à J’écoute

Merci de ton intérêt pour J’écoute ! Les petites modifications ciblées sont les plus faciles à relire et à
accepter.

_English summary at the end of this page._

## Avant de commencer

- **Un bug** : cherche d'abord dans les [issues](https://github.com/ponthieutheo/jecoute/issues?q=is%3Aissue)
  (ouvertes et fermées) et dans la section « Dépannage » du [README](README.md#dépannage), puis ouvre une issue
  avec le modèle « Signaler un bug ».
- **Une nouvelle fonctionnalité** : ouvre d'abord une issue pour en parler, avant d'écrire du code.
- **Une faille de sécurité** : jamais d'issue publique, voir [SECURITY.md](SECURITY.md).
- **Le cœur de l'app vient de [Handy](https://github.com/cjpais/Handy)** (transcription, audio, raccourcis,
  collage). Si le problème existe aussi dans Handy, signale-le également là-bas : les correctifs de Handy arrivent
  dans J’écoute à chaque synchronisation.

## Où est quoi

| Dossier             | Contenu                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------ |
| `src/app/`          | la fenêtre principale : accueil, historique, réglages (cinq onglets), modèles, bienvenue   |
| `src/character/`    | le personnage 3D (three.js) de l'accueil et de la fenêtre d'enregistrement                 |
| `src/overlay/`      | la fenêtre d'enregistrement, qui s'affiche pendant une dictée                              |
| `src/components/`   | les réglages et composants partagés                                                        |
| `src/i18n/locales/` | les traductions                                                                            |
| `src-tauri/`        | le cœur en Rust, repris de Handy : audio, raccourcis, transcription, collage, mises à jour |

## Proposer une modification

1. Forke le dépôt et crée une branche depuis `main`.
2. Installe l'environnement de développement : voir [BUILD.md](BUILD.md) (Windows x64).
3. Fais une seule correction ou fonctionnalité par pull request, avec des commits clairs.
4. Lance les vérifications ci-dessous, puis ouvre la pull request en remplissant son modèle.

## Vérifications

Ce sont celles de la CI ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)) :

```powershell
bun run lint
bun run format:check        # bun run format corrige la mise en forme
bun run check:translations
bun run check:model-languages
bun run test:keyboard
bun src/components/update-checker/portableInstaller.test.ts
bun src/components/settings/history/clipboard.test.ts
bun run build
cd src-tauri; cargo test    # si le code Rust change
```

Si l'interface change, joins des captures avant / après, en thème clair et en thème sombre.

## Traductions

Les textes de l'interface sont dans `src/i18n/locales/<langue>/translation.json` ; l'anglais (`en`) sert de
référence.

- **Corriger une traduction** : modifie la valeur dans le fichier de la langue.
- **Ajouter un texte** : ajoute la clé dans `en` et `fr`, puis dans les autres langues (traduite, ou à défaut en
  anglais). `bun run check:translations` vérifie que chaque langue a exactement les clés de `en`, avec les formes
  du pluriel propres à la langue (`_one`, `_few`, `_many`, `_other`…).
- **Ajouter une langue** : copie `src/i18n/locales/en/translation.json` dans `src/i18n/locales/<code>/` (code
  ISO 639-1), traduis les valeurs, puis déclare la langue dans `src/i18n/languages.ts` (avec `direction: "rtl"`
  pour une langue de droite à gauche).

Dans tous les cas : ne traduis que les valeurs, jamais les clés ; garde les variables telles quelles
(`{{model}}`, `{{error}}`…) et les noms propres (J’écoute, avec son apostrophe ’). Pour vérifier le rendu :
`bun run tauri dev`, puis **Réglages > Application > Langue de l’interface**.

## Licence

Le code est sous licence MIT (voir [LICENSE](LICENSE)) : en proposant une modification, tu acceptes qu'elle soit
publiée sous cette licence. Le personnage et ses images (`src/character/`, `src/assets/perso/`, les icônes, les
images de l'installeur et de la zone de notification) sont sous licence PolyForm Noncommercial 1.0.0, indiquée
dans chaque dossier concerné ; pour une modification qui le touche, ouvre d'abord une issue.

## In English

Contributions in English are welcome. Open an issue first for a new feature; report security issues privately
(see [SECURITY.md](SECURITY.md)). Set up the build with [BUILD.md](BUILD.md) (Windows x64), keep one fix or
feature per pull request, and run the checks above (the same as the CI). New interface strings go in
`src/i18n/locales/en` and `fr` at least, then in the other languages (`bun run check:translations`). Code is MIT;
the character and its images are PolyForm Noncommercial 1.0.0.
