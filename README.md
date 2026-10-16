# J’écoute

**Tu parles, il écrit.** J’écoute transforme ta voix en texte, directement là où se trouve ton curseur, sans que rien ne quitte ton ordinateur.

[English version](README.en.md)

## Ce que ça fait

Tu maintiens un raccourci, tu parles, tu relâches : ton texte apparaît dans l'application ouverte, comme si tu l'avais tapé. Mail, document, chat, terminal, formulaire web : ça marche partout où l'on peut écrire.

Pendant ce temps, un petit perso rouge à cornes surgit en bas de l'écran. Il tend l'oreille pendant que tu parles, puis siffle pendant qu'il écrit ta phrase, ou chuchote quand une IA la retouche. Le texte collé, il repart.

- **100 % local et privé** : la transcription se fait sur ta machine. Pas de compte, pas de cloud, pas d'abonnement, et ça marche hors ligne.
- **Rapide** : les modèles tournent sur ta carte graphique (Vulkan sous Windows et Linux, Metal sur Mac), ou sur le processeur à défaut.
- **Gratuit et ouvert** : le code est sous licence MIT.

## Installation

1. Ouvre la page des [Releases](https://github.com/ponthieutheo/jecoute/releases/latest) et télécharge l'installeur de la dernière version. Sous Windows, c'est `Jecoute_<version>_x64-setup.exe` (`Jecoute_<version>_arm64-setup.exe` sur un PC ARM).
2. Lance-le. L'installeur n'est pas signé, donc Windows SmartScreen peut afficher « Windows a protégé votre ordinateur » : clique sur « Informations complémentaires », puis sur « Exécuter quand même ».
3. Choisis une installation normale, ou portable (un dossier autonome qui garde ses réglages et ses modèles à côté de l'app).
4. Au premier lancement, choisis un modèle de transcription (voir plus bas). Il est téléchargé une seule fois ; ensuite, tout fonctionne hors ligne.

J’écoute te propose ensuite les nouvelles versions tout seul.

## Utilisation

1. Place ton curseur là où tu veux écrire.
2. Maintiens **Ctrl+Espace** (**Option+Espace** sur Mac), parle, puis relâche : le texte est collé.
3. Tu préfères ne pas garder le doigt appuyé ? Appuie brièvement une fois pour démarrer, une seconde fois pour arrêter.

Les deux façons marchent d'office (mode « Auto »). Tu peux imposer « Maintenir » ou « Basculer », et changer de raccourci, dans **Paramètres > Général**.

Le post-traitement par IA est facultatif et désactivé au départ. Une fois activé dans **Paramètres > Avancé** (puis réglé dans la section **Post-traitement**), **Ctrl+Maj+Espace** (**Option+Maj+Espace** sur Mac) transcrit puis fait retoucher le texte (ponctuation, reformulation…) par le fournisseur que tu choisis : un modèle local, ou un service en ligne auquel seul le texte est envoyé.

## Quel modèle choisir pour le français

- **Cohere Transcribe** : le plus précis. Plus lourd, il donne le meilleur de lui-même avec une carte graphique.
- **Parakeet V3** : plus léger et très rapide, même sur une machine modeste. Il détecte tout seul la langue parlée, pratique si tu passes du français à l'anglais.

Tu peux en télécharger plusieurs et passer de l'un à l'autre dans **Paramètres > Modèles**.

## Dépannage

<a id="macos-secure-input"></a>

### macOS : le raccourci ne réagit plus (saisie sécurisée)

**Le symptôme** : un raccourci qui contient une touche normale (par exemple Option+Espace) ne déclenche plus rien, alors qu'un raccourci fait seulement de touches de modification (fn seul, Ctrl gauche seul) marche encore. C'est la saisie sécurisée de macOS (« Secure Input ») : quand un champ de mot de passe ou une application l'active, macOS arrête d'envoyer les frappes aux autres applications, J’écoute compris.

**Trouver le responsable** : J’écoute affiche alors un bandeau dans ses paramètres et un ⚠ dans son menu de la barre des menus. Le bandeau nomme l'application qui tient la saisie sécurisée quand il le peut ; c'est une estimation, pas une certitude. Pour vérifier à la main, dans le Terminal :

```bash
ioreg -l -w 0 | grep -o 'kCGSSessionSecureInputPID"=[0-9]*' | grep -o '[0-9]*' | head -1 | xargs ps -o pid,comm -p
```

La commande ne renvoie rien si l'application fautive est déjà fermée. Dans la section **Débogage** (Cmd+Maj+D), le **Diagnostic du clavier** montre si les frappes arrivent bien jusqu'à J’écoute.

**Les solutions, dans l'ordre** :

1. **Terminal ou iTerm2** : désactive « Entrée sécurisée au clavier » (« Secure Keyboard Entry ») dans le menu de l'application.
2. **Gestionnaire de mots de passe** : quitte-le ou mets-le à jour. Certaines versions de 1Password et de KeePassXC gardent la saisie sécurisée active en arrière-plan.
3. **Sinon** (fenêtre de connexion restée bloquée, application fermée sans relâcher la saisie sécurisée) : verrouille l'écran avec Ctrl+Cmd+Q, puis reconnecte-toi en tapant ton mot de passe (Touch ID ne suffit pas). Si ça ne règle rien, ferme ta session et rouvre-la.

En attendant, J’écoute fait passer les raccourcis touchés par une méthode de secours, avec quelques limites : un raccourci fn + touche ne marche plus du tout, une touche de modification d'un seul côté (Option droite, par exemple) répond des deux côtés, et on ne peut pas enregistrer de nouveau raccourci. Les raccourcis faits seulement de touches de modification ne sont jamais concernés : c'est le bon choix si le problème revient souvent.

### Le texte collé n'est pas le bon

Si la transcription est juste dans l'**Historique** mais que J’écoute colle un texte copié plus tôt : pour coller, J’écoute passe par le presse-papiers, puis y remet ton ancien contenu après un court délai. Une application lente peut lire le presse-papiers trop tard.

1. Ouvre la section **Débogage** avec Ctrl+Maj+D (Cmd+Maj+D sur Mac).
2. Sous Windows et macOS, active **Collage fiable (Beta)**.
3. Si ça ne suffit pas, augmente **Délai de collage (après)**.

### Ctrl+Espace ne déclenche rien

Une autre application utilise peut-être déjà ce raccourci : changement de méthode de saisie (chinois, japonais, coréen), lanceur, ou autre outil de dictée. Choisis un autre raccourci dans **Paramètres > Général > Raccourcis de J’écoute**.

## Crédits

J’écoute est basé sur [Handy](https://github.com/cjpais/Handy) de CJ Pais. Merci aussi aux projets qui rendent la transcription locale possible : ggml et transcribe.cpp, Whisper, Parakeet, Cohere Transcribe et Silero VAD.

## Licences

- **Code** : licence MIT, voir [LICENSE](LICENSE) (copyright CJ Pais et Théo Ponthieu).
- **Personnage** (modèle 3D, visage, images du perso) : licence [PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/), usage non commercial uniquement. Copyright (c) 2026 Théo Ponthieu. Il s'agit des fichiers de `src/character/` et des icônes ; chaque dossier concerné contient son propre fichier de licence.
