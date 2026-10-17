# Tout ce que tu peux faire dans J’écoute

**Français** · [English](en/features.md)

_Toutes les images de ce guide sont des captures de l’app, faites avec des dictées inventées. Les écrans entiers
suivent le thème de ton GitHub (clair ou sombre) ; les gros plans sont en thème sombre._

- [Les raccourcis clavier](#les-raccourcis-clavier)
- [L’accueil](#laccueil)
- [Les réglages](#les-réglages) : [Dictée](#dictée), [Son](#son), [Texte](#texte), [Correction par IA](#correction-par-ia),
  [Application](#application), [À propos](#à-propos)
- [L’historique](#lhistorique)
- [Les modèles](#les-modèles)
- [Le premier lancement](#le-premier-lancement)

## Les raccourcis clavier

| Touches                       | Effet                                                                                                      | Où le changer                                       |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| **Ctrl+Espace**               | maintenir : dicter, relâcher : écrire ; ou un appui pour démarrer, un autre pour arrêter                   | Réglages › Dictée › « Raccourci de dictée »         |
| **Échap**                     | pendant une dictée : l’annule, sans rien écrire                                                            | Réglages › Dictée › « Annuler une dictée »          |
| **Ctrl+Maj+Espace**           | dicte puis fait relire le texte par l’IA (si la correction par IA est activée)                             | Réglages › Texte › « Raccourci avec correction IA » |
| **Ctrl+Maj+D**                | dans la fenêtre : affiche ou masque les outils de débogage                                                 |                                                     |
| **Ctrl+F**                    | dans l’historique : va dans la recherche                                                                   |                                                     |
| **Échap**                     | dans l’historique : retour à l’accueil ; dans les réglages : ferme la liste des modèles, puis les réglages |                                                     |
| **←** **→** **Début** **Fin** | dans les réglages : passe d’un onglet à l’autre                                                            |                                                     |

Le raccourci de dictée et celui de la correction par IA marchent partout, même quand la fenêtre de J’écoute est
cachée.

## L’accueil

Le perso au centre, et sous lui ce que fait J’écoute, en une phrase.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/accueil-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/accueil-clair.png">
    <img src="media/fr/accueil-sombre.png" width="696" alt="L’accueil : le perso, l’état « Prêt », le rappel du raccourci, les pastilles du modèle et de la langue, les dernières dictées">
  </picture>
</p>

Pendant une dictée, l’accueil suit en direct : le perso tend l’oreille, l’état passe à « J’écoute… ».

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/accueil-ecoute-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/accueil-ecoute-clair.png">
    <img src="media/fr/accueil-ecoute-sombre.png" width="696" alt="L’accueil pendant une dictée : le perso tend l’oreille, « J’écoute… », « Relâche Ctrl+Espace quand tu as fini. »">
  </picture>
</p>

| État                                 | Ce qu’il te dit                                                             |
| ------------------------------------ | --------------------------------------------------------------------------- |
| « Prêt »                             | « Maintiens Ctrl+Espace et parle : j’écris là où se trouve ton curseur. »   |
| « J’écoute… »                        | « Relâche Ctrl+Espace quand tu as fini. »                                   |
| « J’écris… »                         | le modèle qui transcrit ta phrase                                           |
| « Je peaufine… »                     | « L’IA relit ta dictée. »                                                   |
| « C’est collé »                      | « Retrouve-la dans les dernières dictées. »                                 |
| « Je charge le modèle… »             | « Quelques secondes après le démarrage, ensuite je reste prêt. »            |
| « Je télécharge Cohere Transcribe… » | le pourcentage et la vitesse du téléchargement                              |
| « Je n’entends rien »                | aucun micro trouvé ; le bouton « Choisir un micro » ouvre le bon réglage    |
| « Je n’ai pas accès au micro »       | Windows bloque le micro ; le bouton « Ouvrir les réglages du micro » y mène |
| « Choisis un modèle »                | aucun modèle encore ; le bouton « Choisir un modèle » ouvre la liste        |
| « Le modèle n’a pas pu se charger »  | le bouton « Changer de modèle » ouvre la liste                              |

Le perso prend l’humeur qui va avec : prêt, chargement, micro absent, erreur, écoute, frappe ou chuchotement (voir
[personnage.md](personnage.md#ses-humeurs)).

En haut à droite : « Historique », la roue dentée des réglages, et le bouton « Mise à jour » quand une nouvelle version
est prête.

### Les pastilles

Sous l’état, deux pastilles : le modèle actif et la langue parlée. Un clic ouvre un menu pour changer de modèle (parmi
ceux que tu as téléchargés, ou « Tous les modèles ») ou de langue (avec une recherche). Pendant un téléchargement, une
troisième pastille montre où il en est.

<p align="center"><img src="media/fr/fonctions/pastilles.png" width="480" alt="Les pastilles du modèle et de la langue, et le menu des modèles ouvert"></p>

### Les dernières dictées

« Dernières dictées » : les trois plus récentes, en cartes. Un clic sur une carte copie son texte (« Copié dans le
presse-papiers »). Une pastille « IA » marque une dictée corrigée par l’IA, une étoile une dictée en favori.
« Tout l’historique » ouvre l’historique.

<p align="center"><img src="media/fr/fonctions/cartes.png" width="480" alt="Les trois dernières dictées en cartes, avec l’heure, la pastille IA et le bouton Copier"></p>

## Les réglages

La roue dentée ouvre les réglages, en cinq onglets : Dictée, Son, Texte, Application, À propos. Le perso se range sur
le côté et les regarde avec toi. « Chaque changement s’applique tout de suite. »

### Dictée

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/reglages-dictee-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/reglages-dictee-clair.png">
    <img src="media/fr/reglages-dictee-sombre.png" width="696" alt="L’onglet Dictée : raccourci, comportement, annulation, modèle de transcription, langue parlée">
  </picture>
</p>

#### Raccourci de dictée

« Maintiens pour parler, relâche pour écrire. » Les touches sont dessinées. Le crayon (« Modifier ») enregistre un
nouveau raccourci : appuie sur les touches voulues. La flèche (« Remettre le raccourci par défaut ») revient à
Ctrl+Espace.

<p align="center"><img src="media/fr/fonctions/raccourci.png" width="480" alt="Le raccourci de dictée : les touches Ctrl et Espace dessinées, le crayon et la flèche de retour"></p>

#### Comportement du raccourci

« Comment le raccourci démarre et arrête la dictée. »

| Choix                   | Ce que ça fait                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------- |
| « Auto » (par défaut)   | « Maintiens pour dicter, ou appuie une fois pour démarrer et une fois pour arrêter. » |
| « Maintenir »           | « J’écoute tant que tu gardes les touches enfoncées. »                                |
| « Appui pour démarrer » | « Un appui pour démarrer, un autre pour arrêter. »                                    |

<p align="center"><img src="media/fr/fonctions/comportement.png" width="480" alt="Le comportement du raccourci : Auto, Maintenir, Appui pour démarrer"></p>

#### Annuler une dictée

« Arrête sans rien écrire. » Par défaut : Échap, pendant une dictée.

<p align="center"><img src="media/fr/fonctions/annuler.png" width="480" alt="Le raccourci d’annulation : la touche Échap"></p>

#### Modèle de transcription

Le modèle actif, sa taille et le nombre de langues qu’il comprend. « Changer » ouvre la [liste des modèles](#les-modèles).

<p align="center"><img src="media/fr/fonctions/modele.png" width="480" alt="La carte du modèle actif : son nom, Actif, sa taille, ses langues, le bouton Changer"></p>

#### Langue parlée

« Automatique » ou une langue précise, avec une recherche. La ligne n’apparaît que si le modèle comprend plusieurs
langues. Un modèle qui ne reconnaît pas la langue tout seul prend celle de Windows : l’option s’affiche alors
« Automatique (Français) ».

<p align="center"><img src="media/fr/fonctions/langue.png" width="480" alt="La langue parlée et sa liste avec la recherche"></p>

#### Traduire en anglais

« Ce que tu dis dans une autre langue est écrit en anglais. » La ligne n’apparaît qu’avec un modèle qui sait traduire
(par exemple Canary 180M Flash ou Whisper Medium).

### Son

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/reglages-son-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/reglages-son-clair.png">
    <img src="media/fr/reglages-son-sombre.png" width="696" alt="L’onglet Son : micro, couper le son, signal sonore, volume, son et sortie du signal">
  </picture>
</p>

#### Micro

« Le micro qui t’écoute. » « Par défaut du système » ou un micro précis. Pendant une dictée, son niveau s’affiche sous
la liste (« Je t’entends. »). Avec une interface audio à plusieurs entrées, « Canal d’entrée » choisit l’entrée, ou
« Moyenne de tous les canaux ».

<p align="center"><img src="media/fr/fonctions/micro.png" width="480" alt="Le choix du micro et son niveau pendant une dictée"></p>

#### Couper le son de l’ordinateur

« Pendant la dictée, la musique et les vidéos se taisent. »

<p align="center"><img src="media/fr/fonctions/couper-son.png" width="480" alt="L’interrupteur Couper le son de l’ordinateur"></p>

#### Signal sonore

« Un petit son au début et à la fin de la dictée. » Désactivé au départ. Une fois activé : « Volume du signal », « Son du
signal » (Marimba ou Pop, avec « Écouter le signal ») et « Sortie du signal » (où il se fait entendre).

<p align="center"><img src="media/fr/fonctions/signal-sonore.png" width="480" alt="Le signal sonore activé, son volume, son son et sa sortie"></p>

### Texte

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/reglages-texte-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/reglages-texte-clair.png">
    <img src="media/fr/reglages-texte-sombre.png" width="696" alt="L’onglet Texte : écrire le texte, presse-papiers, valider, hésitations, espace, mots à reconnaître, correction par IA">
  </picture>
</p>

#### Écrire le texte

« Comment la dictée arrive dans ton application. »

| Choix                                           | Ce que ça fait                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------- |
| « Coller (Ctrl+V) » (par défaut)                | colle le texte d’un coup, par le presse-papiers                      |
| « Taper le texte »                              | tape le texte lettre par lettre, sans toucher au presse-papiers      |
| « Coller (Ctrl+Maj+V) », « Coller (Maj+Inser) » | pour les applications qui collent autrement (terminaux, par exemple) |
| « Ne rien écrire »                              | la dictée va seulement dans l’historique                             |

<p align="center"><img src="media/fr/fonctions/ecrire-texte.png" width="480" alt="La liste Écrire le texte ouverte"></p>

#### Presse-papiers

« Après le collage. » « Remettre l’ancien contenu » (par défaut) ou « Garder la dictée » dans le presse-papiers.

<p align="center"><img src="media/fr/fonctions/presse-papiers.png" width="480" alt="Le réglage du presse-papiers"></p>

#### Valider après le texte

« Appuie sur une touche à ta place, pour envoyer un message. » « Non » (par défaut), « Entrée », « Ctrl+Entrée » ou
« Super+Entrée ».

<p align="center"><img src="media/fr/fonctions/valider.png" width="480" alt="Valider après le texte : Non, Entrée, Ctrl+Entrée, Super+Entrée"></p>

#### Retirer les hésitations

« « euh », « hum », « ben »… » disparaissent du texte. Activé au départ.

<p align="center"><img src="media/fr/fonctions/hesitations.png" width="480" alt="L’interrupteur Retirer les hésitations"></p>

#### Espace après le texte

« Ajoute une espace après chaque dictée. » Pratique pour enchaîner les phrases. Désactivé au départ.

<p align="center"><img src="media/fr/fonctions/espace-final.png" width="480" alt="L’interrupteur Espace après le texte"></p>

#### Mots à reconnaître

« Noms propres et termes techniques que je dois bien écrire. » Tape un mot, « Ajouter » : il devient une étiquette, que
tu retires d’un clic. J’écoute corrige ensuite les mots proches que le modèle entend.

<p align="center"><img src="media/fr/fonctions/mots.png" width="480" alt="Les mots à reconnaître en étiquettes, et le champ Ajouter un mot"></p>

Dans « Options avancées », « Écriture chinoise » choisit les caractères simplifiés ou traditionnels pour le mandarin et
le cantonais.

### Correction par IA

« Une IA en ligne relit la dictée avant de la coller. Demande une clé d’API (OpenRouter, Anthropic, OpenAI…). »
Désactivée au départ : l’interrupteur est dans l’onglet Texte, sous les mots à reconnaître. Une fois activée, le raccourci normal ne change pas :
c’est le second raccourci, Ctrl+Maj+Espace, qui fait relire le texte.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/reglages-texte-ia-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/reglages-texte-ia-clair.png">
    <img src="media/fr/reglages-texte-ia-sombre.png" width="696" alt="La correction par IA activée : raccourci, fournisseur, clé d’API, modèle, consignes">
  </picture>
</p>

#### Raccourci et fournisseur

- « Raccourci avec correction IA » : « Dicte et fait toujours relire le texte par l’IA. » Ctrl+Maj+Espace par défaut.
- « Fournisseur d’IA » : « Fournisseur » (« Un service compatible OpenAI. ») : OpenAI, Z.AI, OpenRouter, Anthropic,
  Groq, Cerebras, AWS Bedrock (Mantle), ou Custom. Custom ouvre « Adresse de l’API » : un serveur à toi, y compris sur
  ton PC (`http://localhost:11434/v1` au départ).
- « Clé d’API » : « La clé de ton compte chez ce fournisseur. »
- « Modèle » : un modèle proposé par le fournisseur, ou son nom tapé à la main ; « Actualiser la liste » la recharge.

<p align="center"><img src="media/fr/fonctions/correction-ia.png" width="480" alt="Le raccourci avec correction IA, le fournisseur, la clé d’API et le modèle"></p>

#### Consignes

« Ce que l’IA fait du texte. ${output} y désigne ta dictée. » Choisis une consigne, modifie-la, ou crée la tienne avec
« Nouvelle consigne » (un « Nom », des « Instructions », puis « Créer la consigne »). La consigne fournie, Improve
Transcriptions, corrige l’orthographe, la ponctuation et les nombres sans changer le sens, dans la langue de la
dictée.

<p align="center"><img src="media/fr/fonctions/consignes.png" width="480" alt="Les consignes : la consigne choisie, son nom et ses instructions"></p>

Dans l’historique, chaque dictée corrigée garde ses deux versions : voir [Brut ou corrigé](#brut-ou-corrigé).

### Application

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/reglages-application-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/reglages-application-clair.png">
    <img src="media/fr/reglages-application-sombre.png" width="696" alt="L’onglet Application : apparence, langue de l’interface, démarrage, pendant la dictée, mémoire, historique, enregistrements">
  </picture>
</p>

#### Apparence

« J’écoute suit le thème du système, ou reste clair ou sombre. » « Système », « Clair » ou « Sombre ».

<p align="center"><img src="media/fr/fonctions/apparence.png" width="480" alt="L’apparence : Système, Clair, Sombre"></p>

#### Langue de l’interface

L’interface existe en 26 langues. Par défaut, celle de Windows.

<p align="center"><img src="media/fr/fonctions/langue-interface.png" width="480" alt="La liste des langues de l’interface"></p>

#### Démarrage

- « Lancer au démarrage » : « J’écoute démarre quand tu ouvres ta session. » Désactivé au départ.
- « Démarrer masqué » : « Démarrer dans la barre des tâches sans ouvrir la fenêtre. »
- « Icône dans la barre des tâches » : « Dans la zone de notification, près de l’horloge. » Son menu : copier la
  dernière transcription, changer de modèle, décharger le modèle, ouvrir les réglages, chercher une mise à jour,
  quitter.

<p align="center"><img src="media/fr/fonctions/demarrage.png" width="480" alt="Lancer au démarrage, Démarrer masqué, Icône dans la barre des tâches"></p>

#### Pendant la dictée

« Ce qui apparaît à l’écran. »

| Choix                       | Ce qui s’affiche                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| « Personnage » (par défaut) | le perso surgit, écoute, tape et repart                                                                                |
| « Texte en direct »         | une carte qui montre le texte pendant que tu parles (avec un modèle qui écrit en direct ; sinon, la pastille minimale) |
| « Minimal »                 | une petite pastille : un voyant, le niveau de ta voix et une croix pour annuler                                        |
| « Aucun »                   | rien                                                                                                                   |

Avec un modèle qui écrit en direct, « Personnage » affiche aussi la carte du texte en direct, à la place du perso.
« Position à l’écran » : « En bas » (par défaut) ou « En haut ».

<p align="center"><img src="media/fr/fonctions/pendant-dictee.png" width="480" alt="Pendant la dictée : Aucun, Minimal, Texte en direct, Personnage ; Position à l’écran"></p>

<p align="center"><img src="media/perso/styles-overlay.png" width="696" alt="Les styles côte à côte : le perso, la carte du texte en direct, la pastille minimale"></p>

#### Libérer la mémoire

« Décharge le modèle quand tu ne dictes plus. » « Jamais » (par défaut), « Tout de suite », ou après 2, 5, 10, 15 minutes ou
1 heure. Le modèle se recharge à la dictée suivante.

<p align="center"><img src="media/fr/fonctions/memoire.png" width="480" alt="Libérer la mémoire et ses délais"></p>

#### Taille de l’historique

« Les plus anciennes dictées s’effacent (sauf les favoris). » Le nombre de dictées gardées : 5 au départ. Il
s’applique tant que « Enregistrements audio » est sur « Garder les 5 plus récents ».

<p align="center"><img src="media/fr/fonctions/historique-limite.png" width="480" alt="Le nombre de dictées gardées dans l’historique"></p>

#### Enregistrements audio

« Supprimer les anciens enregistrements pour gagner de la place. » « Garder les 5 plus récents » (au départ : le
nombre réglé dans « Historique »), « Les garder » (rien ne s’efface), ou supprimer après 3 jours, 2 semaines ou 3 mois.
Une dictée effacée part avec son enregistrement ; les favoris restent toujours.

<p align="center"><img src="media/fr/fonctions/enregistrements.png" width="480" alt="Enregistrements audio : les choix de conservation"></p>

#### Mises à jour et nouveautés

« Vérifier les mises à jour » (activé au départ) cherche les nouvelles versions au démarrage. « Afficher les nouveautés »
ouvre la note de version après une mise à jour. L’installation se fait dans [À propos](#à-propos).

#### Options avancées

- « Détection de la voix » : « Ignore les silences avant et après la parole. » Activée au départ.
- « Fonctions expérimentales » : la gestion du clavier, l’accélération (carte graphique ou processeur), « Garder le micro
  ouvert entre deux dictées » et le détecteur de voix.
- « Mode débogage » : « Affiche les outils de débogage. Aussi avec Ctrl+Maj+D. » La section « Débogage » ajoute les
  journaux, les délais de collage, « Collage fiable (bêta) » et d’autres réglages fins.

### À propos

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/reglages-a-propos-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/reglages-a-propos-clair.png">
    <img src="media/fr/reglages-a-propos-sombre.png" width="696" alt="L’onglet À propos : version, mises à jour, code source, dossiers, crédits">
  </picture>
</p>

#### Mises à jour

La version (« Version 0.1.0, à jour ») et « Mises à jour » : « Vérifier », puis « Installer » quand une version est
disponible. J’écoute se relance sur la nouvelle version.

<p align="center"><img src="media/fr/fonctions/mises-a-jour.png" width="480" alt="La ligne Mises à jour et son bouton Vérifier"></p>

#### Dossiers et crédits

« Code source » (github.com/ponthieutheo/jecoute), « Données de l’application » (« Modèles, réglages, enregistrements. »)
et « Journaux » s’ouvrent d’un clic. En dessous, « Basé sur Handy de CJ Pais », les remerciements à ggml et la licence du
perso.

<p align="center"><img src="media/fr/fonctions/credits.png" width="480" alt="Le crédit Basé sur Handy de CJ Pais, les remerciements et la licence du perso"></p>

## L’historique

« Historique », en haut de l’accueil (ou « Tout l’historique ») : toutes tes dictées gardées, rangées par jour, mises à
jour en direct.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/historique-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/historique-clair.png">
    <img src="media/fr/historique-sombre.png" width="696" alt="L’historique : recherche, filtres, dictées par jour avec leur heure">
  </picture>
</p>

Chaque ligne a ses boutons : « Écouter », « Copier », l’étoile (« Ajouter aux favoris ») et « Plus », qui la déplie :
le lecteur, « Retranscrire » (le même enregistrement, transcrit de nouveau avec le modèle actif, et relu par l’IA
s’il l’avait été) et la corbeille (« Supprimer »). En bas, le nombre de dictées et « Dossier des enregistrements ».

### Recherche

« Rechercher », ou Ctrl+F : cherche dans le texte final et dans le texte brut, sur tout l’historique.

<p align="center"><img src="media/fr/fonctions/recherche.png" width="480" alt="La recherche dans l’historique et les dictées trouvées"></p>

### Favoris

L’étoile garde une dictée pour toujours : les favoris ne s’effacent jamais, quelle que soit la limite de l’historique.
Les filtres « Toutes », « Favoris » et « Corrigées par IA » trient la liste.

<p align="center"><img src="media/fr/fonctions/favoris.png" width="480" alt="Le filtre Favoris et les dictées étoilées"></p>

### Brut ou corrigé

Une dictée relue par l’IA porte la pastille « IA ». Dépliée, elle montre l’encadré « Corrigée par l’IA » avec le nom de
la consigne, et deux versions : « Corrigé » (ce qui a été collé, les ajouts de l’IA surlignés) et « Brut » (ce que le
modèle a entendu, ce que l’IA a retiré barré).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/historique-brut-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/historique-brut-clair.png">
    <img src="media/fr/historique-brut-sombre.png" width="696" alt="Une dictée corrigée dépliée, en version Brut : les mots retirés par l’IA barrés">
  </picture>
</p>

<p align="center"><img src="media/fr/fonctions/brut-corrige.png" width="480" alt="L’encadré Corrigée par l’IA : Corrigé ou Brut, mots surlignés et barrés"></p>

### Lecture

▶ déplie la ligne et lance l’enregistrement. Un seul joue à la fois ; la barre permet d’avancer ou de revenir.

<p align="center"><img src="media/fr/fonctions/lecture.png" width="480" alt="Le lecteur d’une dictée dépliée, Retranscrire et la corbeille"></p>

## Les modèles

« Changer » (Réglages › Dictée), « Tous les modèles » (pastille du modèle) ou « Choisir un modèle » ouvrent la liste :
les 69 modèles du catalogue, « Classés pour le français. » (pour la langue de Windows). En haut « Tes modèles », en dessous
« À télécharger ». Pour choisir : [modeles.md](modeles.md).

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/modeles-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/modeles-clair.png">
    <img src="media/fr/modeles-sombre.png" width="696" alt="La liste des modèles : recherche, filtres, Tes modèles, À télécharger, précision et vitesse">
  </picture>
</p>

Chaque modèle montre ses étiquettes (« Recommandé », « Texte en direct »), sa description, ses barres « Précision » et
« Vitesse », « Traduit en anglais » s’il sait traduire, sa taille et ses langues (« 1,6 Go, 14 langues »).

### Filtres

« Rechercher » par nom. Les icônes filtrent : le globe par langue (« Toutes les langues » ou une langue), les ondes
(« Seulement les modèles qui écrivent en direct »), la traduction (« Seulement les modèles qui traduisent en anglais »).
La flèche circulaire : « Chercher les modèles ajoutés à la main (dossier des modèles ou cache Hugging Face) ».

<p align="center"><img src="media/fr/fonctions/modeles-filtres.png" width="480" alt="La recherche et les filtres de la liste des modèles"></p>

### Télécharger, utiliser, supprimer

« Télécharger » : la barre avance, avec la vitesse, et « Annuler ». Puis « Vérification… » et le modèle passe dans « Tes
modèles ». Un modèle qui finit de se télécharger devient le modèle actif. « Utiliser » en choisit un autre ; la
corbeille le supprime (après confirmation).

<p align="center"><img src="media/fr/fonctions/modele-telechargement.png" width="480" alt="Un modèle en cours de téléchargement : la barre, le pourcentage, la vitesse, Annuler"></p>

## Le premier lancement

« Bienvenue dans J’écoute » : « Choisis le modèle qui transcrit ta voix. Il tourne sur ton ordinateur, rien ne part sur
Internet. » Trois modèles sont proposés pour ta langue et ta machine (« Recommandé pour le français » sur le premier) ;
« Voir les 69 modèles » ouvre le reste. Le bouton dit ce qu’il va faire : « Télécharger Cohere Transcribe (1,6 Go) ». Le
téléchargement se suit sur place, puis l’accueil s’ouvre.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/bienvenue-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/bienvenue-clair.png">
    <img src="media/fr/bienvenue-sombre.png" width="696" alt="Bienvenue dans J’écoute : le perso, trois modèles recommandés, le bouton Télécharger">
  </picture>
</p>

Si Windows bloque l’accès au micro, une étape « Autorisations requises » s’ajoute, avec le bouton qui ouvre les bons
réglages de Windows.
