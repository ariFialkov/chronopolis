/**
 * Landmark generators. Each era places its own monument on the same sacred ground:
 * the ziggurat, the pyramid, the Parthenon, the castle and the city hall all stand on Citadel Hill.
 */
import type { Era } from '../eras/types';
import { Rng } from '../util/rng';
import { shade } from '../util/math';
import type { MeshBuilder } from './meshBuilder';
import type { Collider } from './collision';
import type { Site } from './macro';
import { buildProp, buildTree } from './props';

type Ctx = {
  mb: MeshBuilder;
  x: number;
  z: number;
  y: number;
  rng: Rng;
  era: Era;
  col: Collider[];
};

function solid(c: Ctx, x: number, z: number, w: number, d: number, h: number, rot = 0, tag?: string): void {
  c.col.push({ x, z, hw: w / 2, hd: d / 2, rot, h, tag });
}

function steps(c: Ctx, x: number, z: number, w: number, d: number, n: number, stepH: number, color: number, rot = 0): void {
  for (let i = 0; i < n; i++) {
    const s = 1 - i / n;
    c.mb.box(x, c.y + i * stepH, z, w * s + 0.5, stepH, d * s + 0.5, shade(color, 1 - i * 0.02), rot);
  }
}

function stair(c: Ctx, x: number, y: number, z: number, width: number, run: number, rise: number, dirX: number, dirZ: number, color: number): void {
  const n = Math.max(2, Math.round(rise / 0.5));
  const rot = Math.atan2(dirZ, dirX);
  for (let i = 0; i < n; i++) {
    const t = i / n;
    const px = x + dirX * run * t;
    const pz = z + dirZ * run * t;
    c.mb.box(px, y, pz, run / n + 0.05, rise * (1 - t), width, color, rot);
  }
}

function fence(c: Ctx, x: number, z: number, w: number, d: number, color: number, postEvery = 3): void {
  const corners: [number, number][] = [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const n = Math.floor(len / postEvery);
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      c.mb.box(a[0] + (b[0] - a[0]) * t, c.y, a[1] + (b[1] - a[1]) * t, 0.25, 1.4, 0.25, color);
    }
    const rot = Math.atan2(b[1] - a[1], b[0] - a[0]);
    c.mb.box((a[0] + b[0]) / 2, c.y + 1.0, (a[1] + b[1]) / 2, len, 0.12, 0.1, color, rot);
    c.mb.box((a[0] + b[0]) / 2, c.y + 0.5, (a[1] + b[1]) / 2, len, 0.12, 0.1, color, rot);
  }
}

function wallRect(c: Ctx, x: number, z: number, w: number, d: number, t: number, h: number, color: number, gateSide: 0 | 1 | 2 | 3 | -1 = 2, gateW = 6): void {
  const sides: [number, number, number, number, number][] = [
    [x, z - d / 2, w, t, 0],
    [x + w / 2, z, t, d, 0],
    [x, z + d / 2, w, t, 0],
    [x - w / 2, z, t, d, 0],
  ];
  sides.forEach(([sx, sz, sw, sd], i) => {
    if (i === gateSide) {
      const horiz = sw > sd;
      const len = horiz ? sw : sd;
      const seg = (len - gateW) / 2;
      if (horiz) {
        c.mb.box(sx - (gateW + seg) / 2, c.y - 1, sz, seg, h + 1, sd, color);
        c.mb.box(sx + (gateW + seg) / 2, c.y - 1, sz, seg, h + 1, sd, color);
        solid(c, sx - (gateW + seg) / 2, sz, seg, sd, h);
        solid(c, sx + (gateW + seg) / 2, sz, seg, sd, h);
        c.mb.box(sx, c.y + h, sz, gateW + 2, 1.6, sd + 1, shade(color, 0.9));
      } else {
        c.mb.box(sx, c.y - 1, sz - (gateW + seg) / 2, sw, h + 1, seg, color);
        c.mb.box(sx, c.y - 1, sz + (gateW + seg) / 2, sw, h + 1, seg, color);
        solid(c, sx, sz - (gateW + seg) / 2, sw, seg, h);
        solid(c, sx, sz + (gateW + seg) / 2, sw, seg, h);
        c.mb.box(sx, c.y + h, sz, sw + 1, 1.6, gateW + 2, shade(color, 0.9));
      }
    } else {
      c.mb.box(sx, c.y - 1, sz, sw, h + 1, sd, color);
      solid(c, sx, sz, sw, sd, h);
    }
  });
  // corner towers
  for (const [cx, cz] of [
    [x - w / 2, z - d / 2],
    [x + w / 2, z - d / 2],
    [x + w / 2, z + d / 2],
    [x - w / 2, z + d / 2],
  ]) {
    c.mb.box(cx, c.y - 1, cz, t + 2.5, h + 3.5, t + 2.5, shade(color, 0.95));
    solid(c, cx, cz, t + 2.5, t + 2.5, h + 3.5);
  }
}

function crenellations(c: Ctx, x: number, y: number, z: number, w: number, d: number, color: number): void {
  const n = Math.floor(w / 2.4);
  const m = Math.floor(d / 2.4);
  for (let i = 0; i <= n; i++) {
    const px = x - w / 2 + (i * w) / n;
    c.mb.box(px, y, z - d / 2, 1.1, 1.0, 0.8, color);
    c.mb.box(px, y, z + d / 2, 1.1, 1.0, 0.8, color);
  }
  for (let i = 1; i < m; i++) {
    const pz = z - d / 2 + (i * d) / m;
    c.mb.box(x - w / 2, y, pz, 0.8, 1.0, 1.1, color);
    c.mb.box(x + w / 2, y, pz, 0.8, 1.0, 1.1, color);
  }
}

function templeClassical(c: Ctx, x: number, z: number, w: number, d: number, cols: number, rows: number, colH: number, stone: number, roof: number, rot = 0): void {
  const mb = c.mb;
  steps(c, x, z, w + 6, d + 6, 3, 0.5, shade(stone, 0.95), rot);
  const y = c.y + 1.5;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const W = (lx: number, lz: number): [number, number] => [x + lx * cs - lz * sn, z + lx * sn + lz * cs];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const edge = i === 0 || i === cols - 1 || j === 0 || j === rows - 1;
      if (!edge) continue;
      const [px, pz] = W(-w / 2 + (i / (cols - 1)) * w, -d / 2 + (j / (rows - 1)) * d);
      mb.cylinder(px, y, pz, 0.7, 0.6, colH, stone, 8);
      mb.box(px, y + colH, pz, 1.6, 0.4, 1.6, stone, rot);
    }
  }
  mb.box(x, y, z, w * 0.72, colH, d * 0.78, shade(stone, 0.93), rot);
  mb.box(x, y + colH + 0.4, z, w + 2.4, 1.6, d + 2.4, stone, rot);
  mb.prism(x, y + colH + 2, z, w + 3, (d + 3) * 0.22, d + 3, roof, rot);
  solid(c, x, z, w + 2, d + 2, colH + 4, rot, 'temple');
}

function ziggurat(c: Ctx, x: number, z: number, size: number, tiers: number, color: number): void {
  let w = size;
  let y = c.y;
  const tierH = 7;
  for (let i = 0; i < tiers; i++) {
    c.mb.hip(x, y - (i === 0 ? 1 : 0), z, w, tierH + (i === 0 ? 1 : 0), w * 0.9, w * 0.82, w * 0.72, shade(color, 1 - i * 0.04), 0);
    y += tierH;
    w *= 0.72;
  }
  c.mb.box(x, y, z, w * 0.7, 6, w * 0.6, shade(color, 1.1));
  c.mb.box(x, y + 6, z, w * 0.8, 0.8, w * 0.7, 0x2a5a8a);
  // grand stair up the front
  stair(c, x, c.y, z + size * 0.45 + 12, 6, 12 + size * 0.45 - size * 0.36 * 0.5, tierH * tiers, 0, -1, shade(color, 1.05));
  solid(c, x, z, size, size * 0.9, tierH * tiers, 0, 'citadel');
}

function steppedPyramid(c: Ctx, x: number, z: number, size: number, tiers: number, color: number, stairColor: number, twin = false): void {
  const tierH = size / (tiers * 2.2);
  for (let i = 0; i < tiers; i++) {
    const s = size * (1 - i / (tiers + 0.6));
    c.mb.box(x, c.y + i * tierH - (i === 0 ? 1 : 0), z, s, tierH + (i === 0 ? 1 : 0), s, shade(color, 1 - i * 0.03));
  }
  const top = c.y + tiers * tierH;
  const topS = size * (1 - tiers / (tiers + 0.6));
  if (twin) {
    c.mb.box(x - topS * 0.25, top, z, topS * 0.4, 5, topS * 0.5, 0xc83a2a);
    c.mb.box(x + topS * 0.25, top, z, topS * 0.4, 5, topS * 0.5, 0x2a6ab0);
    stair(c, x - topS * 0.25, c.y, z + size / 2, topS * 0.3, size / 2 - topS * 0.25, tiers * tierH, 0, -1, stairColor);
    stair(c, x + topS * 0.25, c.y, z + size / 2, topS * 0.3, size / 2 - topS * 0.25, tiers * tierH, 0, -1, stairColor);
  } else {
    c.mb.box(x, top, z, topS * 0.6, 5, topS * 0.6, shade(color, 1.1));
    c.mb.box(x, top + 5, z, topS * 0.5, 3, topS * 0.3, 0xd9cfb0);
    stair(c, x, c.y, z + size / 2, 6, size / 2 - topS * 0.3, tiers * tierH, 0, -1, stairColor);
  }
  solid(c, x, z, size, size, tiers * tierH, 0, 'citadel');
}

function pagodaTower(c: Ctx, x: number, z: number, w: number, tiers: number, wall: number, roof: number): void {
  const fh = 4;
  for (let i = 0; i < tiers; i++) {
    const s = 1 - i * 0.1;
    c.mb.box(x, c.y + i * fh, z, w * s, fh, w * s, wall);
    c.mb.hip(x, c.y + (i + 1) * fh - 0.5, z, w * s + 4, 1.4, w * s + 4, w * s * 0.9, w * s * 0.9, roof);
  }
  c.mb.hip(x, c.y + tiers * fh, z, w * (1 - tiers * 0.1) + 2, 4, w * (1 - tiers * 0.1) + 2, 0, 0, roof);
  c.mb.cylinder(x, c.y + tiers * fh + 4, z, 0.3, 0.1, 4, 0xd9a52a, 6);
  solid(c, x, z, w + 1, w + 1, tiers * fh, 0, 'tower');
}

