# Le personnage de J'écoute

Ce dossier contient le personnage 3D de J'écoute : la boule rouge à cornes, son visage peint, ses mains, et ses
moments pendant une dictée (il surgit, tend l'oreille en hochant la tête, tape sur un petit clavier pendant la
transcription, chuchote pendant le post-traitement, sourit ou hausse les épaules, puis repart). Il joue dans deux
scènes : la fenêtre d'enregistrement (overlay) et l'accueil de la fenêtre principale (`<Perso />`), où il reste à
l'écran, vit au repos et suit la souris.

## Licence

**PolyForm Noncommercial 1.0.0** (fichier [`LICENSE`](LICENSE)), avec la mention obligatoire :

> Required Notice: Copyright (c) 2026 Théo Ponthieu

Usage, modification et partage libres pour un usage **non commercial**. Toute personne qui reçoit une copie de ces
fichiers doit aussi recevoir ces conditions (ou leur adresse) et la mention ci-dessus.

Cette licence ne couvre que ce dossier (`src/character/`) : le code 3D, le visage et tout ce qui est dérivé du
personnage. **Le reste de J'écoute est sous licence MIT** (basé sur Handy de CJ Pais). Le personnage ne fait pas
partie du code MIT : pour un usage commercial de l'application, il faut le retirer ou obtenir l'accord de son auteur.

## Fichiers

| Fichier           | Rôle                                                                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `face.ts`         | Le visage : logo projeté sur la sphère, yeux, sourcils, bouches (dont chuchotement) peints dans une toile 2D puis reportés sur la texture       |
| `head.ts`         | Les volumes : boule, intérieur, paroi de l'encoche entre les cornes, mains (avec la forme « en cornet »), goutte de sueur                       |
| `decor.ts`        | Les signes sans texte : arcs sonores, bulle pointillée, goutte                                                                                  |
| `keyboard.ts`     | Le petit clavier noir de la transcription, repris du clavier du bureau d'origine : touches qui s'enfoncent sous les mains                       |
| `choreography.ts` | Les moments de la dictée et leurs transitions (tout dépend du temps : mêmes événements, mêmes images) ; phase de repos de la fenêtre principale |
| `rig.ts`          | Le personnage monté (lumières, tête, mains, signes, clavier), préparation des shaders, perte et restauration du contexte WebGL                  |
| `meter.ts`        | Mesures : temps CPU et GPU par image, intervalles, repeints du visage                                                                           |
| `stage.ts`        | Scène de la fenêtre d'enregistrement : rendu transparent 224 x 144, caméra, boucle d'animation, répétition silencieuse                          |
| `rest.ts`         | Le repos de la fenêtre principale : regard, petits mouvements, saynètes, réactions au clic, sommeil, humeurs hors dictée                        |
| `home.ts`         | Scène de la fenêtre principale : toile qui remplit son conteneur, cadrage, compact, cadence (30 / 60 i/s), pause                                |
| `cursor.ts`       | Position du curseur pour le regard, y compris hors de la fenêtre (API de Tauri)                                                                 |
| `Perso.tsx`       | Le composant `<Perso />` de la fenêtre principale (contrat avec l'interface)                                                                    |
| `index.ts`        | Ce que l'overlay importe                                                                                                                        |

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
ch.show("recording"); // apparition puis armement ; "transcribing" (frappe au clavier), "processing" (chuchotement)
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
- La frappe dure au moins `MIN_TYPING` (1 s, dans `choreography.ts`) : si la transcription est plus rapide, le
  chuchotement ou la sortie attendent la fin de la frappe. Seule l'animation attend, jamais le collage du texte.

## Le contrat avec la fenêtre principale

```tsx
import { Perso } from "@/character/Perso";

<Perso
  mood="pret" // "pret" | "chargement" | "micro-absent" | "erreur" | "ecoute" | "frappe" | "chuchote"
  micLevels={levels} // 16 bandes 0..1 pendant l'écoute (événement main-mic-level), sinon null
  lookAt="souris" // ou "gauche" | "droite" | "bas" : il regarde cette zone de la fenêtre
  compact={false} // réglages ouverts : il rapetisse dans son conteneur, en douceur
  paused={false} // fenêtre réduite : boucle arrêtée (elle s'arrête aussi seule quand la page est cachée)
  onPoke={() => {}} // clic sur lui (sa réaction est déjà animée)
/>;
```

- Il remplit son conteneur (fond transparent) ; le cadrage garde toujours la tête, les mains levées, les arcs
  sonores et le clavier visibles, quelle que soit la forme du conteneur. Accueil de la maquette A : 400 x 240.
- `compact` le rapetisse (74 %) dans le même conteneur : inutile de réduire le conteneur en plus (on peut le
  déplacer). Un conteneur qui change de taille est géré quand même, sans image vide.
- Au repos : respiration, clignements, petits mouvements de tête ; toutes les 8 à 20 s une saynète (regarde autour,
  s'étire, bâille, tour sur lui-même, tapote des doigts, salue, tend l'oreille au silence, fredonne), jamais la
  même deux fois de suite ; il s'endort après 75 s sans rien et se réveille quand la souris bouge ; il salue quand
  la fenêtre revient après plus de 20 s d'absence.
- Le regard suit le curseur (les yeux par saccades, la tête en douceur), même hors de la fenêtre dans
  l'application (`core:window:allow-cursor-position` et `allow-inner-position`, déjà dans `core:default`).
- Chargé à part (`import()` de `home.ts`) ; si WebGL manque, la tête 2D s'affiche à la place.
- Budget : 2 pixels par pixel CSS, 30 images par seconde quand la tête est lente, 60 sinon, rien quand la page est
  cachée ou `paused`.
