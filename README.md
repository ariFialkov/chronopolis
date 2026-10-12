# Chronopolis

A third-person open-world adventure that runs in the browser as a PWA, on desktop and on phones.
One city, one constant map, eighteen eras. Hidden "chronoports" let you walk the same streets in
3200 BCE Uruk, 112 CE Rome, 1600 Sekigahara Japan or 1938, where the game begins.

## Play it

Live build (GitHub Pages, deployed by `.github/workflows/pages.yml` on every push):
**https://arifialkov.github.io/chronopolis/**

## Run it locally

```sh
npm install
npm run dev      # http://localhost:5173, also on your LAN for phones
npm run build    # production build + service worker in dist/
npm run preview  # serve dist/
```

Any static host works for the built `dist/` folder (GitHub Pages, Netlify, S3). The app registers
a service worker, ships a web manifest and offers "Install" on supported browsers.

## Controls

| Desktop | Mobile |
| --- | --- |
| WASD move, mouse look (click the game to capture the pointer) | Left half: joystick. Right half: drag to look |
| Shift run, Space jump | Run (toggle), Jump buttons |
| E talk / read / use a chronoport / advance dialogue | E button |
| M or Tab: journal (map, objectives, chronoports, insights) | Map button |
| Esc: pause (save, quality, controls) | Pause button |

## How the city works

* `src/world/macro.ts` is the geography that never changes: the river, the bay, Citadel Hill, the
  arterial roads and bridges, and the landmark sites. Every era builds on the same bones so the
  player never has to relearn navigation.
* `src/eras/*.ts` describe each era: palette, street pattern (grid, organic, radial, spread,
  castle town), building templates, props, trees, NPC archetypes with dialogue, landmarks for each
  site, the chronoport's hiding place in 1938, district names and the "insight" the era teaches.
* `src/world/pattern.ts` turns an era's layout into streets and building lots as pure functions of
  position, so any chunk can be generated in any order and is always identical.
* `src/world/world.ts` streams 80 m chunks around the player. Near chunks have full detail, far
  chunks have buildings only, everything beyond is culled and hidden by fog. Each chunk is one
  merged, vertex-coloured mesh (one draw call).
* `src/world/landmarks.ts` has every era's monument for every site: ziggurat, pyramid, Parthenon,
  Colosseum, Angkor, castle, Crystal Palace, city hall, and the harbors, arenas, plazas and markets.
* `src/quests/campaign.ts` is the placeholder campaign (prologue, Rome, Hale, one investigation
  per era, finale). It is data: steps are `talk`, `read`, `goto`, `findPort`, `travel`.
* Progress is saved to `localStorage` (autosave every 20 s, on era changes and on quit).

## Chronoport years

Sumerian 3200 BCE, Egyptian 2560 BCE, Minoan 1600 BCE, Mycenaean 1250 BCE, Neo-Assyrian 879 BCE,
Greek 338 BCE, Mauryan 250 BCE, Roman 112 CE, Maya 378 CE, Viking 866 CE, Khmer 1150, Mongol 1241,
Aztec 1519, Sengoku 1600, Buccaneer 1718, Victorian 1851, Wild West 1876, and home: 1938.
