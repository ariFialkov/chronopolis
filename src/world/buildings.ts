import type { BuildingTemplate, Era } from '../eras/types';
import { Rng } from '../util/rng';
import { shade } from '../util/math';
import type { MeshBuilder } from './meshBuilder';
import type { Lot } from './pattern';
import type { Collider } from './collision';

const DARK_WINDOW = 0x1e2228;

export interface BuiltBuilding extends Collider {
  template: BuildingTemplate;
  doorX: number;
  doorZ: number;
}

/**
 * Builds one building from an era template on a lot. Returns its collider, or null if the
 * lot was skipped.
 */
export function buildBuilding(mb: MeshBuilder, lot: Lot, era: Era, groundY: number, rng: Rng, tmpl?: BuildingTemplate): BuiltBuilding | null {
  const t = tmpl ?? rng.weighted(era.buildings);
  const fp = rng.range(t.footprint[0], t.footprint[1]);
  let w = Math.max(3.2, lot.w * fp);
  let d = Math.max(3.2, lot.d * fp);
  if (t.round) {
    const r = Math.min(w, d);
    w = r;
    d = r;
  }
  const floors = rng.int(t.floors[0], t.floors[1]);
  const h = floors * t.floorHeight;
  const wall = shade(rng.pick(t.wallColors), rng.range(0.88, 1.08));
  const roofColor = shade(rng.pick(t.roofColors), rng.range(0.9, 1.05));
  const rot = lot.rot;
  const x = lot.x;
  const z = lot.z;
  let base = groundY;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const W = (lx: number, lz: number): [number, number] => [x + lx * cs - lz * sn, z + lx * sn + lz * cs];

  // front direction in local space
  const fa = lot.front - rot;
  const fx = Math.cos(fa);
  const fz = Math.sin(fa);
  const frontIsZ = Math.abs(fz) >= Math.abs(fx);
  const frontSign = frontIsZ ? Math.sign(fz) || 1 : Math.sign(fx) || 1;

  if (t.stilts) {
    const lift = 2.2;
    const postColor = shade(wall, 0.6);
    for (const [px, pz] of [
      [-w / 2 + 0.4, -d / 2 + 0.4],
      [w / 2 - 0.4, -d / 2 + 0.4],
      [w / 2 - 0.4, d / 2 - 0.4],
      [-w / 2 + 0.4, d / 2 - 0.4],
      [0, -d / 2 + 0.4],
      [0, d / 2 - 0.4],
    ]) {
      const [wx, wz] = W(px, pz);
      mb.box(wx, groundY - 0.5, wz, 0.35, lift + 0.5, 0.35, postColor, rot);
    }
    base = groundY + lift;
    // ladder / steps
    const [sx, sz] = frontIsZ ? W(0, (frontSign * (d / 2 + 0.6))) : W(frontSign * (w / 2 + 0.6), 0);
    mb.box(sx, groundY, sz, 1.2, lift, 1.2, shade(wall, 0.7), rot);
  }

  if (t.tent) {
    mb.cylinder(x, groundY - 0.2, z, Math.min(w, d) / 2, 0, h, wall, 8, rot);
    return { x, z, hw: w / 2 + 0.2, hd: d / 2 + 0.2, rot, h, tag: t.tag, template: t, doorX: x, doorZ: z };
  }

  if (t.round) {
    const r = w / 2;
    mb.cylinder(x, base - 1, z, r, r, h + 1, wall, 10, rot);
    if (t.trim) mb.cylinder(x, base + h * 0.35, z, r + 0.08, r + 0.08, 0.5, t.trim, 10, rot);
    if (t.roof === 'dome') mb.dome(x, base + h, z, r + 0.15, roofColor, 10, 3);
    else mb.cylinder(x, base + h, z, r + 0.5, 0, Math.max(1.5, r * 0.9), roofColor, 10, rot);
  } else if (t.courtyard && w > 7 && d > 7) {
    // four wings around a court
    const wing = Math.min(w, d) * 0.3;
    const wings: [number, number, number, number][] = [
      [0, -d / 2 + wing / 2, w, wing],
      [0, d / 2 - wing / 2, w, wing],
      [-w / 2 + wing / 2, 0, wing, d - wing * 2],
      [w / 2 - wing / 2, 0, wing, d - wing * 2],
    ];
    for (const [lx, lz, ww, dd] of wings) {
      const [wx, wz] = W(lx, lz);
      mb.box(wx, base - 1, wz, ww, h + 1, dd, wall, rot);
      addRoof(mb, t, wx, base + h, wz, ww, dd, rot, roofColor, wall, 0, true);
    }
    if (t.parapet) mb.box(x, base + h - 0.1, z, w + 0.3, 0.5, d + 0.3, shade(wall, 0.85), rot);
  } else if (t.setback && floors >= 6) {
    const h1 = h * 0.45;
    const h2 = h * 0.3;
    const h3 = h * 0.25;
    mb.box(x, base - 1, z, w, h1 + 1, d, wall, rot);
    mb.box(x, base + h1, z, w * 0.78, h2, d * 0.78, wall, rot);
    mb.box(x, base + h1 + h2, z, w * 0.55, h3, d * 0.55, wall, rot);
    windows(mb, x, base, z, w, d, Math.floor(floors * 0.45), t.floorHeight, rot, frontIsZ);
    windows(mb, x, base + h1, z, w * 0.78, d * 0.78, Math.floor(floors * 0.3), t.floorHeight, rot, frontIsZ);
    windows(mb, x, base + h1 + h2, z, w * 0.55, d * 0.55, Math.floor(floors * 0.25), t.floorHeight, rot, frontIsZ);
    mb.box(x, base + h, z, w * 0.2, 2, d * 0.2, shade(wall, 0.9), rot);
    mb.cylinder(x, base + h + 2, z, 0.3, 0.05, 6, 0x9a9aa0, 6);
  } else {
    mb.box(x, base - 1, z, w, h + 1, d, wall, rot);
    if (floors >= 2) windows(mb, x, base, z, w, d, floors, t.floorHeight, rot, frontIsZ);
    else doorFront(mb, x, base, z, w, d, rot, frontIsZ, frontSign);
    if (t.trim) mb.box(x, base, z, w + 0.2, 0.7, d + 0.2, t.trim, rot);
    addRoof(mb, t, x, base + h, z, w, d, rot, roofColor, wall, floors, false);
  }

  if (t.columns) {
    const colH = Math.min(h, t.floorHeight * 1.6);
    const colColor = shade(wall, 1.08);
    const span = frontIsZ ? w : d;
    const n = Math.max(2, Math.floor(span / 2.2));
    for (let i = 0; i < n; i++) {
      const u = -span / 2 + 0.6 + (i / (n - 1)) * (span - 1.2);
      const [cx, cz] = frontIsZ ? W(u, frontSign * (d / 2 + 0.9)) : W(frontSign * (w / 2 + 0.9), u);
      mb.cylinder(cx, base - 0.3, cz, 0.32, 0.28, colH, colColor, 7);
    }
    // porch roof
    const [px, pz] = frontIsZ ? W(0, frontSign * (d / 2 + 0.9)) : W(frontSign * (w / 2 + 0.9), 0);
    if (frontIsZ) mb.box(px, base + colH - 0.3, pz, w + 0.4, 0.5, 2.2, shade(wall, 0.95), rot);
    else mb.box(px, base + colH - 0.3, pz, 2.2, 0.5, d + 0.4, shade(wall, 0.95), rot);
  }

  if (t.chimney) {
    const [cx, cz] = W(w / 2 - 0.9, -d / 2 + 0.9);
    mb.box(cx, base + h * 0.6, cz, 0.8, h * 0.45 + 1.8, 0.8, shade(wall, 0.6), rot);
  }
  if (t.smokestack) {
    const [cx, cz] = W(w / 2 - 1.5, d / 2 - 1.5);
    mb.cylinder(cx, base, cz, 1.1, 0.8, h + 9 + rng.range(0, 6), 0x3a3230, 8);
  }
  if (t.tower) {
    const tw = Math.min(w, d) * 0.4;
    const [cx, cz] = W(-w / 2 + tw / 2, -d / 2 + tw / 2);
    const th = h * 1.6 + 2;
    mb.box(cx, base, cz, tw, th, tw, shade(wall, 0.96), rot);
    mb.hip(cx, base + th, cz, tw + 0.4, tw * 0.9, tw + 0.4, 0, 0, roofColor, rot);
  }

  const [doorX, doorZ] = frontIsZ ? W(0, frontSign * (d / 2 + 1.2)) : W(frontSign * (w / 2 + 1.2), 0);
  return { x, z, hw: w / 2 + 0.15, hd: d / 2 + 0.15, rot, h, tag: t.tag, template: t, doorX, doorZ };
}

