/** Ground surfaces per era: what the roads, sidewalks, plazas, parks and open ground are made of. */
import { TILE, type Tile } from './textures';

export type ParkStyle = 'lawn' | 'orchard' | 'garden' | 'none';

export interface Surfaces {
  road: Tile;
  roadColor: number;
  minorRoad: Tile;
  minorRoadColor: number;
  sidewalk: Tile | null;
  sidewalkColor: number;
  sidewalkWidth: number;
  curbColor: number;
  laneMarks: boolean;
  laneColor: number;
  core: Tile;
  coreColor: number;
  outskirts: Tile;
  outskirtsColor: number;
  plaza: Tile;
  plazaColor: number;
  park: ParkStyle;
  parkChance: number;
  parkTile: Tile;
  parkColor: number;
  pathTile: Tile;
  pathColor: number;
  /** some minor streets are canals (Tenochtitlan) */
  canals: boolean;
}

const base: Surfaces = {
  road: TILE.DIRT, roadColor: 0xa08860, minorRoad: TILE.DIRT, minorRoadColor: 0xa89068,
  sidewalk: null, sidewalkColor: 0xcccccc, sidewalkWidth: 0, curbColor: 0x999999,
  laneMarks: false, laneColor: 0xffffff,
  core: TILE.DIRT, coreColor: 0xb09a70, outskirts: TILE.GRASS, outskirtsColor: 0x7f9a4a,
  plaza: TILE.SLAB, plazaColor: 0xd9d0bd,
  park: 'garden', parkChance: 0.05, parkTile: TILE.GRASS, parkColor: 0x6f9a4a, pathTile: TILE.DIRT, pathColor: 0xb8a070,
  canals: false,
};

