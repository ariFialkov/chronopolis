import type { BuildingTemplate, Era, Feature, WindowStyle } from '../eras/types';
import { Rng } from '../util/rng';
import { shade } from '../util/math';
import type { MeshBuilder } from './meshBuilder';
import type { Lot } from './pattern';
import type { Collider } from './collision';
import { TILE, type Tile } from './textures';

const DARK_WINDOW = 0x1e2228;
const IRON = 0x2a2a2e;

export interface BuiltBuilding extends Collider {
  template: BuildingTemplate;
  doorX: number;
  doorZ: number;
}

function texRepeat(tile: Tile): number {
  switch (tile) {
    case TILE.BRICK:
      return 0.75;
    case TILE.STONE:
      return 0.32;
    case TILE.WOOD:
      return 0.5;
    case TILE.MUDBRICK:
      return 0.55;
    case TILE.TIMBERFRAME:
      return 0.25;
    case TILE.CONCRETE:
      return 0.35;
    case TILE.ROOFTILE:
      return 0.7;
    case TILE.THATCH:
      return 0.45;
    case TILE.SLATE:
      return 0.6;
    case TILE.GRASS:
      return 0.3;
    default:
      return 0.5;
  }
}

interface Face {
  /** face runs along local x (true) or local z (false) */
  alongX: boolean;
  sign: number;
  len: number;
  /** distance of the face from the centre */
  off: number;
}

/**
 * Builds one building from an era template on a lot. Returns its collider, or null if the
 * lot was skipped. `detail` false skips the fine features (far chunks).
 */
function rot0(lot: Lot): number {
  return lot.rot;
}