export function buildShip(mb: MeshBuilder, x: number, y: number, z: number, kind: Era['ships'], rot: number, rng: Rng): void {
  const hull = shade(0x6a4a30, rng.range(0.85, 1.1));
  switch (kind) {
    case 'reed':
      mb.hip(x, y - 0.4, z, 7, 1.0, 1.8, 5, 1.2, 0xc9b06a, rot);
      mb.cylinder(x + Math.cos(rot) * 3.4, y, z + Math.sin(rot) * 3.4, 0.3, 0.05, 2.2, 0xc9b06a, 5);
      break;
    case 'barque':
      mb.hip(x, y - 0.4, z, 12, 1.4, 3, 9, 2.4, hull, rot);
      mb.cylinder(x, y, z, 0.2, 0.15, 8, 0x5a4330, 5);
      mb.prism(x, y + 3.5, z, 0.3, 4, 6, 0xf0e8d0, rot + Math.PI / 2);
      break;
    case 'galley':
      mb.hip(x, y - 0.5, z, 20, 1.6, 4, 17, 3.2, hull, rot);
      mb.box(x, y + 1.1, z, 17, 0.5, 3.4, shade(hull, 1.1), rot);
      mb.cylinder(x, y + 1, z, 0.25, 0.18, 10, 0x5a4330, 5);
      mb.box(x, y + 7, z, 9, 0.2, 0.2, 0x5a4330, rot);
      mb.prism(x, y + 3.5, z, 0.3, 3.5, 8, 0xf0e8d0, rot + Math.PI / 2);
      for (let i = -3; i <= 3; i++) {
        for (const s of [-1, 1]) {
          const px = x + Math.cos(rot) * i * 2.2 - Math.sin(rot) * s * 2.4;
          const pz = z + Math.sin(rot) * i * 2.2 + Math.cos(rot) * s * 2.4;
          mb.box(px, y + 0.9, pz, 0.15, 0.15, 2.2, 0x8a6a40, rot + s * 0.5);
        }
      }
      break;
    case 'longship':
      mb.hip(x, y - 0.5, z, 18, 1.4, 3.2, 14, 2.6, hull, rot);
      mb.box(x + Math.cos(rot) * 8.5, y + 0.5, z + Math.sin(rot) * 8.5, 0.8, 3.5, 0.8, hull, rot);
      mb.cylinder(x, y + 0.9, z, 0.22, 0.16, 9, 0x5a4330, 5);
      mb.box(x, y + 6, z, 0.3, 4.5, 8, rng.pick([0xc83a2a, 0xe8e0d0]), rot);
      for (let i = -3; i <= 3; i++) {
        for (const s of [-1, 1]) {
          const px = x + Math.cos(rot) * i * 2 - Math.sin(rot) * s * 1.7;
          const pz = z + Math.sin(rot) * i * 2 + Math.cos(rot) * s * 1.7;
          mb.cylinder(px, y + 0.9, pz, 0.5, 0.5, 0.12, rng.pick([0xc83a2a, 0xd9a52a, 0x2a6ab0]), 8);
        }
      }
      break;
    case 'junk':
      mb.hip(x, y - 0.5, z, 14, 1.8, 4, 12, 3.4, hull, rot);
      mb.box(x - Math.cos(rot) * 3, y + 1.3, z - Math.sin(rot) * 3, 5, 1.6, 3.6, shade(hull, 1.1), rot);
      mb.cylinder(x, y + 1.2, z, 0.2, 0.15, 10, 0x5a4330, 5);
      mb.box(x, y + 4, z, 0.3, 6, 6, 0xc9b890, rot);
      break;
    case 'galleon':
      mb.hip(x, y - 0.8, z, 26, 2.6, 7, 22, 5.5, hull, rot);
      mb.box(x - Math.cos(rot) * 8, y + 1.8, z - Math.sin(rot) * 8, 8, 3, 6, shade(hull, 1.1), rot);
      mb.box(x + Math.cos(rot) * 6, y + 1.8, z + Math.sin(rot) * 6, 6, 1.6, 5.5, shade(hull, 1.05), rot);
      for (const m of [-6, 1, 8]) {
        const mh = m === 1 ? 20 : 15;
        mb.cylinder(x + Math.cos(rot) * m, y + 1.8, z + Math.sin(rot) * m, 0.3, 0.2, mh, 0x5a4330, 5);
        mb.box(x + Math.cos(rot) * m, y + 1.8 + mh * 0.45, z + Math.sin(rot) * m, 0.4, mh * 0.35, 7, 0xeee6d2, rot);
        mb.box(x + Math.cos(rot) * m, y + 1.8 + mh * 0.75, z + Math.sin(rot) * m, 0.4, mh * 0.22, 5, 0xeee6d2, rot);
      }
      mb.box(x - Math.cos(rot) * 12.5, y + 10, z - Math.sin(rot) * 12.5, 0.2, 2, 3, 0x111111, rot);
      break;
    case 'steamer':
      mb.hip(x, y - 1, z, 34, 3.4, 8, 32, 7, 0x2a2a2a, rot);
      mb.box(x, y + 2.3, z, 20, 2.4, 6.5, 0xe8e0d0, rot);
      mb.cylinder(x + Math.cos(rot) * 3, y + 4.7, z + Math.sin(rot) * 3, 1.3, 1.2, 7, 0xb03020, 8);
      mb.cylinder(x + Math.cos(rot) * 3, y + 11.5, z + Math.sin(rot) * 3, 1.4, 1.4, 0.8, 0x111111, 8);
      mb.cylinder(x - Math.cos(rot) * 12, y + 2.3, z - Math.sin(rot) * 12, 0.2, 0.15, 10, 0x4a4a4a, 5);
      break;
    case 'canoe':
      mb.hip(x, y - 0.3, z, 6, 0.7, 1.2, 4.5, 0.8, hull, rot);
      break;
    case 'none':
      break;
  }
}

function quay(c: Ctx, shipKind: Era['ships'], stone: number, n: number): void {
  const { mb, x, z, rng } = c;
  // two piers reaching into the water
  for (const px of [x - 30, x + 30]) {
    mb.box(px, c.y - 1, z + 30, 8, 2.2, 70, stone);
    solid(c, px, z + 30, 8, 70, 2.2);
    for (let i = 0; i < 6; i++) mb.cylinder(px + 3.6, c.y + 1.2, z + i * 12, 0.3, 0.3, 1.0, 0x3a3a3a, 5);
  }
  mb.box(x, c.y - 1, z - 10, 80, 2.2, 14, stone);
  solid(c, x, z - 10, 80, 14, 2.2);
  if (shipKind !== 'none') {
    for (let i = 0; i < n; i++) {
      const sx = x + (i - (n - 1) / 2) * 24 + rng.range(-3, 3);
      buildShip(mb, sx, -0.8, z + 45 + rng.range(-5, 12), shipKind, Math.PI / 2 + rng.range(-0.2, 0.2), rng);
    }
  }
  for (let i = 0; i < 10; i++) {
    buildProp(mb, x - 36 + i * 8, c.y + 1.2, z - 10 + rng.range(-4, 4), rng.pick(['crate', 'barrel', 'amphora']), rng, rng.range(0, 3));
  }
}

