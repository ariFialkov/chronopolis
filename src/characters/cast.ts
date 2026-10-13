/**
 * Everyone's clothes, era by era, after the character sheet: the player (Eli, the same man in
 * every era, dressed to blend in) and five townspeople per era.
 */
import type { Outfit } from './outfit';
import { shade } from '../util/math';

const LINEN = 0xefe6d2;
const WHITE = 0xf4f0e6;
const GOLD = 0xd9a53a;
const RED = 0xb8322a;
const BLUE = 0x2c4a9a;
const LEATHER = 0x5a3e28;
const DARKLEATHER = 0x3a2a1a;
const BLACK = 0x1e1e22;
const BOOT = 0x4a3020;

/** Eli Marsh: the face, skin and hair stay the same whatever he wears. */
const ELI = { skin: 0xdcae88, hair: 0x3a2618, hairStyle: 'short' as const, beard: 'mustache' as const, build: 'm' as const };

type Body = Pick<Outfit, 'skin' | 'hair' | 'hairStyle' | 'beard' | 'build'>;
const man = (skin: number, beard: Outfit['beard'] = 'short', hair = 0x1a1410, hairStyle: Outfit['hairStyle'] = 'short'): Body => ({ skin, hair, hairStyle, beard, build: 'm' });
const woman = (skin: number, hairStyle: Outfit['hairStyle'] = 'long', hair = 0x1a1410): Body => ({ skin, hair, hairStyle, beard: 'none', build: 'f' });
const sandal = (color = 0x7a5a32): Outfit['feet'] => ({ kind: 'sandal', color });
const boot = (color = BOOT, height = 0.3): Outfit['feet'] => ({ kind: 'boot', color, height });
const shoe = (color = 0x1a1a1a): Outfit['feet'] => ({ kind: 'shoe', color });

export interface EraCast {
  player: Outfit;
  /** keyed by outfit name used in era NPC archetypes */
  roles: Record<string, Outfit>;
}

