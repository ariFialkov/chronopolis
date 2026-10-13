/**
 * Outfit vocabulary. Every character in the game (player and NPCs, every era) is one shared body
 * dressed from these pieces, so they all share proportions, rig and style.
 */
export type HairStyle = 'short' | 'long' | 'shoulder' | 'bob' | 'bun' | 'buns' | 'topknot' | 'bald' | 'braid';
export type BeardStyle = 'none' | 'mustache' | 'goatee' | 'short' | 'full' | 'long' | 'square';

export type HatKind =
  | 'headband' // a band round the head
  | 'skullcap' // close cap, optional band (color2)
  | 'fez' // tall cylinder cap (Assyrian polos, red fez); color2 band, color3 top
  | 'spike' // dome helmet with a spike (color2)
  | 'crest' // dome helmet with cheek guards and a crest (color2)
  | 'pschent' // tall striped crown (color/color2 stripes, color3 band)
  | 'horns' // cap with horns of consecration (color2 horns)
  | 'wreath' // laurel wreath
  | 'athena' // helmet with spike and side horns
  | 'turban'
  | 'feathers' // band (color2) with a fan of feathers (color, color3); size scales the fan
  | 'viking' // round helmet with nasal; horns or spike via flags
  | 'mukuta' // tiered spired crown
  | 'mongol' // felt hat with upturned brim and a finial (color2)
  | 'jingasa' // low round brimmed hat
  | 'kasa' // straw cone
  | 'kabuto' // helmet with neck guard and antler crest (color2)
  | 'tricorn' // with an optional badge (color2)
  | 'bandana'
  | 'tophat'
  | 'bowler'
  | 'flatcap'
  | 'cowboy'
  | 'bonnet'
  | 'ladyhat'
  | 'hood';

export interface Hat {
  kind: HatKind;
  color: number;
  color2?: number;
  color3?: number;
  /** fan size for feathers, height for fez */
  size?: number;
  horns?: boolean;
  spike?: boolean;
  /** brass goggles on the hat */
  goggles?: boolean;
}

export interface Skirt {
  color: number;
  /** 0 = mid-thigh, 0.5 = knee, 1 = ankle */
  length: number;
  /** extra radius at the hem */
  flare?: number;
  hem?: number;
  /** extra bands up from the hem (Minoan flounces, Assyrian fringes) */
  bands?: number[];
  /** alternate segment colour (pteruges, pleats) */
  alt?: number;
  /** open at the front (coat tails, wrap skirts) */
  open?: boolean;
}

export interface Outfit {
  build?: 'm' | 'f';
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  beard?: BeardStyle;
  beardColor?: number;

  /** torso garment colour; null = bare chest */
  top: number | null;
  /** neckline: a V of skin or undershirt at the front */
  neck?: 'v' | 'wrap';
  neckColor?: number;
  sleeves?: 'none' | 'short' | 'long' | 'wide';
  sleeveColor?: number;
  cuff?: number;
  /** trousers colour; null = bare legs */
  legs: number | null;
  /** trousers stop at the knee (breeches, shorts) */
  legsKnee?: boolean;
  skirt?: Skirt;
  feet: { kind: 'sandal' | 'shoe' | 'boot' | 'bare'; color: number; /** boot top, metres */ height?: number };

  belt?: number;
  buckle?: number;
  /** strap over one shoulder */
  sash?: { color: number; side?: 1 | -1; width?: number };
  /** two crossed straps */
  cross?: number;
  /** draped toga: body colour plus a border band */
  toga?: { color: number; trim?: number };
  apron?: { color: number; length: number; width?: number; trim?: number };
  /** broad collar / necklace */
  collar?: number;
  cape?: { color: number; length: number };
  /** waistcoat over the top; the top colour becomes the shirt showing at the front */
  vest?: { color: number };
  /** coat over everything; length like a skirt (0 = waist jacket) */
  coat?: { color: number; length: number; trim?: number };
  overalls?: number;
  tie?: number;
  /** breastplate: chest colour plus trim, shoulder guards */
  armor?: { color: number; trim?: number; shoulders?: number };
  greaves?: number;
  bracers?: number;
  hat?: Hat;
  hip?: 'sword' | 'pouch' | 'katana' | 'holster' | 'satchel' | 'tools';
  hipColor?: number;
}