const GENERATORS: Record<string, (c: Ctx) => void> = {
  // ---------- citadels ----------
  ziggurat: (c) => {
    ziggurat(c, c.x, c.z, 110, 3, 0xc9a56c);
    wallRect(c, c.x, c.z, 200, 190, 3, 6, 0xb8945c, 2, 12);
  },
  pyramid: (c) => {
    c.mb.hip(c.x, c.y - 1, c.z, 150, 96, 150, 0, 0, 0xf2e6c8);
    solid(c, c.x, c.z, 150, 150, 96, 0, 'citadel');
    c.mb.hip(c.x + 100, c.y - 1, c.z + 60, 40, 26, 40, 0, 0, 0xe8dcb8);
    solid(c, c.x + 100, c.z + 60, 40, 40, 26);
    c.mb.hip(c.x - 100, c.y - 1, c.z + 60, 28, 18, 28, 0, 0, 0xe8dcb8);
    solid(c, c.x - 100, c.z + 60, 28, 28, 18);
    c.mb.box(c.x, c.y, c.z + 95, 30, 5, 14, 0xe0d0a8);
    solid(c, c.x, c.z + 95, 30, 14, 5);
  },
  palace_minoan: (c) => {
    const { mb, x, z } = c;
    const stone = 0xf1e7d2;
    const red = 0xb03a2a;
    mb.box(x, c.y - 1, z, 120, 1.6, 100, 0xd8ccb0);
    for (const [ox, oz, w, d, floors] of [
      [-40, -30, 36, 36, 3],
      [40, -30, 36, 30, 2],
      [-40, 30, 36, 30, 2],
      [40, 30, 36, 36, 3],
      [0, -40, 40, 16, 2],
      [0, 40, 40, 16, 1],
    ] as [number, number, number, number, number][]) {
      mb.box(x + ox, c.y, z + oz, w, floors * 3.4, d, stone);
      mb.box(x + ox, c.y + floors * 3.4, z + oz, w + 0.6, 0.6, d + 0.6, 0xd0c4a8);
      solid(c, x + ox, z + oz, w, d, floors * 3.4, 0, 'palace');
      for (let f = 0; f < floors; f++) mb.box(x + ox, c.y + f * 3.4 + 0.4, z + oz, w + 0.3, 0.5, d + 0.3, red);
    }
    // central court with inverted red columns
    for (let i = -2; i <= 2; i++) {
      mb.cylinder(x + i * 8, c.y, z - 14, 0.5, 0.8, 4, red, 8);
      mb.cylinder(x + i * 8, c.y, z + 14, 0.5, 0.8, 4, red, 8);
    }
    // horns of consecration
    for (const ox of [-55, 55]) {
      mb.box(x + ox, c.y + 1, z - 48, 8, 2, 2, stone);
      mb.hip(x + ox - 3, c.y + 3, z - 48, 2, 3, 2, 0.5, 0.5, stone);
      mb.hip(x + ox + 3, c.y + 3, z - 48, 2, 3, 2, 0.5, 0.5, stone);
    }
  },
  citadel_mycenae: (c) => {
    const { mb, x, z } = c;
    const stone = 0x9a8f78;
    wallRect(c, x, z, 170, 140, 7, 9, stone, 2, 7);
    // lion gate relief
    mb.box(x, c.y + 9, z + 70, 11, 5, 2.5, shade(stone, 1.1));
    mb.hip(x, c.y + 14, z + 70, 11, 3, 2.5, 3, 2, 0xb8a888);
    // megaron
    mb.box(x, c.y, z - 10, 40, 1.5, 30, 0xb8a888);
    mb.box(x, c.y + 1.5, z - 15, 30, 7, 20, 0xd3c4a0);
    solid(c, x, z - 15, 30, 20, 8.5, 0, 'palace');
    mb.prism(x, c.y + 8.5, z - 15, 32, 4, 22, 0x8a6d4a);
    for (let i = -1; i <= 1; i++) mb.cylinder(x + i * 7, c.y + 1.5, z - 2, 0.7, 0.6, 7, 0xb03a2a, 8);
    // houses inside
    for (let i = 0; i < 6; i++) {
      const hx = x - 60 + i * 24;
      mb.box(hx, c.y, z + 35, 12, 4, 10, 0xcdbf9c);
      solid(c, hx, z + 35, 12, 10, 4);
    }
  },
  palace_assyria: (c) => {
    const { mb, x, z } = c;
    const brick = 0xc9a56c;
    mb.box(x, c.y - 1, z, 170, 6, 140, shade(brick, 0.9));
    solid(c, x, z - 25, 170, 90, 18, 0, 'palace');
    mb.box(x, c.y + 5, z - 25, 150, 14, 80, brick);
    crenellations(c, x, c.y + 19, z - 25, 150, 80, shade(brick, 0.9));
    mb.box(x, c.y + 5, z + 45, 150, 2, 40, shade(brick, 1.05));
    // lamassu pairs at the gate
    for (const s of [-1, 1]) {
      const lx = x + s * 12;
      mb.box(lx, c.y + 5, z + 16, 4, 6, 9, 0xe8dcc0);
      mb.box(lx, c.y + 11, z + 20.5, 3, 3, 3, 0xe8dcc0);
      mb.prism(lx + s * 1.5, c.y + 9, z + 14, 7, 2.5, 1, 0xd8ccb0, Math.PI / 2);
      solid(c, lx, z + 16, 4, 9, 11);
    }
    stair(c, x, c.y - 1, z + 70, 20, 10, 6, 0, -1, shade(brick, 1.05));
    for (let i = 0; i < 5; i++) mb.cylinder(x - 40 + i * 20, c.y + 19, z - 55, 0.5, 0.4, 6, 0xd9a52a, 6);
  },
  parthenon: (c) => {
    templeClassical(c, c.x, c.z, 60, 28, 17, 8, 10, 0xf4efe4, 0xd9cfbc);
    templeClassical(c, c.x - 70, c.z + 40, 22, 12, 6, 4, 6, 0xf1ebdc, 0xb5533b);
    c.mb.box(c.x + 70, c.y, c.z + 40, 1.6, 12, 1.6, 0xd9cfbc);
    c.mb.box(c.x + 70, c.y + 12, c.z + 40, 1.2, 4, 1.2, 0xb8a24a);
  },
  palace_maurya: (c) => {
    const { mb, x, z } = c;
    const stone = 0xf2e8d0;
    mb.box(x, c.y - 1, z, 120, 2.5, 100, 0xd8c8a0);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 7; j++) {
        mb.cylinder(x - 42 + i * 12, c.y + 1.5, z - 36 + j * 12, 0.9, 0.8, 10, stone, 8);
      }
    }
    mb.box(x, c.y + 11.5, z, 100, 2.5, 84, 0x7a4a2c);
    mb.hip(x, c.y + 14, z, 100, 6, 84, 70, 54, 0x8a5a3a);
    solid(c, x, z, 100, 84, 20, 0, 'palace');
    mb.box(x, c.y + 20, z, 30, 5, 24, stone);
    mb.hip(x, c.y + 25, z, 32, 5, 26, 0, 0, 0x7a4a2c);
    // Ashoka pillar
    mb.cylinder(x + 70, c.y, z + 50, 1.2, 1.0, 14, 0xe9dfc8, 10);
    mb.dome(x + 70, c.y + 14, z + 50, 1.6, 0xd9c08a, 8, 2);
    mb.box(x + 70, c.y + 15.5, z + 50, 2.6, 2.4, 2.6, 0xd9c08a);
  },
  capitol_rome: (c) => {
    templeClassical(c, c.x, c.z, 48, 30, 8, 6, 12, 0xf4efe4, 0xb04f36);
    templeClassical(c, c.x - 75, c.z + 30, 20, 14, 6, 4, 7, 0xf1ebdc, 0xb04f36);
    templeClassical(c, c.x + 75, c.z + 30, 20, 14, 6, 4, 7, 0xf1ebdc, 0xb04f36);
    // equestrian statue
    c.mb.box(c.x, c.y, c.z + 50, 4, 3, 7, 0xd8d0c0);
    c.mb.box(c.x, c.y + 3, c.z + 50, 1.6, 2, 5, 0x8a7a5a);
    c.mb.box(c.x, c.y + 5, c.z + 50, 1.2, 2.4, 1.2, 0x8a7a5a);
    solid(c, c.x, c.z + 50, 4, 7, 7);
  },
  pyramid_maya: (c) => {
    steppedPyramid(c, c.x, c.z, 90, 9, 0xd8ccb0, 0xc8b898);
    steppedPyramid(c, c.x + 85, c.z - 50, 40, 5, 0xd0c4a8, 0xc8b898);
    steppedPyramid(c, c.x - 85, c.z - 50, 34, 4, 0xd0c4a8, 0xc8b898);
  },
  great_hall: (c) => {
    const { mb, x, z } = c;
    mb.box(x, c.y - 1, z, 44, 6, 14, 0x5c4630);
    solid(c, x, z, 44, 14, 12, 0, 'hall');
    mb.prism(x, c.y + 5, z, 48, 8, 20, 0x8a7a4a);
    for (const s of [-1, 1]) {
      mb.box(x + s * 24.5, c.y + 12, z, 1, 2.5, 0.4, 0x3a2a1a, 0.5);
      mb.box(x + s * 24.5, c.y + 12, z, 1, 2.5, 0.4, 0x3a2a1a, -0.5);
    }
    fence(c, x, z, 90, 60, 0x5a4a3a, 2.5);
    for (let i = 0; i < 5; i++) buildProp(mb, x - 30 + i * 15, c.y, z + 22, 'runestone', c.rng, c.rng.range(0, 3));
    buildProp(mb, x, c.y, z - 20, 'campfire', c.rng);
  },
  angkor: (c) => {
    const { mb, x, z } = c;
    const stone = 0x9a9078;
    // moat
    mb.groundQuad(x - 115, z - 115, x + 115, z - 115, x + 115, z + 115, x - 115, z + 115, c.y + 0.05, c.era.water);
    mb.box(x, c.y - 1, z, 170, 3, 170, 0xa89e86);
    mb.box(x, c.y + 2, z, 130, 4, 130, stone);
    mb.box(x, c.y + 6, z, 80, 6, 80, shade(stone, 1.05));
    solid(c, x, z, 130, 130, 12, 0, 'temple');
    const tower = (tx: number, tz: number, h: number, base: number): void => {
      const n = 5;
      for (let i = 0; i < n; i++) {
        const s = base * (1 - i / n);
        mb.box(tx, c.y + 12 + (i * h) / n, tz, s, h / n, s, shade(stone, 1 + i * 0.03));
      }
      mb.hip(tx, c.y + 12 + h, tz, base * 0.3, 4, base * 0.3, 0, 0, shade(stone, 1.1));
    };
    tower(x, z, 30, 16);
    for (const [ox, oz] of [
      [-28, -28],
      [28, -28],
      [28, 28],
      [-28, 28],
    ]) tower(x + ox, z + oz, 22, 12);
    // causeway over the moat
    mb.box(x, c.y + 0.2, z + 120, 12, 2.5, 60, 0xa89e86);
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) mb.cylinder(x + s * 6, c.y + 2.7, z + 95 + i * 10, 0.4, 0.3, 1.2, stone, 6);
    }
    // naga heads
    for (const s of [-1, 1]) mb.hip(x + s * 7, c.y + 2.7, z + 148, 3, 3, 2, 1, 1, shade(stone, 1.1));
  },
  khan_ordu: (c) => {
    const { mb, x, z, rng } = c;
    mb.cylinder(x, c.y - 0.5, z, 16, 16, 4.5, 0xf9f6ee, 16);
    mb.cylinder(x, c.y + 4, z, 16.8, 0, 6, 0xd9a52a, 16);
    solid(c, x, z, 30, 30, 10, 0, 'hall');
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const gx = x + Math.cos(a) * 45;
      const gz = z + Math.sin(a) * 45;
      mb.cylinder(gx, c.y - 0.3, gz, 4.5, 4.5, 2.2, 0xf0ece0, 10);
      mb.cylinder(gx, c.y + 1.9, gz, 4.8, 0, 2.2, 0xe4ded0, 10);
      solid(c, gx, gz, 9, 9, 4);
    }
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      mb.cylinder(x + Math.cos(a) * 22, c.y, z + Math.sin(a) * 22, 0.15, 0.1, 7, 0x3a2a1a, 5);
      mb.cylinder(x + Math.cos(a) * 22, c.y + 6.5, z + Math.sin(a) * 22, 0.7, 0.1, 1.2, 0xe8e0d0, 5);
    }
    buildProp(mb, x + 30, c.y, z - 20, 'campfire', rng);
    buildProp(mb, x - 32, c.y, z + 18, 'campfire', rng);
  },
  templo_mayor: (c) => {
    steppedPyramid(c, c.x, c.z, 90, 6, 0xf1ebdc, 0xe0d6bc, true);
    wallRect(c, c.x, c.z, 210, 200, 3, 4, 0xe6dcc4, 2, 16);
    for (const ox of [-70, 70]) {
      steppedPyramid(c, c.x + ox, c.z + 40, 30, 4, 0xe9e0cc, 0xd8ccb0);
    }
    c.mb.cylinder(c.x - 60, c.y, c.z - 60, 10, 10, 6, 0xd9cfb5, 12);
    c.mb.cylinder(c.x - 60, c.y + 6, c.z - 60, 10.5, 0, 4, 0xc8b898, 12);
    solid(c, c.x - 60, c.z - 60, 20, 20, 10);
  },
  castle_japan: (c) => {
    const { mb, x, z } = c;
    const stone = 0x6f6f68;
    mb.hip(x, c.y - 1, z, 120, 14, 110, 90, 80, stone);
    solid(c, x, z, 100, 90, 14, 0, 'castle');
    wallRect(c, x, z, 92, 82, 2, 3, 0xf0e8d4, 2, 8);
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const s = 1 - i * 0.14;
      const w = 40 * s;
      const d = 34 * s;
      const yy = c.y + 13 + i * 5;
      mb.box(x, yy, z, w, 5, d, 0xf3ede0);
      mb.hip(x, yy + 4.6, z, w + 5, 1.8, d + 5, w * 0.92, d * 0.92, 0x2e2e32);
      mb.box(x, yy + 1.8, z, w + 0.2, 1.2, d + 0.2, 0x2a2a2e);
    }
    mb.hip(x, c.y + 13 + tiers * 5, z, 40 * (1 - tiers * 0.14) + 3, 6, 34 * (1 - tiers * 0.14) + 3, 0, 0, 0x2e2e32);
    for (const s of [-1, 1]) mb.box(x + s * 2, c.y + 13 + tiers * 5 + 6, z, 1.2, 1.8, 0.4, 0xd9a52a, 0.6 * s);
    stair(c, x, c.y - 1, z + 70, 10, 16, 14, 0, -1, shade(stone, 1.1));
  },
  fort_stone: (c) => {
    const { mb, x, z, rng } = c;
    const stone = 0x8a8a80;
    wallRect(c, x, z, 110, 90, 6, 8, stone, 2, 8);
    for (const [cx, cz] of [
      [-55, -45],
      [55, -45],
      [55, 45],
      [-55, 45],
    ]) {
      mb.hip(x + cx, c.y - 1, z + cz, 22, 9, 22, 16, 16, stone, Math.PI / 4);
      solid(c, x + cx, z + cz, 20, 20, 9, Math.PI / 4);
    }
    mb.box(x, c.y, z - 10, 30, 7, 16, 0xe9dfc8);
    mb.prism(x, c.y + 7, z - 10, 32, 4, 18, 0x6a4a3a);
    solid(c, x, z - 10, 30, 16, 11, 0, 'hall');
    for (let i = 0; i < 6; i++) buildProp(mb, x - 40 + i * 16, c.y, z - 36, 'cannon', rng, Math.PI / 2);
    mb.cylinder(x, c.y, z + 20, 0.2, 0.15, 14, 0x5a4a3a, 5);
    mb.box(x + 2, c.y + 12, z + 20, 4, 2.5, 0.2, 0x111111);
  },
  fort_timber: (c) => {
    const { mb, x, z } = c;
    const wood = 0x7a5a3a;
    for (let i = 0; i < 4; i++) {
      const horiz = i % 2 === 0;
      const len = horiz ? 90 : 70;
      const n = Math.floor(len / 1.2);
      for (let k = 0; k < n; k++) {
        const t = -len / 2 + k * 1.2;
        const px = horiz ? x + t : x + (i === 1 ? 45 : -45);
        const pz = horiz ? z + (i === 0 ? -35 : 35) : z + t;
        if (i === 2 && Math.abs(t) < 4) continue;
        mb.cylinder(px, c.y - 0.5, pz, 0.6, 0.45, 5.5 + (k % 3) * 0.3, wood, 5);
      }
      if (horiz) solid(c, x, z + (i === 0 ? -35 : 35), 90, 1.4, 5.5);
      else solid(c, x + (i === 1 ? 45 : -45), z, 1.4, 70, 5.5);
    }
    mb.box(x + 35, c.y + 5, z - 28, 8, 4, 8, 0x8a6a4a);
    for (const [ox, oz] of [
      [31.5, -31.5],
      [38.5, -31.5],
      [31.5, -24.5],
      [38.5, -24.5],
    ]) mb.box(x + ox, c.y, z + oz, 0.5, 5, 0.5, wood);
    mb.hip(x + 35, c.y + 9, z - 28, 9, 3, 9, 0, 0, 0x5a4a3a);
    solid(c, x + 35, z - 28, 8, 8, 12);
    mb.box(x, c.y, z - 5, 24, 4, 12, 0x9a7a52);
    mb.prism(x, c.y + 4, z - 5, 26, 3, 14, 0x5a4a3a);
    solid(c, x, z - 5, 24, 12, 7, 0, 'hall');
    mb.cylinder(x - 20, c.y, z + 10, 0.2, 0.15, 12, 0x5a4a3a, 5);
    mb.box(x - 18, c.y + 10, z + 10, 4, 2.5, 0.2, 0x2a3a8a);
  },
  parliament: (c) => {
    const { mb, x, z } = c;
    const stone = 0xc9b89a;
    mb.box(x, c.y - 1, z, 130, 22, 40, stone);
    solid(c, x, z, 130, 40, 22, 0, 'civic');
    for (let f = 0; f < 5; f++) {
      mb.box(x, c.y + 2 + f * 4, z, 130.3, 1.4, 40.3, 0x2a2a30);
    }
    for (let i = 0; i < 14; i++) {
      mb.box(x - 60 + i * 9.2, c.y + 21, z - 20, 1.6, 6, 1.6, stone);
      mb.hip(x - 60 + i * 9.2, c.y + 27, z - 20, 2, 2.4, 2, 0, 0, shade(stone, 0.9));
      mb.box(x - 60 + i * 9.2, c.y + 21, z + 20, 1.6, 6, 1.6, stone);
      mb.hip(x - 60 + i * 9.2, c.y + 27, z + 20, 2, 2.4, 2, 0, 0, shade(stone, 0.9));
    }
    mb.prism(x, c.y + 21, z, 128, 6, 36, 0x3a3a42);
    // clock tower
    mb.box(x + 72, c.y - 1, z, 14, 60, 14, stone);
    solid(c, x + 72, z, 14, 14, 60);
    mb.box(x + 72, c.y + 52, z, 15, 5, 15, 0xe8e0d0);
    mb.box(x + 72, c.y + 54, z - 7.6, 6, 0.6, 0.3, 0x2a2a2a);
    mb.hip(x + 72, c.y + 59, z, 15, 12, 15, 0, 0, 0x3a3a42);
    mb.box(x - 72, c.y - 1, z, 18, 34, 18, stone);
    solid(c, x - 72, z, 18, 18, 34);
    mb.hip(x - 72, c.y + 33, z, 19, 10, 19, 0, 0, 0x3a3a42);
  },
  city_hall: (c) => {
    const { mb, x, z } = c;
    const stone = 0xd9d2c2;
    mb.box(x, c.y - 1, z, 90, 18, 70, stone);
    solid(c, x, z, 90, 70, 18, 0, 'civic');
    for (let i = 0; i < 10; i++) mb.cylinder(x - 36 + i * 8, c.y + 2, z + 36, 1, 0.9, 14, shade(stone, 1.05), 8);
    mb.box(x, c.y + 16, z + 36, 86, 2.5, 4, stone);
    mb.box(x, c.y + 17, z, 44, 40, 40, 0xcfc8b8);
    mb.box(x, c.y + 57, z, 30, 26, 28, 0xcac3b3);
    mb.box(x, c.y + 83, z, 18, 20, 18, 0xc4bdad);
    for (let f = 0; f < 25; f++) {
      const w = f < 10 ? 44 : f < 16 ? 30 : 18;
      const d = f < 10 ? 40 : f < 16 ? 28 : 18;
      mb.box(x, c.y + 18 + f * 3.4, z, w * 0.75, 1.2, d + 0.1, 0x1e2228);
      mb.box(x, c.y + 18 + f * 3.4, z, w + 0.1, 1.2, d * 0.75, 0x1e2228);
    }
    mb.hip(x, c.y + 103, z, 18, 10, 18, 2, 2, 0x8a8a92);
    mb.cylinder(x, c.y + 113, z, 0.6, 0.1, 18, 0x9a9aa0, 6);
    stair(c, x, c.y - 1, z + 50, 40, 12, 3, 0, -1, shade(stone, 0.95));
    mb.cylinder(x - 30, c.y + 3, z + 50, 0.2, 0.15, 16, 0x8a8a92, 5);
    mb.box(x - 28, c.y + 15, z + 50, 4, 2.5, 0.2, 0x3a5a9a);
  },

  // ---------- harbors ----------
  quay: (c) => quay(c, c.era.ships, 0xb8a888, 3),
  quay_roman: (c) => {
    quay(c, 'galley', 0xc9c0b0, 4);
    c.mb.cylinder(c.x + 60, c.y, c.z - 25, 4, 3, 24, 0xe8e0d0, 10);
    c.mb.cylinder(c.x + 60, c.y + 24, c.z - 25, 2, 0.5, 5, 0xffa030, 8);
    solid(c, c.x + 60, c.z - 25, 8, 8, 24);
  },
  longship_harbor: (c) => {
    quay(c, 'longship', 0x6a5a40, 5);
    c.mb.box(c.x - 50, c.y, c.z - 25, 14, 4, 24, 0x5c4630);
    c.mb.prism(c.x - 50, c.y + 4, c.z - 25, 16, 4, 26, 0x7a6a3a);
    solid(c, c.x - 50, c.z - 25, 14, 24, 8);
  },
  pirate_harbor: (c) => {
    quay(c, 'galleon', 0x8a7a60, 3);
    c.mb.box(c.x + 50, c.y, c.z - 28, 18, 6, 12, 0xd9c7a0);
    c.mb.prism(c.x + 50, c.y + 6, c.z - 28, 20, 4, 14, 0x5a4a3a);
    solid(c, c.x + 50, c.z - 28, 18, 12, 10, 0, 'tavern');
    c.mb.box(c.x + 50, c.y + 4, c.z - 21.8, 4, 1.2, 0.2, 0x111111);
  },
  fishing_harbor: (c) => quay(c, 'junk', 0x7a7a70, 5),
  steam_docks: (c) => {
    const { mb, x, z } = c;
    quay(c, 'steamer', 0x6a6a68, 2);
    for (const ox of [-55, 55]) {
      mb.box(x + ox, c.y, z - 40, 30, 10, 18, 0x7a5a4a);
      mb.prism(x + ox, c.y + 10, z - 40, 32, 3, 20, 0x4a4a52);
      solid(c, x + ox, z - 40, 30, 18, 13, 0, 'warehouse');
    }
    for (const ox of [-20, 20]) {
      mb.box(x + ox, c.y, z - 8, 2.5, 22, 2.5, 0x3a3a3a);
      mb.box(x + ox + 8, c.y + 20, z - 8, 20, 1.2, 1.2, 0x3a3a3a);
      solid(c, x + ox, z - 8, 2.5, 2.5, 22);
    }
  },
  railroad_depot: (c) => {
    const { mb, x, z } = c;
    // tracks along the shore
    mb.box(x, c.y + 0.05, z - 30, 160, 0.3, 1.6, 0x4a4a4a);
    for (let i = 0; i < 80; i++) mb.box(x - 80 + i * 2, c.y + 0.1, z - 30, 0.4, 0.2, 2.6, 0x5a4a3a);
    for (const s of [-0.7, 0.7]) mb.box(x, c.y + 0.3, z - 30 + s, 160, 0.15, 0.15, 0x8a8a8a);
    // locomotive
    mb.cylinder(x + 10, c.y + 1.2, z - 30, 1.2, 1.2, 8, 0x1a1a1a, 10, 0);
    mb.box(x + 10, c.y + 1.2, z - 30, 8, 2.4, 2.4, 0x1a1a1a);
    mb.box(x + 15, c.y + 1, z - 30, 3.2, 3.6, 2.8, 0x2a2a2a);
    mb.cylinder(x + 7, c.y + 3.4, z - 30, 0.6, 1.0, 2.4, 0x1a1a1a, 8);
    for (let i = 0; i < 3; i++) mb.box(x + 24 + i * 9, c.y + 1.2, z - 30, 8, 3, 2.6, i === 1 ? 0x6a3a2a : 0x4a3a2a);
    solid(c, x + 25, z - 30, 60, 3, 4);
    // depot + water tower
    mb.box(x, c.y, z - 12, 24, 4.5, 10, 0xb08a5a);
    mb.prism(x, c.y + 4.5, z - 12, 28, 2.5, 14, 0x5a4a3a);
    solid(c, x, z - 12, 24, 10, 7, 0, 'depot');
    mb.cylinder(x + 40, c.y, z - 12, 0.4, 0.3, 9, 0x5a4a3a, 5);
    mb.cylinder(x + 40, c.y + 9, z - 12, 3, 3, 4, 0x7a5a3a, 10);
    mb.cylinder(x + 40, c.y + 13, z - 12, 3.4, 0, 1.5, 0x4a3a2a, 10);
    solid(c, x + 40, z - 12, 6, 6, 14);
  },
  baray: (c) => {
    const { mb, x, z } = c;
    mb.groundQuad(x - 90, z - 60, x + 90, z - 60, x + 90, z + 60, x - 90, z + 60, c.y + 0.05, c.era.water);
    mb.box(x, c.y - 1, z, 24, 3, 24, 0x9a9078);
    pagodaTower(c, x, z, 8, 3, 0xa89e86, 0x8a8070);
  },
  chinampas: (c) => {
    const { mb, x, z, rng } = c;
    mb.groundQuad(x - 90, z - 60, x + 90, z - 60, x + 90, z + 60, x - 90, z + 60, c.y + 0.05, c.era.water);
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 5; j++) {
        const px = x - 78 + i * 22;
        const pz = z - 48 + j * 24;
        mb.box(px, c.y - 0.2, pz, 16, 1.0, 16, shade(0x5a8a3a, rng.range(0.8, 1.2)));
        for (let k = 0; k < 3; k++) mb.box(px - 6 + k * 6, c.y + 0.8, pz, 1.2, 0.8, 14, 0x4a7a2a);
        if (rng.chance(0.5)) buildTree(mb, px + 7, c.y + 0.8, pz + 7, 'palm', rng);
      }
    }
    for (let i = 0; i < 5; i++) buildShip(mb, x - 60 + i * 30, c.y - 0.6, z + 56, 'canoe', rng.range(0, 3), rng);
  },
  ferry_camp: (c) => {
    for (let i = 0; i < 6; i++) buildProp(c.mb, c.x - 40 + i * 16, c.y, c.z - 20, 'tent', c.rng, c.rng.range(0, 3));
    buildProp(c.mb, c.x, c.y, c.z + 5, 'campfire', c.rng);
    c.mb.box(c.x, c.y - 0.5, c.z + 30, 20, 1.2, 10, 0x6a5a40);
  },
  canoe_landing: (c) => {
    c.mb.box(c.x, c.y - 1, c.z + 10, 60, 1.8, 10, 0x8e7a52);
    solid(c, c.x, c.z + 10, 60, 10, 1.8);
    for (let i = 0; i < 7; i++) buildShip(c.mb, c.x - 30 + i * 10, c.y - 0.6, c.z + 24 + c.rng.range(0, 6), 'canoe', 1.3 + c.rng.range(-0.3, 0.3), c.rng);
  },

  // ---------- arenas ----------
  none: () => {},
  colosseum: (c) => {
    const { mb, x, z } = c;
    const stone = 0xe6dcc4;
    for (let t = 0; t < 3; t++) {
      const r = 60 - t * 3;
      const y = c.y + t * 9;
      const n = 40;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        mb.box(x + Math.cos(a) * r * 1.2, y, z + Math.sin(a) * r, 3.2, 7, 3, shade(stone, 1 - t * 0.04), a + Math.PI / 2 + Math.atan2(Math.sin(a) * 0.2, 1));
      }
      mb.ringWall(x, y + 7, z, r, 3.5, 2, shade(stone, 0.95), n);
    }
    mb.ringWall(x, c.y + 27, z, 55, 2, 6, shade(stone, 0.9), 40);
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2;
      c.col.push({ x: x + Math.cos(a) * 60 * 1.2, z: z + Math.sin(a) * 60, hw: 2, hd: 4, rot: a + Math.PI / 2, h: 27, tag: 'arena' });
    }
    mb.groundQuad(x - 50, z - 40, x + 50, z - 40, x + 50, z + 40, x - 50, z + 40, c.y + 0.08, 0xd9b870);
  },
  stadium: (c) => {
    const { mb, x, z } = c;
    mb.box(x, c.y - 1, z - 42, 150, 14, 24, 0x7a7a78);
    mb.box(x, c.y - 1, z + 42, 150, 14, 24, 0x7a7a78);
    solid(c, x, z - 42, 150, 24, 14, 0, 'arena');
    solid(c, x, z + 42, 150, 24, 14, 0, 'arena');
    for (let i = 0; i < 8; i++) {
      mb.box(x, c.y + 2 + i * 1.5, z - 42 + 12 - i * 3, 150, 1.5, 3, 0x9a9a98);
      mb.box(x, c.y + 2 + i * 1.5, z + 42 - 12 + i * 3, 150, 1.5, 3, 0x9a9a98);
    }
    mb.groundQuad(x - 72, z - 28, x + 72, z - 28, x + 72, z + 28, x - 72, z + 28, c.y + 0.08, 0x4f8f3a);
    for (const ox of [-70, 70]) {
      mb.cylinder(x + ox, c.y, z, 0.6, 0.4, 28, 0x4a4a4a, 6);
      mb.box(x + ox, c.y + 26, z, 4, 3, 1, 0xffffe0);
    }
  },
  theatre: (c) => {
    const { mb, x, z } = c;
    for (let t = 0; t < 9; t++) {
      mb.ringWall(x, c.y + t * 1.2, z, 18 + t * 4, 4.2, 1.2, shade(0xe8e0d0, 1 - t * 0.02), 20 + t * 2, Math.PI, Math.PI * 2);
    }
    for (let t = 0; t < 9; t += 2) c.col.push({ x, z: z - 18 - t * 4, hw: 18 + t * 4, hd: 2, rot: 0, h: 10, tag: 'arena' });
    mb.box(x, c.y, z + 12, 40, 8, 6, 0xd9cfbc);
    solid(c, x, z + 12, 40, 6, 8);
    mb.cylinder(x, c.y, z, 12, 12, 0.3, 0xcdb996, 16);
  },
  ballcourt: (c) => {
    const { mb, x, z } = c;
    for (const s of [-1, 1]) {
      mb.hip(x + s * 14, c.y - 1, z, 10, 7, 60, 4, 60, 0xd8ccb0);
      solid(c, x + s * 14, z, 10, 60, 7);
      mb.cylinder(x + s * 9.5, c.y + 4, z, 1.2, 1.2, 0.6, 0x8a8a80, 10, 0);
    }
    mb.groundQuad(x - 9, z - 30, x + 9, z - 30, x + 9, z + 30, x - 9, z + 30, c.y + 0.08, 0xcdb996);
  },
  bull_court: (c) => {
    wallRect(c, c.x, c.z, 60, 40, 1.2, 2.5, 0xf1e7d2, 2, 8);
    c.mb.groundQuad(c.x - 28, c.z - 18, c.x + 28, c.z - 18, c.x + 28, c.z + 18, c.x - 28, c.z + 18, c.y + 0.08, 0xd9b870);
    c.mb.box(c.x, c.y, c.z - 25, 6, 3, 4, 0x6a4a3a);
  },
  siege_yard: (c) => {
    const { mb, x, z } = c;
    for (let i = 0; i < 3; i++) {
      const tx = x - 30 + i * 30;
      mb.box(tx, c.y, z, 8, 18, 8, 0x7a5a3a);
      mb.box(tx, c.y + 18, z, 9, 2, 9, 0x5a4a3a);
      for (const s of [-1, 1]) mb.cylinder(tx + s * 3.5, c.y, z + 4.5, 1.2, 1.2, 0.8, 0x3a3a3a, 8);
      solid(c, tx, z, 8, 8, 18);
    }
    mb.box(x, c.y + 1.5, z + 25, 14, 1, 1, 0x5a4a3a);
    mb.box(x, c.y + 0.5, z + 25, 1, 2, 3, 0x5a4a3a);
    mb.box(x + 7, c.y + 1.5, z + 25, 1.5, 1.5, 1.5, 0x3a3a3a);
  },
  elephant_ground: (c) => {
    fence(c, c.x, c.z, 80, 60, 0x6a4a3a);
    for (let i = 0; i < 4; i++) {
      const ex = c.x - 30 + i * 20;
      c.mb.box(ex, c.y + 1.8, c.z, 6, 3.4, 3.2, 0x7a7a78);
      c.mb.box(ex + 3.5, c.y + 2.8, c.z, 2.6, 2.6, 2.4, 0x7a7a78);
      c.mb.box(ex + 5, c.y + 0.5, c.z, 0.8, 3, 0.8, 0x7a7a78);
      for (const [ox, oz] of [
        [-2, -1],
        [2, -1],
        [-2, 1],
        [2, 1],
      ]) c.mb.cylinder(ex + ox, c.y, c.z + oz, 0.5, 0.5, 1.8, 0x6a6a68, 6);
      solid(c, ex, c.z, 8, 3.2, 5);
    }
  },
  thing_mound: (c) => {
    c.mb.dome(c.x, c.y - 2, c.z, 22, 0x5f7a44, 14, 4);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      buildProp(c.mb, c.x + Math.cos(a) * 32, c.y, c.z + Math.sin(a) * 32, 'runestone', c.rng, a);
    }
    solid(c, c.x, c.z, 20, 20, 8);
  },
  elephant_terrace: (c) => {
    c.mb.box(c.x, c.y - 1, c.z, 100, 4, 20, 0x9a9078);
    solid(c, c.x, c.z, 100, 20, 4);
    for (let i = 0; i < 6; i++) {
      const ex = c.x - 40 + i * 16;
      c.mb.box(ex, c.y + 1, c.z + 11, 5, 3, 2.5, 0x8a8070);
      c.mb.box(ex, c.y + 0, c.z + 13, 1.2, 2, 1.2, 0x8a8070);
    }
  },
  horse_field: (c) => {
    fence(c, c.x, c.z, 90, 70, 0x6a5a40, 4);
    for (let i = 0; i < 6; i++) {
      const hx = c.x - 30 + i * 12;
      const hz = c.z + c.rng.range(-20, 20);
      c.mb.box(hx, c.y + 1.2, hz, 2.4, 1.3, 0.9, c.rng.pick([0x5a4030, 0x8a7050, 0x2a2a2a]), c.rng.range(0, 3));
      c.mb.box(hx + 1.3, c.y + 1.8, hz, 1.0, 1.0, 0.6, 0x5a4030);
    }
  },
  drill_ground: (c) => {
    fence(c, c.x, c.z, 70, 50, 0x6a5a40, 4);
    for (let i = 0; i < 5; i++) {
      c.mb.box(c.x - 24 + i * 12, c.y, c.z - 20, 0.3, 2.2, 0.3, 0x5a4a3a);
      c.mb.cylinder(c.x - 24 + i * 12, c.y + 1.2, c.z - 19.8, 0.7, 0.7, 0.1, 0xe8e0d0, 8, 0);
    }
  },
  gallows_green: (c) => {
    c.mb.box(c.x, c.y, c.z, 8, 1.2, 6, 0x6a5a40);
    c.mb.box(c.x - 3, c.y + 1.2, c.z, 0.4, 5, 0.4, 0x5a4a3a);
    c.mb.box(c.x - 0.5, c.y + 6, c.z, 5.5, 0.4, 0.4, 0x5a4a3a);
    solid(c, c.x, c.z, 8, 6, 2);
    for (let i = 0; i < 4; i++) buildTree(c.mb, c.x - 30 + i * 20, c.y, c.z + 25, 'palm', c.rng);
  },
  corral: (c) => {
    fence(c, c.x, c.z, 60, 44, 0x8a6a4a, 3);
    for (let i = 0; i < 8; i++) {
      const hx = c.x + c.rng.range(-25, 25);
      const hz = c.z + c.rng.range(-18, 18);
      c.mb.box(hx, c.y + 1.0, hz, 2.2, 1.2, 0.9, c.rng.pick([0x5a4030, 0x8a7050, 0xd8d0c0]), c.rng.range(0, 3));
    }
  },
  crystal_palace: (c) => {
    const { mb, x, z } = c;
    const glass = 0x9fd0e8;
    mb.box(x, c.y - 1, z, 140, 14, 50, glass);
    mb.prism(x, c.y + 13, z, 142, 8, 52, 0xb8e0f0);
    mb.box(x, c.y + 13, z, 60, 10, 30, glass);
    mb.hip(x, c.y + 23, z, 62, 8, 32, 50, 20, 0xb8e0f0);
    for (let i = 0; i < 24; i++) mb.box(x - 69 + i * 6, c.y - 1, z, 0.5, 14, 50.4, 0xe8e8e8);
    solid(c, x, z, 140, 50, 22, 0, 'civic');
  },

  // ---------- plazas ----------
  temple_sumer: (c) => {
    wallRect(c, c.x, c.z, 50, 40, 2, 4, 0xc4a46c, 2, 6);
    c.mb.box(c.x, c.y, c.z - 5, 24, 8, 16, 0xd2b483);
    solid(c, c.x, c.z - 5, 24, 16, 8, 0, 'temple');
  },
  temple_egypt: (c) => {
    const { mb, x, z } = c;
    for (const s of [-1, 1]) {
      mb.hip(x + s * 14, c.y - 1, z + 30, 16, 16, 7, 12, 5, 0xe8d8ad);
      solid(c, x + s * 14, z + 30, 16, 7, 16);
      buildProp(mb, x + s * 26, c.y, z + 40, 'obelisk', c.rng);
    }
    mb.box(x, c.y + 10, z + 30, 12, 6, 6, 0xe0d0a8);
    mb.box(x, c.y, z - 5, 44, 9, 50, 0xf0dfb4);
    solid(c, x, z - 5, 44, 50, 9, 0, 'temple');
    for (let i = 0; i < 6; i++) mb.cylinder(x - 15 + i * 6, c.y, z + 22, 1.0, 0.9, 8, 0xe8dcc0, 8);
  },
  court_minoan: (c) => {
    c.mb.groundQuad(c.x - 30, c.z - 20, c.x + 30, c.z - 20, c.x + 30, c.z + 20, c.x - 30, c.z + 20, c.y + 0.08, 0xe8dcc0);
    for (let i = 0; i < 4; i++) c.mb.cylinder(c.x - 18 + i * 12, c.y, c.z - 18, 0.5, 0.8, 4, 0xb03a2a, 8);
    buildProp(c.mb, c.x, c.y, c.z, 'fountain', c.rng);
  },
  tholos: (c) => {
    c.mb.dome(c.x, c.y - 2, c.z, 16, 0x7f7f74, 14, 4);
    c.mb.box(c.x, c.y, c.z + 14, 6, 6, 8, 0x9a8f78);
    solid(c, c.x, c.z, 28, 28, 12, 0, 'tomb');
  },
  lamassu_gate: (c) => {
    for (const s of [-1, 1]) {
      c.mb.box(c.x + s * 8, c.y, c.z, 6, 9, 10, 0xcfae78);
      c.mb.box(c.x + s * 8, c.y + 2, c.z + 6, 3.5, 5, 7, 0xe8dcc0);
      c.mb.box(c.x + s * 8, c.y + 7, c.z + 9, 2.4, 2.6, 2.4, 0xe8dcc0);
      solid(c, c.x + s * 8, c.z + 2, 6, 16, 9);
    }
    c.mb.box(c.x, c.y + 9, c.z, 22, 2.5, 10, 0xc9a56c);
  },
  agora: (c) => {
    c.mb.groundQuad(c.x - 50, c.z - 40, c.x + 50, c.z - 40, c.x + 50, c.z + 40, c.x - 50, c.z + 40, c.y + 0.08, 0xd9d0bd);
    for (let i = 0; i < 5; i++) buildProp(c.mb, c.x - 40 + i * 20, c.y, c.z - 30, 'statue', c.rng, Math.PI / 2);
    buildProp(c.mb, c.x, c.y, c.z, 'fountain', c.rng);
    for (let i = 0; i < 6; i++) buildProp(c.mb, c.x - 25 + i * 10, c.y, c.z + 30, 'stall', c.rng, 0);
    c.mb.cylinder(c.x + 40, c.y, c.z + 30, 4, 4, 1, 0xe8e0d0, 10);
    c.mb.box(c.x + 40, c.y + 1, c.z + 30, 1.6, 1.2, 1.6, 0xe8e0d0);
  },
  ashoka_pillar: (c) => {
    c.mb.cylinder(c.x, c.y, c.z, 1.3, 1.0, 16, 0xe9dfc8, 12);
    c.mb.dome(c.x, c.y + 16, c.z, 1.8, 0xd9c08a, 8, 2);
    c.mb.box(c.x, c.y + 17.8, c.z, 3, 2.6, 3, 0xd9c08a);
    solid(c, c.x, c.z, 3, 3, 20);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      buildTree(c.mb, c.x + Math.cos(a) * 30, c.y, c.z + Math.sin(a) * 30, 'jungle', c.rng);
    }
  },
  forum: (c) => {
    c.mb.groundQuad(c.x - 60, c.z - 40, c.x + 60, c.z - 40, c.x + 60, c.z + 40, c.x - 60, c.z + 40, c.y + 0.08, 0xd9d0bd);
    for (let i = 0; i < 8; i++) {
      c.mb.cylinder(c.x - 42 + i * 12, c.y, c.z - 34, 0.8, 0.7, 9, 0xf0e8d8, 8);
      c.mb.cylinder(c.x - 42 + i * 12, c.y, c.z + 34, 0.8, 0.7, 9, 0xf0e8d8, 8);
    }
    c.mb.box(c.x, c.y + 9, c.z - 34, 100, 1.2, 3, 0xe8e0d0);
    c.mb.box(c.x, c.y + 9, c.z + 34, 100, 1.2, 3, 0xe8e0d0);
    // Trajan's column
    c.mb.box(c.x, c.y, c.z, 7, 4, 7, 0xe8e0d0);
    c.mb.cylinder(c.x, c.y + 4, c.z, 1.8, 1.6, 30, 0xf0e8d8, 12);
    c.mb.box(c.x, c.y + 34, c.z, 1.2, 2.5, 1.2, 0xb8a24a);
    solid(c, c.x, c.z, 7, 7, 36);
    for (let i = 0; i < 4; i++) buildProp(c.mb, c.x - 30 + i * 20, c.y, c.z + 12, 'statue', c.rng, Math.PI);
  },
  stela_plaza: (c) => {
    c.mb.groundQuad(c.x - 40, c.z - 30, c.x + 40, c.z - 30, c.x + 40, c.z + 30, c.x - 40, c.z + 30, c.y + 0.08, 0xdccfb0);
    for (let i = 0; i < 7; i++) buildProp(c.mb, c.x - 30 + i * 10, c.y, c.z - 15, 'stele', c.rng, 0);
    for (let i = 0; i < 3; i++) buildProp(c.mb, c.x - 20 + i * 20, c.y, c.z + 15, 'altar', c.rng, 0);
  },
  runestone_ring: (c) => {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      buildProp(c.mb, c.x + Math.cos(a) * 14, c.y, c.z + Math.sin(a) * 14, 'runestone', c.rng, a + Math.PI / 2);
    }
    buildProp(c.mb, c.x, c.y, c.z, 'campfire', c.rng);
  },
  bayon_faces: (c) => {
    const stone = 0x9a9078;
    for (let i = 0; i < 4; i++) c.mb.box(c.x, c.y + i * 6, c.z, 20 - i * 3, 6, 20 - i * 3, shade(stone, 1 + i * 0.03));
    for (const [ox, oz, r] of [
      [0, -9, 0],
      [9, 0, Math.PI / 2],
      [0, 9, Math.PI],
      [-9, 0, -Math.PI / 2],
    ] as [number, number, number][]) {
      c.mb.box(c.x + ox, c.y + 14, c.z + oz, 6, 7, 2, shade(stone, 1.1), r);
      c.mb.box(c.x + ox * 1.1, c.y + 16, c.z + oz * 1.1, 1.2, 1.2, 0.5, shade(stone, 0.8), r);
    }
    c.mb.hip(c.x, c.y + 24, c.z, 10, 6, 10, 0, 0, shade(stone, 1.1));
    solid(c, c.x, c.z, 20, 20, 30, 0, 'temple');
  },
  standard_pole: (c) => {
    c.mb.cylinder(c.x, c.y, c.z, 0.4, 0.2, 12, 0x3a2a1a, 6);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      c.mb.box(c.x + Math.cos(a) * 1.2, c.y + 10, c.z + Math.sin(a) * 1.2, 0.3, 2.2, 0.3, 0x2a2a2a);
    }
    for (let i = 0; i < 6; i++) buildProp(c.mb, c.x + Math.cos(i) * 20, c.y, c.z + Math.sin(i) * 20, 'tent', c.rng, i);
  },
  skull_rack: (c) => {
    c.mb.box(c.x, c.y, c.z, 30, 1.5, 6, 0xe6dcc4);
    for (let i = 0; i < 7; i++) c.mb.box(c.x - 14 + i * 4.7, c.y + 1.5, c.z, 0.4, 6, 0.4, 0x5a4a3a);
    for (let r = 0; r < 4; r++) for (let i = 0; i < 24; i++) c.mb.box(c.x - 13.5 + i * 1.18, c.y + 2.5 + r * 1.1, c.z, 0.7, 0.7, 0.7, 0xf0ead8);
    solid(c, c.x, c.z, 30, 6, 7);
  },
  torii: (c) => {
    const red = 0xc8372d;
    for (const s of [-1, 1]) c.mb.cylinder(c.x + s * 5, c.y, c.z, 0.6, 0.5, 9, red, 8);
    c.mb.box(c.x, c.y + 8.5, c.z, 15, 0.8, 0.8, 0x2a2a2a);
    c.mb.box(c.x, c.y + 7, c.z, 12, 0.6, 0.6, red);
    solid(c, c.x - 5, c.z, 1.2, 1.2, 9);
    solid(c, c.x + 5, c.z, 1.2, 1.2, 9);
    for (let i = 0; i < 6; i++) buildProp(c.mb, c.x - 25 + i * 10, c.y, c.z + 15, 'lantern', c.rng);
    for (let i = 0; i < 4; i++) buildTree(c.mb, c.x - 30 + i * 20, c.y, c.z - 20, 'pine', c.rng);
  },
  tavern_square: (c) => {
    c.mb.box(c.x, c.y, c.z - 20, 26, 7, 14, 0xd9c7a0);
    c.mb.prism(c.x, c.y + 7, c.z - 20, 28, 4, 16, 0x5a4a3a);
    solid(c, c.x, c.z - 20, 26, 14, 11, 0, 'tavern');
    c.mb.box(c.x, c.y + 4.5, c.z - 12.7, 5, 1.4, 0.3, 0x3a2a2a);
    for (let i = 0; i < 6; i++) buildProp(c.mb, c.x - 20 + i * 8, c.y, c.z + 10, 'barrel', c.rng);
    buildProp(c.mb, c.x + 20, c.y, c.z, 'cannon', c.rng, 0.4);
    buildProp(c.mb, c.x - 20, c.y, c.z, 'signpost', c.rng, 0.3);
  },
  water_tower: (c) => {
    for (const [ox, oz] of [
      [-3, -3],
      [3, -3],
      [3, 3],
      [-3, 3],
    ]) c.mb.box(c.x + ox, c.y, c.z + oz, 0.5, 12, 0.5, 0x5a4a3a);
    c.mb.cylinder(c.x, c.y + 12, c.z, 4, 4, 5, 0x7a5a3a, 10);
    c.mb.cylinder(c.x, c.y + 17, c.z, 4.4, 0, 2, 0x4a3a2a, 10);
    solid(c, c.x, c.z, 7, 7, 19);
    for (let i = 0; i < 3; i++) buildProp(c.mb, c.x - 15 + i * 15, c.y, c.z + 15, 'wagon', c.rng, c.rng.range(0, 3));
  },
  victoria_square: (c) => {
    c.mb.groundQuad(c.x - 40, c.z - 30, c.x + 40, c.z - 30, c.x + 40, c.z + 30, c.x - 40, c.z + 30, c.y + 0.08, 0x8a8a88);
    c.mb.box(c.x, c.y, c.z, 6, 6, 6, 0x9a9a98);
    c.mb.box(c.x, c.y + 6, c.z, 2, 5, 2, 0x4a4a48);
    c.mb.box(c.x, c.y + 11, c.z, 1.4, 1.2, 1.4, 0x4a4a48);
    solid(c, c.x, c.z, 6, 6, 12);
    for (let i = 0; i < 4; i++) buildProp(c.mb, c.x - 30 + i * 20, c.y, c.z - 22, 'gaslamp', c.rng);
    buildProp(c.mb, c.x - 25, c.y, c.z + 12, 'fountain', c.rng);
    buildProp(c.mb, c.x + 25, c.y, c.z + 12, 'fountain', c.rng);
  },
  war_memorial: (c) => {
    c.mb.groundQuad(c.x - 40, c.z - 30, c.x + 40, c.z - 30, c.x + 40, c.z + 30, c.x - 40, c.z + 30, c.y + 0.08, 0x8a8a88);
    c.mb.box(c.x, c.y, c.z, 10, 2, 10, 0xb8b0a0);
    c.mb.hip(c.x, c.y + 2, c.z, 4, 22, 4, 1.5, 1.5, 0xc8c0b0);
    solid(c, c.x, c.z, 10, 10, 24);
    for (let i = 0; i < 4; i++) buildProp(c.mb, c.x - 30 + i * 20, c.y, c.z + 20, 'statue', c.rng, Math.PI);
    for (let i = 0; i < 6; i++) buildProp(c.mb, c.x - 25 + i * 10, c.y, c.z - 22, 'bench', c.rng, 0);
    for (let i = 0; i < 5; i++) buildTree(c.mb, c.x - 36 + i * 18, c.y, c.z - 28, 'oak', c.rng);
  },

  // ---------- sacred ----------
  standing_stones: (c) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.mb.box(c.x + Math.cos(a) * 20, c.y - 0.5, c.z + Math.sin(a) * 20, 2.2, 5 + (i % 3), 1.2, 0x8a8a80, a + Math.PI / 2);
      c.col.push({ x: c.x + Math.cos(a) * 20, z: c.z + Math.sin(a) * 20, hw: 1.2, hd: 0.7, rot: a + Math.PI / 2, h: 5 });
    }
    buildProp(c.mb, c.x, c.y, c.z, 'altar', c.rng);
  },
  sphinx: (c) => {
    c.mb.box(c.x, c.y - 1, c.z, 20, 10, 56, 0xe8d8ad);
    c.mb.box(c.x, c.y + 9, c.z - 22, 12, 12, 10, 0xe8d8ad);
    c.mb.box(c.x, c.y + 20, c.z - 24, 14, 4, 6, 0xd9c08a);
    c.mb.box(c.x, c.y + 4, c.z + 10, 24, 5, 30, 0xe0d0a8);
    solid(c, c.x, c.z, 24, 56, 20, 0, 'sphinx');
  },
  peak_sanctuary: (c) => {
    c.mb.dome(c.x, c.y - 4, c.z, 30, 0xb6b08a, 14, 4);
    c.mb.box(c.x, c.y + 10, c.z, 10, 5, 8, 0xf1e7d2);
    c.mb.box(c.x, c.y + 15, c.z, 11, 0.5, 9, 0xb03a2a);
    solid(c, c.x, c.z, 30, 30, 15);
  },
  grave_circle: (c) => {
    c.mb.ringWall(c.x, c.y, c.z, 22, 2, 1.5, 0x9a8f78, 24);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      buildProp(c.mb, c.x + Math.cos(a) * 10, c.y, c.z + Math.sin(a) * 10, 'stele', c.rng, a);
    }
    c.col.push({ x: c.x, z: c.z, hw: 0, hd: 0, rot: 0, h: 0 });
  },
  ziggurat_small: (c) => ziggurat(c, c.x, c.z, 50, 2, 0xc9a56c),
  oracle: (c) => {
    c.mb.cylinder(c.x, c.y - 1, c.z, 14, 14, 2, 0xf4efe4, 16);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      c.mb.cylinder(c.x + Math.cos(a) * 11, c.y + 1, c.z + Math.sin(a) * 11, 0.7, 0.6, 8, 0xf4efe4, 8);
    }
    c.mb.cylinder(c.x, c.y + 9, c.z, 13, 10, 1.5, 0xe8e0d0, 16);
    c.mb.cylinder(c.x, c.y + 10.5, c.z, 13, 0, 4, 0xb5533b, 16);
    solid(c, c.x, c.z, 24, 24, 14, 0, 'temple');
    for (let i = 0; i < 5; i++) buildTree(c.mb, c.x - 30 + i * 15, c.y, c.z + 28, 'cypress', c.rng);
  },
  great_stupa: (c) => {
    c.mb.cylinder(c.x, c.y - 1, c.z, 30, 30, 4, 0xe6d6b2, 20);
    c.mb.dome(c.x, c.y + 3, c.z, 26, 0xf1e9d4, 20, 6);
    c.mb.box(c.x, c.y + 28, c.z, 6, 3, 6, 0xd9c08a);
    c.mb.cylinder(c.x, c.y + 31, c.z, 0.4, 0.3, 6, 0x8a6a3a, 6);
    for (let i = 0; i < 3; i++) c.mb.cylinder(c.x, c.y + 33 + i * 1.3, c.z, 3 - i * 0.8, 3 - i * 0.8, 0.3, 0xd9c08a, 10);
    solid(c, c.x, c.z, 56, 56, 30, 0, 'stupa');
    for (const [ox, oz] of [
      [0, 38],
      [38, 0],
      [0, -38],
      [-38, 0],
    ]) {
      c.mb.box(c.x + ox, c.y, c.z + oz, 2, 8, 2, 0xd8c8a0);
      c.mb.box(c.x + ox, c.y + 8, c.z + oz, 8, 1.2, 1.2, 0xd8c8a0, Math.atan2(oz, ox) + Math.PI / 2);
    }
  },
  pantheon: (c) => {
    c.mb.cylinder(c.x, c.y - 1, c.z, 22, 22, 16, 0xe8dabd, 20);
    c.mb.dome(c.x, c.y + 15, c.z, 22, 0xb8b0a0, 20, 5);
    c.mb.box(c.x, c.y, c.z + 30, 30, 1.5, 16, 0xf0e8d8);
    for (let i = 0; i < 8; i++) c.mb.cylinder(c.x - 12 + i * 3.4, c.y + 1.5, c.z + 36, 0.8, 0.7, 12, 0xf4efe4, 8);
    c.mb.box(c.x, c.y + 13.5, c.z + 30, 32, 2, 18, 0xf0e8d8);
    c.mb.prism(c.x, c.y + 15.5, c.z + 30, 18, 5, 34, 0xd9cfbc, Math.PI / 2);
    solid(c, c.x, c.z, 44, 44, 30, 0, 'temple');
    solid(c, c.x, c.z + 30, 30, 16, 20);
  },
  observatory: (c) => {
    c.mb.box(c.x, c.y - 1, c.z, 36, 8, 36, 0xdccfb0);
    c.mb.cylinder(c.x, c.y + 7, c.z, 10, 9, 10, 0xe9dcc0, 12);
    c.mb.dome(c.x, c.y + 17, c.z, 9, 0xd0c4a8, 12, 3);
    solid(c, c.x, c.z, 36, 36, 26, 0, 'observatory');
    stair(c, c.x, c.y - 1, c.z + 30, 8, 12, 8, 0, -1, 0xc8b898);
  },
  hof: (c) => {
    c.mb.box(c.x, c.y - 1, c.z, 24, 8, 14, 0x4e3a28);
    c.mb.prism(c.x, c.y + 7, c.z, 28, 10, 20, 0x4f4a3a);
    c.mb.prism(c.x, c.y + 14, c.z, 14, 5, 10, 0x4f4a3a);
    solid(c, c.x, c.z, 24, 14, 20, 0, 'temple');
    for (let i = 0; i < 4; i++) buildProp(c.mb, c.x - 18 + i * 12, c.y, c.z + 14, 'totem', c.rng);
    for (let i = 0; i < 6; i++) buildTree(c.mb, c.x - 35 + i * 14, c.y, c.z - 22, 'pine', c.rng);
  },
  naga_bridge: (c) => {
    c.mb.box(c.x, c.y, c.z, 60, 2, 10, 0xa89e86);
    solid(c, c.x, c.z, 60, 10, 2);
    for (let i = 0; i < 12; i++) {
      for (const s of [-1, 1]) c.mb.box(c.x - 27 + i * 5, c.y + 2, c.z + s * 5, 1.4, 1.6, 1.0, 0x9a9078);
    }
    for (const s of [-1, 1]) {
      c.mb.hip(c.x + s * 31, c.y + 2, c.z + 5, 3, 4, 2, 1.5, 1, 0x9a9078);
      c.mb.hip(c.x + s * 31, c.y + 2, c.z - 5, 3, 4, 2, 1.5, 1, 0x9a9078);
    }
  },
  ovoo: (c) => {
    c.mb.cylinder(c.x, c.y - 0.5, c.z, 5, 1.5, 4.5, 0x8a8a80, 10);
    c.mb.cylinder(c.x, c.y + 4, c.z, 0.2, 0.1, 4, 0x5a4a3a, 5);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      c.mb.box(c.x + Math.cos(a) * 1.8, c.y + 5.5, c.z + Math.sin(a) * 1.8, 0.6, 0.6, 0.05, c.rng.pick([0x2b6fb0, 0xe8e0d0, 0xd9a52a]), a);
    }
    solid(c, c.x, c.z, 9, 9, 5);
  },
  sun_stone: (c) => {
    c.mb.box(c.x, c.y, c.z, 10, 2, 10, 0xd8ccb0);
    c.mb.cylinder(c.x, c.y + 2, c.z, 5, 5, 1.2, 0x9a8a78, 16);
    c.mb.cylinder(c.x, c.y + 3.2, c.z, 2.5, 2.5, 0.3, 0xd9a52a, 12);
    solid(c, c.x, c.z, 10, 10, 4);
    for (let i = 0; i < 4; i++) buildProp(c.mb, c.x - 15 + i * 10, c.y, c.z + 12, 'torch', c.rng);
  },
  pagoda_tower: (c) => pagodaTower(c, c.x, c.z, 12, 5, 0xb8392e, 0x3a3a3c),
  lighthouse: (c) => {
    c.mb.cylinder(c.x, c.y - 1, c.z, 5, 3.4, 26, 0xeee6d2, 12);
    for (let i = 0; i < 4; i++) c.mb.cylinder(c.x, c.y + 3 + i * 6, c.z, 5 - i * 0.4, 5 - i * 0.4, 1.4, 0xb03020, 12);
    c.mb.cylinder(c.x, c.y + 25, c.z, 3.6, 3.6, 3, 0xffe8a0, 10);
    c.mb.cylinder(c.x, c.y + 28, c.z, 4, 0, 2.5, 0x2a2a2a, 10);
    solid(c, c.x, c.z, 10, 10, 30, 0, 'lighthouse');
  },
  church_white: (c) => {
    c.mb.box(c.x, c.y - 1, c.z, 14, 7, 26, 0xf0ece0);
    c.mb.prism(c.x, c.y + 6, c.z, 16, 5, 28, 0x5a4a3a, Math.PI / 2);
    c.mb.box(c.x, c.y, c.z + 10, 5, 14, 5, 0xf0ece0);
    c.mb.hip(c.x, c.y + 14, c.z + 10, 5.5, 7, 5.5, 0, 0, 0x5a4a3a);
    solid(c, c.x, c.z, 14, 26, 11, 0, 'church');
  },
  gothic_cathedral: (c) => {
    const stone = 0x9a9a9a;
    c.mb.box(c.x, c.y - 1, c.z, 30, 26, 80, stone);
    c.mb.prism(c.x, c.y + 25, c.z, 32, 10, 82, 0x3a3a42, Math.PI / 2);
    for (const s of [-1, 1]) {
      c.mb.box(c.x + s * 12, c.y - 1, c.z + 36, 10, 50, 10, stone);
      c.mb.hip(c.x + s * 12, c.y + 49, c.z + 36, 10, 22, 10, 0, 0, shade(stone, 0.8));
      solid(c, c.x + s * 12, c.z + 36, 10, 10, 70);
    }
    for (let i = 0; i < 8; i++) {
      for (const s of [-1, 1]) c.mb.box(c.x + s * 17, c.y - 1, c.z - 30 + i * 9, 4, 14, 2, shade(stone, 0.9));
    }
    c.mb.cylinder(c.x, c.y + 35, c.z + 36, 3, 3, 0.4, 0x3a5a9a, 12, 0);
    solid(c, c.x, c.z, 30, 80, 30, 0, 'cathedral');
  },
  cathedral_stone: (c) => {
    const stone = 0x8a8278;
    c.mb.box(c.x, c.y - 1, c.z, 28, 22, 70, stone);
    c.mb.prism(c.x, c.y + 21, c.z, 30, 8, 72, 0x4a4a52, Math.PI / 2);
    c.mb.box(c.x, c.y - 1, c.z + 30, 14, 48, 14, stone);
    c.mb.hip(c.x, c.y + 47, c.z + 30, 14, 14, 14, 0, 0, 0x4a4a52);
    solid(c, c.x, c.z, 28, 70, 30, 0, 'cathedral');
    solid(c, c.x, c.z + 30, 14, 14, 60);
  },

  // ---------- markets ----------
  bazaar: (c) => {
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        buildProp(c.mb, c.x - 24 + i * 16, c.y, c.z - 16 + j * 16, 'stall', c.rng, (j % 2) * Math.PI);
        c.col.push({ x: c.x - 24 + i * 16, z: c.z - 16 + j * 16, hw: 1.5, hd: 1.0, rot: 0, h: 2 });
      }
    }
    buildProp(c.mb, c.x + 30, c.y, c.z, 'well', c.rng);
    c.col.push({ x: c.x + 30, z: c.z, hw: 1.3, hd: 1.3, rot: 0, h: 2 });
  },
  stoa_market: (c) => {
    c.mb.box(c.x, c.y - 1, c.z - 20, 80, 1.6, 14, 0xf2ece0);
    for (let i = 0; i < 16; i++) c.mb.cylinder(c.x - 37 + i * 5, c.y + 0.5, c.z - 14, 0.6, 0.5, 6, 0xf4efe4, 8);
    c.mb.box(c.x, c.y + 0.5, c.z - 23, 80, 6, 8, 0xe7dfcb);
    c.mb.box(c.x, c.y + 6.5, c.z - 20, 82, 1, 16, 0xe8e0d0);
    c.mb.prism(c.x, c.y + 7.5, c.z - 20, 84, 3, 18, 0xb5533b);
    solid(c, c.x, c.z - 23, 80, 8, 8);
    for (let i = 0; i < 6; i++) buildProp(c.mb, c.x - 30 + i * 12, c.y, c.z + 8, 'stall', c.rng, 0);
  },
  macellum: (c) => {
    c.mb.cylinder(c.x, c.y - 1, c.z, 20, 20, 1.5, 0xd9d0bd, 16);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      c.mb.cylinder(c.x + Math.cos(a) * 17, c.y + 0.5, c.z + Math.sin(a) * 17, 0.6, 0.5, 6, 0xf0e8d8, 8);
    }
    c.mb.cylinder(c.x, c.y + 6.5, c.z, 19, 19, 1, 0xe8e0d0, 16);
    c.mb.cylinder(c.x, c.y + 7.5, c.z, 19, 6, 4, 0xb04f36, 16);
    c.mb.cylinder(c.x, c.y + 0.5, c.z, 6, 6, 8, 0xe8dabd, 10);
    c.mb.dome(c.x, c.y + 8.5, c.z, 6, 0xb04f36, 10, 3);
    solid(c, c.x, c.z, 12, 12, 10);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      buildProp(c.mb, c.x + Math.cos(a) * 12, c.y + 0.5, c.z + Math.sin(a) * 12, 'stall', c.rng, a + Math.PI / 2);
    }
  },
  trading_post: (c) => {
    c.mb.box(c.x, c.y - 1, c.z, 20, 5, 12, 0x6e5436);
    c.mb.prism(c.x, c.y + 4, c.z, 22, 5, 15, 0x8a7a4a);
    solid(c, c.x, c.z, 20, 12, 9, 0, 'hall');
    for (let i = 0; i < 5; i++) buildProp(c.mb, c.x - 20 + i * 10, c.y, c.z + 12, 'stall', c.rng, 0);
    for (let i = 0; i < 6; i++) buildProp(c.mb, c.x - 15 + i * 6, c.y, c.z - 10, 'barrel', c.rng);
  },
  caravan: (c) => {
    for (let i = 0; i < 6; i++) {
      const cx = c.x - 30 + i * 12;
      c.mb.box(cx, c.y + 1.4, c.z, 3, 1.4, 1.0, 0xc9a86a, 0.3);
      c.mb.dome(cx, c.y + 2.6, c.z, 0.9, 0xb89858, 6, 2);
      c.mb.box(cx + 1.8, c.y + 1.8, c.z, 1.0, 1.4, 0.6, 0xc9a86a, 0.3);
      for (const [ox, oz] of [
        [-1, -0.4],
        [1, -0.4],
        [-1, 0.4],
        [1, 0.4],
      ]) c.mb.box(cx + ox, c.y, c.z + oz, 0.25, 1.4, 0.25, 0xb89858);
    }
    for (let i = 0; i < 4; i++) buildProp(c.mb, c.x - 20 + i * 14, c.y, c.z + 16, 'tent', c.rng, c.rng.range(0, 3));
    for (let i = 0; i < 4; i++) buildProp(c.mb, c.x - 20 + i * 14, c.y, c.z - 14, 'stall', c.rng, 0);
  },
  tlatelolco: (c) => {
    c.mb.groundQuad(c.x - 50, c.z - 40, c.x + 50, c.z - 40, c.x + 50, c.z + 40, c.x - 50, c.z + 40, c.y + 0.08, 0xd3c9ad);
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 4; j++) {
        buildProp(c.mb, c.x - 40 + i * 16, c.y, c.z - 24 + j * 16, 'stall', c.rng, (j % 2) * Math.PI);
        c.col.push({ x: c.x - 40 + i * 16, z: c.z - 24 + j * 16, hw: 1.5, hd: 1.0, rot: 0, h: 2 });
      }
    }
    c.mb.box(c.x, c.y, c.z, 6, 3, 6, 0xf1ebdc);
    c.mb.box(c.x, c.y + 3, c.z, 4, 2, 4, 0xe9e0cc);
    solid(c, c.x, c.z, 6, 6, 5);
  },
  general_store: (c) => {
    c.mb.box(c.x, c.y - 1, c.z, 16, 7, 12, 0xc9a070);
    c.mb.box(c.x, c.y + 5, c.z + 6.2, 17, 3.5, 0.5, 0xd9cfb5);
    c.mb.prism(c.x, c.y + 6, c.z, 16, 3, 13, 0x5a4a3a);
    c.mb.box(c.x, c.y + 3, c.z + 8, 18, 0.4, 4, 0x8a6a4a);
    for (const s of [-1, 1]) c.mb.box(c.x + s * 8, c.y, c.z + 9.5, 0.3, 3.2, 0.3, 0x8a6a4a);
    solid(c, c.x, c.z, 16, 12, 9, 0, 'store');
    for (let i = 0; i < 4; i++) buildProp(c.mb, c.x - 12 + i * 8, c.y, c.z + 14, 'barrel', c.rng);
    buildProp(c.mb, c.x + 20, c.y, c.z + 6, 'wagon', c.rng, 1.2);
  },
  covered_market: (c) => {
    c.mb.box(c.x, c.y - 1, c.z, 60, 8, 36, 0x8a5a44);
    c.mb.prism(c.x, c.y + 7, c.z, 62, 6, 38, 0x9fd0e8);
    for (let i = 0; i < 11; i++) c.mb.box(c.x - 30 + i * 6, c.y + 7, c.z, 0.4, 6, 38.4, 0x3a3a3a);
    solid(c, c.x, c.z, 60, 36, 13, 0, 'market');
    for (let i = 0; i < 5; i++) buildProp(c.mb, c.x - 24 + i * 12, c.y, c.z + 24, 'stall', c.rng, 0);
  },
};

export function buildLandmark(mb: MeshBuilder, key: string, site: Site, era: Era, groundY: number, rng: Rng): Collider[] {
  const gen = GENERATORS[key];
  const col: Collider[] = [];
  if (!gen) return col;
  gen({ mb, x: site.x, z: site.z, y: groundY, rng, era, col });
  return col.filter((k) => k.hw > 0 && k.hd > 0);
}

export function landmarkKeyForSite(era: Era, siteId: string): string | null {
  const l = era.landmarks as unknown as Record<string, string>;
  const k = l[siteId];
  return k && k !== 'none' ? k : null;
}
