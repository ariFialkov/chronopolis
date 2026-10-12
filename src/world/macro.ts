/**
 * The macro layout of Chronopolis: the geography that stays constant across every era.
 * The river, the bay, the citadel hill, the great arterial roads and the sacred sites are the
 * "bones" of the city. Every era dresses them differently, but a player who learns where the
 * river bends in 1938 will know where it bends in 3200 BCE.
 */
import { segDist, smoothstep, clamp } from '../util/math';
import { fbm } from '../util/rng';

export const WORLD_HALF = 820; // playable world spans -820..820 on both axes
export const CHUNK_SIZE = 80;
export const RING_ROAD = 620; // the ring road / city limit used in every era
export const ARTERIAL_WIDTH = 14;

/** River centreline, north (negative z) to south (positive z, into the bay). */
export const RIVER: ReadonlyArray<readonly [number, number]> = [
  [-70, -900],
  [-55, -620],
  [-30, -420],
  [20, -240],
  [60, -60],
  [55, 120],
  [20, 300],
  [-10, 430],
  [-20, 560],
];
export const RIVER_HALF_WIDTH = 34;

/** Coastline: water where z > coastZ(x). */
export function coastZ(x: number): number {
  return 540 + 40 * Math.sin(x / 170) + 18 * Math.sin(x / 61 + 1.3) - clamp((Math.abs(x + 20) - 120) * -0.25, -40, 0);
}

export const HILL = { x: 380, z: -340, radius: 230, plateau: 110, height: 26 };

export interface Site {
  id: string;
  x: number;
  z: number;
  /** Radius kept clear of ordinary buildings. */
  clear: number;
  label: string;
}

/** Landmark sites. The same ground holds the ziggurat, the pyramid, the temple, the castle and the city hall. */
export const SITES: Record<string, Site> = {
  citadel: { id: 'citadel', x: HILL.x, z: HILL.z, clear: 120, label: 'Citadel Hill' },
  plaza: { id: 'plaza', x: -140, z: -120, clear: 72, label: 'Great Plaza' },
  harbor: { id: 'harbor', x: 160, z: 470, clear: 90, label: 'Old Harbor' },
  arena: { id: 'arena', x: 430, z: 210, clear: 95, label: 'Arena Grounds' },
  sacred: { id: 'sacred', x: -480, z: -470, clear: 85, label: 'Sacred Ground' },
  market: { id: 'market', x: -330, z: 170, clear: 55, label: 'Market Square' },
  gate: { id: 'gate', x: -220, z: -620, clear: 30, label: 'North Gate' },
};

/** Districts: names change with the era, geography does not. */
export interface District {
  id: string;
  x: number;
  z: number;
  radius: number;
}
export const DISTRICTS: District[] = [
  { id: 'citadel', x: 380, z: -340, radius: 260 },
  { id: 'oldtown', x: -150, z: -150, radius: 260 },
  { id: 'harbor', x: 120, z: 420, radius: 220 },
  { id: 'eastside', x: 420, z: 150, radius: 240 },
  { id: 'westmarket', x: -380, z: 150, radius: 240 },
  { id: 'north', x: -350, z: -450, radius: 240 },
  { id: 'fields', x: 0, z: 0, radius: 9999 },
];

export function districtAt(x: number, z: number): string {
  let best = 'fields';
  let bestD = Infinity;
  for (const d of DISTRICTS) {
    if (d.id === 'fields') continue;
    const dd = Math.hypot(x - d.x, z - d.z);
    if (dd < d.radius && dd < bestD) {
      bestD = dd;
      best = d.id;
    }
  }
  return best;
}

/** Arterial roads, as polylines. Width is constant. Bridges happen where they cross the river. */
export const ARTERIALS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
  // Kings Road, west bank, north-south
  [
    [-220, -820],
    [-220, 820],
  ],
  // River Road, east bank
  [
    [200, -820],
    [200, 820],
  ],
  // Meridian Way, east-west, with a bridge
  [
    [-820, -120],
    [820, -120],
  ],
  // Harbor Way, east-west, with a bridge
  [
    [-820, 330],
    [820, 330],
  ],
  // Ring road
  [
    [-RING_ROAD, -RING_ROAD],
    [RING_ROAD, -RING_ROAD],
    [RING_ROAD, RING_ROAD],
    [-RING_ROAD, RING_ROAD],
    [-RING_ROAD, -RING_ROAD],
  ],
  // Citadel approach: from Meridian Way up the hill
  [
    [380, -120],
    [380, -250],
  ],
  // Harbor spur
  [
    [200, 330],
    [160, 430],
  ],
];

