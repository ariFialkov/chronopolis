import type { PropKind, TreeKind } from '../eras/types';
import { Rng } from '../util/rng';
import { shade } from '../util/math';
import type { MeshBuilder } from './meshBuilder';

const TRUNK = 0x5a4330;

/** Returns collision radius (0 = walk-through). */
export function buildTree(mb: MeshBuilder, x: number, y: number, z: number, kind: TreeKind, rng: Rng): number {
  const s = rng.range(0.8, 1.3);
  switch (kind) {
    case 'oak': {
      const g = shade(0x4f7f3a, rng.range(0.85, 1.15));
      mb.cylinder(x, y - 0.3, z, 0.35 * s, 0.25 * s, 2.6 * s, TRUNK, 6);
      mb.dome(x, y + 1.8 * s, z, 2.4 * s, g, 8, 3);
      mb.dome(x + 0.8 * s, y + 2.6 * s, z - 0.4 * s, 1.6 * s, shade(g, 1.1), 7, 3);
      return 0.45;
    }
    case 'pine': {
      const g = shade(0x2f5f36, rng.range(0.85, 1.15));
      mb.cylinder(x, y - 0.3, z, 0.3 * s, 0.2 * s, 2 * s, TRUNK, 5);
      mb.cylinder(x, y + 1.2 * s, z, 2.2 * s, 0.0, 3.2 * s, g, 7);
      mb.cylinder(x, y + 3.2 * s, z, 1.6 * s, 0.0, 2.8 * s, shade(g, 1.08), 7);
      mb.cylinder(x, y + 5.0 * s, z, 1.0 * s, 0.0, 2.2 * s, shade(g, 1.15), 7);
      return 0.4;
    }
    case 'cedar': {
      const g = shade(0x3b6a3f, rng.range(0.85, 1.15));
      mb.cylinder(x, y - 0.3, z, 0.45 * s, 0.3 * s, 3 * s, TRUNK, 6);
      mb.cylinder(x, y + 1.5 * s, z, 3.2 * s, 1.5 * s, 2.5 * s, g, 8);
      mb.cylinder(x, y + 3.8 * s, z, 2.4 * s, 0.0, 2.6 * s, shade(g, 1.1), 8);
      return 0.5;
    }
    case 'cypress': {
      const g = shade(0x2d5a33, rng.range(0.85, 1.15));
      mb.cylinder(x, y - 0.3, z, 0.25 * s, 0.2 * s, 1.2 * s, TRUNK, 5);
      mb.cylinder(x, y + 0.8 * s, z, 0.9 * s, 0.0, 6.5 * s, g, 6);
      return 0.35;
    }
    case 'palm': {
      const lean = rng.range(-0.25, 0.25);
      const h = 6 * s;
      const tx = x + lean * h;
      mb.cylinder(x, y - 0.3, z, 0.3 * s, 0.22 * s, h, 0x8a6a45, 5);
      const g = shade(0x4f8f3a, rng.range(0.85, 1.15));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + rng.range(0, 0.5);
        mb.prism(tx + Math.cos(a) * 1.4 * s, y + h - 0.4, z + Math.sin(a) * 1.4 * s, 3 * s, 0.4, 0.9 * s, g, a);
      }
      mb.dome(tx, y + h - 0.6, z, 0.7 * s, 0x7a5a3a, 6, 2);
      return 0.35;
    }
    case 'jungle': {
      const g = shade(0x2f7a3a, rng.range(0.8, 1.2));
      const h = 7 * s;
      mb.cylinder(x, y - 0.3, z, 0.5 * s, 0.35 * s, h, 0x6a5038, 6);
      mb.dome(x, y + h - 1, z, 3.4 * s, g, 9, 3);
      mb.dome(x + 1.5 * s, y + h - 2.2, z + 1 * s, 2.2 * s, shade(g, 0.9), 7, 2);
      mb.dome(x - 1.4 * s, y + h - 2.4, z - 1.2 * s, 2.0 * s, shade(g, 1.1), 7, 2);
      return 0.55;
    }
    case 'dead': {
      mb.cylinder(x, y - 0.3, z, 0.3 * s, 0.15 * s, 3.5 * s, 0x6a5a4a, 5);
      mb.box(x + 0.6 * s, y + 2.4 * s, z, 1.8 * s, 0.25, 0.25, 0x6a5a4a, 0.6);
      mb.box(x - 0.5 * s, y + 2.9 * s, z + 0.2, 1.4 * s, 0.22, 0.22, 0x6a5a4a, -0.9);
      return 0.3;
    }
    case 'none':
      return 0;
  }
}