export const CAST: Record<string, EraCast> = {
  sumerian: (() => {
    const S = 0xc48d5e;
    return {
      player: { ...ELI, top: LINEN, sleeves: 'short', sash: { color: BLUE }, skirt: { color: LINEN, length: 0.45, hem: BLUE }, belt: LEATHER, legs: null, feet: sandal(), hat: { kind: 'headband', color: WHITE } },
      roles: {
        farmer: { ...man(S, 'short', 0x1a1410, 'shoulder'), top: null, legs: null, skirt: { color: LINEN, length: 0.42 }, belt: DARKLEATHER, feet: sandal() },
        priest: { ...man(S, 'long'), top: LINEN, sleeves: 'short', sleeveColor: BLUE, cross: BLUE, skirt: { color: LINEN, length: 0.72, hem: BLUE }, apron: { color: BLUE, length: 0.35, width: 0.12 }, belt: BLUE, legs: null, feet: sandal(BLUE), hat: { kind: 'skullcap', color: BLUE, color2: WHITE } },
        soldier: { ...man(S, 'full'), top: BLUE, sleeves: 'short', bracers: BLUE, sash: { color: GOLD, width: 0.07 }, skirt: { color: BLUE, length: 0.6, hem: GOLD, bands: [LINEN] }, belt: GOLD, buckle: GOLD, legs: null, feet: sandal(BLUE), hat: { kind: 'spike', color: BLUE, color2: GOLD }, hip: 'sword' },
        artisan: { ...man(S, 'short'), top: LINEN, sleeves: 'short', skirt: { color: LINEN, length: 0.5 }, belt: DARKLEATHER, legs: null, feet: sandal(BLUE), hat: { kind: 'skullcap', color: BLUE }, hip: 'tools' },
        merchant: { ...man(S, 'long'), top: BLUE, sleeves: 'short', sash: { color: GOLD, width: 0.07 }, skirt: { color: BLUE, length: 0.72, hem: GOLD }, belt: GOLD, legs: null, feet: sandal(BLUE), hat: { kind: 'skullcap', color: BLUE, color2: shade(BLUE, 0.8) }, hip: 'pouch' },
      },
    };
  })(),

  egyptian: (() => {
    const S = 0xb5794c;
    return {
      player: { ...ELI, top: LINEN, sleeves: 'short', neck: 'v', skirt: { color: LINEN, length: 0.62 }, belt: GOLD, legs: null, feet: sandal(), hat: { kind: 'headband', color: WHITE } },
      roles: {
        farmer: { ...woman(S, 'long'), top: LINEN, sleeves: 'none', neck: 'v', skirt: { color: LINEN, length: 0.75 }, belt: GOLD, legs: null, feet: sandal(), hat: { kind: 'headband', color: WHITE } },
        priest: { ...man(S, 'none'), top: null, collar: 0x3a7ab0, skirt: { color: LINEN, length: 0.78 }, apron: { color: GOLD, length: 0.45, width: 0.12, trim: 0x2a5aa8 }, belt: GOLD, bracers: GOLD, legs: null, feet: sandal(0x8a6a3a), hat: { kind: 'pschent', color: 0x2a5aa8, color2: WHITE, color3: GOLD } },
        soldier: { ...man(S, 'short'), top: null, armor: { color: 0xc9a040, trim: 0x8a6a2a, shoulders: 0xc9a040 }, cross: 0x8a6a2a, skirt: { color: LINEN, length: 0.38, hem: 0xa03a2a }, belt: GOLD, greaves: 0xc9a040, legs: null, feet: sandal(), hat: { kind: 'spike', color: 0xc9a040, color2: GOLD }, hip: 'sword' },
        artisan: { ...man(S, 'none', 0x1a1410, 'bob'), top: LINEN, sleeves: 'short', sash: { color: 0x8a6a4a }, apron: { color: 0x9a7a5a, length: 0.3 }, skirt: { color: LINEN, length: 0.45 }, belt: 0x5a4028, legs: null, feet: sandal(), hat: { kind: 'headband', color: WHITE }, hip: 'tools' },
        merchant: { ...man(S, 'short'), top: 0x4a3028, sleeves: 'short', sash: { color: GOLD, width: 0.07 }, skirt: { color: 0x4a3028, length: 0.72 }, belt: GOLD, legs: null, feet: sandal(), hat: { kind: 'fez', color: 0x4a2a20, color2: 0x7a4a2a, size: 0.2 }, hip: 'pouch' },
      },
    };
  })(),

  minoan: (() => {
    const S = 0xc9935f;
    return {
      player: { ...ELI, top: RED, sleeves: 'short', cross: WHITE, apron: { color: RED, length: 0.5, width: 0.18, trim: GOLD }, skirt: { color: LINEN, length: 0.72 }, belt: GOLD, legs: null, feet: sandal(), hat: { kind: 'fez', color: RED, color2: GOLD, size: 0.12 } },
      roles: {
        farmer: { ...woman(S, 'shoulder'), top: 0x4a9a6a, sleeves: 'none', cross: 0x2a6a4a, apron: { color: 0xc9b040, length: 0.3, width: 0.12 }, skirt: { color: LINEN, length: 0.82 }, belt: GOLD, legs: null, feet: sandal(), hat: { kind: 'headband', color: GOLD } },
        priest: { ...woman(S, 'shoulder'), top: RED, sleeves: 'short', neck: 'v', skirt: { color: RED, length: 0.92, flare: 0.08, hem: WHITE, bands: [WHITE, WHITE] }, belt: GOLD, legs: null, feet: sandal(), hat: { kind: 'horns', color: RED, color2: GOLD } },
        soldier: { ...man(S, 'none'), top: null, armor: { color: 0x5a5a5e, trim: GOLD, shoulders: GOLD }, skirt: { color: RED, length: 0.35 }, belt: GOLD, greaves: 0xb08040, legs: null, feet: sandal(), hat: { kind: 'crest', color: GOLD, color2: RED }, hip: 'sword' },
        artisan: { ...woman(S, 'buns'), top: WHITE, sleeves: 'none', cross: 0x2a5aa8, skirt: { color: LINEN, length: 0.85, hem: 0x2a5aa8 }, belt: 0x2a3a5a, legs: null, feet: sandal() },
        merchant: { ...woman(S, 'shoulder'), top: RED, sleeves: 'short', neck: 'v', apron: { color: 0x3a6ab0, length: 0.32, width: 0.14 }, skirt: { color: RED, length: 0.86, flare: 0.06, hem: WHITE, bands: [WHITE, WHITE] }, belt: GOLD, legs: null, feet: sandal() },
      },
    };
  })(),

  mycenaean: (() => {
    const S = 0xd29c6c;
    return {
      player: { ...ELI, top: LINEN, sleeves: 'short', sash: { color: BLUE }, skirt: { color: LINEN, length: 0.5, hem: BLUE }, belt: BLUE, legs: null, feet: sandal() },
      roles: {
        farmer: { ...woman(S, 'long'), top: 0xe0c09a, sleeves: 'none', cross: 0xa83a2a, apron: { color: 0xc9a040, length: 0.35, width: 0.08 }, skirt: { color: LINEN, length: 0.65 }, belt: 0x6a4a2a, legs: null, feet: sandal() },
        priest: { ...man(S, 'full'), top: LINEN, sleeves: 'short', sash: { color: BLUE }, skirt: { color: LINEN, length: 0.85 }, belt: 0x3a2a2a, legs: null, feet: sandal(), hat: { kind: 'spike', color: 0x2a4a9a } },
        soldier: { ...man(S, 'short'), top: null, armor: { color: 0x6a7a8a, trim: GOLD, shoulders: 0x8a9aaa }, skirt: { color: BLUE, length: 0.4, hem: GOLD }, cape: { color: RED, length: 0.7 }, belt: GOLD, legs: null, feet: sandal(), hat: { kind: 'spike', color: GOLD, color2: GOLD }, hip: 'sword' },
        artisan: { ...man(S, 'full'), top: null, cross: 0xa08a6a, skirt: { color: LINEN, length: 0.55 }, belt: 0x5a3a2a, legs: null, feet: sandal(), hat: { kind: 'skullcap', color: 0x2a2a3a }, hip: 'tools' },
        merchant: { ...man(S, 'full'), top: 0x5a5a2a, sleeves: 'short', skirt: { color: 0x5a5a2a, length: 0.6 }, belt: GOLD, buckle: GOLD, legs: null, feet: sandal(), hat: { kind: 'fez', color: 0x8a2a2a, color2: GOLD, size: 0.18 }, hip: 'pouch' },
      },
    };
  })(),

  assyrian: (() => {
    const S = 0xc08a5c;
    const sq = (h = 0x140f0c): Body => ({ ...man(S, 'square', h, 'shoulder') });
    return {
      player: { ...ELI, top: LINEN, sleeves: 'short', sash: { color: BLUE }, skirt: { color: BLUE, length: 0.55, hem: WHITE, bands: [0xa03a2a] }, belt: GOLD, legs: null, feet: sandal(), hat: { kind: 'fez', color: 0x1a2a5a, color2: GOLD, size: 0.24 } },
      roles: {
        farmer: { ...sq(), top: 0xc9a87a, sleeves: 'short', cross: 0x8a6a4a, skirt: { color: 0xc9a87a, length: 0.8 }, belt: 0x5a3a2a, legs: null, feet: sandal(), hat: { kind: 'fez', color: 0x5a2a2a, color2: GOLD, color3: GOLD, size: 0.24 } },
        priest: { ...sq(), top: LINEN, sleeves: 'short', cross: 0x3a2a2a, skirt: { color: LINEN, length: 0.86, hem: GOLD }, belt: 0x3a2a2a, legs: null, feet: sandal(), hat: { kind: 'fez', color: 0x1a2a5a, color2: 0xa03a2a, size: 0.22 } },
        soldier: { ...sq(), top: 0x8a4a2a, sleeves: 'short', cross: 0x5a3a2a, skirt: { color: 0x4a5a7a, length: 0.55, hem: GOLD }, belt: GOLD, buckle: GOLD, legs: null, feet: boot(0x5a3a2a, 0.28), hat: { kind: 'spike', color: GOLD, color2: GOLD }, hip: 'sword' },
        artisan: { ...sq(), top: LINEN, sleeves: 'short', cross: 0x3a3a4a, skirt: { color: LINEN, length: 0.8 }, belt: 0x3a2a2a, legs: null, feet: sandal(), hat: { kind: 'bandana', color: 0x1a1a1a }, hip: 'tools' },
        merchant: { ...sq(), top: 0x3a3e4a, sleeves: 'short', sleeveColor: 0x8a2a2a, skirt: { color: 0x3a3e4a, length: 0.8 }, belt: GOLD, buckle: GOLD, legs: null, feet: boot(0x3a2a2a, 0.2), hat: { kind: 'fez', color: 0x1a1a1a, color2: GOLD, color3: GOLD, size: 0.28 }, hip: 'pouch' },
      },
    };
  })(),

  greek: (() => {
    const S = 0xd8a777;
    return {
      player: { ...ELI, top: LINEN, sleeves: 'short', skirt: { color: LINEN, length: 0.5 }, belt: 0x6a3a2a, legs: null, feet: sandal(), hat: { kind: 'wreath', color: 0x4a8a3a } },
      roles: {
        farmer: { ...woman(S, 'shoulder'), top: LINEN, sleeves: 'none', neck: 'v', neckColor: 0x4a8ac0, skirt: { color: LINEN, length: 1 }, belt: 0x2a5aa8, legs: null, feet: sandal() },
        priest: { ...woman(S, 'long'), top: LINEN, sleeves: 'none', cross: 0x2a5aa8, apron: { color: 0x2a5aa8, length: 0.95, width: 0.06 }, skirt: { color: LINEN, length: 1 }, belt: 0x2a5aa8, legs: null, feet: sandal(), hat: { kind: 'athena', color: 0xc0c4c8 } },
        soldier: { ...man(S, 'none'), top: null, armor: { color: 0x5a6068, trim: GOLD, shoulders: GOLD }, skirt: { color: RED, length: 0.35 }, belt: GOLD, greaves: 0xc09040, legs: null, feet: sandal(), hat: { kind: 'crest', color: GOLD, color2: RED }, hip: 'sword' },
        artisan: { ...woman(S, 'bun'), top: LINEN, sleeves: 'none', sash: { color: RED }, skirt: { color: LINEN, length: 1 }, belt: 0x3a3a3a, legs: null, feet: sandal(), hat: { kind: 'headband', color: GOLD } },
        merchant: { ...man(S, 'short'), top: 0xa8322a, sleeves: 'short', skirt: { color: 0xd8c49a, length: 0.45 }, belt: 0x6a4a2a, legs: null, feet: sandal(), hip: 'pouch' },
      },
    };
  })(),

  mauryan: (() => {
    const S = 0xa86c44;
    return {
      player: { ...ELI, top: LINEN, sleeves: 'none', sash: { color: RED }, apron: { color: BLUE, length: 0.6, width: 0.08 }, skirt: { color: LINEN, length: 0.7, hem: 0xd9a050 }, belt: BLUE, legs: null, feet: sandal() },
      roles: {
        farmer: { ...man(S, 'short', 0x120e0c, 'topknot'), top: null, skirt: { color: LINEN, length: 0.45 }, belt: LINEN, legs: null, feet: sandal() },
        priest: { ...man(S, 'short'), top: 0xe8962a, sleeves: 'short', skirt: { color: 0xe8962a, length: 0.55 }, belt: 0x8a5a2a, legs: null, feet: sandal(), hat: { kind: 'turban', color: 0xe8a020 } },
        soldier: { ...man(S, 'short'), top: null, armor: { color: 0x7a8a9a, trim: RED, shoulders: 0x9aa8b8 }, skirt: { color: RED, length: 0.4 }, cape: { color: RED, length: 0.6 }, belt: GOLD, greaves: 0x5a6a7a, legs: null, feet: boot(0x4a3a2a, 0.2), hat: { kind: 'crest', color: GOLD, color2: RED }, hip: 'sword' },
        artisan: { ...man(S, 'short'), top: 0x4a6ac0, sleeves: 'short', skirt: { color: 0x4a6ac0, length: 0.75 }, belt: 0xa03a2a, legs: null, feet: sandal(), hat: { kind: 'turban', color: 0x1a2a4a }, hip: 'tools' },
        merchant: { ...man(S, 'short'), top: 0x4a5a7a, sleeves: 'short', legs: 0x3a4a6a, legsKnee: true, belt: 0x5a3a2a, buckle: GOLD, feet: boot(0x3a3a4a, 0.25), hat: { kind: 'turban', color: 0xe8e0c8 }, hip: 'pouch' },
      },
    };
  })(),

  roman: (() => {
    const S = 0xd6a476;
    return {
      player: { ...ELI, top: LINEN, sleeves: 'short', toga: { color: WHITE, trim: 0xa8221e }, legs: null, belt: WHITE, feet: sandal(0x6a4a2a) },
      roles: {
        farmer: { ...man(S, 'short'), top: LINEN, sleeves: 'short', neck: 'v', skirt: { color: LINEN, length: 0.5 }, belt: 0x5a3a24, apron: { color: 0x5a3a24, length: 0.4, width: 0.05 }, legs: null, feet: sandal() },
        priest: { ...man(S, 'short'), top: LINEN, sleeves: 'short', toga: { color: WHITE, trim: 0xa8221e }, legs: null, belt: WHITE, feet: sandal(), hat: { kind: 'skullcap', color: 0xa8221e } },
        soldier: { ...man(S, 'none'), top: RED, sleeves: 'short', sleeveColor: RED, armor: { color: 0x7a7e86, trim: 0x4a4e56, shoulders: 0x8a8e96 }, skirt: { color: 0x6a4a2a, length: 0.3, alt: RED }, cape: { color: RED, length: 0.75 }, belt: 0x6a4a2a, buckle: GOLD, greaves: 0xb08040, legs: null, feet: sandal(), hat: { kind: 'crest', color: GOLD, color2: RED }, hip: 'sword' },
        artisan: { ...man(S, 'mustache'), top: LINEN, sleeves: 'short', cross: 0x2a3a5a, skirt: { color: LINEN, length: 0.45 }, belt: 0x5a3a24, legs: null, feet: boot(0x2a4a4a, 0.18), hip: 'tools' },
        merchant: { ...man(S, 'short'), top: 0x2a8a7a, sleeves: 'short', skirt: { color: 0x2a8a7a, length: 0.5 }, belt: 0x6a4a2a, buckle: GOLD, legs: null, feet: boot(0x2a5a4a, 0.2), hat: { kind: 'skullcap', color: WHITE, color2: 0xa8221e }, hip: 'pouch' },
      },
    };
  })(),

  mayan: (() => {
    const S = 0xb07448;
    const GREEN = 0x3a9a5a;
    return {
      player: { ...ELI, top: LINEN, sleeves: 'none', collar: GREEN, skirt: { color: LINEN, length: 0.4, hem: RED }, apron: { color: GREEN, length: 0.3, width: 0.12 }, belt: GREEN, greaves: 0x3a8a4a, legs: null, feet: sandal(), hat: { kind: 'feathers', color: 0xc8322a, color2: GREEN, color3: GREEN, size: 0.25 } },
      roles: {
        farmer: { ...woman(S, 'long'), top: LINEN, sleeves: 'none', collar: GREEN, skirt: { color: LINEN, length: 0.3, hem: GREEN }, belt: GREEN, legs: null, feet: sandal(), hat: { kind: 'headband', color: GREEN } },
        priest: { ...man(S, 'goatee'), top: 0xc8422a, sleeves: 'short', collar: GREEN, skirt: { color: 0xc8422a, length: 0.5, hem: 0xe8b030 }, belt: GREEN, legs: null, feet: boot(0xb06a3a, 0.25), hat: { kind: 'feathers', color: 0xd83a2a, color2: GREEN, size: 1 } },
        soldier: { ...man(S, 'goatee'), top: 0xd86a2a, sleeves: 'short', collar: 0x6aa04a, skirt: { color: 0xd86a2a, length: 0.45, hem: 0xe8b030 }, apron: { color: 0x5a8a3a, length: 0.3 }, belt: 0x5a8a3a, legs: null, feet: boot(0xd86a2a, 0.3), hat: { kind: 'feathers', color: 0x3a6ac0, color2: GOLD, color3: 0xe8b030, size: 0.6 }, hip: 'sword', hipColor: 0x2a2a2a },
        artisan: { ...woman(S, 'long'), top: LINEN, sleeves: 'none', sash: { color: 0x8a5a3a }, skirt: { color: LINEN, length: 0.6 }, belt: 0x6a4a2a, legs: null, feet: sandal(), hat: { kind: 'feathers', color: 0x2a4ac0, color2: GOLD, size: 0.7 }, hip: 'satchel', hipColor: 0x8a5a3a },
        merchant: { ...man(S, 'mustache'), top: 0xd8c49a, sleeves: 'short', sash: { color: 0x6a4a2a }, skirt: { color: 0x3a7a4a, length: 0.45 }, belt: 0x6a4a2a, legs: null, feet: sandal(), hat: { kind: 'feathers', color: 0x2a8a5a, color2: 0x2a6a4a, size: 0.2 }, hip: 'pouch' },
      },
    };
  })(),

  viking: (() => {
    const S = 0xe8c0a0;
    const BLOND = 0xd8b060;
    const BROWN = 0x8a5a30;
    const NAVY = 0x2a3450;
    return {
      player: { ...ELI, top: NAVY, sleeves: 'long', cuff: LINEN, apron: { color: LINEN, length: 0.4, width: 0.12 }, skirt: { color: NAVY, length: 0.42 }, belt: LEATHER, buckle: GOLD, legs: NAVY, feet: boot(BOOT, 0.25), hat: { kind: 'viking', color: 0xc9a040, color2: 0x8a6a2a } },
      roles: {
        farmer: { ...man(S, 'full', 0x4a3020, 'long'), top: NAVY, sleeves: 'long', sleeveColor: 0xc9b08a, skirt: { color: NAVY, length: 0.45, hem: 0xc9b08a }, belt: LEATHER, buckle: GOLD, legs: 0x6a5a4a, feet: boot(BOOT, 0.25), hat: { kind: 'hood', color: 0x6a5040 } },
        priest: { ...man(S, 'long', BLOND, 'long'), top: 0x2a3a6a, sleeves: 'long', cuff: LINEN, skirt: { color: 0x2a3a6a, length: 0.5, hem: 0xc9b08a }, belt: LEATHER, legs: 0xc9b08a, feet: boot(BOOT, 0.3), hat: { kind: 'viking', color: 0xc9a040, color2: 0x8a6a2a, spike: true } },
        soldier: { ...man(S, 'full', BROWN, 'shoulder'), top: 0xa8282a, sleeves: 'long', cross: 0x6a6a6a, skirt: { color: 0xa8282a, length: 0.45 }, belt: LEATHER, buckle: GOLD, legs: 0x6a5a4a, feet: boot(BOOT, 0.3), hat: { kind: 'viking', color: 0xa8acb0, color2: 0x6a6e72, horns: true }, hip: 'sword' },
        artisan: { ...man(S, 'full', 0x141010, 'shoulder'), top: 0xc9b08a, sleeves: 'long', cross: 0x4a3020, skirt: { color: 0x5a5040, length: 0.3 }, belt: LEATHER, legs: 0x5a5040, feet: boot(BOOT, 0.3), hat: { kind: 'viking', color: 0x9a9ea2, color2: 0x6a6e72, spike: true }, hip: 'tools' },
        merchant: { ...man(S, 'full', BROWN, 'long'), top: 0x6a4a30, sleeves: 'long', skirt: { color: 0x6a4a30, length: 0.4 }, belt: LEATHER, buckle: GOLD, legs: 0x4a3a6a, feet: boot(BOOT, 0.3), hat: { kind: 'viking', color: 0x9a9ea2, color2: 0x6a6e72, horns: true }, hip: 'pouch' },
      },
    };
  })(),

  khmer: (() => {
    const S = 0xb0784a;
    const crown = { kind: 'mukuta' as const, color: GOLD };
    return {
      player: { ...ELI, top: RED, sleeves: 'none', neck: 'wrap', apron: { color: GOLD, length: 0.25, width: 0.12 }, skirt: { color: RED, length: 0.45, hem: GOLD }, belt: GOLD, legs: null, feet: sandal(), hat: crown },
      roles: {
        farmer: { ...man(S, 'none', 0x141010, 'shoulder'), top: null, cross: 0xc9a050, skirt: { color: 0x2a7a4a, length: 0.45 }, belt: GOLD, legs: null, feet: sandal(), hat: crown },
        priest: { ...man(S, 'none', 0x141010, 'shoulder'), top: 0xc83a3a, sleeves: 'none', apron: { color: GOLD, length: 0.4, width: 0.12 }, skirt: { color: 0x9a7ab0, length: 0.5, hem: GOLD }, belt: GOLD, legs: null, feet: sandal(), hat: crown },
        soldier: { ...man(S, 'none', 0x141010, 'shoulder'), top: 0x2a7a5a, sleeves: 'none', sash: { color: 0x1a5a3a }, skirt: { color: 0x2a7a5a, length: 0.4, hem: GOLD }, belt: GOLD, buckle: GOLD, greaves: 0x2a6a4a, legs: null, feet: sandal(), hat: crown, hip: 'sword' },
        artisan: { ...woman(S, 'long'), top: WHITE, sleeves: 'none', neck: 'v', apron: { color: GOLD, length: 0.4, width: 0.14 }, skirt: { color: WHITE, length: 1 }, belt: GOLD, legs: null, feet: sandal(), hat: crown },
        merchant: { ...man(S, 'none', 0x141010, 'shoulder'), top: 0xc84a3a, sleeves: 'short', skirt: { color: 0xc84a3a, length: 0.55, hem: 0xd8804a }, belt: 0xa83a2a, legs: null, feet: sandal(), hat: crown, hip: 'pouch' },
      },
    };
  })(),

  mongol: (() => {
    const S = 0xd4a272;
    const FELT = 0xece6da;
    return {
      player: { ...ELI, top: RED, sleeves: 'long', neck: 'wrap', neckColor: WHITE, skirt: { color: RED, length: 0.45, hem: WHITE }, belt: 0x6a4a2a, buckle: GOLD, legs: 0x6a4a3a, feet: boot(BOOT, 0.3), hat: { kind: 'skullcap', color: RED } },
      roles: {
        farmer: { ...man(S, 'full', 0x141010, 'long'), top: 0x5a6a8a, sleeves: 'long', sleeveColor: 0xd8d0c0, cross: 0x6a4a2a, skirt: { color: 0x5a6a8a, length: 0.45, hem: 0xe8e0d0 }, belt: 0x6a4a2a, legs: 0x4a4a4a, feet: boot(BOOT, 0.3), hat: { kind: 'mongol', color: FELT, color2: RED } },
        priest: { ...man(S, 'mustache', 0x141010, 'long'), top: 0xc8ccd0, sleeves: 'long', cross: 0x5a6a8a, skirt: { color: 0xc8ccd0, length: 0.5 }, belt: 0x5a4a3a, legs: 0x5a5a5a, feet: boot(BOOT, 0.32), hat: { kind: 'mongol', color: FELT, color2: RED, horns: true } },
        soldier: { ...man(S, 'full', 0x141010, 'long'), top: 0x9a5a3a, sleeves: 'long', cross: 0x5a3a24, skirt: { color: 0x9a5a3a, length: 0.45, hem: 0xe8e0d0 }, belt: LEATHER, legs: 0x5a4a3a, feet: boot(BOOT, 0.32), hat: { kind: 'mongol', color: FELT, color2: RED }, hip: 'sword' },
        artisan: { ...woman(S, 'long'), top: 0xd8c8a8, sleeves: 'long', cross: 0x6a4a2a, skirt: { color: 0xd8c8a8, length: 0.5 }, belt: LEATHER, legs: 0x3a3a3a, feet: boot(BOOT, 0.3), hat: { kind: 'mongol', color: FELT, color2: 0x3a3a3a } },
        merchant: { ...man(S, 'full', 0x141010, 'long'), top: 0x7a5a42, sleeves: 'long', cross: 0x4a3020, skirt: { color: 0x7a5a42, length: 0.5, hem: 0xd8c8a8 }, belt: LEATHER, legs: 0x4a3a2a, feet: boot(BOOT, 0.3), hat: { kind: 'mongol', color: FELT, color2: RED }, hip: 'pouch' },
      },
    };
  })(),

  aztec: (() => {
    const S = 0xb07448;
    const GREEN = 0x2a8a4a;
    const YELLOW = 0xe8b030;
    return {
      player: { ...ELI, top: null, collar: GREEN, skirt: { color: LINEN, length: 0.35, hem: RED }, apron: { color: GREEN, length: 0.25 }, belt: RED, greaves: GREEN, legs: null, feet: sandal(GOLD), hat: { kind: 'feathers', color: GREEN, color2: GOLD, color3: RED, size: 0.55 } },
      roles: {
        farmer: { ...man(S, 'none', 0x141010, 'shoulder'), top: null, collar: 0x3a9a5a, skirt: { color: LINEN, length: 0.35 }, apron: { color: 0x3a9a5a, length: 0.25, width: 0.12 }, belt: 0x3a9a5a, legs: null, feet: sandal(), hat: { kind: 'feathers', color: GREEN, color2: 0x2a6a3a, size: 0.25 } },
        priest: { ...man(S, 'none', 0x141010, 'shoulder'), top: 0x2a9a8a, sleeves: 'short', collar: GOLD, skirt: { color: LINEN, length: 0.5, hem: YELLOW }, apron: { color: 0x2a8a5a, length: 0.4 }, bracers: 0x2a9a8a, greaves: 0x2a8a5a, belt: 0x2a8a5a, legs: null, feet: sandal(), hat: { kind: 'feathers', color: 0x2a6ad0, color2: WHITE, color3: 0x4a8ae0, size: 1 } },
        soldier: { ...man(S, 'none', 0x141010, 'shoulder'), top: YELLOW, sleeves: 'short', collar: GREEN, skirt: { color: YELLOW, length: 0.5, hem: GREEN }, apron: { color: GREEN, length: 0.4 }, greaves: GREEN, belt: GREEN, legs: null, feet: sandal(), hat: { kind: 'feathers', color: GREEN, color2: GOLD, size: 1.1 }, hip: 'sword', hipColor: 0x2a2a2a },
        artisan: { ...man(S, 'short', 0x141010, 'shoulder'), top: 0x2a7a4a, sleeves: 'none', skirt: { color: 0x2a7a4a, length: 0.5, hem: YELLOW }, belt: 0x6a4a2a, greaves: 0x2a7a4a, legs: null, feet: sandal(), hat: { kind: 'feathers', color: 0x1a5a3a, color2: GOLD, size: 0.25 }, hip: 'satchel', hipColor: LINEN },
        merchant: { ...man(S, 'none', 0x141010, 'shoulder'), top: 0x4a8ad0, sleeves: 'short', cross: 0x6a4a2a, skirt: { color: 0x4a8ad0, length: 0.7, hem: LINEN, bands: [LINEN] }, belt: 0x6a4a2a, greaves: 0x2a6a4a, legs: null, feet: sandal(), hat: { kind: 'feathers', color: 0x2a6ab0, color2: GOLD, size: 0.55 }, hip: 'pouch' },
      },
    };
  })(),

  sengoku: (() => {
    const S = 0xe2b98e;
    const NAVY = 0x1e2a44;
    const hat = { kind: 'jingasa' as const, color: 0x222228 };
    return {
      player: { ...ELI, top: NAVY, sleeves: 'wide', neck: 'wrap', neckColor: WHITE, sash: { color: 0xa8221e, width: 0.07 }, skirt: { color: NAVY, length: 0.72 }, belt: 0xa8221e, legs: null, feet: sandal(0x6a4a2a), hat, hip: 'katana', hipColor: 0x2a2a2a },
      roles: {
        farmer: { ...man(S, 'none'), top: 0x2a3a6a, sleeves: 'wide', neck: 'wrap', neckColor: WHITE, skirt: { color: 0x2a3a6a, length: 0.75 }, belt: 0x6a4a2a, buckle: GOLD, legs: null, feet: sandal(), hat: { kind: 'kasa', color: 0xd8b050 } },
        priest: { ...man(S, 'mustache'), top: WHITE, sleeves: 'wide', vest: { color: 0xa8221e }, apron: { color: WHITE, length: 0.62, width: 0.22 }, skirt: { color: 0x3a3a3a, length: 0.6 }, belt: 0x8a6a3a, legs: 0x3a3a3a, feet: sandal(), hat },
        soldier: { ...man(S, 'full'), top: 0x2a2a32, sleeves: 'long', cuff: 0xa8221e, armor: { color: 0x2a2a32, trim: 0xd86a2a, shoulders: 0x2a2a32 }, skirt: { color: 0x2a2a32, length: 0.4, alt: 0x3a3a44, hem: 0xd86a2a }, belt: 0xa8221e, legs: 0x8a2a2a, feet: boot(0x4a3a2a, 0.3), hat: { kind: 'kabuto', color: 0x2a2a30, color2: GOLD }, hip: 'katana', hipColor: 0x2a2a2a },
        artisan: { ...woman(S, 'long'), top: 0xd8c49a, sleeves: 'wide', neck: 'wrap', neckColor: WHITE, sash: { color: 0x6a4a2a }, skirt: { color: 0xd8c49a, length: 0.82 }, belt: 0x6a4a2a, legs: null, feet: sandal() },
        merchant: { ...man(S, 'mustache'), top: 0x3a3e46, sleeves: 'wide', neck: 'wrap', neckColor: WHITE, skirt: { color: 0x3a3e46, length: 0.7 }, belt: 0x6a4a2a, buckle: GOLD, legs: null, feet: boot(0x3a2a1a, 0.25), hat, hip: 'pouch' },
      },
    };
  })(),

  buccaneer: (() => {
    const S = 0xdcae88;
    const BREECH = 0x5a4a3a;
    return {
      player: { ...ELI, top: WHITE, sleeves: 'long', cuff: 0xa8221e, vest: { color: 0x9a2222 }, legs: BREECH, legsKnee: true, belt: 0x4a3020, buckle: GOLD, feet: boot(0x5a3a22, 0.38), hat: { kind: 'cowboy', color: BLACK, color2: BLACK } },
      roles: {
        farmer: { ...man(S, 'mustache', 0x2a1a10), top: WHITE, sleeves: 'long', vest: { color: BLACK }, tie: BLACK, legs: BREECH, belt: 0x4a3020, feet: boot(0x5a3a22, 0.38), hat: { kind: 'cowboy', color: BLACK, color2: BLACK }, hip: 'pouch' },
        priest: { ...man(S, 'none', 0x2a1a10), top: WHITE, coat: { color: 0x5a5a32, length: 0.5, trim: 0xd88a3a }, vest: { color: 0x6a7a8a }, legs: BREECH, legsKnee: true, feet: boot(0x5a3a22, 0.38), hat: { kind: 'cowboy', color: BLACK, color2: BLACK } },
        soldier: { ...man(S, 'long', 0x141010), top: WHITE, coat: { color: 0x1e2a4a, length: 0.55, trim: 0xd88a3a }, vest: { color: 0xa8221e }, legs: 0x1e2a4a, belt: 0x4a3020, buckle: GOLD, feet: boot(0x5a3a22, 0.38), hat: { kind: 'bandana', color: 0xb8221e }, hip: 'sword' },
        artisan: { ...man(S, 'none', 0x2a1a10), top: WHITE, sleeves: 'long', vest: { color: 0x6a4a32 }, legs: 0x5a5a5a, legsKnee: true, belt: 0x4a3020, feet: boot(0x5a3a22, 0.38), hat: { kind: 'tricorn', color: BLACK, color2: WHITE }, hip: 'tools' },
        merchant: { ...man(S, 'mustache', 0x2a1a10), top: WHITE, sleeves: 'long', vest: { color: 0x4a3428 }, tie: 0x2a1a10, legs: 0x5a5a5a, belt: 0x4a3020, buckle: GOLD, feet: boot(0x5a3a22, 0.38), hat: { kind: 'tricorn', color: 0x2a2420, color2: GOLD }, hip: 'pouch' },
      },
    };
  })(),

  victorian: (() => {
    const S = 0xe8c4a4;
    const top = { kind: 'tophat' as const, color: 0x18181c, color2: 0x2a2a30 };
    return {
      player: { ...ELI, top: WHITE, coat: { color: 0x26262c, length: 0.22 }, vest: { color: 0x6a4a2a }, tie: 0x6a4a2a, legs: 0x26262c, feet: shoe(), hat: top },
      roles: {
        farmer: { ...woman(S, 'bun', 0x2a1a10), top: 0x6a5040, sleeves: 'long', sleeveColor: 0xe8e0d0, neck: 'v', neckColor: WHITE, skirt: { color: 0x6a5040, length: 1, flare: 0.1, hem: 0x5a4030 }, belt: 0x5a4030, legs: null, feet: shoe(0x2a1a10), hat: { kind: 'bonnet', color: WHITE, spike: true } },
        priest: { ...man(S, 'full', 0x2a1a10), top: WHITE, coat: { color: 0x1e2a44, length: 0.72 }, tie: 0x1a1a1a, legs: 0x2a2a30, feet: shoe(), hat: top },
        soldier: { ...woman(S, 'bun', 0x2a1a10), top: 0x7a1a26, sleeves: 'long', neck: 'v', neckColor: WHITE, skirt: { color: 0x7a1a26, length: 1, flare: 0.12, hem: 0xd8b08a, bands: [0xd8b08a] }, belt: 0x5a1018, buckle: GOLD, legs: null, feet: shoe(), hat: { kind: 'ladyhat', color: 0x1a1a1a, color2: 0x6a1a22 } },
        artisan: { ...man(S, 'full', 0x2a1a10), top: WHITE, sleeves: 'long', vest: { color: 0x6a4a32 }, apron: { color: WHITE, length: 0.6, width: 0.3 }, legs: WHITE, feet: boot(DARKLEATHER, 0.3), hat: top, hip: 'tools' },
        merchant: { ...man(S, 'full', 0x2a1a10), top: WHITE, coat: { color: 0x1e1e24, length: 0.72 }, tie: 0x1a1a1a, legs: 0x1e1e24, feet: shoe(), hat: top },
      },
    };
  })(),

  wildwest: (() => {
    const S = 0xd9a882;
    const hat = (c = 0x3a2a1e) => ({ kind: 'cowboy' as const, color: c, color2: shade(c, 0.7) });
    return {
      player: { ...ELI, top: WHITE, sleeves: 'long', vest: { color: 0x2a1e18 }, coat: { color: 0x2a1e18, length: 0.45 }, tie: 0xa8221e, legs: 0x2a2420, belt: DARKLEATHER, buckle: GOLD, feet: boot(BOOT, 0.3), hat: hat(), hip: 'holster' },
      roles: {
        farmer: { ...woman(S, 'long', 0x3a2416), top: 0xa8462a, sleeves: 'long', cross: 0x5a3a24, skirt: { color: 0xa8462a, length: 0.85, flare: 0.06 }, belt: 0x5a3a24, legs: null, feet: boot(0x5a3a24, 0.3), hat: hat() },
        priest: { ...man(S, 'full', 0x2a1a10), top: WHITE, vest: { color: 0x2a2420 }, coat: { color: 0x2a2420, length: 0.45 }, tie: 0x1a1a1a, legs: 0x2a2420, belt: DARKLEATHER, buckle: GOLD, feet: boot(BOOT, 0.3), hat: hat(0x2a2420) },
        outlaw: { ...man(S, 'full', 0x2a1a10), top: WHITE, vest: { color: 0xa8221e }, coat: { color: 0x26344e, length: 0.55, trim: 0xc84a2a }, legs: 0x26344e, belt: DARKLEATHER, buckle: GOLD, feet: boot(BOOT, 0.32), hat: hat(0x2a2420), hip: 'holster' },
        doctor: { ...woman(S, 'bun', 0x3a2416), top: WHITE, sleeves: 'long', vest: { color: 0x5a2a5a }, skirt: { color: 0x6a2a6a, length: 1, flare: 0.1 }, belt: 0x5a2a5a, legs: null, feet: shoe(0x2a1a1a), hat: { kind: 'ladyhat', color: 0x5a2a5a, color2: 0x3a1a3a }, hip: 'satchel', hipColor: 0x3a2a1a },
        merchant: { ...man(S, 'mustache', 0x2a1a10), top: WHITE, sleeves: 'long', vest: { color: 0x7a5a3a }, tie: 0x2a1a10, legs: 0x7a5a3a, belt: DARKLEATHER, feet: boot(BOOT, 0.28), hat: { kind: 'bowler', color: 0x2a2420, goggles: true }, hip: 'pouch' },
      },
    };
  })(),

  industrial: (() => {
    const S = 0xe2bc98;
    const cap = (c = 0x2a2c30) => ({ kind: 'flatcap' as const, color: c });
    return {
      player: { ...ELI, top: WHITE, sleeves: 'long', overalls: 0x2a3448, legs: 0x2a3448, feet: boot(0x5a3a24, 0.25), hat: cap() },
      roles: {
        farmer: { ...woman(S, 'long', 0x3a2416), top: WHITE, sleeves: 'long', overalls: 0x2e3a52, legs: 0x2e3a52, feet: boot(0x5a3a24, 0.25), hat: cap(0x4a4644) },
        priest: { ...man(S, 'none', 0x2a1a10), top: 0xd8b88a, sleeves: 'long', cross: 0x6a4a2a, tie: 0x2a1a10, legs: 0x2e3a52, belt: 0x5a3a24, feet: boot(0x5a3a24, 0.25), hat: cap() },
        soldier: { ...man(S, 'none', 0x2a1a10), top: WHITE, coat: { color: 0x4a4c50, length: 0.45, trim: 0xc88a3a }, tie: 0x1a1a1a, legs: 0x2a3448, belt: 0x3a2a1a, feet: boot(0x5a3a24, 0.32), hat: { kind: 'bowler', color: BLACK, goggles: true } },
        inventor: { ...man(S, 'mustache', 0x2a1a10), top: WHITE, vest: { color: 0x6a4a32 }, coat: { color: 0x6a4a32, length: 0.55 }, tie: 0x2a1a10, legs: 0x6a4a32, feet: boot(0x5a3a24, 0.3), hat: { kind: 'bowler', color: 0x5a3e2a } },
        merchant: { ...man(S, 'mustache', 0x2a1a10), top: WHITE, coat: { color: 0x2c2c30, length: 0.7 }, tie: 0x1a1a1a, legs: 0x2c2c30, feet: shoe(), hat: cap() },
        // story characters in 1938
        varga: { ...woman(0xe8c8a8, 'bun', 0x8a8a8a), top: WHITE, coat: { color: 0x4a3a5a, length: 0.92, trim: 0x2a2234 }, tie: 0x6a2a3a, legs: 0x2a2a2a, feet: shoe() },
        danny: { ...man(0xe0c0a0, 'none', 0x6a4a2a), top: WHITE, sleeves: 'long', vest: { color: 0x7a6a5a }, legs: 0x4a4a4a, legsKnee: true, feet: shoe(0x3a2a1a), hat: cap(0x5a4a3a), hip: 'satchel', hipColor: 0x8a6a4a },
        hale: { ...man(0xe8c8a8, 'short', 0x9a9a9a), top: WHITE, coat: { color: 0x1a1a22, length: 0.72 }, vest: { color: 0x3a2a3a }, tie: 0x6a1a1a, legs: 0x1a1a22, feet: shoe(), hat: { kind: 'tophat', color: 0x111111, color2: 0x2a2a2a } },
        worker: { ...man(S, 'short', 0x3a2a1a), top: 0x8a8a7a, sleeves: 'long', overalls: 0x3a4a5a, legs: 0x3a4a5a, feet: boot(0x4a3020, 0.25), hat: cap(0x3a3a3a) },
      },
    };
  })(),
};