export function buildBuilding(mb: MeshBuilder, lot: Lot, era: Era, groundY: number, rng: Rng, tmpl?: BuildingTemplate, detail = true, groundAt: (x: number, z: number) => number = () => groundY): BuiltBuilding | null {
  const t = tmpl ?? rng.weighted(era.buildings);
  const F = new Set<Feature>(t.features ?? []);
  const fp = rng.range(t.footprint[0], t.footprint[1]);
  // How far this template's features stick out, so the footprint is shrunk to keep them inside the lot.
  const ov = t.overhang ?? 0.35;
  let frontOut = 0.3;
  if (F.has('porch') || t.columns) frontOut = Math.max(frontOut, 2.1);
  if (F.has('arcade')) frontOut = Math.max(frontOut, 2.1);
  if (F.has('veranda')) frontOut = Math.max(frontOut, 2.4);
  if (F.has('awning')) frontOut = Math.max(frontOut, 1.9);
  if (F.has('bay')) frontOut = Math.max(frontOut, 1.1);
  if (F.has('balcony')) frontOut = Math.max(frontOut, 1.0);
  if (F.has('sign')) frontOut = Math.max(frontOut, 0.9);
  if (t.stilts) frontOut = Math.max(frontOut, 1.6);
  let sideOut = Math.max(0.35, ov + 0.15);
  if (F.has('fireEscape')) sideOut = Math.max(sideOut, 1.3);
  if (F.has('buttress')) sideOut = Math.max(sideOut, 1.3);
  if (F.has('eaves')) sideOut = Math.max(sideOut, ov + 0.35);
  if (F.has('plinth') || F.has('cornice')) sideOut = Math.max(sideOut, 0.45);
  const fa0 = lot.front - rot0(lot);
  const frontAlongZ0 = Math.abs(Math.sin(fa0)) >= Math.abs(Math.cos(fa0));
  // usable extents inside the lot after setbacks (front/back along the front axis, sides across it)
  const lotAlong = frontAlongZ0 ? lot.d : lot.w;
  const lotAcross = frontAlongZ0 ? lot.w : lot.d;
  const usableAlong = Math.max(3.2, lotAlong - frontOut - sideOut);
  const usableAcross = Math.max(3.2, lotAcross - 2 * sideOut);
  let along = Math.max(3.2, usableAlong * fp);
  let across = Math.max(3.2, usableAcross * fp);
  if (t.round) {
    const r = Math.min(along, across);
    along = r;
    across = r;
  }
  let w = frontAlongZ0 ? across : along;
  let d = frontAlongZ0 ? along : across;
  // shift the body back so the front features land inside the lot
  const backShift = (frontOut - sideOut) / 2;
  const floors = rng.int(t.floors[0], t.floors[1]);
  const fh = t.floorHeight;
  const h = floors * fh;
  const wall = shade(rng.pick(t.wallColors), rng.range(0.88, 1.08));
  const roofColor = shade(rng.pick(t.roofColors), rng.range(0.9, 1.05));
  const accent = t.accent ?? t.trim ?? shade(wall, 0.6);
  const wallTex = (t.tex ?? TILE.PLASTER) as Tile;
  const wallRep = t.texRepeat ?? texRepeat(wallTex);
  const roofTex = (t.roofTex ?? (t.roof === 'thatch' ? TILE.THATCH : t.roof === 'flat' ? TILE.CONCRETE : TILE.ROOFTILE)) as Tile;
  const rot = lot.rot;
  const cs = Math.cos(rot);
  const sn = Math.sin(rot);
  const frontSign0 = frontAlongZ0 ? Math.sign(Math.sin(fa0)) || 1 : Math.sign(Math.cos(fa0)) || 1;
  const shiftLx = frontAlongZ0 ? 0 : -frontSign0 * backShift;
  const shiftLz = frontAlongZ0 ? -frontSign0 * backShift : 0;
  const x = lot.x + shiftLx * cs - shiftLz * sn;
  const z = lot.z + shiftLx * sn + shiftLz * cs;
  // the building stands on the highest corner of its footprint; a foundation fills down to the lowest
  const corners: [number, number][] = [
    [x + (w / 2) * cs - (d / 2) * sn, z + (w / 2) * sn + (d / 2) * cs],
    [x - (w / 2) * cs - (d / 2) * sn, z - (w / 2) * sn + (d / 2) * cs],
    [x + (w / 2) * cs + (d / 2) * sn, z + (w / 2) * sn - (d / 2) * cs],
    [x - (w / 2) * cs + (d / 2) * sn, z - (w / 2) * sn - (d / 2) * cs],
  ];
  let minY = groundY;
  let maxY = groundY;
  for (const [cx2, cz2] of corners) {
    const gy = groundAt(cx2, cz2);
    if (gy < minY) minY = gy;
    if (gy > maxY) maxY = gy;
  }
  let base = maxY + 0.05;
  const foundationDepth = base - minY + 0.6;
  const W = (lx: number, lz: number): [number, number] => [x + lx * cs - lz * sn, z + lx * sn + lz * cs];
  /** world-space outward normal of a face */
  const N = (f: Face): [number, number] => (f.alongX ? [-f.sign * sn, f.sign * cs] : [f.sign * cs, f.sign * sn]);
  /** world point on a face at local coordinate u, `out` metres outside the wall, */
  const P = (f: Face, u: number, out: number): [number, number] => (f.alongX ? W(u, f.sign * (f.off + out)) : W(f.sign * (f.off + out), u));

  const fa = lot.front - rot;
  const fx = Math.cos(fa);
  const fz = Math.sin(fa);
  const frontIsZ = Math.abs(fz) >= Math.abs(fx);
  const frontSign = frontIsZ ? Math.sign(fz) || 1 : Math.sign(fx) || 1;
  const faces: Face[] = [
    { alongX: true, sign: 1, len: w, off: d / 2 },
    { alongX: true, sign: -1, len: w, off: d / 2 },
    { alongX: false, sign: 1, len: d, off: w / 2 },
    { alongX: false, sign: -1, len: d, off: w / 2 },
  ];
  const isFront = (f: Face): boolean => f.alongX === frontIsZ && f.sign === frontSign;
  const front = faces.find(isFront)!;
  const frontRot = frontIsZ ? rot : rot + Math.PI / 2;
  const insetAt = F.has('battered') ? (y: number): number => (0.1 * Math.min(w, d) * 0.5 * (y - base)) / h : (): number => 0;
  const wallMat = (): void => mb.material(wallTex, wallRep);
  const stoneMat = (): void => mb.material(TILE.STONE, 0.35);

  if (t.stilts) {
    const lift = 2.2;
    mb.material(TILE.WOOD, 0.6);
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
      const gy = groundAt(wx, wz);
      mb.box(wx, gy - 0.5, wz, 0.35, base + lift - gy + 0.5, 0.35, postColor, rot);
    }
    base = base + lift;
    const [sx, sz] = P(front, 0, 0.7);
    mb.box(sx, groundAt(sx, sz) - 0.2, sz, 1.2, base - groundAt(sx, sz) + 0.2, 1.2, shade(wall, 0.7), rot);
    // floor slab
    mb.box(x, base - 0.25, z, w + 0.6, 0.25, d + 0.6, shade(wall, 0.8), rot);
  }

  if (t.tent) {
    mb.material(TILE.THATCH, 0.4);
    mb.cylinder(x, groundY - 0.2, z, Math.min(w, d) / 2, 0, h, wall, 8, rot);
    return { x, z, hw: w / 2 + 0.2, hd: d / 2 + 0.2, rot, h, tag: t.tag, template: t, doorX: x, doorZ: z };
  }

  // ---------------- foundation ----------------
  // a stone podium from below the lowest corner up to the floor level, slightly wider than the body
  mb.material(TILE.STONE, 0.4);
  if (t.round) mb.cylinder(x, minY - 0.6, z, w / 2 + 0.12, w / 2 + 0.12, foundationDepth, shade(wall, 0.62), 12, rot);
  else mb.box(x, minY - 0.6, z, w + 0.24, foundationDepth, d + 0.24, shade(wall, 0.62), rot, 0.8);
  // steps up to the door when the ground in front is lower than the floor
  {
    const [sx, sz] = P(front, 0, 0.9);
    const gyDoor = groundAt(sx, sz);
    const rise = base - gyDoor;
    if (rise > 0.3 && !t.stilts) {
      const steps = Math.min(6, Math.ceil(rise / 0.25));
      const run = 0.32;
      for (let i = 0; i < steps; i++) {
        const [px, pz] = P(front, 0, 0.12 + i * run);
        const sh = base - (i * rise) / steps;
        const sy = gyDoor - 0.2;
        if (frontIsZ) mb.box(px, sy, pz, 2.4, sh - sy, run + 0.02, shade(wall, 0.7), rot);
        else mb.box(px, sy, pz, run + 0.02, sh - sy, 2.4, shade(wall, 0.7), rot);
      }
    }
  }

  // ---------------- body ----------------
  wallMat();
  if (t.round) {
    const r = w / 2;
    mb.cylinder(x, base - 0.1, z, r, r, h + 0.1, wall, 12, rot);
    if (F.has('bands')) {
      mb.cylinder(x, base + 0.15, z, r + 0.06, r + 0.06, 0.35, accent, 12, rot);
      mb.cylinder(x, base + h - 0.5, z, r + 0.06, r + 0.06, 0.3, accent, 12, rot);
    }
    if (t.trim) mb.cylinder(x, base + h * 0.35, z, r + 0.08, r + 0.08, 0.5, t.trim, 12, rot);
    // door
    mb.material(TILE.WOOD, 0.6);
    const [dx, dz] = P(front, 0, 0);
    const [nx, nz] = N(front);
    mb.wallQuad(x + nx * (r + 0.04), base, z + nz * (r + 0.04), 1.1, Math.min(2.0, h * 0.8), nx, nz, t.tag === 'ger' || t.tag === 'great_ger' ? accent : 0x3a2a1a);
    void dx;
    void dz;
    mb.material(roofTex, texRepeat(roofTex));
    if (t.roof === 'dome') mb.dome(x, base + h, z, r + 0.15, roofColor, 12, 4);
    else mb.cylinder(x, base + h, z, r + 0.5, 0, Math.max(1.5, r * 0.9), roofColor, 12, rot);
  } else if (t.courtyard && w > 7 && d > 7) {
    const wing = Math.min(w, d) * 0.3;
    const wings: [number, number, number, number][] = [
      [0, -d / 2 + wing / 2, w, wing],
      [0, d / 2 - wing / 2, w, wing],
      [-w / 2 + wing / 2, 0, wing, d - wing * 2],
      [w / 2 - wing / 2, 0, wing, d - wing * 2],
    ];
    for (const [lx, lz, ww, dd] of wings) {
      const [wx, wz] = W(lx, lz);
      wallMat();
      mb.box(wx, base - 0.1, wz, ww, h + 0.1, dd, wall, rot, 0.78);
      addRoof(mb, t, wx, base + h, wz, ww, dd, rot, roofColor, wall, 0, true, roofTex);
    }
    if (t.parapet) {
      wallMat();
      mb.box(x, base + h - 0.1, z, w + 0.3, 0.5, d + 0.3, shade(wall, 0.85), rot);
    }
    // courtyard floor and a tree or fountain
    mb.material(TILE.SAND, 0.4);
    mb.box(x, base - 0.5, z, w - wing * 2, 0.55, d - wing * 2, shade(wall, 0.75), rot);
  } else if (t.setback && floors >= 6) {
    const h1 = h * 0.45;
    const h2 = h * 0.3;
    const h3 = h * 0.25;
    mb.box(x, base - 0.1, z, w, h1 + 0.1, d, wall, rot, 0.78);
    mb.box(x, base + h1, z, w * 0.78, h2, d * 0.78, wall, rot);
    mb.box(x, base + h1 + h2, z, w * 0.55, h3, d * 0.55, wall, rot);
    if (detail) {
      windows(mb, faces, W, N, P, base, Math.floor(floors * 0.45), fh, t, F, accent, wall, () => 0, isFront, 0);
      const f2 = faces.map((f) => ({ ...f, len: f.len * 0.78, off: f.off * 0.78 }));
      const f3 = faces.map((f) => ({ ...f, len: f.len * 0.55, off: f.off * 0.55 }));
      windows(mb, f2, W, N, P, base + h1, Math.floor(floors * 0.3), fh, t, F, accent, wall, () => 0, () => false, 1);
      windows(mb, f3, W, N, P, base + h1 + h2, Math.floor(floors * 0.25), fh, t, F, accent, wall, () => 0, () => false, 1);
      if (F.has('ledges')) {
        wallMat();
        mb.box(x, base + h1 - 0.2, z, w + 0.3, 0.4, d + 0.3, shade(wall, 0.85), rot);
        mb.box(x, base + h1 + h2 - 0.2, z, w * 0.78 + 0.3, 0.4, d * 0.78 + 0.3, shade(wall, 0.85), rot);
      }
    }
    wallMat();
    mb.box(x, base + h, z, w * 0.2, 2, d * 0.2, shade(wall, 0.9), rot);
    mb.material(TILE.CONCRETE, 0.5);
    mb.cylinder(x, base + h + 2, z, 0.3, 0.05, 6, 0x9a9aa0, 6);
  } else if (F.has('battered')) {
    mb.hip(x, base - 0.1, z, w, h + 0.1, d, w * 0.9, d * 0.9, wall, rot);
    if (detail) windows(mb, faces, W, N, P, base, floors, fh, t, F, accent, wall, insetAt, isFront, 0);
    if (t.parapet) mb.box(x, base + h - 0.1, z, w * 0.9 + 0.3, 0.5, d * 0.9 + 0.3, shade(wall, 0.85), rot);
  } else {
    mb.box(x, base - 0.1, z, w, h + 0.1, d, wall, rot, 0.78);
    if (detail) windows(mb, faces, W, N, P, base, floors, fh, t, F, accent, wall, insetAt, isFront, 0);
    if (t.trim && !F.has('bands')) {
      wallMat();
      mb.box(x, base, z, w + 0.2, 0.7, d + 0.2, t.trim, rot);
    }
    addRoof(mb, t, x, base + h, z, w, d, rot, roofColor, wall, floors, false, roofTex);
  }

  // ---------------- silhouette features (all detail levels) ----------------
  if (F.has('plinth')) {
    stoneMat();
    const ins = insetAt(base);
    mb.box(x, base - 0.05, z, w - ins * 2 + 0.3, 0.75, d - ins * 2 + 0.3, shade(wall, 0.72), rot);
  }
  if (F.has('cornice') && !t.round) {
    wallMat();
    const ins = insetAt(base + h);
    mb.box(x, base + h - 0.35, z, w - ins * 2 + 0.5, 0.35, d - ins * 2 + 0.5, shade(wall, 0.9), rot);
    mb.box(x, base + h - 0.65, z, w - ins * 2 + 0.25, 0.3, d - ins * 2 + 0.25, shade(wall, 0.95), rot);
  }
  if (F.has('falsefront')) {
    wallMat();
    const rise = Math.min(w, d) * 0.38;
    const [cx, cz] = P(front, 0, -0.2);
    const ffh = rise + 1.4;
    if (frontIsZ) mb.box(cx, base + h - 0.1, cz, w + 0.3, ffh, 0.4, wall, rot);
    else mb.box(cx, base + h - 0.1, cz, 0.4, ffh, d + 0.3, wall, rot);
    const [tx, tz] = P(front, 0, -0.2);
    if (frontIsZ) mb.box(tx, base + h + ffh - 0.3, tz, w + 0.7, 0.4, 0.7, shade(wall, 0.85), rot);
    else mb.box(tx, base + h + ffh - 0.3, tz, 0.7, 0.4, d + 0.7, shade(wall, 0.85), rot);
    if (F.has('sign')) {
      mb.material(TILE.WOOD, 0.5);
      const [sx, sz] = P(front, 0, 0.12);
      const [nx, nz] = N(front);
      mb.wallQuad(sx, base + h + 0.4, sz, front.len * 0.6, 0.9, nx, nz, accent);
    }
  }
  if (F.has('porch') || t.columns) {
    const colH = Math.min(h, fh * 1.6);
    const colColor = shade(wall, 1.08);
    const span = front.len;
    const n = Math.max(2, Math.floor(span / 2.2));
    const depth = 2.0;
    // floor slab (stylobate) from the lowest ground under the porch up to floor level
    const [px, pz] = P(front, 0, depth / 2);
    const gLow = Math.min(groundAt(...P(front, -span / 2, depth)), groundAt(...P(front, span / 2, depth)), groundAt(px, pz));
    stoneMat();
    if (frontIsZ) mb.box(px, gLow - 0.3, pz, span + 0.6, base - gLow + 0.3, depth + 0.3, shade(wall, 0.8), rot, 0.8);
    else mb.box(px, gLow - 0.3, pz, depth + 0.3, base - gLow + 0.3, span + 0.6, shade(wall, 0.8), rot, 0.8);
    for (let i = 0; i < n; i++) {
      const u = -span / 2 + 0.6 + (i / (n - 1)) * (span - 1.2);
      const [cx, cz] = P(front, u, depth - 0.45);
      mb.cylinder(cx, base, cz, 0.32, 0.28, colH, colColor, 8);
      mb.box(cx, base + colH - 0.05, cz, 0.8, 0.3, 0.8, colColor, rot);
    }
    wallMat();
    if (frontIsZ) mb.box(px, base + colH + 0.2, pz, w + 0.4, 0.5, depth + 0.4, shade(wall, 0.95), rot);
    else mb.box(px, base + colH + 0.2, pz, depth + 0.4, 0.5, d + 0.4, shade(wall, 0.95), rot);
  }
  if (F.has('arcade') && !t.round) {
    // ground-floor arcade along the front: pillars, lintel, arched openings
    const span = front.len;
    const n = Math.max(2, Math.round(span / 2.8));
    const step = span / n;
    const ah = fh - 0.3;
    stoneMat();
    for (let i = 0; i <= n; i++) {
      const u = -span / 2 + i * step;
      const [cx, cz] = P(front, Math.max(-span / 2 + 0.35, Math.min(span / 2 - 0.35, u)), 1.3);
      mb.box(cx, base - 0.05, cz, 0.7, ah, 0.7, shade(wall, 1.05), rot);
    }
    const [lx, lz] = P(front, 0, 0.75);
    if (frontIsZ) mb.box(lx, base + ah - 0.35, lz, span + 0.5, 0.55, 1.9, shade(wall, 0.95), rot);
    else mb.box(lx, base + ah - 0.35, lz, 1.9, 0.55, span + 0.5, shade(wall, 0.95), rot);
    const [fx2, fz2] = P(front, 0, 0.85);
    const gLow = Math.min(groundAt(...P(front, -span / 2, 1.8)), groundAt(...P(front, span / 2, 1.8)), groundAt(fx2, fz2));
    mb.material(TILE.SLAB, 0.4);
    if (frontIsZ) mb.box(fx2, gLow - 0.3, fz2, span + 0.4, base - gLow + 0.36, 1.9, shade(wall, 0.8), rot, 0.8);
    else mb.box(fx2, gLow - 0.3, fz2, 1.9, base - gLow + 0.36, span + 0.4, shade(wall, 0.8), rot, 0.8);
    if (detail) {
      mb.material(TILE.CONCRETE, 0.3);
      const [nx, nz] = N(front);
      for (let i = 0; i < n; i++) {
        const u = -span / 2 + (i + 0.5) * step;
        const [ox, oz] = P(front, u, 0.05);
        mb.archQuad(ox, base + 0.05, oz, Math.min(1.8, step - 0.9), ah - 0.6, nx, nz, DARK_WINDOW);
      }
    }
  }
  if (F.has('bay') && floors >= 2 && !t.round) {
    const nb = front.len > 11 ? 2 : 1;
    const bh = Math.min(2, floors) * fh - 0.35;
    for (let i = 0; i < nb; i++) {
      const u = nb === 1 ? -front.len * 0.22 : (i === 0 ? -1 : 1) * front.len * 0.28;
      const [bx, bz] = P(front, u, 0.45);
      wallMat();
      if (frontIsZ) mb.box(bx, base, bz, 2.6, bh, 0.9, wall, rot, 0.78);
      else mb.box(bx, base, bz, 0.9, bh, 2.6, wall, rot, 0.78);
      mb.material(roofTex, texRepeat(roofTex));
      mb.hip(bx, base + bh, bz, frontIsZ ? 3.0 : 1.3, 0.5, frontIsZ ? 1.3 : 3.0, 0, 0, roofColor, rot);
      if (detail) {
        mb.material(TILE.CONCRETE, 0.3);
        const [nx, nz] = N(front);
        for (let f = 0; f < Math.min(2, floors); f++) {
          const wy = base + f * fh + fh * 0.3;
          const [wx, wz] = P(front, u, 0.94);
          mb.wallQuad(wx, wy, wz, 1.4, Math.min(1.6, fh * 0.5), nx, nz, t.windowColor ?? DARK_WINDOW);
          // side panes
          const [tx, tz] = frontIsZ ? [cs, sn] : [-sn, cs];
          mb.wallQuad(wx + tx * 1.34, wy, wz + tz * 1.34, 0.7, Math.min(1.6, fh * 0.5), tx, tz, t.windowColor ?? DARK_WINDOW);
          mb.wallQuad(wx - tx * 1.34, wy, wz - tz * 1.34, 0.7, Math.min(1.6, fh * 0.5), -tx, -tz, t.windowColor ?? DARK_WINDOW);
        }
      }
    }
  }
  if (F.has('turret') || t.tower) {
    const tw = Math.min(w, d) * 0.4;
    const [cx, cz] = W(-w / 2 + tw / 2, -d / 2 + tw / 2);
    const th = h * 1.6 + 2;
    wallMat();
    mb.box(cx, base, cz, tw, th, tw, shade(wall, 0.96), rot, 0.8);
    mb.material(roofTex, texRepeat(roofTex));
    mb.hip(cx, base + th, cz, tw + 0.4, tw * 0.9, tw + 0.4, 0, 0, roofColor, rot);
  }
  if (t.chimney || F.has('chimneypots')) {
    const [cx, cz] = W(w / 2 - 0.9, -d / 2 + 0.9);
    mb.material(TILE.BRICK, 0.8);
    const ch = h * 0.45 + 1.8;
    mb.box(cx, base + h * 0.6, cz, 0.8, ch, 0.8, shade(wall, 0.6), rot);
    if (F.has('chimneypots')) {
      mb.material(TILE.CONCRETE, 0.5);
      mb.cylinder(cx - 0.2 * cs, base + h * 0.6 + ch, cz - 0.2 * sn, 0.14, 0.12, 0.6, 0x8a4a3a, 6);
      mb.cylinder(cx + 0.2 * cs, base + h * 0.6 + ch, cz + 0.2 * sn, 0.14, 0.12, 0.6, 0x8a4a3a, 6);
    }
  }
  if (t.smokestack) {
    const [cx, cz] = W(w / 2 - 1.5, d / 2 - 1.5);
    mb.material(TILE.BRICK, 0.8);
    mb.cylinder(cx, base, cz, 1.1, 0.8, h + 9 + rng.range(0, 6), 0x3a3230, 8);
  }
  if (F.has('crenellation') && !t.round) {
    wallMat();
    const ins = insetAt(base + h);
    for (const f of faces) {
      const n = Math.max(2, Math.floor((f.len - 1) / 1.8));
      for (let i = 0; i < n; i++) {
        const u = -f.len / 2 + 0.6 + (i / (n - 1)) * (f.len - 1.2);
        const [mx, mz] = P(f, u, -ins - 0.3);
        mb.box(mx, base + h + 0.2, mz, f.alongX ? 1.0 : 0.6, 0.8, f.alongX ? 0.6 : 1.0, shade(wall, 0.92), rot);
      }
    }
  }

  // ---------------- fine features (near chunks only) ----------------
  if (detail) {
    if (F.has('ledges') && floors >= 2 && !t.round && !t.setback) {
      wallMat();
      for (let f = 1; f < floors; f++) {
        const ins = insetAt(base + f * fh);
        mb.box(x, base + f * fh - 0.08, z, w - ins * 2 + 0.16, 0.16, d - ins * 2 + 0.16, shade(wall, 0.85), rot);
      }
    }
    if (F.has('bands') && !t.round) {
      wallMat();
      for (const yy of [base + 0.3, base + h - 0.7]) {
        const ins = insetAt(yy);
        mb.box(x, yy, z, w - ins * 2 + 0.06, 0.35, d - ins * 2 + 0.06, accent, rot);
      }
    }
    if (F.has('corners') && !t.round) {
      stoneMat();
      for (const [lx, lz] of [
        [-w / 2, -d / 2],
        [w / 2, -d / 2],
        [w / 2, d / 2],
        [-w / 2, d / 2],
      ]) {
        const [cx, cz] = W(lx, lz);
        mb.box(cx, base, cz, 0.45, h, 0.45, shade(wall, 1.1), rot);
      }
    }
    if (F.has('pilasters') && !t.round) {
      wallMat();
      for (const f of faces) {
        const n = Math.max(1, Math.round(f.len / 3.2));
        for (let i = 0; i <= n; i++) {
          const u = -f.len / 2 + (i * f.len) / n;
          const [px, pz] = P(f, Math.max(-f.len / 2 + 0.3, Math.min(f.len / 2 - 0.3, u)), 0.12);
          mb.box(px, base - 0.3, pz, f.alongX ? 0.5 : 0.3, h + 0.3, f.alongX ? 0.3 : 0.5, shade(wall, 1.06), rot);
        }
      }
    }
    if (F.has('buttress') && !t.round) {
      wallMat();
      for (const f of faces) {
        if (isFront(f)) continue;
        const n = Math.max(1, Math.floor(f.len / 4));
        for (let i = 0; i <= n; i++) {
          const u = -f.len / 2 + (i * f.len) / n;
          const [px, pz] = P(f, Math.max(-f.len / 2 + 0.5, Math.min(f.len / 2 - 0.5, u)), 0.5);
          mb.box(px, base - 0.3, pz, f.alongX ? 0.8 : 1.0, h * 0.6, f.alongX ? 1.0 : 0.8, shade(wall, 0.95), rot);
        }
      }
    }
    if (F.has('eaves') && t.roof !== 'flat' && !t.round) {
      mb.material(TILE.WOOD, 0.6);
      const ov = t.overhang ?? 0.35;
      for (const f of faces) {
        if (f.alongX !== front.alongX) continue; // brackets under the two eave-side faces only
        const n = Math.max(2, Math.floor(f.len / 2.2));
        for (let i = 0; i < n; i++) {
          const u = -f.len / 2 + 0.5 + (i / (n - 1)) * (f.len - 1);
          const [px, pz] = P(f, u, ov / 2 + 0.1);
          mb.box(px, base + h - 0.6, pz, f.alongX ? 0.25 : ov + 0.3, 0.5, f.alongX ? ov + 0.3 : 0.25, shade(roofColor, 0.75), rot);
        }
      }
    }
    if (F.has('ridge') && (t.roof === 'gable' || t.roof === 'thatch') && !t.round) {
      mb.material(TILE.WOOD, 0.6);
      const alongX = w >= d;
      const rh = (t.roof === 'thatch' ? 0.5 : 0.38) * Math.min(w, d);
      const len = (alongX ? w : d) + (t.overhang ?? 0.35) * 2;
      const rr = alongX ? rot : rot + Math.PI / 2;
      mb.box(x, base + h + rh - 0.1, z, len + 0.3, 0.28, 0.4, shade(roofColor, 0.65), rr);
      const [e1x, e1z] = alongX ? W(-len / 2, 0) : W(0, -len / 2);
      const [e2x, e2z] = alongX ? W(len / 2, 0) : W(0, len / 2);
      mb.box(e1x, base + h + rh - 0.3, e1z, 0.3, 1.1, 0.3, shade(roofColor, 0.55), rr);
      mb.box(e2x, base + h + rh - 0.3, e2z, 0.3, 1.1, 0.3, shade(roofColor, 0.55), rr);
    }
    if (F.has('horns')) {
      stoneMat();
      for (const u of [-front.len * 0.3, front.len * 0.3]) {
        const [hx, hz] = P(front, u, -0.6);
        mb.box(hx, base + h, hz, 1.6, 0.4, 0.5, 0xf4ecd8, frontRot);
        mb.hip(hx - 0.55 * Math.cos(frontRot), base + h + 0.4, hz - 0.55 * Math.sin(frontRot), 0.4, 0.8, 0.4, 0.1, 0.1, 0xf4ecd8, frontRot);
        mb.hip(hx + 0.55 * Math.cos(frontRot), base + h + 0.4, hz + 0.55 * Math.sin(frontRot), 0.4, 0.8, 0.4, 0.1, 0.1, 0xf4ecd8, frontRot);
      }
    }
    if (F.has('rooftank') && t.roof === 'flat' && !t.setback) {
      mb.material(TILE.WOOD, 0.6);
      const [tx, tz] = W(rng.range(-w / 2 + 2, w / 2 - 2), rng.range(-d / 2 + 2, d / 2 - 2));
      const ty = base + h;
      for (const [ox, oz] of [
        [-0.8, -0.8],
        [0.8, -0.8],
        [0.8, 0.8],
        [-0.8, 0.8],
      ]) mb.box(tx + ox, ty, tz + oz, 0.18, 1.6, 0.18, IRON);
      mb.cylinder(tx, ty + 1.6, tz, 1.2, 1.2, 2.2, 0x6a5a4a, 10);
      mb.cylinder(tx, ty + 3.8, tz, 1.3, 0.1, 0.7, 0x4a3a2a, 10);
    }
    if (F.has('fireEscape') && floors >= 2) {
      // on a side face (never the front)
      const side = faces.find((f) => f.alongX !== front.alongX)!;
      mb.material(TILE.CONCRETE, 0.5);
      const [nx, nz] = N(side);
      const u = -side.len * 0.2;
      for (let f = 1; f < floors; f++) {
        const py = base + f * fh + 0.1;
        const [px, pz] = P(side, u, 0.55);
        const srot = side.alongX ? rot : rot + Math.PI / 2;
        mb.box(px, py, pz, 3.0, 0.1, 1.1, IRON, srot);
        const [rx, rz] = P(side, u, 1.08);
        mb.box(rx, py, rz, 3.0, 0.95, 0.06, IRON, srot);
        // stair panel to the floor below
        const [ax, az] = P(side, u + 1.2, 1.0);
        const [bx, bz] = P(side, u - 1.2, 1.0);
        if (f > 1) mb.panel(ax, py - fh, az, ax + nx * 0.02, py - fh, az + nz * 0.02, bx + nx * 0.02, py, bz + nz * 0.02, bx, py, bz, shade(IRON, 1.4));
      }
      const [lx, lz] = P(side, u - 1.2, 1.0);
      mb.box(lx, base + fh - 1.4, lz, 0.15, 1.5, 0.15, IRON, rot);
    }
    if (F.has('balcony') && floors >= 2) {
      mb.material(TILE.WOOD, 0.6);
      const n = Math.max(1, Math.floor((front.len - 0.8) / 2.3));
      const step = front.len / n;
      for (let f = 1; f < floors; f++) {
        for (let i = 0; i < n; i++) {
          if (rng.chance(0.55)) continue;
          const u = -front.len / 2 + (i + 0.5) * step;
          const [px, pz] = P(front, u, 0.45);
          mb.box(px, base + f * fh - 0.05, pz, frontIsZ ? 1.8 : 0.85, 0.15, frontIsZ ? 0.85 : 1.8, shade(wall, 0.7), rot);
          const [rx, rz] = P(front, u, 0.85);
          mb.box(rx, base + f * fh + 0.1, rz, frontIsZ ? 1.8 : 0.06, 0.9, frontIsZ ? 0.06 : 1.8, accent, rot);
        }
      }
    }
    if (F.has('veranda')) {
      mb.material(TILE.WOOD, 0.6);
      const span = front.len;
      const n = Math.max(2, Math.floor(span / 2.4));
      const vh = fh - 0.2;
      for (let i = 0; i < n; i++) {
        const u = -span / 2 + 0.4 + (i / (n - 1)) * (span - 0.8);
        const [cx, cz] = P(front, u, 1.9);
        mb.box(cx, base, cz, 0.18, vh, 0.18, shade(wall, 0.6), rot);
      }
      const [px, pz] = P(front, 0, 1.0);
      const gLow = Math.min(groundAt(...P(front, -span / 2, 2.1)), groundAt(...P(front, span / 2, 2.1)), groundAt(px, pz));
      if (frontIsZ) {
        mb.box(px, gLow - 0.3, pz, span + 0.2, base + 0.14 - gLow + 0.3, 2.1, shade(wall, 0.8), rot, 0.8);
        mb.box(px, base + vh - 0.1, pz, span + 0.5, 0.2, 2.4, shade(roofColor, 1.0), rot);
      } else {
        mb.box(px, gLow - 0.3, pz, 2.1, base + 0.14 - gLow + 0.3, span + 0.2, shade(wall, 0.8), rot, 0.8);
        mb.box(px, base + vh - 0.1, pz, 2.4, 0.2, span + 0.5, shade(roofColor, 1.0), rot);
      }
      const [rx, rz] = P(front, 0, 1.95);
      if (frontIsZ) mb.box(rx, base + 0.9, rz, span - 0.6, 0.08, 0.08, shade(wall, 0.6), rot);
      else mb.box(rx, base + 0.9, rz, 0.08, 0.08, span - 0.6, shade(wall, 0.6), rot);
    }
    if (F.has('lattice')) {
      mb.material(TILE.WOOD, 0.8);
      const [nx, nz] = N(front);
      const span = front.len * 0.7;
      const n = Math.floor(span / 0.32);
      for (let i = 0; i < n; i++) {
        const u = -span / 2 + (i + 0.5) * (span / n);
        if (Math.abs(u) < 0.9) continue; // door
        const [px, pz] = P(front, u, 0.1);
        mb.wallQuad(px, base + 0.5, pz, 0.08, Math.min(2.0, fh * 0.7), nx, nz, accent);
      }
      const [rx, rz] = P(front, 0, 0.12);
      mb.box(rx, base + 0.5 + Math.min(2.0, fh * 0.7), rz, frontIsZ ? span : 0.1, 0.1, frontIsZ ? 0.1 : span, accent, rot);
    }
    if (F.has('awning')) {
      const [nx, nz] = N(front);
      const span = front.len * (F.has('storefront') ? 0.75 : 0.35);
      const [ax, az] = P(front, -span / 2, 0.05);
      const [bx, bz] = P(front, span / 2, 0.05);
      const top = base + Math.min(3.0, fh * 0.95);
      mb.material(TILE.PLASTER, 0.5);
      mb.panel(ax, top, az, bx, top, bz, bx + nx * 1.8, top - 0.55, bz + nz * 1.8, ax + nx * 1.8, top - 0.55, az + nz * 1.8, accent);
      mb.box((ax + bx) / 2 + nx * 1.8, top - 0.85, (az + bz) / 2 + nz * 1.8, frontIsZ ? span : 0.08, 0.3, frontIsZ ? 0.08 : span, shade(accent, 0.8), rot);
    }
    if (F.has('sign') && !F.has('falsefront')) {
      mb.material(TILE.WOOD, 0.5);
      const [nx, nz] = N(front);
      if (F.has('storefront')) {
        const [sx, sz] = P(front, 0, 0.1);
        mb.wallQuad(sx, base + fh + 0.15, sz, front.len * 0.6, 0.75, nx, nz, accent);
      } else {
        const u = front.len * 0.25;
        const [sx, sz] = P(front, u, 0.6);
        mb.box(sx, base + 2.9, sz, frontIsZ ? 0.08 : 1.2, 0.7, frontIsZ ? 1.2 : 0.08, accent, rot);
        const [bx2, bz2] = P(front, u, 0.3);
        mb.box(bx2, base + 3.6, bz2, frontIsZ ? 0.08 : 0.7, 0.08, frontIsZ ? 0.7 : 0.08, IRON, rot);
      }
    }
    if (F.has('ladder') && t.stilts) {
      mb.material(TILE.WOOD, 0.6);
      const [nx, nz] = N(front);
      const [ax, az] = P(front, -0.45, 0.3);
      const [bx, bz] = P(front, 0.45, 0.3);
      mb.panel(ax, base, az, bx, base, bz, bx + nx * 1.4, groundY, bz + nz * 1.4, ax + nx * 1.4, groundY, az + nz * 1.4, shade(wall, 0.7));
    }
  }

  const [doorX, doorZ] = P(front, 0, 1.2);
  const pad = F.has('arcade') || F.has('porch') || F.has('veranda') ? 0 : 0;
  return { x, z, hw: w / 2 + 0.15 + pad, hd: d / 2 + 0.15 + pad, rot, h, tag: t.tag, template: t, doorX, doorZ };
}