/** Builds a prop and returns its collision radius (0 = walk-through). */
export function buildProp(mb: MeshBuilder, x: number, y: number, z: number, kind: PropKind, rng: Rng, rot = 0): number {
  switch (kind) {
    case 'lamp':
      mb.cylinder(x, y, z, 0.12, 0.1, 4.2, 0x3a3a3a, 5);
      mb.box(x, y + 4.2, z, 0.5, 0.45, 0.5, 0xfff0b0);
      return 0.2;
    case 'gaslamp':
      mb.cylinder(x, y, z, 0.14, 0.1, 3.4, 0x2a3a2a, 5);
      mb.hip(x, y + 3.4, z, 0.6, 0.6, 0.6, 0.4, 0.4, 0xffe8a0);
      mb.hip(x, y + 4.0, z, 0.6, 0.3, 0.6, 0, 0, 0x2a3a2a);
      return 0.2;
    case 'torch':
      mb.cylinder(x, y, z, 0.1, 0.08, 2.4, 0x5a4330, 5);
      mb.cylinder(x, y + 2.4, z, 0.25, 0.05, 0.7, 0xffa030, 5);
      return 0.15;
    case 'lantern':
      mb.box(x, y, z, 0.7, 0.3, 0.7, 0x7a7a72, rot);
      mb.cylinder(x, y + 0.3, z, 0.18, 0.18, 1.6, 0x7a7a72, 6);
      mb.box(x, y + 1.9, z, 0.7, 0.5, 0.7, 0x7a7a72, rot);
      mb.hip(x, y + 2.4, z, 1.0, 0.4, 1.0, 0, 0, 0x6a6a62, rot);
      return 0.4;
    case 'crate':
      mb.box(x, y, z, 1.1, 1.1, 1.1, shade(0x9a7a4a, rng.range(0.85, 1.1)), rot);
      if (rng.chance(0.4)) mb.box(x + 0.3, y + 1.1, z - 0.2, 0.9, 0.9, 0.9, 0x8a6a40, rot + 0.4);
      return 0.7;
    case 'barrel':
      mb.cylinder(x, y, z, 0.5, 0.5, 1.1, shade(0x7a5a3a, rng.range(0.85, 1.1)), 7);
      mb.cylinder(x, y + 0.3, z, 0.53, 0.53, 0.12, 0x3a3a3a, 7);
      mb.cylinder(x, y + 0.75, z, 0.53, 0.53, 0.12, 0x3a3a3a, 7);
      return 0.55;
    case 'amphora':
      mb.cylinder(x, y, z, 0.25, 0.45, 0.7, 0xb0704a, 6);
      mb.cylinder(x, y + 0.7, z, 0.45, 0.2, 0.6, 0xb0704a, 6);
      return 0.4;
    case 'statue':
      mb.box(x, y, z, 1.4, 1.2, 1.4, 0xb8b0a0, rot);
      mb.box(x, y + 1.2, z, 0.5, 1.4, 0.4, 0xd0c8b8, rot);
      mb.box(x, y + 2.6, z, 0.9, 0.8, 0.45, 0xd0c8b8, rot);
      mb.dome(x, y + 3.4, z, 0.3, 0xd0c8b8, 6, 2);
      return 0.8;
    case 'obelisk':
      mb.box(x, y, z, 1.6, 0.6, 1.6, 0xd8c8a8, rot);
      mb.hip(x, y + 0.6, z, 1.2, 7, 1.2, 0.5, 0.5, 0xe0d0b0, rot);
      mb.hip(x, y + 7.6, z, 0.5, 0.6, 0.5, 0, 0, 0xf0d070, rot);
      return 0.9;
    case 'pillar':
      mb.cylinder(x, y, z, 0.6, 0.5, 6, 0xe8e0d0, 8);
      mb.box(x, y + 6, z, 1.4, 0.5, 1.4, 0xe8e0d0, rot);
      return 0.7;
    case 'stele':
      mb.box(x, y, z, 1.2, 3.2, 0.5, 0xb8a888, rot);
      mb.box(x, y, z, 1.8, 0.4, 1.0, 0xa89878, rot);
      return 0.8;
    case 'runestone':
      mb.hip(x, y - 0.2, z, 1.4, 2.4, 0.7, 0.9, 0.5, 0x7a7a78, rot);
      return 0.7;
    case 'totem':
      mb.cylinder(x, y, z, 0.3, 0.3, 4, 0x6a4a2a, 6);
      mb.box(x, y + 1.2, z, 0.9, 0.8, 0.8, 0x8a3a2a, rot);
      mb.box(x, y + 2.6, z, 0.9, 0.8, 0.8, 0x2a5a8a, rot);
      mb.box(x, y + 4, z, 1.6, 0.3, 0.4, 0x6a4a2a, rot);
      return 0.4;
    case 'well':
      mb.cylinder(x, y, z, 1.2, 1.2, 1.0, 0x8a8a80, 8);
      mb.cylinder(x, y + 0.9, z, 0.9, 0.9, 0.2, 0x2a3a4a, 8);
      mb.box(x - 1, y, z, 0.2, 2.6, 0.2, 0x5a4330);
      mb.box(x + 1, y, z, 0.2, 2.6, 0.2, 0x5a4330);
      mb.prism(x, y + 2.6, z, 2.8, 0.6, 1.6, 0x6a4a3a);
      return 1.3;
    case 'fountain':
      mb.cylinder(x, y, z, 2.4, 2.4, 0.7, 0xc8c0b0, 10);
      mb.cylinder(x, y + 0.5, z, 2.0, 2.0, 0.25, 0x4a8aa8, 10);
      mb.cylinder(x, y + 0.7, z, 0.4, 0.3, 1.6, 0xc8c0b0, 6);
      mb.cylinder(x, y + 2.3, z, 1.0, 1.0, 0.3, 0xc8c0b0, 8);
      return 2.5;
    case 'cart':
      mb.box(x, y + 0.6, z, 2.6, 0.7, 1.4, 0x8a6a40, rot);
      mb.cylinder(x + Math.cos(rot) * 0.8, y + 0.0, z + Math.sin(rot) * 0.8, 0.55, 0.55, 0.15, 0x4a3a2a, 8);
      mb.cylinder(x - Math.cos(rot) * 0.8, y + 0.0, z - Math.sin(rot) * 0.8, 0.55, 0.55, 0.15, 0x4a3a2a, 8);
      return 1.3;
    case 'wagon':
      mb.box(x, y + 0.7, z, 3.4, 0.8, 1.6, 0x7a5a3a, rot);
      mb.hip(x, y + 1.5, z, 3.4, 0.9, 1.9, 3.0, 1.4, 0xe8e0d0, rot);
      for (const s of [-1, 1]) {
        mb.cylinder(x + Math.cos(rot) * 1.1 * s + Math.sin(rot) * 0.8, y, z + Math.sin(rot) * 1.1 * s - Math.cos(rot) * 0.8, 0.6, 0.6, 0.15, 0x4a3a2a, 8);
        mb.cylinder(x + Math.cos(rot) * 1.1 * s - Math.sin(rot) * 0.8, y, z + Math.sin(rot) * 1.1 * s + Math.cos(rot) * 0.8, 0.6, 0.6, 0.15, 0x4a3a2a, 8);
      }
      return 1.8;
    case 'automobile': {
      const c = rng.pick([0x1a1a1a, 0x2a2a3a, 0x4a1a1a, 0x1a3a2a, 0x3a3a3a]);
      mb.box(x, y + 0.45, z, 4.4, 0.8, 1.8, c, rot);
      mb.box(x - Math.cos(rot) * 0.3, y + 1.25, z - Math.sin(rot) * 0.3, 2.4, 0.9, 1.6, c, rot);
      for (const s of [-1, 1]) {
        mb.cylinder(x + Math.cos(rot) * 1.4 * s + Math.sin(rot) * 0.9, y, z + Math.sin(rot) * 1.4 * s - Math.cos(rot) * 0.9, 0.42, 0.42, 0.25, 0x111111, 8);
        mb.cylinder(x + Math.cos(rot) * 1.4 * s - Math.sin(rot) * 0.9, y, z + Math.sin(rot) * 1.4 * s + Math.cos(rot) * 0.9, 0.42, 0.42, 0.25, 0x111111, 8);
      }
      return 2.2;
    }
    case 'bench':
      mb.box(x, y + 0.45, z, 1.8, 0.1, 0.5, 0x6a4a3a, rot);
      mb.box(x, y, z, 1.6, 0.45, 0.1, 0x3a3a3a, rot);
      return 0.6;
    case 'hydrant':
      mb.cylinder(x, y, z, 0.2, 0.18, 0.9, 0xb02020, 6);
      mb.dome(x, y + 0.9, z, 0.2, 0xb02020, 6, 2);
      return 0.25;
    case 'signpost':
      mb.cylinder(x, y, z, 0.08, 0.08, 2.8, 0x5a4330, 5);
      mb.box(x, y + 2.3, z, 1.2, 0.35, 0.08, 0xd8c8a0, rot);
      return 0.15;
    case 'shrine':
      mb.box(x, y, z, 1.6, 0.4, 1.6, 0x8a8a80, rot);
      mb.box(x, y + 0.4, z, 1.0, 1.2, 1.0, 0x9a6a3a, rot);
      mb.hip(x, y + 1.6, z, 1.8, 0.7, 1.8, 0, 0, 0x4a3a2a, rot);
      return 0.9;
    case 'altar':
      mb.box(x, y, z, 2.2, 1.0, 1.2, 0x9a9088, rot);
      mb.box(x, y + 1.0, z, 2.5, 0.2, 1.5, 0xa8a098, rot);
      return 1.3;
    case 'stall': {
      const cloth = rng.pick([0xc83a2a, 0x2a6ab0, 0xd9a52a, 0x4a8a3a, 0xe8e0d0]);
      mb.box(x, y + 0.5, z, 2.6, 0.5, 1.4, 0x8a6a40, rot);
      for (const s of [-1, 1]) {
        mb.box(x + Math.cos(rot) * 1.2 * s, y, z + Math.sin(rot) * 1.2 * s, 0.12, 2.3, 0.12, 0x5a4330);
        mb.box(x + Math.cos(rot) * 1.2 * s - Math.sin(rot) * 1.3, y, z + Math.sin(rot) * 1.2 * s + Math.cos(rot) * 1.3, 0.12, 2.3, 0.12, 0x5a4330);
      }
      mb.prism(x - Math.sin(rot) * 0.6, y + 2.3, z + Math.cos(rot) * 0.6, 3.0, 0.5, 2.8, cloth, rot);
      return 1.5;
    }
    case 'haystack':
      mb.cylinder(x, y, z, 1.4, 0.4, 2.0, 0xd9b85a, 7);
      return 1.2;
    case 'cactus':
      mb.cylinder(x, y, z, 0.3, 0.28, 2.6, 0x4a7a3a, 6);
      mb.box(x + 0.6, y + 1.2, z, 0.9, 0.3, 0.3, 0x4a7a3a);
      mb.cylinder(x + 0.9, y + 1.2, z, 0.18, 0.16, 1.0, 0x4a7a3a, 5);
      return 0.4;
    case 'campfire':
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        mb.box(x + Math.cos(a) * 0.9, y, z + Math.sin(a) * 0.9, 0.5, 0.35, 0.5, 0x6a6a68, a);
      }
      mb.cylinder(x, y, z, 0.5, 0.05, 0.9, 0xff8020, 6);
      return 1.0;
    case 'tent':
      mb.hip(x, y - 0.1, z, 3.2, 2.2, 3.2, 0, 0, shade(0xc9b890, rng.range(0.85, 1.1)), rot);
      return 1.7;
    case 'cannon':
      mb.box(x, y + 0.3, z, 1.6, 0.5, 1.2, 0x6a4a3a, rot);
      mb.cylinder(x, y + 0.6, z, 0.3, 0.3, 0.1, 0x2a2a2a, 6);
      mb.box(x, y + 0.6, z, 2.6, 0.5, 0.5, 0x2a2a2a, rot);
      return 1.2;
    case 'boulder':
      mb.dome(x, y - 0.3, z, rng.range(0.8, 1.8), shade(0x8a8a80, rng.range(0.8, 1.1)), 6, 2);
      return 1.2;
  }
}
