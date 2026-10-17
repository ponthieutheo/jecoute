# Confidentialité

**Français** · [English](en/privacy.md)

**La transcription est 100 % locale.** Ta voix est enregistrée et transcrite sur ton PC, par le modèle que tu as
téléchargé ; l’audio ne quitte jamais ta machine. J’écoute n’a pas de compte, pas de serveur à lui, pas de
statistiques d’usage ni de publicité.

## Ce qui sort de ton PC, et quand

| Quoi                                | Vers                                 | Quand                                                                                                                                           | Pour l’éviter                                                                                          |
| ----------------------------------- | ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| le téléchargement d’un modèle       | Hugging Face                         | quand tu cliques sur « Télécharger », au premier lancement ou dans la liste des modèles                                                         | une fois le modèle sur ton PC, plus rien ne sort pour transcrire                                       |
| la vérification des mises à jour    | GitHub (les releases de ce dépôt)    | au démarrage, quand tu cliques sur « Vérifier », puis le téléchargement si tu cliques sur « Installer »                                         | Réglages › Application › « Vérifier les mises à jour »                                                 |
| le texte d’une dictée               | le fournisseur d’IA que tu as choisi | seulement si la correction par IA est activée, et seulement quand tu dictes avec Ctrl+Maj+Espace (ou que tu retranscris une dictée faite ainsi) | laisser la correction par IA désactivée (c’est le réglage de départ), ou choisir un serveur sur ton PC |
| la liste des modèles du fournisseur | le fournisseur d’IA                  | quand tu choisis le fournisseur, ou avec « Actualiser la liste »                                                                                |                                                                                                        |

Le raccourci normal, Ctrl+Espace, n’envoie jamais rien : même avec la correction par IA activée, seul Ctrl+Maj+Espace
fait relire le texte.

## La correction par IA

Elle est désactivée au départ. Une fois activée (Réglages › Texte › « Correction par IA »), voici ce que reçoit le
fournisseur à chaque Ctrl+Maj+Espace :

- le texte transcrit, glissé dans ta consigne (`${output}` dans les « Instructions ») ;
- ta clé d’API, pour t’identifier chez lui ;
- le nom de l’app (`Jecoute`) et l’adresse de ce dépôt, dans les en-têtes de la requête.

Jamais l’audio. Ce que le fournisseur fait du texte dépend de ses propres conditions : lis-les avant de choisir. Pour
que rien ne sorte, choisis « Custom » et l’adresse d’un serveur compatible OpenAI qui tourne sur ton PC
(`http://localhost:11434/v1` au départ).

La clé d’API est enregistrée avec tes réglages, sur ton PC, dans `settings_store.json` (en clair, comme le reste des
réglages). Elle est masquée dans les journaux.

## Où sont tes données

Rien n’est envoyé ailleurs : tout est dans ces dossiers.

| Quoi                                               | Installation normale                                           | Installation portable      |
| -------------------------------------------------- | -------------------------------------------------------------- | -------------------------- |
| réglages, mots à reconnaître, consignes, clé d’API | `%APPDATA%\io.github.ponthieutheo.jecoute\settings_store.json` | `Data\settings_store.json` |
| historique (le texte des dictées)                  | `%APPDATA%\io.github.ponthieutheo.jecoute\history.db`          | `Data\history.db`          |
| enregistrements audio (WAV)                        | `%APPDATA%\io.github.ponthieutheo.jecoute\recordings\`         | `Data\recordings\`         |
| modèles ajoutés à la main                          | `%APPDATA%\io.github.ponthieutheo.jecoute\models\`             | `Data\models\`             |
| modèles téléchargés                                | `%USERPROFILE%\.cache\huggingface\hub\`                        | `Data\huggingface\hub\`    |
| journaux                                           | `%LOCALAPPDATA%\io.github.ponthieutheo.jecoute\logs\`          | `Data\logs\`               |

En portable, `Data\` est à côté de `jecoute.exe`. Réglages › À propos › « Données de l’application » et « Journaux »
ouvrent ces dossiers.

## Ce que l’historique garde

- **Par défaut, tes 5 dernières dictées**, avec leur enregistrement, plus les favoris. Les plus anciennes s’effacent.
- **La règle se choisit** dans Réglages › Application › « Enregistrements audio » : « Garder les 5 plus récents » (le
  nombre réglé dans « Historique »), « Les garder » (rien ne s’efface), ou effacer ce qui a plus de 3 jours, 2 semaines
  ou 3 mois. Une dictée effacée part avec son enregistrement ; les favoris restent toujours.
- **La corbeille** d’une dictée (« Supprimer ») efface son texte et son enregistrement.
- **Une dictée corrigée par l’IA** garde ses deux versions, la brute et la corrigée.

## Bon à savoir : le presse-papiers

Pour coller, J’écoute passe par le presse-papiers de Windows, puis y remet ton ancien contenu. Si tu as activé
l’historique du presse-papiers de Windows (Win+V) ou sa synchronisation entre appareils, la dictée peut s’y
retrouver. Pour l’éviter : « Taper le texte » (Réglages › Texte › « Écrire le texte ») ne touche pas au presse-papiers,
et « Collage fiable (bêta) », dans la section « Débogage », marque la dictée pour que Windows ne l’ajoute ni à
l’historique ni à la synchronisation (avec « Remettre l’ancien contenu », le réglage de départ du presse-papiers).

## Effacer tout

Désinstalle J’écoute en cochant « Delete the application data », puis supprime ses modèles du cache Hugging Face :
voir [installation.md](installation.md#7-désinstaller). En portable, supprime le dossier de l’app.
