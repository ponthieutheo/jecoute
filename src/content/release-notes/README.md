# Notes de version affichées dans l'app

Après une mise à jour, J’écoute peut afficher une fenêtre « Nouveautés de J’écoute v<version> ». Son texte vient
d'un fichier Markdown de ce dossier, nommé d'après la version :

```text
src/content/release-notes/0.1.1.md
```

- La fenêtre montre la note la plus récente qui est plus récente que la dernière note vue
  (`whats_new_last_seen_version`) sans dépasser la version de l'app. Elle s'affiche une seule fois.
- Une nouvelle installation enregistre sa propre version comme déjà vue : la note de la version installée ne
  s'affiche donc qu'aux personnes qui font une mise à jour. C'est pourquoi la 0.1.0, première version, n'a pas
  de note.
- L'utilisateur peut couper ces fenêtres (Réglages > Application > Afficher les nouveautés). En mode débogage,
  « Aperçu des nouveautés » montre la dernière note sans la marquer comme lue.
- Un seul fichier par version, affiché quelle que soit la langue de l'interface : écris d'abord le texte en
  français, puis une partie `## English`.

Garde l'essentiel : ce qui change pour l'utilisateur. Le Markdown accepte paragraphes, titres, listes, liens,
code, citations, séparateurs, retours à la ligne forcés et images locales sous `/release-notes/...` ; le HTML
brut est ignoré.

Les images vont dans `public/release-notes/<version>/` (dossier à créer à la racine du dépôt) et se citent par
un chemin absolu :

```md
![Le nouvel accueil](/release-notes/0.1.1/accueil.webp)
```

_In English: one Markdown file per version (`<version>.md`), shown once after an update, never on a fresh
install; write French first, then an `## English` section._