function windows(mb: MeshBuilder, x: number, y: number, z: number, w: number, d: number, floors: number, fh: number, rot: number, frontIsZ: boolean): void {
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  for (let f = 0; f < floors; f++) {
    const wy = y + f * fh + fh * 0.4;
    const wh = fh * 0.32;
    for (const s of [-1, 1]) {
      if (frontIsZ) {
        const lz = s * (d / 2 + 0.04);
        mb.box(x - lz * sn, wy, z + lz * cs, w * 0.72, wh, 0.1, DARK_WINDOW, rot);
      } else {
        const lx = s * (w / 2 + 0.04);
        mb.box(x + lx * cs, wy, z + lx * sn, 0.1, wh, d * 0.72, DARK_WINDOW, rot);
      }
    }
  }
}

function doorFront(mb: MeshBuilder, x: number, y: number, z: number, w: number, d: number, rot: number, frontIsZ: boolean, sign: number): void {
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  if (frontIsZ) {
    const lz = sign * (d / 2 + 0.04);
    mb.box(x - lz * sn, y, z + lz * cs, 1.1, 2.0, 0.1, DARK_WINDOW, rot);
  } else {
    const lx = sign * (w / 2 + 0.04);
    mb.box(x + lx * cs, y, z + lx * sn, 0.1, 2.0, 1.1, DARK_WINDOW, rot);
  }
}