/** Pick the closest outfit for a role name when a story character has no explicit outfit. */
export function outfitKeyForRole(eraId: string, role: string): string {
  const r = role.toLowerCase();
  const roles = CAST[eraId]?.roles ?? {};
  const has = (k: string): boolean => k in roles;
  if (/soldier|guard|warrior|legion|hoplite|raider|samurai|archer|captain|general|pirate|officer/.test(r)) return has('soldier') ? 'soldier' : has('outlaw') ? 'outlaw' : 'merchant';
  if (/priest|monk|oracle|astronomer|shaman|vicar|preacher|scholar|scribe|senator|sage|historian|chaplain|skald/.test(r)) return 'priest';
  if (/merchant|trader|banker|official|noble|courtier|envoy|gentleman|king|governor|industrialist/.test(r)) return 'merchant';
  if (/farmer|peasant|herder|shepherd|laborer|worker|dockhand|deportee/.test(r)) return 'farmer';
  if (/doctor/.test(r) && has('doctor')) return 'doctor';
  if (/inventor|engineer/.test(r) && has('inventor')) return 'inventor';
  return has('artisan') ? 'artisan' : 'merchant';
}

/**
 * A slightly different person in the same outfit: skin tone, hair and garment shades shift so a
 * crowd of one role does not look cloned. Variant 0 is the sheet's look.
 */
export function varyOutfit(o: Outfit, v: number): Outfit {
  if (v === 0) return o;
  const k = v === 1 ? 0.9 : 1.08;
  const skinK = v === 1 ? 0.92 : 1.05;
  const tint = (c: number | null | undefined): number | null | undefined => (c === null || c === undefined ? c : shade(c, k));
  const out: Outfit = {
    ...o,
    skin: shade(o.skin, skinK),
    hair: v === 2 && o.hair < 0x303030 ? 0x4a3020 : o.hair,
    top: tint(o.top) as number | null,
    legs: tint(o.legs) as number | null,
  };
  if (o.skirt) out.skirt = { ...o.skirt, color: shade(o.skirt.color, k) };
  if (o.coat) out.coat = { ...o.coat, color: shade(o.coat.color, k) };
  if (o.vest) out.vest = { ...o.vest, color: shade(o.vest.color, k) };
  if (o.build !== 'f') {
    // swap facial hair between neighbours
    const beards: NonNullable<Outfit['beard']>[] = ['none', 'mustache', 'short', 'full'];
    if (o.beard && beards.includes(o.beard)) out.beard = beards[(beards.indexOf(o.beard) + v) % beards.length];
  }
  return out;
}

export const VARIANTS = 3;
