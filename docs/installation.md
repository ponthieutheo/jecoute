# Installer J’écoute

**Français** · [English](en/installation.md)

Compte quelques minutes, surtout le temps de télécharger le modèle. La prise en main en vidéo :

VIDEO_PRISE_EN_MAIN

## 1. Ce qu’il te faut

- **Windows 10 ou 11, 64 bits (x64).** La version 0.1.0 n’est publiée que pour Windows x64 : pas encore de version
  macOS, Linux ou ARM prête à installer. Le code compile sous Linux et macOS (voir [BUILD.md](../BUILD.md#linux-et-macos)) ;
  une version Linux arrivera ensuite.
- **Un micro** : celui du portable, un casque ou un micro USB.
- **De la place pour un modèle** : de 33 Mo à 16 Go selon le modèle. Cohere Transcribe, le plus précis de ceux que
  J’écoute conseille, fait 1,6 Go ([modeles.md](modeles.md)).
- **Une carte graphique, si possible.** Les modèles tournent sur la carte graphique (Vulkan) quand il y en a une, sinon
  sur le processeur.
- **WebView2**, le moteur d’affichage de Windows : il est déjà dans Windows 11. Sous Windows 10, l’installeur le
  télécharge auprès de Microsoft s’il manque.

## 2. Télécharger

Sur la page des [releases](https://github.com/ponthieutheo/jecoute/releases/latest) :

| Fichier                              | À quoi il sert                                                          |
| ------------------------------------ | ----------------------------------------------------------------------- |
| `Jecoute_<version>_x64-setup.exe`    | **l’installeur conseillé** ; il propose aussi une installation portable |
| `Jecoute_<version>_x64_en-US.msi`    | la même app en paquet MSI, pour un déploiement géré                     |
| `SHA256SUMS.txt`                     | les sommes de contrôle des deux installeurs                             |
| `latest.json` et les fichiers `.sig` | servent à la mise à jour automatique : rien à en faire                  |

## 3. Vérifier le fichier (facultatif)

**L’empreinte SHA-256.** Dans PowerShell, dans le dossier du téléchargement (remplace `0.1.0` par ta version) :

```powershell
$attendu = (Select-String -Path .\SHA256SUMS.txt -Pattern 'x64-setup.exe').Line.Split(' ')[0]
(Get-FileHash .\Jecoute_0.1.0_x64-setup.exe -Algorithm SHA256).Hash -eq $attendu
```

`True` : le fichier est intact. Les mêmes empreintes sont dans le texte de la release.

**La provenance.** Les deux installeurs et `latest.json` ont une attestation de provenance GitHub : elle prouve qu’ils
sortent du workflow de release de ce dépôt, sans retouche. Avec la [CLI GitHub](https://cli.github.com/) connectée
à un compte quelconque (`gh auth login`) :

```powershell
gh attestation verify Jecoute_0.1.0_x64-setup.exe --repo ponthieutheo/jecoute
```

Plus strict, en exigeant aussi le fichier de workflow qui a signé :

```powershell
gh attestation verify Jecoute_0.1.0_x64-setup.exe --repo ponthieutheo/jecoute `
  --signer-workflow ponthieutheo/jecoute/.github/workflows/release.yml
```

La commande retrouve l’attestation par l’empreinte du fichier, vérifie sa signature et affiche le dépôt, le workflow
et le commit d’origine. Un fichier modifié, même d’un octet, n’a pas d’attestation.

## 4. Installer

### SmartScreen

L’installeur n’est pas signé : il n’a pas de certificat de signature de code, et Windows ne le connaît pas encore.
SmartScreen peut donc afficher « Windows a protégé votre ordinateur ». Clique sur « Informations complémentaires »,
puis sur « Exécuter quand même ». La vérification de l’étape 3 te dit, elle, d’où vient le fichier.

### Normale ou portable

L’installeur est en anglais. Sa page « Choose Install Type » propose deux façons d’installer :

| Choix                                 | Ce que ça donne                                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| « Normal Installation (recommended) » | l’app va dans `%LOCALAPPDATA%\J’écoute`, pour ton compte seulement (pas besoin d’être administrateur), avec un raccourci dans le menu Démarrer, un désinstalleur et la mise à jour automatique                           |
| « Portable Installation »             | un dossier autonome (par défaut `J’écoute` sur le Bureau) : réglages, historique et modèles dans son sous-dossier `Data\`, rien dans le registre, pas de raccourci, pas de désinstalleur, pas de mise à jour automatique |

La dernière page propose de lancer J’écoute.

## 5. Premier lancement

1. **« Bienvenue dans J’écoute ».** Trois modèles sont proposés, choisis pour ta langue et ta machine ; « Voir les
   69 modèles » ouvre le reste. Clique sur le bouton de téléchargement (« Télécharger Cohere Transcribe (1,6 Go) »,
   par exemple) : le modèle vient de Hugging Face, une seule fois.
2. **Le micro.** Si Windows bloque l’accès au micro, J’écoute te le dit et ouvre les bons réglages (Paramètres →
   Confidentialité et sécurité → Microphone).
3. **C’est prêt.** L’accueil s’ouvre sur « Prêt ». Place ton curseur dans n’importe quelle application, maintiens
   Ctrl+Espace, parle, relâche.

<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="media/fr/bienvenue-sombre.png">
    <source media="(prefers-color-scheme: light)" srcset="media/fr/bienvenue-clair.png">
    <img src="media/fr/bienvenue-sombre.png" width="696" alt="Bienvenue dans J’écoute : trois modèles recommandés et le bouton Télécharger">
  </picture>
</p>

J’écoute vit ensuite dans la zone de notification, près de l’horloge. Fermer la fenêtre ne le quitte pas : le
raccourci marche toujours. Un clic gauche sur l’icône rouvre la fenêtre, un clic droit ouvre le menu (dernière
transcription, modèle, réglages, « Quitter »). Pour qu’il démarre avec Windows : Réglages › Application › « Lancer au
démarrage ».

## 6. Mettre à jour

**Installation normale.** Au démarrage, J’écoute regarde sur GitHub si une nouvelle version existe. Si oui, un
bouton « Mise à jour » apparaît en haut de l’accueil ; il mène à Réglages › À propos, où « Installer » télécharge la
mise à jour, vérifie sa signature, l’installe et relance l’app. Tes réglages, ton historique et tes modèles restent.
Tu peux aussi vérifier à la main (« Vérifier » dans À propos, ou « Rechercher des mises à jour… » dans le menu de
l’icône), ou couper la vérification (Réglages › Application › « Vérifier les mises à jour »).

**Installation portable.** Elle ne se met pas à jour toute seule : le bouton « Mise à jour » apparaît aussi, mais
« Installer » ouvre « Mise à jour manuelle », avec le bouton « Télécharger l’installeur ». Lance-le, choisis
« Portable Installation » et le même dossier : le dossier `Data\` (réglages, modèles, enregistrements) est conservé.

## 7. Désinstaller

**Installation normale.** Paramètres de Windows › Applications › Applications installées (« Applications et
fonctionnalités » sous Windows 10) › J’écoute › Désinstaller. Le désinstalleur propose « Delete the application
data » :

- coché, il efface aussi `%APPDATA%\io.github.ponthieutheo.jecoute` (réglages, historique, enregistrements, modèles
  ajoutés à la main) et `%LOCALAPPDATA%\io.github.ponthieutheo.jecoute` (journaux, données de la fenêtre) ;
- non coché, ces dossiers restent, et une nouvelle installation les retrouve.

Les modèles téléchargés sont dans le cache Hugging Face, `%USERPROFILE%\.cache\huggingface\hub` (dossiers
`models--handy-computer--…`), partagé avec d’autres outils : le désinstalleur n’y touche pas. Pour récupérer la place,
supprime-les dans l’app avant de désinstaller (la corbeille, dans la liste des modèles), ou efface ces dossiers à la
main.

**Installation portable.** Quitte J’écoute (clic droit sur l’icône › « Quitter »), puis supprime son dossier :
tout est dedans, modèles compris.

Où est rangé quoi : [confidentialite.md](confidentialite.md#où-sont-tes-données).