function windowSize(style: WindowStyle, fh: number): [number, number] {
  switch (style) {
    case 'tall':
      return [1.0, Math.min(1.8, fh * 0.55)];
    case 'square':
      return [1.1, 1.1];
    case 'slit':
      return [0.5, 1.0];
    case 'arch':
      return [1.1, Math.min(2.0, fh * 0.6)];
    case 'wide':
      return [2.0, Math.min(1.5, fh * 0.45)];
    case 'shoji':
      return [1.5, 1.2];
    case 'none':
      return [0, 0];
  }
}

/** Windows, doors, sills, frames, shutters and storefronts on every face. */
function windows(
  mb: MeshBuilder,
  faces: Face[],
  W: (lx: number, lz: number) => [number, number],
  N: (f: Face) => [number, number],
  P: (f: Face, u: number, out: number) => [number, number],
  y: number,
  floors: number,
  fh: number,
  t: BuildingTemplate,
  F: Set<Feature>,
  accent: number,
  wall: number,
  insetAt: (y: number) => number,
  isFront: (f: Face) => boolean,
  firstFloor: number,
): void {
  const style = t.windows ?? 'square';
  const [winW, winH] = windowSize(style, fh);
  const glass = t.windowColor ?? (style === 'shoji' ? 0xf0e8d0 : DARK_WINDOW);
  const spacing = style === 'wide' ? 3.2 : style === 'slit' ? 1.6 : 2.3;
  for (const f of faces) {
    const front = isFront(f);
    const [nx, nz] = N(f);
    const n = Math.max(1, Math.floor((f.len - 0.8) / spacing));
    const step = f.len / n;
    for (let fl = 0; fl < floors; fl++) {
      const groundFloor = fl === 0 && firstFloor === 0;
      if (groundFloor && F.has('arcade') && front) continue;
      const wy = y + fl * fh + fh * 0.3;
      const inset = insetAt(wy + winH / 2);
      if (groundFloor && front && F.has('storefront')) {
        // big shop windows either side of a door
        mb.material(TILE.CONCRETE, 0.3);
        const paneW = f.len * 0.3;
        for (const s of [-1, 1]) {
          const [px, pz] = P(f, s * f.len * 0.26, 0.06 - inset);
          mb.wallQuad(px, y + 0.5, pz, paneW, Math.min(2.3, fh * 0.72), nx, nz, 0x26343a);
          mb.wallQuad(px, y + 0.42, pz, paneW + 0.24, Math.min(2.46, fh * 0.78), nx, nz, accent);
        }
        const [dx, dz] = P(f, 0, 0.06 - inset);
        mb.wallQuad(dx, y + 0.02, dz, 1.3, Math.min(2.3, fh * 0.75), nx, nz, DARK_WINDOW);
        continue;
      }
      if (style === 'none') {
        if (groundFloor && front) {
          mb.material(TILE.WOOD, 0.6);
          const [dx, dz] = P(f, 0, 0.05 - inset);
          mb.wallQuad(dx, y + 0.02, dz, 1.2, Math.min(2.1, fh * 0.75), nx, nz, 0x3a2a1a);
        }
        continue;
      }
      for (let i = 0; i < n; i++) {
        const u = -f.len / 2 + (i + 0.5) * step;
        const isDoor = front && groundFloor && i === Math.floor(n / 2);
        if (isDoor) {
          mb.material(TILE.WOOD, 0.6);
          const [dx, dz] = P(f, u, 0.05 - inset);
          const dh = Math.min(2.2, fh * 0.75);
          if (F.has('frames')) mb.wallQuad(dx, y + 0.02, dz, 1.5, dh + 0.2, nx, nz, accent);
          const [dx2, dz2] = P(f, u, 0.08 - inset);
          mb.wallQuad(dx2, y + 0.02, dz2, 1.2, dh, nx, nz, 0x2a1e14);
          continue;
        }
        mb.material(TILE.CONCRETE, 0.3);
        if (F.has('frames')) {
          const [qx, qz] = P(f, u, 0.04 - inset);
          if (style === 'arch') mb.archQuad(qx, wy - 0.12, qz, winW + 0.26, winH + 0.26, nx, nz, accent);
          else mb.wallQuad(qx, wy - 0.12, qz, winW + 0.26, winH + 0.24, nx, nz, accent);
        }
        const [px, pz] = P(f, u, 0.07 - inset);
        if (style === 'arch') mb.archQuad(px, wy, pz, winW, winH, nx, nz, glass);
        else mb.wallQuad(px, wy, pz, winW, winH, nx, nz, glass);
        if (style === 'shoji') {
          // dark crossbars
          mb.wallQuad(px + nx * 0.01, wy + winH * 0.5 - 0.04, pz + nz * 0.01, winW, 0.08, nx, nz, accent);
          mb.wallQuad(px + nx * 0.01, wy, pz + nz * 0.01, 0.08, winH, nx, nz, accent);
        }
        // boxes aligned with the face: long side along the face, thin side along its normal
        const faceRot = Math.atan2(nz, nx) - Math.PI / 2;
        if (F.has('sills')) {
          mb.material(TILE.STONE, 0.5);
          const [sx, sz] = P(f, u, 0.12 - inset);
          mb.box(sx, wy - 0.14, sz, winW + 0.4, 0.14, 0.3, shade(wall, 0.8), faceRot);
        }
        if (F.has('shutters')) {
          mb.material(TILE.WOOD, 0.8);
          for (const s of [-1, 1]) {
            const [hx, hz] = P(f, u + s * (winW / 2 + 0.25), 0.1 - inset);
            mb.box(hx, wy, hz, 0.4, winH, 0.08, accent, faceRot);
          }
        }
      }
    }
  }
}

