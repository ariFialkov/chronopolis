/**
 * Building template sets per era. Each template is a recipe: proportions, roof, wall texture,
 * window style and a list of features the generator adds (arcades, porches, fire escapes...).
 * These are what make a Roman street look Roman and a 1938 street look like 1938.
 */
import type { BuildingTemplate } from './types';
import { TILE } from '../world/textures';

const T = TILE;

export const BUILDING_STYLES: Record<string, BuildingTemplate[]> = {
  sumerian: [
    { weight: 7, floors: [1, 1], floorHeight: 3.2, footprint: [0.7, 0.95], roof: 'flat', roofColors: [0xb08c5a], wallColors: [0xc4a46c, 0xb9975f, 0xcdb07a], parapet: true, tex: T.MUDBRICK, windows: 'slit', features: ['plinth', 'ladder'] },
    { weight: 3, floors: [2, 2], floorHeight: 2.9, footprint: [0.6, 0.9], roof: 'flat', roofColors: [0xa8844f], wallColors: [0xbf9d63, 0xc9aa72], parapet: true, tex: T.MUDBRICK, windows: 'slit', features: ['plinth', 'ledges'] },
    { weight: 1.5, floors: [1, 1], floorHeight: 2.6, footprint: [0.5, 0.7], roof: 'thatch', roofColors: [0xcfb679], wallColors: [0xc8b07e], round: true, tex: T.THATCH, roofTex: T.THATCH, windows: 'none' },
    { weight: 1, floors: [1, 2], floorHeight: 3.6, footprint: [0.8, 0.95], roof: 'flat', roofColors: [0x9d7c4c], wallColors: [0xd2b483], parapet: true, courtyard: true, tex: T.MUDBRICK, windows: 'slit', features: ['bands', 'pilasters', 'plinth'], accent: 0x2a5a8a, tag: 'temple' },
    { weight: 1, floors: [1, 1], floorHeight: 4, footprint: [0.85, 0.95], roof: 'flat', roofColors: [0xa8844f], wallColors: [0xb9975f], parapet: true, tex: T.MUDBRICK, windows: 'none', features: ['plinth', 'pilasters'], tag: 'granary' },
  ],
  egyptian: [
    { weight: 7, floors: [1, 2], floorHeight: 3, footprint: [0.65, 0.92], roof: 'flat', roofColors: [0xcdb07a], wallColors: [0xe3cc98, 0xd8bf85, 0xead8aa, 0xf1e3bf], parapet: true, tex: T.MUDBRICK, windows: 'slit', features: ['battered', 'bands'], accent: 0xb04a3a },
    { weight: 2, floors: [2, 3], floorHeight: 3.1, footprint: [0.7, 0.9], roof: 'flat', roofColors: [0xc2a570], wallColors: [0xf0dfb4, 0xe6d3a3], parapet: true, tex: T.PLASTER, windows: 'square', features: ['battered', 'bands', 'cornice'], accent: 0x2d5da6, trim: 0xb04a3a },
    { weight: 1, floors: [1, 1], floorHeight: 4.4, footprint: [0.8, 0.95], roof: 'flat', roofColors: [0xd9c28d], wallColors: [0xf2e4c0], tex: T.STONE, windows: 'none', features: ['battered', 'pilasters', 'bands', 'cornice'], accent: 0x2d5da6, tag: 'temple' },
    { weight: 1.5, floors: [1, 1], floorHeight: 2.6, footprint: [0.6, 0.85], roof: 'flat', roofColors: [0xcbb27f], wallColors: [0xd9c08a], courtyard: true, tex: T.MUDBRICK, windows: 'slit', features: ['porch', 'bands'], accent: 0x2d5da6 },
    { weight: 1, floors: [1, 1], floorHeight: 3.4, footprint: [0.5, 0.7], roof: 'dome', roofColors: [0xd8bf85], wallColors: [0xd8bf85], round: true, tex: T.MUDBRICK, windows: 'none', tag: 'granary' },
  ],
  minoan: [
    { weight: 6, floors: [2, 3], floorHeight: 2.9, footprint: [0.65, 0.9], roof: 'flat', roofColors: [0xd7c6a3], wallColors: [0xf2e8d5, 0xe8d8bd, 0xf7efe0], parapet: true, tex: T.PLASTER, windows: 'square', features: ['ledges', 'frames', 'bands'], accent: 0xb03a2a, trim: 0xb03a2a },
    { weight: 3, floors: [1, 2], floorHeight: 3, footprint: [0.6, 0.85], roof: 'flat', roofColors: [0xc9b58f], wallColors: [0xeadfc6, 0xf1e9d6], tex: T.STONE, windows: 'square', features: ['frames', 'bands', 'plinth'], accent: 0x2c5f8a, trim: 0x2c5f8a },
    { weight: 1, floors: [2, 2], floorHeight: 3.2, footprint: [0.8, 0.95], roof: 'flat', roofColors: [0xcdb68f], wallColors: [0xf6ecd8], courtyard: true, tex: T.PLASTER, windows: 'square', features: ['porch', 'bands', 'horns', 'ledges'], accent: 0xb03a2a, trim: 0xb03a2a, tag: 'villa' },
    { weight: 1, floors: [1, 1], floorHeight: 3.4, footprint: [0.8, 0.95], roof: 'flat', roofColors: [0xc9b58f], wallColors: [0xe8d8bd], tex: T.STONE, windows: 'none', features: ['plinth'], tag: 'magazine' },
  ],
  mycenaean: [
    { weight: 6, floors: [1, 2], floorHeight: 2.9, footprint: [0.65, 0.9], roof: 'flat', roofColors: [0xa89572], wallColors: [0xd8cba9, 0xcdbf9c, 0xe0d4b4], tex: T.STONE, texRepeat: 0.3, windows: 'slit', features: ['plinth'] },
    { weight: 3, floors: [1, 1], floorHeight: 3.2, footprint: [0.6, 0.85], roof: 'gable', roofColors: [0x9b7a55], wallColors: [0xd3c4a0, 0xc8b78e], tex: T.MUDBRICK, roofTex: T.THATCH, windows: 'slit', features: ['plinth', 'ridge'] },
    { weight: 1, floors: [1, 1], floorHeight: 4.6, footprint: [0.8, 0.95], roof: 'gable', roofColors: [0x8a6d4a], wallColors: [0xe3d6b5], tex: T.STONE, roofTex: T.ROOFTILE, windows: 'none', features: ['porch', 'plinth', 'bands'], accent: 0xb03a2a, tag: 'megaron' },
    { weight: 1, floors: [1, 1], floorHeight: 3.2, footprint: [0.85, 0.95], roof: 'flat', roofColors: [0xa89572], wallColors: [0xc8b78e], tex: T.STONE, texRepeat: 0.25, windows: 'none', features: ['plinth', 'crenellation'], tag: 'storehouse' },
  ],
  assyrian: [
    { weight: 6, floors: [1, 2], floorHeight: 3.2, footprint: [0.7, 0.95], roof: 'flat', roofColors: [0xa68453], wallColors: [0xc9a56c, 0xbf9b63, 0xd1ae76], parapet: true, tex: T.MUDBRICK, windows: 'slit', features: ['plinth', 'crenellation'] },
    { weight: 2, floors: [2, 3], floorHeight: 3.3, footprint: [0.75, 0.95], roof: 'flat', roofColors: [0x9c7a4c], wallColors: [0xcfae78], parapet: true, tex: T.MUDBRICK, windows: 'slit', features: ['crenellation', 'bands', 'pilasters'], accent: 0x3f6f9e, trim: 0x3f6f9e },
    { weight: 1, floors: [2, 2], floorHeight: 4, footprint: [0.85, 0.95], roof: 'flat', roofColors: [0x8f6f45], wallColors: [0xd6b47c], parapet: true, courtyard: true, tower: true, tex: T.BRICK, windows: 'slit', features: ['crenellation', 'bands', 'pilasters', 'plinth'], accent: 0x3f6f9e, tag: 'palace' },
    { weight: 1, floors: [1, 1], floorHeight: 3.4, footprint: [0.85, 0.95], roof: 'flat', roofColors: [0xa68453], wallColors: [0xbf9b63], parapet: true, tex: T.MUDBRICK, windows: 'none', features: ['plinth', 'arcade'], tag: 'storehouse' },
  ],
  greek: [
    { weight: 6, floors: [1, 2], floorHeight: 3, footprint: [0.65, 0.9], roof: 'hip', roofColors: [0xb5533b, 0xa8482f], wallColors: [0xf1ebdc, 0xe7dfcb, 0xf6f0e3], courtyard: true, tex: T.PLASTER, roofTex: T.ROOFTILE, windows: 'square', features: ['plinth', 'frames', 'shutters'], accent: 0x3a5a8a },
    { weight: 3, floors: [1, 2], floorHeight: 3, footprint: [0.6, 0.85], roof: 'gable', roofColors: [0xb5533b], wallColors: [0xece3d0, 0xf3ecdf], tex: T.PLASTER, roofTex: T.ROOFTILE, windows: 'square', features: ['plinth', 'sills', 'eaves'] },
    { weight: 1, floors: [1, 1], floorHeight: 5, footprint: [0.8, 0.95], roof: 'gable', roofColors: [0xc7b89a], wallColors: [0xf7f2e6], tex: T.STONE, roofTex: T.ROOFTILE, windows: 'none', features: ['porch', 'pilasters', 'plinth', 'cornice'], tag: 'temple' },
    { weight: 1, floors: [1, 1], floorHeight: 4, footprint: [0.85, 0.95], roof: 'flat', roofColors: [0xd9d0bd], wallColors: [0xf2ece0], tex: T.STONE, windows: 'none', features: ['arcade', 'cornice', 'plinth'], tag: 'stoa' },
    { weight: 1, floors: [1, 1], floorHeight: 3.2, footprint: [0.6, 0.8], roof: 'hip', roofColors: [0xb5533b], wallColors: [0xd9c8a8], tex: T.MUDBRICK, roofTex: T.ROOFTILE, windows: 'slit', features: ['plinth'], tag: 'workshop' },
  ],
  mauryan: [
    { weight: 6, floors: [1, 2], floorHeight: 3, footprint: [0.6, 0.9], roof: 'hip', roofColors: [0x8a5a3a, 0x9c6b45], wallColors: [0xe6d6b2, 0xd8c69c, 0xefe2c4], tex: T.BRICK, texRepeat: 0.6, roofTex: T.ROOFTILE, windows: 'arch', features: ['balcony', 'lattice', 'eaves', 'plinth'], accent: 0x7a4a2c },
    { weight: 3, floors: [1, 1], floorHeight: 3, footprint: [0.55, 0.8], roof: 'thatch', roofColors: [0xb9a06a], wallColors: [0xd9c49a, 0xcdb88e], tex: T.MUDBRICK, roofTex: T.THATCH, windows: 'square', features: ['porch', 'plinth'] },
    { weight: 1, floors: [1, 1], floorHeight: 3.6, footprint: [0.7, 0.9], roof: 'dome', roofColors: [0xe9e2cf], wallColors: [0xf1e9d4], round: true, tex: T.BRICK, windows: 'none', features: ['bands'], accent: 0xd9a52a, tag: 'stupa' },
    { weight: 1, floors: [2, 3], floorHeight: 3.4, footprint: [0.8, 0.95], roof: 'hip', roofColors: [0x7a4a2c], wallColors: [0xf2e8d0], tex: T.PLASTER, roofTex: T.WOOD, windows: 'arch', features: ['porch', 'pilasters', 'balcony', 'eaves', 'cornice'], accent: 0x7a4a2c, tag: 'hall' },
  ],
  roman: [
    { weight: 6, floors: [3, 5], floorHeight: 3, footprint: [0.78, 0.96], roof: 'hip', roofColors: [0xb04f36, 0xa4432c, 0xbd5a3e], wallColors: [0xd9c3a0, 0xcfb58f, 0xe2cfae, 0xc9b08a], tex: T.BRICK, texRepeat: 0.7, roofTex: T.ROOFTILE, windows: 'square', features: ['arcade', 'balcony', 'ledges', 'eaves'], accent: 0x5a4a3a, tag: 'insula' },
    { weight: 3, floors: [1, 2], floorHeight: 3.2, footprint: [0.75, 0.95], roof: 'hip', roofColors: [0xb04f36], wallColors: [0xf0e4cc, 0xe8dabd], courtyard: true, tex: T.PLASTER, roofTex: T.ROOFTILE, windows: 'slit', features: ['plinth', 'bands', 'eaves'], accent: 0xa4432c, tag: 'domus' },
    { weight: 1, floors: [1, 1], floorHeight: 6, footprint: [0.8, 0.95], roof: 'gable', roofColors: [0xd9cfbc], wallColors: [0xf4efe4], tex: T.STONE, roofTex: T.ROOFTILE, windows: 'none', features: ['porch', 'pilasters', 'plinth', 'cornice'], tag: 'temple' },
    { weight: 1, floors: [1, 1], floorHeight: 5, footprint: [0.85, 0.95], roof: 'flat', roofColors: [0xc7bca6], wallColors: [0xeae2d0], tex: T.STONE, windows: 'arch', features: ['arcade', 'cornice', 'plinth', 'pilasters'], tag: 'basilica' },
    { weight: 1.5, floors: [1, 2], floorHeight: 3.6, footprint: [0.85, 0.95], roof: 'gable', roofColors: [0xa4432c], wallColors: [0xc9b08a, 0xbfa078], tex: T.BRICK, texRepeat: 0.7, roofTex: T.ROOFTILE, windows: 'arch', features: ['arcade', 'plinth'], tag: 'horrea' },
  ],
  mayan: [
    { weight: 6, floors: [1, 1], floorHeight: 2.8, footprint: [0.55, 0.8], roof: 'thatch', roofColors: [0xb59f67, 0xa8925c], wallColors: [0xe8dcc0, 0xd9ccaa, 0xc9b58f], tex: T.WOOD, roofTex: T.THATCH, windows: 'none', features: ['plinth', 'ridge'] },
    { weight: 2, floors: [1, 1], floorHeight: 3.4, footprint: [0.7, 0.9], roof: 'flat', roofColors: [0xd6c7a4], wallColors: [0xecdfc2, 0xf2e6cc], parapet: true, tex: T.PLASTER, windows: 'slit', features: ['plinth', 'bands', 'cornice'], accent: 0xb0423a, trim: 0xb0423a },
    { weight: 1, floors: [1, 1], floorHeight: 3, footprint: [0.8, 0.95], roof: 'stepped', roofColors: [0xdccfb0], wallColors: [0xe9dcc0], tex: T.STONE, windows: 'none', features: ['plinth', 'bands'], accent: 0xb0423a, tag: 'shrine' },
    { weight: 1, floors: [1, 1], floorHeight: 3, footprint: [0.8, 0.95], roof: 'flat', roofColors: [0xd6c7a4], wallColors: [0xe3d6b5], courtyard: true, tex: T.PLASTER, windows: 'slit', features: ['plinth', 'bands'], accent: 0x2b8f6a, tag: 'compound' },
  ],
  viking: [
    { weight: 6, floors: [1, 1], floorHeight: 2.6, footprint: [0.75, 0.95], roof: 'thatch', roofColors: [0x6f8a3a, 0x7a8a40, 0x9c8a55], wallColors: [0x6e5436, 0x7d6140, 0x5c4630], overhang: 0.9, tex: T.WOOD, roofTex: T.GRASS, windows: 'none', features: ['ridge', 'plinth'], tag: 'longhouse' },
    { weight: 3, floors: [1, 1], floorHeight: 2.4, footprint: [0.4, 0.6], roof: 'gable', roofColors: [0x7a6a3a], wallColors: [0x6e5436, 0x5a4530], overhang: 0.6, tex: T.WOOD, roofTex: T.THATCH, windows: 'none', features: ['ridge'] },
    { weight: 1, floors: [1, 1], floorHeight: 3.4, footprint: [0.8, 0.95], roof: 'gable', roofColors: [0x4f4a3a], wallColors: [0x4e3a28], overhang: 1.1, tex: T.WOOD, roofTex: T.WOOD, windows: 'none', features: ['ridge', 'porch', 'plinth'], tag: 'hall' },
    { weight: 1.5, floors: [1, 1], floorHeight: 2.2, footprint: [0.5, 0.7], roof: 'gable', roofColors: [0x8a7a4a], wallColors: [0x8a8a80], overhang: 0.5, tex: T.STONE, roofTex: T.THATCH, windows: 'none', tag: 'byre' },
  ],
  khmer: [
    { weight: 6, floors: [1, 1], floorHeight: 2.8, footprint: [0.55, 0.8], roof: 'thatch', roofColors: [0x9c8a55, 0x8a7a4a], wallColors: [0x8a6a44, 0x7d5f3c, 0x9c7a50], stilts: true, tex: T.WOOD, roofTex: T.THATCH, windows: 'square', features: ['ridge', 'ladder'] },
    { weight: 2, floors: [1, 1], floorHeight: 3, footprint: [0.65, 0.85], roof: 'gable', roofColors: [0x8a4a2a], wallColors: [0xa98a5a, 0xb4915f], stilts: true, overhang: 0.8, tex: T.WOOD, roofTex: T.ROOFTILE, windows: 'square', features: ['ridge', 'eaves', 'ladder'] },
    { weight: 1, floors: [1, 2], floorHeight: 3.6, footprint: [0.8, 0.95], roof: 'pagoda', roofColors: [0x8a8070], wallColors: [0x9a9078, 0xa89e86], tower: true, tex: T.STONE, roofTex: T.STONE, windows: 'arch', features: ['plinth', 'ridge', 'pilasters'], tag: 'temple' },
    { weight: 1, floors: [1, 1], floorHeight: 3.2, footprint: [0.7, 0.9], roof: 'hip', roofColors: [0x8a4a2a], wallColors: [0xb4915f], tex: T.WOOD, roofTex: T.ROOFTILE, windows: 'none', features: ['arcade', 'eaves', 'ridge'], tag: 'pavilion' },
  ],
  mongol: [
    { weight: 8, floors: [1, 1], floorHeight: 2.2, footprint: [0.5, 0.7], roof: 'dome', roofColors: [0xe9e4d6, 0xdcd6c6], wallColors: [0xf0ece0, 0xe4ded0], round: true, tex: T.PLASTER, roofTex: T.PLASTER, windows: 'none', features: ['bands'], accent: 0xb0343a, tag: 'ger' },
    { weight: 2, floors: [1, 1], floorHeight: 2.4, footprint: [0.6, 0.8], roof: 'dome', roofColors: [0xc9b8a0], wallColors: [0xd8c8a8], round: true, tex: T.PLASTER, windows: 'none', features: ['bands'], accent: 0x3d6fb0, trim: 0x3d6fb0 },
    { weight: 1, floors: [1, 1], floorHeight: 3.6, footprint: [0.8, 0.95], roof: 'dome', roofColors: [0xf4efe4], wallColors: [0xf9f6ee], round: true, tex: T.PLASTER, windows: 'none', features: ['bands'], accent: 0xd9a52a, trim: 0xb0343a, tag: 'great_ger' },
  ],
  aztec: [
    { weight: 6, floors: [1, 1], floorHeight: 3, footprint: [0.7, 0.92], roof: 'flat', roofColors: [0xd8cdb0], wallColors: [0xf1ebdc, 0xe9e0cc, 0xf6f0e4], parapet: true, tex: T.PLASTER, windows: 'slit', features: ['plinth', 'bands'], accent: 0xc8372d, trim: 0xc8372d },
    { weight: 3, floors: [1, 2], floorHeight: 3, footprint: [0.65, 0.9], roof: 'flat', roofColors: [0xcdb996], wallColors: [0xe6dcc4, 0xeadfc8], parapet: true, courtyard: true, tex: T.PLASTER, windows: 'slit', features: ['plinth', 'bands', 'cornice'], accent: 0x2b6fb0 },
    { weight: 1, floors: [1, 1], floorHeight: 3.4, footprint: [0.8, 0.95], roof: 'stepped', roofColors: [0xe0d6bc], wallColors: [0xf3ecdc], tex: T.STONE, windows: 'none', features: ['plinth', 'bands'], accent: 0x2b6fb0, trim: 0x2b6fb0, tag: 'shrine' },
    { weight: 1.5, floors: [1, 1], floorHeight: 2.6, footprint: [0.5, 0.75], roof: 'thatch', roofColors: [0xb59f67], wallColors: [0xc9b58f], tex: T.WOOD, roofTex: T.THATCH, windows: 'none', features: ['ridge'] },
  ],
  sengoku: [
    { weight: 6, floors: [1, 2], floorHeight: 2.8, footprint: [0.75, 0.95], roof: 'gable', roofColors: [0x3a3a3c, 0x2e2e32, 0x4a4a4c], wallColors: [0xe8e0cc, 0xd9cfb5, 0xa08358], overhang: 0.9, tex: T.PLASTER, roofTex: T.SLATE, windows: 'shoji', features: ['lattice', 'eaves', 'plinth', 'ridge'], accent: 0x3a2a1a, tag: 'machiya' },
    { weight: 2, floors: [1, 1], floorHeight: 3, footprint: [0.6, 0.85], roof: 'hip', roofColors: [0x3a3a3c], wallColors: [0xf0e8d4], overhang: 1.2, courtyard: true, tex: T.PLASTER, roofTex: T.SLATE, windows: 'shoji', features: ['eaves', 'plinth', 'veranda'], accent: 0x3a2a1a, tag: 'samurai' },
    { weight: 1, floors: [2, 3], floorHeight: 3.2, footprint: [0.7, 0.9], roof: 'pagoda', roofColors: [0x3a3a3c], wallColors: [0xb8392e, 0xd9cfb5], tower: true, tex: T.PLASTER, roofTex: T.SLATE, windows: 'shoji', features: ['eaves', 'ridge', 'plinth'], tag: 'temple' },
    { weight: 1.5, floors: [1, 2], floorHeight: 3, footprint: [0.6, 0.8], roof: 'gable', roofColors: [0x2e2e32], wallColors: [0xf4f0e6], overhang: 0.5, tex: T.PLASTER, roofTex: T.SLATE, windows: 'slit', features: ['plinth', 'bands'], accent: 0x2a2a2a, tag: 'kura' },
  ],
  buccaneer: [
    { weight: 6, floors: [1, 2], floorHeight: 3, footprint: [0.65, 0.9], roof: 'gable', roofColors: [0x6a4a3a, 0x7a5a45, 0x5a4a3a], wallColors: [0xe9dfc8, 0xd9c7a0, 0xc9b088, 0x8fb0b8], chimney: true, tex: T.WOOD, roofTex: T.SLATE, windows: 'tall', features: ['shutters', 'veranda', 'frames', 'chimneypots'], accent: 0x2a5a4a },
    { weight: 2, floors: [1, 1], floorHeight: 2.8, footprint: [0.5, 0.75], roof: 'thatch', roofColors: [0xb9a06a], wallColors: [0x9a7a5a, 0xb08a60], tex: T.WOOD, roofTex: T.THATCH, windows: 'square', features: ['porch'] },
    { weight: 1, floors: [2, 2], floorHeight: 3.4, footprint: [0.8, 0.95], roof: 'hip', roofColors: [0x8a3a2a], wallColors: [0xf2e8d2], tex: T.PLASTER, roofTex: T.ROOFTILE, windows: 'tall', features: ['porch', 'pilasters', 'cornice', 'shutters', 'balcony'], accent: 0x2a5a4a, tag: 'governor' },
    { weight: 1.5, floors: [1, 2], floorHeight: 3.6, footprint: [0.8, 0.95], roof: 'gable', roofColors: [0x5a4a3a], wallColors: [0x9a8a78, 0xa89a88], tex: T.STONE, roofTex: T.SLATE, windows: 'arch', features: ['plinth', 'arcade'], tag: 'warehouse' },
    { weight: 1, floors: [2, 2], floorHeight: 3.2, footprint: [0.7, 0.9], roof: 'gable', roofColors: [0x5a4a3a], wallColors: [0xd9c7a0], chimney: true, tex: T.WOOD, roofTex: T.SLATE, windows: 'square', features: ['storefront', 'sign', 'balcony', 'shutters'], accent: 0x8a2a2a, tag: 'tavern' },
  ],
  wildwest: [
    { weight: 5, floors: [1, 2], floorHeight: 3.2, footprint: [0.7, 0.95], roof: 'gable', roofColors: [0x6a4a3a, 0x5a4a3a], wallColors: [0xb08a5a, 0x9a7a52, 0xc9a070, 0xd9cfb5], tex: T.WOOD, roofTex: T.WOOD, windows: 'tall', features: ['falsefront', 'porch', 'storefront', 'sign', 'frames'], accent: 0x8a2a2a, tag: 'falsefront' },
    { weight: 2, floors: [2, 2], floorHeight: 3.3, footprint: [0.8, 0.95], roof: 'gable', roofColors: [0x5a4a3a], wallColors: [0xc9a070, 0xd9b888], tex: T.WOOD, roofTex: T.WOOD, windows: 'tall', features: ['falsefront', 'porch', 'balcony', 'storefront', 'sign', 'awning'], accent: 0x2a4a7a, tag: 'saloon' },
    { weight: 2, floors: [1, 1], floorHeight: 2.8, footprint: [0.5, 0.75], roof: 'gable', roofColors: [0x5a4a3a], wallColors: [0x8a6a4a, 0x7a5a3a], chimney: true, tex: T.WOOD, roofTex: T.WOOD, windows: 'square', features: ['porch', 'frames'] },
    { weight: 1, floors: [2, 2], floorHeight: 3.4, footprint: [0.8, 0.95], roof: 'flat', roofColors: [0x4a3a2a], wallColors: [0xd9cfb5, 0xb89a78], parapet: true, tex: T.BRICK, texRepeat: 0.7, windows: 'arch', features: ['cornice', 'pilasters', 'sign', 'plinth'], accent: 0x2a2a2a, tag: 'bank' },
    { weight: 1, floors: [1, 1], floorHeight: 4.2, footprint: [0.8, 0.95], roof: 'gable', roofColors: [0x6a3a2a], wallColors: [0x9a3a2a, 0x8a3a2a], tex: T.WOOD, roofTex: T.WOOD, windows: 'none', features: ['plinth'], tag: 'barn' },
  ],
  victorian: [
    { weight: 6, floors: [3, 4], floorHeight: 3.3, footprint: [0.85, 0.98], roof: 'gable', roofColors: [0x4a4a52, 0x3a3a42], wallColors: [0x8a5a44, 0x9a6a4e, 0x7a4e3a, 0xd9d0bf], chimney: true, tex: T.BRICK, texRepeat: 0.8, roofTex: T.SLATE, windows: 'tall', features: ['sills', 'frames', 'bay', 'plinth', 'chimneypots', 'cornice'], accent: 0xe8e0d0, tag: 'terrace' },
    { weight: 2, floors: [4, 6], floorHeight: 3.4, footprint: [0.85, 0.98], roof: 'hip', roofColors: [0x3a3a42], wallColors: [0xc9b89a, 0xd9ccb0], tex: T.STONE, texRepeat: 0.3, roofTex: T.SLATE, windows: 'arch', features: ['pilasters', 'cornice', 'ledges', 'plinth', 'frames'], tag: 'civic' },
    { weight: 2, floors: [2, 3], floorHeight: 4.2, footprint: [0.9, 0.98], roof: 'gable', roofColors: [0x4a4a52], wallColors: [0x7a4e3a, 0x6a4a3a], smokestack: true, tex: T.BRICK, texRepeat: 0.8, roofTex: T.SLATE, windows: 'arch', features: ['plinth', 'ledges'], tag: 'mill' },
    { weight: 1, floors: [1, 1], floorHeight: 8, footprint: [0.7, 0.9], roof: 'gable', roofColors: [0x3a3a42], wallColors: [0x9a9a9a, 0xb0b0b0], tower: true, tex: T.STONE, texRepeat: 0.3, roofTex: T.SLATE, windows: 'arch', features: ['buttress', 'plinth'], tag: 'church' },
    { weight: 1.5, floors: [2, 3], floorHeight: 3.3, footprint: [0.85, 0.98], roof: 'gable', roofColors: [0x3a3a42], wallColors: [0x6a4a3a, 0x3a4a3a], chimney: true, tex: T.BRICK, texRepeat: 0.8, roofTex: T.SLATE, windows: 'tall', features: ['storefront', 'sign', 'sills', 'plinth', 'chimneypots'], accent: 0x2a3a2a, tag: 'pub' },
  ],
  industrial: [
    { weight: 5, floors: [4, 7], floorHeight: 3.3, footprint: [0.85, 0.98], roof: 'flat', roofColors: [0x4a4a4a, 0x3a3a3a], wallColors: [0x8a5a44, 0x9a6a4e, 0x7a5a4a, 0xa8a090], parapet: true, tex: T.BRICK, texRepeat: 0.8, windows: 'tall', features: ['fireEscape', 'sills', 'cornice', 'rooftank', 'plinth', 'storefront'], accent: 0x2a2a2a, tag: 'tenement' },
    { weight: 2, floors: [10, 22], floorHeight: 3.4, footprint: [0.8, 0.95], roof: 'flat', roofColors: [0x4a4a52], wallColors: [0xc9c2b2, 0xb8b0a0, 0xd9d2c2, 0x8a8a92], setback: true, parapet: true, tex: T.CONCRETE, texRepeat: 0.3, windows: 'tall', features: ['ledges', 'cornice', 'pilasters'], tag: 'tower' },
    { weight: 2, floors: [2, 3], floorHeight: 4.5, footprint: [0.9, 0.98], roof: 'flat', roofColors: [0x3a3a3a], wallColors: [0x6a4a3a, 0x7a5a4a, 0x5a5a5a], smokestack: true, parapet: true, tex: T.BRICK, texRepeat: 0.8, windows: 'wide', features: ['plinth', 'ledges', 'rooftank'], tag: 'factory' },
    { weight: 1, floors: [2, 4], floorHeight: 3.6, footprint: [0.85, 0.98], roof: 'flat', roofColors: [0x4a4a4a], wallColors: [0xd9d0bf, 0xc9c0ae], parapet: true, tex: T.STONE, texRepeat: 0.3, windows: 'arch', features: ['pilasters', 'cornice', 'plinth', 'porch'], tag: 'civic' },
    { weight: 2, floors: [2, 3], floorHeight: 3.4, footprint: [0.85, 0.98], roof: 'flat', roofColors: [0x4a4a4a], wallColors: [0xb08a6a, 0x9a7a5a, 0x8a8a8a], parapet: true, tex: T.BRICK, texRepeat: 0.8, windows: 'wide', features: ['storefront', 'awning', 'sign', 'cornice', 'sills'], accent: 0x8a2a2a, tag: 'shop' },
    { weight: 1, floors: [1, 2], floorHeight: 4, footprint: [0.9, 0.98], roof: 'flat', roofColors: [0x4a4a4a], wallColors: [0x8a7a6a, 0x7a6a5a], parapet: true, tex: T.CONCRETE, texRepeat: 0.4, windows: 'slit', features: ['plinth', 'sign'], tag: 'warehouse' },
  ],
};