function addRoof(mb: MeshBuilder, t: BuildingTemplate, x: number, y: number, z: number, w: number, d: number, rot: number, roofColor: number, wall: number, floors: number, wing: boolean): void {
  const ov = t.overhang ?? 0.35;
  const alongX = w >= d;
  switch (t.roof) {
    case 'flat':
      if (t.parapet) mb.box(x, y - 0.1, z, w + 0.3, 0.6, d + 0.3, shade(wall, 0.85), rot);
      else mb.box(x, y, z, w + 0.1, 0.25, d + 0.1, roofColor, rot);
      if (!wing && floors >= 4) mb.box(x, y, z, Math.min(3, w * 0.3), 1.6, Math.min(3, d * 0.3), shade(wall, 0.9), rot);
      break;
    case 'gable': {
      const rh = Math.min(w, d) * 0.38;
      if (alongX) mb.prism(x, y - 0.05, z, w + ov * 2, rh, d + ov * 2, roofColor, rot);
      else mb.prism(x, y - 0.05, z, d + ov * 2, rh, w + ov * 2, roofColor, rot + Math.PI / 2);
      break;
    }
    case 'thatch': {
      const rh = Math.min(w, d) * 0.5;
      const o = Math.max(ov, 0.7);
      if (alongX) mb.prism(x, y - 0.3, z, w + o * 2, rh, d + o * 2, roofColor, rot);
      else mb.prism(x, y - 0.3, z, d + o * 2, rh, w + o * 2, roofColor, rot + Math.PI / 2);
      break;
    }
    case 'hip': {
      const rh = Math.min(w, d) * 0.32;
      mb.hip(x, y - 0.05, z, w + ov * 2, rh, d + ov * 2, alongX ? w * 0.45 : w * 0.1, alongX ? d * 0.1 : d * 0.45, roofColor, rot);
      break;
    }
    case 'pyramid':
      mb.hip(x, y - 0.05, z, w + ov * 2, Math.min(w, d) * 0.5, d + ov * 2, 0, 0, roofColor, rot);
      break;
    case 'dome':
      mb.dome(x, y - 0.1, z, Math.min(w, d) / 2, roofColor, 10, 3);
      break;
    case 'pagoda': {
      const tiers = Math.max(2, floors);
      const fh = t.floorHeight;
      for (let i = 0; i < tiers; i++) {
        const ty = y - (tiers - i) * fh + fh * 0.95;
        const o = 1.2 + i * 0.1;
        const shrink = 1 - i * 0.12;
        mb.hip(x, ty, z, w * shrink + o * 2, 1.1, d * shrink + o * 2, w * shrink, d * shrink, roofColor, rot);
      }
      mb.hip(x, y - 0.1, z, w * 0.75 + 1.6, Math.min(w, d) * 0.45, d * 0.75 + 1.6, 0, 0, roofColor, rot);
      break;
    }
    case 'stepped': {
      mb.box(x, y, z, w * 0.8, 1.6, d * 0.8, roofColor, rot);
      mb.box(x, y + 1.6, z, w * 0.55, 1.4, d * 0.55, roofColor, rot);
      mb.box(x, y + 3, z, w * 0.3, 1.2, d * 0.3, shade(roofColor, 0.9), rot);
      break;
    }
    case 'none':
      break;
  }
}
