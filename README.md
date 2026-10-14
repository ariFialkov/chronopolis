# Chronopolis

A third-person open-world adventure that runs in the browser as a PWA, on desktop and on phones.
One city, one constant map, eighteen eras. Hidden "chronoports" let you walk the same streets in
3200 BCE Uruk, 112 CE Rome, 1600 Sekigahara Japan or 1938, where the game begins.

## Play it

Live build (GitHub Pages, deployed by `.github/workflows/pages.yml` on every push):
**https://arifialkov.github.io/chronopolis/**

## Desktop version (Godot 4, C#)

The game is being rebuilt as a downloadable desktop game in [Godot 4.7](https://godotengine.org) (.NET/C#),
in [`godot/`](godot/). It is a faithful port: the same seeded generators produce the identical city, buildings,
landmarks, characters and quests, rendered with Godot's Forward+ renderer (Vulkan, Metal on Mac). That brings
real-time shadows, ambient occlusion, a cloud sky, animated water and filmic tonemapping, and world
generation runs on worker threads.

**Download:** every push that touches `godot/` runs `.github/workflows/godot-build.yml`, which
exports macOS (universal: Apple Silicon and Intel), Windows and Linux builds. It publishes them as a
pre-release under **Releases** (`Chronopolis-mac.zip`, `Chronopolis-windows.zip`, `Chronopolis-linux.zip`)
and as artifacts on the workflow run.

**Run on a Mac:**
1. Download `Chronopolis-mac.zip` (about 125 MB) and unzip it. Safari unzips it automatically.
2. Move `Chronopolis.app` anywhere you like, for example Applications, and double-click it.
3. The app is not notarized yet, so the first launch is blocked ("Apple could not verify..."). Open
   **System Settings > Privacy & Security**, scroll down and click **Open Anyway**, then confirm.
   Alternatively, run this once in Terminal: `xattr -dr com.apple.quarantine /path/to/Chronopolis.app`
4. It needs macOS 11 or later on Apple Silicon, or 10.15 or later on Intel.

**Controls:**
- **Keyboard and mouse:** WASD to move, mouse to look (click the game to capture the mouse).
  Shift runs, Space jumps, E talks, uses or continues, M or Tab opens the journal, Esc pauses.
- **Gamepad:** left stick moves and right stick looks. L3 runs, A or Cross jumps, X or Square interacts,
  Back or Y opens the journal, and Start pauses.
- **Display:** F11 or Alt+Enter toggles fullscreen (Cmd+Ctrl+F on a Mac).
- **Dev panel:** the backquote key toggles the dev panel (fps and one-click era travel).
- **Quality:** Pause > Quality cycles low, medium, high and ultra. Higher tiers stream more of the city
  and add SSIL, screen-space reflections and longer shadow range.

Saves and settings live in the user data folder (`~/Library/Application Support/Godot/app_userdata/Chronopolis`
on a Mac).

**Develop:**
1. Install [Godot 4.7 .NET](https://godotengine.org/download) and the .NET 8 SDK, then open `godot/project.godot`.
2. Press F5 to play. Godot's own export menu builds the desktop apps.
3. Game content (eras, outfits, campaign) comes from the TypeScript sources. After changing them, run
   `npm run export:godot` to regenerate `godot/data/*.json`.
4. Dev scenes: `scenes/lineup.tscn` shows an era's character lineup, and `scenes/worldshot.tscn` renders
   any era and position, for example `godot --path godot res://scenes/worldshot.tscn -- --era=roman --x=-12 --z=-160`.
5. For an automated playthrough with screenshots, run `godot --path godot -- --smoke --shots=/tmp/shots`.

## Run it locally (web version)

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

## Developer widget

A small panel on the left (toggle with the backquote key) shows fps, triangles, draw calls and
loaded chunks, and has one-click chronoport buttons for every era. It is created by one line in
`src/main.ts` (`new DevTools(game)`); delete that line before release.

With `npm run dev` running, `http://localhost:5173/lineup.html?era=roman` shows an era's player
outfit and five townspeople side by side, like the character sheet. Add `&yaw=2.6` to turn them,
`&walk=1` to animate, `&zoom=1` for faces and `&variant=1` or `2` for the crowd variations. The
page is not part of the game build.

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
* `src/world/textures.ts` draws a 16-tile texture atlas at startup (brick, stone, plaster, wood, roof
  tile, thatch, slate, cobbles, asphalt, dirt, grass, sand, paving, mudbrick, timber frame, concrete).
  `src/world/material.ts` patches the Lambert shader so each face picks a tile while every chunk stays
  one draw call. `src/eras/styles.ts` holds each era's building recipes (textures, window styles and
  features such as arcades, porches, bay windows, fire escapes, lattices, false fronts).
  `src/world/surfaces.ts` defines each era's roads, plazas and parks.
* `src/world/landmarks.ts` has every era's monument for every site: ziggurat, pyramid, Parthenon,
  Colosseum, Angkor, castle, Crystal Palace, city hall, and the harbors, arenas, plazas and markets.
* `src/characters/` builds every person in the game from one shared rig: `character.ts` makes a
  skinned, flat-shaded body (about 800 triangles, one draw call) and animates it procedurally,
  `outfit.ts` is the clothing vocabulary (tunics, skirts, togas, armour, coats, vests, overalls,
  sashes, aprons, capes, hair, beards and some 25 kinds of hat), and `cast.ts` dresses the player and
  each era's five townspeople after the character sheet. Era NPC archetypes name their outfit.
* `src/quests/campaign.ts` is the placeholder campaign (prologue, Rome, Hale, one investigation
  per era, finale). It is data: steps are `talk`, `read`, `goto`, `findPort`, `travel`.
* Progress is saved to `localStorage` (autosave every 20 s, on era changes and on quit).

## Chronoport years

Sumerian 3200 BCE, Egyptian 2560 BCE, Minoan 1600 BCE, Mycenaean 1250 BCE, Neo-Assyrian 879 BCE,
Greek 338 BCE, Mauryan 250 BCE, Roman 112 CE, Maya 378 CE, Viking 866 CE, Khmer 1150, Mongol 1241,
Aztec 1519, Sengoku 1600, Buccaneer 1718, Victorian 1851, Wild West 1876, and home: 1938.