export function riverDistance(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[i];
    const b = RIVER[i + 1];
    const d = segDist(x, z, a[0], a[1], b[0], b[1]);
    if (d < best) best = d;
  }
  return best;
}

export function arterialDistance(x: number, z: number): number {
  let best = Infinity;
  for (const line of ARTERIALS) {
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      const d = segDist(x, z, a[0], a[1], b[0], b[1]);
      if (d < best) best = d;
    }
  }
  return best;
}

export function isArterial(x: number, z: number, width = ARTERIAL_WIDTH): boolean {
  return arterialDistance(x, z) < width / 2;
}

/** Bridge: arterial crossing water. */
export function isBridge(x: number, z: number): boolean {
  return isArterial(x, z, ARTERIAL_WIDTH - 2) && isWater(x, z);
}

/** Signed water measure: > 0 means water, value is roughly depth-ish distance inside water. */
export function waterDepth(x: number, z: number): number {
  const sea = z - coastZ(x);
  const river = RIVER_HALF_WIDTH + 6 * Math.sin(z * 0.05) - riverDistance(x, z);
  return Math.max(sea, river);
}

export function isWater(x: number, z: number): boolean {
  return waterDepth(x, z) > 0;
}

/**
 * Terrain before landmark flattening: rolling hills across the whole city, a valley that drops
 * toward the river, the citadel hill, and ground that shelves down into the water.
 */
export function rawHeight(x: number, z: number): number {
  let h = 5 + (fbm(x * 0.0036 + 3.1, z * 0.0036 + 7.7, 3, 21) - 0.5) * 17;
  h += (fbm(x * 0.013 + 1.3, z * 0.013 + 2.9, 2, 23) - 0.5) * 3.2;
  // valley toward the river
  const rd = riverDistance(x, z);
  h -= 3.5 * (1 - smoothstep(40, 260, rd));
  // lowlands never dip below the water table
  if (h < 1.2) h = 1.2 - (1.2 - h) * 0.15;
  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  if (dh < HILL.radius) {
    h += HILL.height * (1 - smoothstep(HILL.plateau, HILL.radius, dh));
  }
  const outside = Math.max(Math.abs(x), Math.abs(z)) - RING_ROAD;
  if (outside > 0) {
    h += (fbm(x * 0.004, z * 0.004, 2, 9) - 0.5) * 12 * smoothstep(0, 120, outside);
  }
  return h;
}

const siteBaseCache = new Map<string, number>();
function siteBase(s: Site): number {
  let v = siteBaseCache.get(s.id);
  if (v === undefined) {
    v = rawHeight(s.x, s.z);
    siteBaseCache.set(s.id, v);
  }
  return v;
}

/** Final terrain height: raw hills, landmark sites flattened to a level base, shores shelving into water. */
export function terrainHeight(x: number, z: number): number {
  let h = rawHeight(x, z);
  for (const id in SITES) {
    const s = SITES[id];
    const d = Math.hypot(x - s.x, z - s.z);
    const outer = s.clear * 1.4;
    if (d < outer) {
      const t = 1 - smoothstep(s.clear * 0.95, outer, d);
      h = h + (siteBase(s) - h) * t;
    }
  }
  const wd = waterDepth(x, z);
  if (wd > -16) {
    // shore shelves down into the water
    const t = smoothstep(-16, 10, wd);
    h = h * (1 - t) - 3.5 * t;
  }
  return h;
}

export const WATER_LEVEL = -0.8;

export function siteClearance(x: number, z: number): Site | null {
  for (const id in SITES) {
    const s = SITES[id];
    if (Math.hypot(x - s.x, z - s.z) < s.clear) return s;
  }
  return null;
}

export function insideCity(x: number, z: number): boolean {
  return Math.abs(x) < RING_ROAD && Math.abs(z) < RING_ROAD;
}
