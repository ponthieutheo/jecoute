# Confidentialité

**Français** · [English](en/privacy.md)

**La transcription est 100 % locale.** Ta voix est enregistrée et transcrite sur ton PC, par le modèle que tu as
téléchargé ; l’audio ne quitte jamais ta machine. J’écoute n’a pas de compte, pas de serveur à lui, pas de publicité,
et n’envoie aucune statistique d’usage : tes [statistiques de dictée](#les-statistiques) restent sur ton PC.

## Ce qui sort de ton PC, et quand

| Quoi                                               | Vers                                 | Quand                                                                                                                                                        | Pour l’éviter                                                                                                  |
| -------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| le téléchargement d’un modèle                      | Hugging Face                         | quand tu cliques sur « Télécharger », au premier lancement ou dans la liste des modèles                                                                      | une fois le modèle sur ton PC, plus rien ne sort pour transcrire                                               |
| la vérification des mises à jour                   | GitHub (les releases de ce dépôt)    | au démarrage, quand tu cliques sur « Vérifier », puis le téléchargement si tu cliques sur « Installer »                                                      | Réglages › Application › « Vérifier les mises à jour »                                                         |
| le texte d’une dictée                              | le fournisseur d’IA que tu as choisi | seulement si la correction par IA est activée, et seulement quand tu dictes avec Ctrl+Maj+Espace (ou que tu retranscris une dictée faite ainsi)              | laisser la correction par IA désactivée (c’est le réglage de départ), ou choisir un serveur sur ton PC         |
| la liste des modèles du fournisseur                | le fournisseur d’IA                  | quand tu choisis le fournisseur, ou avec « Actualiser la liste »                                                                                             |                                                                                                                |
| la transcription d’un appel (le texte, pas le son) | le fournisseur d’IA que tu as choisi | à la fin d’un appel, si un fournisseur est réglé et que « Résumé par IA » est activé ; ou quand tu cliques sur « Écrire le résumé » ou « Refaire le résumé » | couper « Résumé par IA » (réglages des appels), ne pas régler de fournisseur, ou choisir un serveur sur ton PC |
| le téléchargement du modèle des voix (29 Mo)       | Hugging Face                         | une seule fois, quand tu cliques sur « Télécharger » pour distinguer les voix d’un appel                                                                     | ne pas le télécharger : les autres restent « Les autres »                                                      |

Le raccourci normal, Ctrl+Espace, n’envoie jamais rien : même avec la correction par IA activée, seul Ctrl+Maj+Espace
fait relire le texte. Les statistiques de dictée, elles, ne sortent jamais.

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

| Quoi                                                         | Installation normale                                           | Installation portable      |
| ------------------------------------------------------------ | -------------------------------------------------------------- | -------------------------- |
| réglages, mots à reconnaître, consignes, clé d’API           | `%APPDATA%\io.github.ponthieutheo.jecoute\settings_store.json` | `Data\settings_store.json` |
| historique (le texte des dictées)                            | `%APPDATA%\io.github.ponthieutheo.jecoute\history.db`          | `Data\history.db`          |
| appels (le texte : transcription, résumé, tâches)            | `%APPDATA%\io.github.ponthieutheo.jecoute\calls.db`            | `Data\calls.db`            |
| son d’un appel en cours (WAV, effacé une fois l’appel écrit) | `%APPDATA%\io.github.ponthieutheo.jecoute\calls\`              | `Data\calls\`              |
| statistiques de dictée (des chiffres)                        | `%APPDATA%\io.github.ponthieutheo.jecoute\stats.db`            | `Data\stats.db`            |
| enregistrements audio (WAV)                                  | `%APPDATA%\io.github.ponthieutheo.jecoute\recordings\`         | `Data\recordings\`         |
| modèles ajoutés à la main, modèle des voix                   | `%APPDATA%\io.github.ponthieutheo.jecoute\models\`             | `Data\models\`             |
| modèles téléchargés                                          | `%USERPROFILE%\.cache\huggingface\hub\`                        | `Data\huggingface\hub\`    |
| journaux                                                     | `%LOCALAPPDATA%\io.github.ponthieutheo.jecoute\logs\`          | `Data\logs\`               |

En portable, `Data\` est à côté de `jecoute.exe`. Réglages › À propos › « Données de l’application » et « Journaux »
ouvrent ces dossiers.

## Ce que l’historique garde

- **Par défaut, tes 50 dernières dictées**, avec leur enregistrement, plus les favoris. Les plus anciennes s’effacent.
- **La règle se choisit** dans Réglages › Application › « Conserver les dictées » : « Les 50 plus récentes » (le
  nombre réglé dans « Historique »), « Toujours » (rien ne s’efface), ou effacer ce qui a plus de 3 jours, 2 semaines
  ou 3 mois. Une dictée effacée part avec son enregistrement ; les favoris restent toujours.
- **La corbeille** d’une dictée (« Supprimer ») efface son texte et son enregistrement.
- **Une dictée corrigée par l’IA** garde ses deux versions, la brute et la corrigée.

## Les appels

L’enregistreur d’appels (page « Appels ») ne rejoint pas l’appel : les autres ne voient rien. **Préviens toujours les
personnes que tu enregistres** ; selon l’endroit où tu vis, enregistrer quelqu’un sans le lui dire peut être interdit.

- **Ce qui est enregistré** : ton micro, et tout ce que joue l’ordinateur si « Son de l’ordinateur » est activé (la
  voix des autres, mais aussi une vidéo ou une notification qui sonne pendant l’appel).
- **Le son reste sur ton PC**, en deux fichiers WAV dans le dossier `calls\` des données de l’app, le temps de l’appel.
  Il est effacé dès que l’appel est écrit. Si J’écoute s’arrête en plein appel, le son attend le lancement suivant :
  l’appel est alors écrit, puis le son effacé.
- **Le texte est gardé** dans `calls.db` : le titre, la date, la durée, le nom des personnes, la transcription, le
  résumé, les points clés et les tâches. Il reste jusqu’à ce que tu supprimes l’appel (la corbeille), ce qui efface
  aussi ce qui resterait de son son.
- **La transcription et les voix sont faites sur ton PC**, avec ton modèle de transcription et, pour distinguer les
  voix, un petit modèle (29 Mo) téléchargé une fois depuis Hugging Face, dans une version figée dont J’écoute vérifie
  l’empreinte SHA-256.
- **Le résumé** est écrit par le fournisseur d’IA réglé pour la [correction par IA](#la-correction-par-ia). Il reçoit
  la transcription de l’appel (avec le nom des personnes), la consigne qui demande la note, ta clé d’API et les mêmes
  en-têtes que pour la correction. Jamais le son. Sans fournisseur, rien ne part : l’appel garde sa transcription,
  sans résumé. Pour que rien ne sorte avec un résumé, choisis un serveur sur ton PC (« Custom »).
- **Copier et exporter** : « Copier » passe par le presse-papiers (voir plus bas), « Exporter » écrit un fichier `.md`
  dans ton dossier Documents. Ce fichier est à toi : J’écoute ne l’efface pas, même si tu supprimes l’appel.

## Les statistiques

La page « Statistiques » est calculée sur ton PC et gardée dans `stats.db`. Rien n’est envoyé, à personne.

- **Ce qu’elle garde** : pour chaque jour, le nombre de mots dictés, le temps de dictée et le nombre de dictées ; pour
  chaque appli et chaque jour, le nombre de mots et le nom du programme (« Outlook », « Chrome »…). Jamais le texte de
  tes dictées, jamais le titre des fenêtres ni ce qu’elles contiennent.
- **L’appli** est celle qui est au premier plan quand ta dictée est collée. J’écoute elle-même et les morceaux de
  Windows (barre des tâches, menu Démarrer, recherche…) ne comptent pas.
- **Au premier lancement de la 0.2.0**, les dictées encore dans l’historique (avec leur enregistrement) sont reprises,
  sans les applis.
- **Vider l’historique ne les efface pas.** « Remettre à zéro », en bas de la page, efface tous les chiffres, après
  confirmation.

## Bon à savoir : le presse-papiers

Pour coller, J’écoute passe par le presse-papiers de Windows, puis y remet ton ancien contenu. Si tu as activé
l’historique du presse-papiers de Windows (Win+V) ou sa synchronisation entre appareils, la dictée peut s’y
retrouver. Pour l’éviter : « Taper le texte » (Réglages › Texte › « Écrire le texte ») ne touche pas au presse-papiers,
et « Collage fiable (bêta) », dans la section « Débogage », marque la dictée pour que Windows ne l’ajoute ni à
l’historique ni à la synchronisation (avec « Remettre l’ancien contenu », le réglage de départ du presse-papiers).

## Effacer tout

Désinstalle J’écoute en cochant « Delete the application data », puis supprime ses modèles du cache Hugging Face :
voir [installation.md](installation.md#7-désinstaller). En portable, supprime le dossier de l’app.