export const SURFACES: Record<string, Surfaces> = {
  sumerian: { ...base, road: TILE.DIRT, roadColor: 0xa88a56, minorRoad: TILE.DIRT, minorRoadColor: 0xb0945e, core: TILE.SAND, coreColor: 0xc9ad74, outskirts: TILE.DIRT, outskirtsColor: 0xa08a5a, plaza: TILE.MUDBRICK, plazaColor: 0xc4a46c, park: 'orchard', parkChance: 0.06, parkTile: TILE.DIRT, parkColor: 0x9a8a5a },
  egyptian: { ...base, road: TILE.SAND, roadColor: 0xc9ad74, minorRoad: TILE.SAND, minorRoadColor: 0xd2b67c, core: TILE.SAND, coreColor: 0xe0c68e, outskirts: TILE.SAND, outskirtsColor: 0xd8bf85, plaza: TILE.SLAB, plazaColor: 0xe8d8ad, park: 'orchard', parkChance: 0.07, parkTile: TILE.GRASS, parkColor: 0x7f9a4a, pathTile: TILE.SAND, pathColor: 0xd8c08a },
  minoan: { ...base, road: TILE.SLAB, roadColor: 0xc8bfa0, minorRoad: TILE.COBBLE, minorRoadColor: 0xbdb398, core: TILE.SAND, coreColor: 0xc9c09e, outskirts: TILE.GRASS, outskirtsColor: 0x9aa06a, plaza: TILE.SLAB, plazaColor: 0xe8dcc0, park: 'garden', parkChance: 0.08, parkTile: TILE.GRASS, parkColor: 0x7f9a5a, pathTile: TILE.SLAB, pathColor: 0xd8ccb0 },
  mycenaean: { ...base, road: TILE.DIRT, roadColor: 0xa39a78, minorRoad: TILE.DIRT, minorRoadColor: 0xab9f80, core: TILE.DIRT, coreColor: 0xb0a684, outskirts: TILE.GRASS, outskirtsColor: 0x8f9a60, plaza: TILE.STONE, plazaColor: 0xb8a888, park: 'orchard', parkChance: 0.04, parkTile: TILE.DIRT, parkColor: 0x9a9a6a },
  assyrian: { ...base, road: TILE.STONE, roadColor: 0xa58a5f, minorRoad: TILE.DIRT, minorRoadColor: 0xa88e62, core: TILE.MUDBRICK, coreColor: 0xb89a68, outskirts: TILE.DIRT, outskirtsColor: 0xa08a5c, plaza: TILE.SLAB, plazaColor: 0xcfae78, park: 'garden', parkChance: 0.05, parkTile: TILE.GRASS, parkColor: 0x7a8f4a, pathTile: TILE.SLAB, pathColor: 0xc9b088 },
  greek: { ...base, road: TILE.SLAB, roadColor: 0xd2cbb3, minorRoad: TILE.COBBLE, minorRoadColor: 0xc8c0a8, sidewalk: null, core: TILE.SAND, coreColor: 0xc9c2a0, outskirts: TILE.GRASS, outskirtsColor: 0x9ea868, plaza: TILE.SLAB, plazaColor: 0xe0d8c4, park: 'garden', parkChance: 0.08, parkTile: TILE.GRASS, parkColor: 0x7f9a4a, pathTile: TILE.SLAB, pathColor: 0xd8d0bc },
  mauryan: { ...base, road: TILE.DIRT, roadColor: 0xb79e6c, minorRoad: TILE.DIRT, minorRoadColor: 0xb8a070, core: TILE.DIRT, coreColor: 0xb89e70, outskirts: TILE.GRASS, outskirtsColor: 0x7f9a4a, plaza: TILE.BRICK, plazaColor: 0xc89a6a, park: 'garden', parkChance: 0.1, parkTile: TILE.GRASS, parkColor: 0x5f8f3a, pathTile: TILE.BRICK, pathColor: 0xb88a5a },
  roman: { ...base, road: TILE.COBBLE, roadColor: 0x9a9890, minorRoad: TILE.COBBLE, minorRoadColor: 0xa3a098, sidewalk: TILE.SLAB, sidewalkColor: 0xcfc8b8, sidewalkWidth: 2.2, curbColor: 0xb8b0a0, core: TILE.SLAB, coreColor: 0xc4bca8, outskirts: TILE.GRASS, outskirtsColor: 0x8fa058, plaza: TILE.SLAB, plazaColor: 0xdcd4c0, park: 'garden', parkChance: 0.07, parkTile: TILE.GRASS, parkColor: 0x6f9a4a, pathTile: TILE.SLAB, pathColor: 0xd0c8b4 },
  mayan: { ...base, road: TILE.SLAB, roadColor: 0xc9c0a2, minorRoad: TILE.DIRT, minorRoadColor: 0x9a8a5e, core: TILE.DIRT, coreColor: 0x8e7a52, outskirts: TILE.GRASS, outskirtsColor: 0x4f7a3c, plaza: TILE.SLAB, plazaColor: 0xdccfb0, park: 'orchard', parkChance: 0.08, parkTile: TILE.GRASS, parkColor: 0x4f8a3c, pathTile: TILE.DIRT, pathColor: 0x9a8a5e },
  viking: { ...base, road: TILE.DIRT, roadColor: 0x7d6e52, minorRoad: TILE.DIRT, minorRoadColor: 0x857658, core: TILE.GRASS, coreColor: 0x6a8a4a, outskirts: TILE.GRASS, outskirtsColor: 0x5f7a44, plaza: TILE.DIRT, plazaColor: 0x8a7a5e, park: 'none', parkChance: 0, parkTile: TILE.GRASS, parkColor: 0x5f7a44 },
  khmer: { ...base, road: TILE.SLAB, roadColor: 0xc1b38f, minorRoad: TILE.DIRT, minorRoadColor: 0xa08a5c, core: TILE.GRASS, coreColor: 0x6a9a4e, outskirts: TILE.GRASS, outskirtsColor: 0x5b8a46, plaza: TILE.STONE, plazaColor: 0xa89e86, park: 'garden', parkChance: 0.08, parkTile: TILE.GRASS, parkColor: 0x4f8a3c, pathTile: TILE.STONE, pathColor: 0xa89e86 },
  mongol: { ...base, road: TILE.DIRT, roadColor: 0xa89a6c, minorRoad: TILE.DIRT, minorRoadColor: 0xa89a6c, core: TILE.GRASS, coreColor: 0x9aa05f, outskirts: TILE.GRASS, outskirtsColor: 0x9aa05f, plaza: TILE.DIRT, plazaColor: 0xa89a6c, park: 'none', parkChance: 0, parkTile: TILE.GRASS, parkColor: 0x9aa05f },
  aztec: { ...base, road: TILE.SLAB, roadColor: 0xd3c9ad, minorRoad: TILE.SLAB, minorRoadColor: 0xd8ceb2, core: TILE.SLAB, coreColor: 0xcfc6ab, outskirts: TILE.GRASS, outskirtsColor: 0x7a9a58, plaza: TILE.SLAB, plazaColor: 0xe6dcc4, park: 'garden', parkChance: 0.1, parkTile: TILE.GRASS, parkColor: 0x5f9a3a, pathTile: TILE.SLAB, pathColor: 0xd8ceb2, canals: true },
  sengoku: { ...base, road: TILE.DIRT, roadColor: 0xb8ac8e, minorRoad: TILE.DIRT, minorRoadColor: 0xb0a486, core: TILE.DIRT, coreColor: 0xb3a98c, outskirts: TILE.GRASS, outskirtsColor: 0x6f8a4e, plaza: TILE.SLAB, plazaColor: 0xc9c0a8, park: 'garden', parkChance: 0.1, parkTile: TILE.GRASS, parkColor: 0x5f8a4a, pathTile: TILE.COBBLE, pathColor: 0xa8a090 },
  buccaneer: { ...base, road: TILE.DIRT, roadColor: 0xc8b78e, minorRoad: TILE.SAND, minorRoadColor: 0xd0bc90, core: TILE.SAND, coreColor: 0xd2c29a, outskirts: TILE.GRASS, outskirtsColor: 0x8fa868, plaza: TILE.COBBLE, plazaColor: 0xb8b0a0, park: 'orchard', parkChance: 0.05, parkTile: TILE.GRASS, parkColor: 0x7f9a4a, pathTile: TILE.SAND, pathColor: 0xd0bc90 },
  wildwest: { ...base, road: TILE.DIRT, roadColor: 0xb09265, minorRoad: TILE.DIRT, minorRoadColor: 0xb89a6c, sidewalk: TILE.WOOD, sidewalkColor: 0x9a7a52, sidewalkWidth: 2.0, curbColor: 0x7a5e3e, core: TILE.DIRT, coreColor: 0xb89a6c, outskirts: TILE.DIRT, outskirtsColor: 0xb79c6a, plaza: TILE.DIRT, plazaColor: 0xb09265, park: 'none', parkChance: 0, parkTile: TILE.DIRT, parkColor: 0xb09265 },
  victorian: { ...base, road: TILE.COBBLE, roadColor: 0x6e6e6c, minorRoad: TILE.COBBLE, minorRoadColor: 0x747472, sidewalk: TILE.SLAB, sidewalkColor: 0x9a9a98, sidewalkWidth: 2.4, curbColor: 0x7a7a78, core: TILE.SLAB, coreColor: 0x8a8a86, outskirts: TILE.GRASS, outskirtsColor: 0x5f7a4a, plaza: TILE.SLAB, plazaColor: 0x9a9a98, park: 'lawn', parkChance: 0.1, parkTile: TILE.GRASS, parkColor: 0x4f7a3a, pathTile: TILE.DIRT, pathColor: 0xa89878 },
  industrial: { ...base, road: TILE.ASPHALT, roadColor: 0x4a4a4c, minorRoad: TILE.ASPHALT, minorRoadColor: 0x505052, sidewalk: TILE.SLAB, sidewalkColor: 0x9a9894, sidewalkWidth: 3.0, curbColor: 0x7a7876, laneMarks: true, laneColor: 0xd8d0a0, core: TILE.CONCRETE, coreColor: 0x8a8884, outskirts: TILE.GRASS, outskirtsColor: 0x6b7560, plaza: TILE.SLAB, plazaColor: 0x9a9894, park: 'lawn', parkChance: 0.09, parkTile: TILE.GRASS, parkColor: 0x4f7a3a, pathTile: TILE.ASPHALT, pathColor: 0x6a6a68 },
};

export function surfacesFor(eraId: string): Surfaces {
  return SURFACES[eraId] ?? base;
}
