export type StreetPattern = 'grid' | 'organic' | 'spread' | 'radial' | 'castle';
export type RoofKind =
  | 'flat'
  | 'gable'
  | 'hip'
  | 'pyramid'
  | 'dome'
  | 'thatch'
  | 'pagoda'
  | 'stepped'
  | 'none';

export type TreeKind = 'oak' | 'palm' | 'pine' | 'cypress' | 'jungle' | 'cedar' | 'dead' | 'none';

export type PropKind =
  | 'lamp'
  | 'gaslamp'
  | 'torch'
  | 'crate'
  | 'barrel'
  | 'amphora'
  | 'statue'
  | 'obelisk'
  | 'well'
  | 'cart'
  | 'bench'
  | 'hydrant'
  | 'signpost'
  | 'totem'
  | 'runestone'
  | 'pillar'
  | 'shrine'
  | 'fountain'
  | 'stall'
  | 'haystack'
  | 'cactus'
  | 'campfire'
  | 'tent'
  | 'lantern'
  | 'automobile'
  | 'wagon'
  | 'cannon'
  | 'stele'
  | 'altar'
  | 'boulder';

export type HatKind =
  | 'none'
  | 'helmet'
  | 'cap'
  | 'hood'
  | 'crown'
  | 'headdress'
  | 'conical'
  | 'tophat'
  | 'cowboy'
  | 'turban'
  | 'feather'
  | 'bowler'
  | 'fedora'
  | 'tricorn'
  | 'kabuto'
  | 'nemes'
  | 'plume';

export interface BuildingTemplate {
  weight: number;
  floors: [number, number];
  floorHeight: number;
  /** fraction of the lot used, min and max */
  footprint: [number, number];
  roof: RoofKind;
  roofColors: number[];
  wallColors: number[];
  columns?: boolean;
  chimney?: boolean;
  stilts?: boolean;
  round?: boolean;
  tower?: boolean;
  setback?: boolean;
  smokestack?: boolean;
  parapet?: boolean;
  courtyard?: boolean;
  trim?: number;
  /** rooftop overhang in meters */
  overhang?: number;
  /** building is an open tent / hut (cone only) */
  tent?: boolean;
  /** label used by missions to find a building of a kind */
  tag?: string;
}

export interface EraLayout {
  pattern: StreetPattern;
  blockW: number;
  blockD: number;
  streetWidth: number;
  /** curvature amplitude for organic street patterns (meters) */
  curve: number;
  /** curvature wavelength (meters) */
  curveLen: number;
  lotSize: number;
  /** 0..1 chance that a lot is built upon */
  density: number;
  /** city shrinks toward the centre: buildings fade beyond this fraction of the ring road */
  extent: number;
  fields: boolean;
  walls: boolean;
  /** which arterials exist as paved roads (others become dirt tracks) */
  pavedArterials: boolean;
}

export interface NpcArchetype {
  role: string;
  weight: number;
  body: number;
  legs: number;
  skin: number;
  hat: HatKind;
  hatColor: number;
  names: string[];
  lines: string[];
}

export interface Chronoport {
  x: number;
  z: number;
  /** where it is hidden in 1938 */
  placeName: string;
  /** clue given by the journal once rumoured */
  hint: string;
}

export interface Landmarks {
  citadel: string;
  harbor: string;
  arena: string;
  plaza: string;
  sacred: string;
  market: string;
}

export interface Era {
  id: string;
  name: string;
  civ: string;
  year: number;
  yearLabel: string;
  tagline: string;
  sky: number;
  horizon: number;
  fog: number;
  fogDensity: number;
  sun: number;
  sunIntensity: number;
  ambient: number;
  ground: number;
  road: number;
  dirt: number;
  water: number;
  layout: EraLayout;
  buildings: BuildingTemplate[];
  props: PropKind[];
  propDensity: number;
  trees: TreeKind;
  treeDensity: number;
  landmarks: Landmarks;
  npcs: NpcArchetype[];
  npcDensity: number;
  ships: 'reed' | 'barque' | 'galley' | 'longship' | 'junk' | 'galleon' | 'steamer' | 'canoe' | 'none';
  chronoport: Chronoport | null;
  districtNames: Record<string, string>;
  lore: string;
  insight: { title: string; text: string };
}

export type EraPartial = Omit<Era, 'yearLabel'> & { yearLabel?: string };

export function defineEra(e: EraPartial): Era {
  const yearLabel = e.yearLabel ?? (e.year < 0 ? `${-e.year} BCE` : `${e.year} CE`);
  return { ...e, yearLabel };
}
