# Le personnage de J'écoute

Ce dossier contient le personnage 3D de la fenêtre d'enregistrement : la boule rouge à cornes, son visage peint,
ses mains, et ses moments pendant une dictée (il surgit, tend l'oreille, siffle pendant la transcription, chuchote
pendant le post-traitement, sourit ou hausse les épaules, puis repart).

## Licence

**PolyForm Noncommercial 1.0.0** (fichier [`LICENSE`](LICENSE)), avec la mention obligatoire :

> Required Notice: Copyright (c) 2026 Théo Ponthieu

Usage, modification et partage libres pour un usage **non commercial**. Toute personne qui reçoit une copie de ces
fichiers doit aussi recevoir ces conditions (ou leur adresse) et la mention ci-dessus.

Cette licence ne couvre que ce dossier (`src/character/`) : le code 3D, le visage et tout ce qui est dérivé du
personnage. **Le reste de J'écoute est sous licence MIT** (basé sur Handy de CJ Pais). Le personnage ne fait pas
partie du code MIT : pour un usage commercial de l'application, il faut le retirer ou obtenir l'accord de son auteur.

## Fichiers

| Fichier           | Rôle                                                                                                                                                 |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `face.ts`         | Le visage : logo projeté sur la sphère, yeux, sourcils, bouches (dont sifflet et chuchotement) peints dans une toile 2D puis reportés sur la texture |
| `head.ts`         | Les volumes : boule, intérieur, paroi de l'encoche entre les cornes, mains (avec la forme « en cornet »), goutte de sueur                            |
| `decor.ts`        | Les signes sans texte : arcs sonores, notes de musique, bulle pointillée, goutte                                                                     |
| `choreography.ts` | Les moments de la dictée et leurs transitions (tout dépend du temps : mêmes événements, mêmes images)                                                |
| `stage.ts`        | Moteur de rendu transparent, caméra, lumières, boucle d'animation, préparation des shaders, perte de contexte, mesures                               |
| `index.ts`        | Ce que le reste de l'application peut importer                                                                                                       |

Le modèle (géométries, matières, rouge `#f0101c`, visage, lumières) reprend le personnage d'origine ; seuls la tête,
le visage, les cornes, les mains et la goutte ont été gardés.

## Le contrat avec l'application

L'overlay (`src/overlay/CharacterOverlay.tsx`, MIT) crée le personnage sur une toile et lui relaie les événements
de la fenêtre d'enregistrement :

```ts
import { createOverlayCharacter, STAGE_W, STAGE_H } from "@/character";

const ch = createOverlayCharacter(canvas, {
  onExitDone: (token) => {
    /* la dernière image (vide) est affichée : la fenêtre peut être cachée */
  },
});
await ch.ready; // facultatif : shaders et textures prêts (lancé dès la création)
ch.show("recording"); // apparition puis armement ; "transcribing" (sifflet), "processing" (chuchotement)
ch.micReady(); // le micro envoie ses premiers échantillons : il tend l'oreille
ch.levels(levels16); // niveaux du micro (16 bandes 0..1, ~30 fois par seconde) : arcs et hochements
ch.error(); // une erreur est arrivée : la sortie sera un « oups »
ch.hide("done", token); // sortie (sourire, ou haussement si "cancel" / jamais transcrit / erreur), puis onExitDone(token)
ch.abort(); // retrait immédiat, sans animation (une autre forme d'overlay prend la fenêtre)
ch.stats(); // temps par image (CPU, et GPU si `measureGpu`)
ch.dispose(); // libère tout, contexte WebGL compris
```

- La scène mesure `STAGE_W` x `STAGE_H` pixels CSS (224 x 144) ; la fenêtre native a exactement cette taille.
- La boucle ne tourne que pendant que le personnage est à l'écran, et s'arrête sur une image vide.
- Un `show()` pendant la sortie le fait revenir depuis sa taille du moment, sans saut.
