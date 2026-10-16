# Contribuer à J’écoute

Merci de ton intérêt pour J’écoute ! Les petites modifications ciblées sont les plus faciles à relire et à
accepter.

_English is welcome: the same steps apply._

## Avant de commencer

- **Un bug** : cherche d'abord dans les [issues](https://github.com/ponthieutheo/jecoute/issues?q=is%3Aissue)
  (ouvertes et fermées) et dans la section « Dépannage » du [README](README.md#dépannage), puis ouvre une issue
  avec le modèle « Signaler un bug ».
- **Une nouvelle fonctionnalité** : ouvre d'abord une issue pour en parler, avant d'écrire du code.
- **Une faille de sécurité** : jamais d'issue publique, voir [SECURITY.md](SECURITY.md).
- **Le cœur de l'app vient de [Handy](https://github.com/cjpais/Handy)** (transcription, audio, raccourcis,
  collage). Si le problème existe aussi dans Handy, signale-le également là-bas : les correctifs de Handy arrivent
  dans J’écoute à chaque synchronisation.

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
bun run build
cd src-tauri; cargo test    # si le code Rust change
```

Si l'interface change, joins des captures avant / après, en thème clair et en thème sombre.

## Traductions

Les textes de l'interface sont dans `src/i18n/locales/<langue>/translation.json` ; l'anglais (`en`) sert de
référence.

- **Corriger une traduction** : modifie la valeur dans le fichier de la langue.
- **Ajouter un texte** : ajoute la clé dans `en` et `fr`, puis dans les autres langues (traduite, ou à défaut en
  anglais). `bun run check:translations` vérifie que chaque langue a exactement les clés de `en`.
- **Ajouter une langue** : copie `src/i18n/locales/en/translation.json` dans `src/i18n/locales/<code>/` (code
  ISO 639-1), traduis les valeurs, puis déclare la langue dans `src/i18n/languages.ts` (avec `direction: "rtl"`
  pour une langue de droite à gauche).

Dans tous les cas : ne traduis que les valeurs, jamais les clés ; garde les variables telles quelles
(`{{model}}`, `{{error}}`…) et les noms propres (J’écoute, avec son apostrophe ’). Pour vérifier le rendu :
`bun run tauri dev`, puis **À propos > Langue de l'application**.

## Licence

Le code est sous licence MIT (voir [LICENSE](LICENSE)) : en proposant une modification, tu acceptes qu'elle soit
publiée sous cette licence. Le personnage (`src/character/` et les icônes) a sa propre licence, indiquée dans
chaque dossier concerné ; pour une modification qui le touche, ouvre d'abord une issue.