function addRoof(mb: MeshBuilder, t: BuildingTemplate, x: number, y: number, z: number, w: number, d: number, rot: number, roofColor: number, wall: number, floors: number, wing: boolean, roofTex: Tile): void {
  const ov = t.overhang ?? 0.35;
  const alongX = w >= d;
  mb.material(roofTex, texRepeat(roofTex));
  switch (t.roof) {
    case 'flat':
      if (t.parapet) {
        mb.material(t.tex !== undefined ? (t.tex as Tile) : TILE.PLASTER, texRepeat((t.tex ?? TILE.PLASTER) as Tile));
        mb.box(x, y - 0.1, z, w + 0.3, 0.6, d + 0.3, shade(wall, 0.85), rot);
        mb.material(roofTex, 0.3);
        mb.box(x, y - 0.2, z, w - 0.3, 0.25, d - 0.3, roofColor, rot);
      } else mb.box(x, y, z, w + 0.1, 0.25, d + 0.1, roofColor, rot);
      if (!wing && floors >= 4) {
        mb.material(TILE.CONCRETE, 0.4);
        mb.box(x, y, z, Math.min(3, w * 0.3), 1.6, Math.min(3, d * 0.3), shade(wall, 0.9), rot);
      }
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
      mb.dome(x, y - 0.1, z, Math.min(w, d) / 2, roofColor, 12, 4);
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
      mb.material(TILE.STONE, 0.4);
      mb.box(x, y, z, w * 0.8, 1.6, d * 0.8, roofColor, rot);
      mb.box(x, y + 1.6, z, w * 0.55, 1.4, d * 0.55, roofColor, rot);
      mb.box(x, y + 3, z, w * 0.3, 1.2, d * 0.3, shade(roofColor, 0.9), rot);
      break;
    }
    case 'none':
      break;
  }
}
