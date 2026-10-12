/**
 * Era-specific street patterns laid over the constant macro layout.
 * A pattern answers two questions: "is this point on a minor street?" and
 * "which building lots exist inside this rectangle?". Both are pure functions of
 * position, so chunks can be generated in any order and are always identical.
 */
import type { Era } from '../eras/types';
import { hash2, noise2 } from '../util/rng';
import { smoothstep } from '../util/math';
import { RING_ROAD, SITES, HILL } from './macro';

export interface Lot {
  x: number;
  z: number;
  w: number;
  d: number;
  /** rotation of the building (radians, about Y) */
  rot: number;
  /** direction the front faces, radians */
  front: number;
  seed: number;
  /** distance-based build probability modifier */
  weight: number;
}

export interface StreetNode {
  x: number;
  z: number;
  key: string;
}

export interface Park {
  x: number;
  z: number;
  w: number;
  d: number;
  seed: number;
}

export interface CityPattern {
  isStreet(x: number, z: number): boolean;
  /** Blocks given over to parks or gardens inside the rect. */
  parksInRect(x0: number, z0: number, x1: number, z1: number): Park[];
  /** True if the point lies inside a park block. */
  isPark(x: number, z: number): boolean;
  lotsInRect(x0: number, z0: number, x1: number, z1: number): Lot[];
  /** Street strips to draw inside a rect: a polyline with a width. */
  stripsInRect(x0: number, z0: number, x1: number, z1: number): { points: [number, number][]; width: number }[];
  /** Navigation nodes (street intersections) for NPC wandering. */
  nodesInRect(x0: number, z0: number, x1: number, z1: number): StreetNode[];
  neighbors(node: StreetNode): StreetNode[];
}

/** How "urban" a point is, 0..1. The city thins out toward the ring road. */
export function urbanity(era: Era, x: number, z: number): number {
  const r = Math.max(Math.abs(x), Math.abs(z)) / RING_ROAD;
  const ext = era.layout.extent;
  let u = 1 - smoothstep(ext * 0.8, Math.max(ext, 1.0), r);
  // the citadel plateau is reserved for the landmark
  const dh = Math.hypot(x - HILL.x, z - HILL.z);
  if (dh < HILL.plateau + 20) u *= smoothstep(HILL.plateau - 10, HILL.plateau + 20, dh);
  return u;
}

function gridPattern(era: Era, seed: number, parkChance: number): CityPattern {
  const L = era.layout;
  const isParkBlock = (i: number, j: number): boolean =>
    parkChance > 0 && hash2(i * 7 + 3, j * 11 + 5, seed + 777) < parkChance && urbanity(era, (i + 0.5) * bw, (j + 0.5) * bd) > 0.55;
  const bw = L.blockW;
  const bd = L.blockD;
  const sw = L.streetWidth;
  const organic = L.pattern === 'organic' || L.pattern === 'spread' || L.pattern === 'castle';
  const skipStreet = L.pattern === 'spread' ? 0.45 : L.pattern === 'organic' ? 0.12 : 0;
  const skipSegment = L.pattern === 'castle' ? 0.22 : L.pattern === 'spread' ? 0.3 : 0;

  const vExists = (i: number): boolean => hash2(i, 77, seed) >= skipStreet;
  const hExists = (j: number): boolean => hash2(991, j, seed) >= skipStreet;
  const vSegExists = (i: number, j: number): boolean => vExists(i) && hash2(i * 3 + 1, j * 5 + 2, seed + 11) >= skipSegment;
  const hSegExists = (i: number, j: number): boolean => hExists(j) && hash2(i * 7 + 3, j * 11 + 5, seed + 23) >= skipSegment;

  // curvature: vertical street i sways in x as a function of z
  const curveV = (i: number, z: number): number =>
    organic ? (noise2(z / L.curveLen, i * 3.1, seed + 5) - 0.5) * 2 * L.curve : (noise2(z / L.curveLen, i * 3.1, seed + 5) - 0.5) * 2 * L.curve;
  const curveH = (j: number, x: number): number => (noise2(x / L.curveLen, j * 2.7 + 50, seed + 9) - 0.5) * 2 * L.curve;
  const streetX = (i: number, z: number): number => i * bw + curveV(i, z);
  const streetZ = (j: number, x: number): number => j * bd + curveH(j, x);
  const widthV = (i: number): number => sw * (0.8 + 0.5 * hash2(i, 5, seed));
  const widthH = (j: number): number => sw * (0.8 + 0.5 * hash2(6, j, seed));

  function isStreet(x: number, z: number): boolean {
    const i = Math.round(x / bw);
    const j = Math.round(z / bd);
    // which block row/column are we in (for segment existence)
    const jj = Math.floor(z / bd);
    const ii = Math.floor(x / bw);
    if (vSegExists(i, jj) && Math.abs(x - streetX(i, z)) < widthV(i) / 2) return true;
    if (hSegExists(ii, j) && Math.abs(z - streetZ(j, x)) < widthH(j) / 2) return true;
    return false;
  }

  function blockInner(i: number, j: number): [number, number, number, number] {
    const zc = (j + 0.5) * bd;
    const xc = (i + 0.5) * bw;
    const xl = streetX(i, zc) + widthV(i) / 2;
    const xr = streetX(i + 1, zc) - widthV(i + 1) / 2;
    const zt = streetZ(j, xc) + widthH(j) / 2;
    const zb = streetZ(j + 1, xc) - widthH(j + 1) / 2;
    return [xl, zt, xr, zb];
  }

  function parksInRect(x0: number, z0: number, x1: number, z1: number): Park[] {
    const out: Park[] = [];
    for (let i = Math.floor(x0 / bw) - 1; i <= Math.floor(x1 / bw) + 1; i++) {
      for (let j = Math.floor(z0 / bd) - 1; j <= Math.floor(z1 / bd) + 1; j++) {
        if (!isParkBlock(i, j)) continue;
        const [xl, zt, xr, zb] = blockInner(i, j);
        const x = (xl + xr) / 2;
        const z = (zt + zb) / 2;
        if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
        out.push({ x, z, w: xr - xl, d: zb - zt, seed: hash2(i, j, seed + 55) * 1e6 });
      }
    }
    return out;
  }

  function isPark(x: number, z: number): boolean {
    const i = Math.floor(x / bw);
    const j = Math.floor(z / bd);
    if (!isParkBlock(i, j)) return false;
    const [xl, zt, xr, zb] = blockInner(i, j);
    return x >= xl && x <= xr && z >= zt && z <= zb;
  }

  function lotsInBlock(i: number, j: number, out: Lot[]): void {
    // block spans street i..i+1 and j..j+1
    if (isParkBlock(i, j)) return;
    const blockSeed = hash2(i, j, seed + 101) * 1e6;
    const zc = (j + 0.5) * bd;
    const xc = (i + 0.5) * bw;
    const xl = streetX(i, zc) + widthV(i) / 2;
    const xr = streetX(i + 1, zc) - widthV(i + 1) / 2;
    const zt = streetZ(j, xc) + widthH(j) / 2;
    const zb = streetZ(j + 1, xc) - widthH(j + 1) / 2;
    const innerW = xr - xl;
    const innerD = zb - zt;
    if (innerW < 4 || innerD < 4) return;

    if (L.pattern === 'spread') {
      // a few big plots, buildings placed freely with random rotation
      const n = 1 + Math.floor(hash2(i, j, seed + 7) * 3);
      const placed: Lot[] = [];
      for (let k = 0; k < n; k++) {
        const w = Math.min(L.lotSize, innerW * 0.5);
        const d = Math.min(L.lotSize * 0.6, innerD * 0.5);
        const r = Math.hypot(w, d) / 2 + 1.5; // rotated footprint radius plus a gap
        let ok = false;
        let x = 0;
        let z = 0;
        let rot = 0;
        for (let attempt = 0; attempt < 6 && !ok; attempt++) {
          const h = hash2(i * 13 + k * 3 + attempt, j * 17 + k, seed + 31);
          const h2 = hash2(i * 19 + k, j * 23 + k * 5 + attempt, seed + 37);
          x = xl + r + h * Math.max(0, innerW - 2 * r);
          z = zt + r + h2 * Math.max(0, innerD - 2 * r);
          rot = (hash2(i + k, j - k + attempt, seed + 41) - 0.5) * 1.2;
          ok = placed.every((o) => Math.hypot(o.x - x, o.z - z) > 2 * r);
        }
        if (!ok) continue;
        const lot: Lot = { x, z, w, d, rot, front: rot + Math.PI / 2, seed: blockSeed + k * 7919, weight: 1 };
        placed.push(lot);
        out.push(lot);
      }
      return;
    }

    const nx = Math.max(1, Math.floor(innerW / L.lotSize));
    const nz = Math.max(1, Math.floor(innerD / L.lotSize));
    const lw = innerW / nx;
    const ld = innerD / nz;
    for (let a = 0; a < nx; a++) {
      for (let b = 0; b < nz; b++) {
        const edgeL = a === 0;
        const edgeR = a === nx - 1;
        const edgeT = b === 0;
        const edgeB = b === nz - 1;
        const onEdge = edgeL || edgeR || edgeT || edgeB;
        if (!onEdge && hash2(a + i * 50, b + j * 50, seed + 61) < 0.75) continue; // interior stays open (courtyards)
        const gx = xl + (a + 0.5) * lw;
        const gz = zt + (b + 0.5) * ld;
        // local curvature: follow the nearest street's sway, and turn the lot to the street's tangent
        const x = gx + (edgeL ? curveV(i, gz) - curveV(i, zc) : edgeR ? curveV(i + 1, gz) - curveV(i + 1, zc) : 0);
        const z = gz + (edgeT ? curveH(j, gx) - curveH(j, xc) : edgeB ? curveH(j + 1, gx) - curveH(j + 1, xc) : 0);
        let lotRot = 0;
        let lotW = lw;
        let lotD = ld;
        if (edgeL || edgeR) {
          const si = edgeL ? i : i + 1;
          const slope = (curveV(si, gz + 2) - curveV(si, gz - 2)) / 4;
          lotRot = -Math.atan(slope);
          lotD = Math.max(4, ld - Math.abs(slope) * lw);
        } else if (edgeT || edgeB) {
          const sj = edgeT ? j : j + 1;
          const slope = (curveH(sj, gx + 2) - curveH(sj, gx - 2)) / 4;
          lotRot = Math.atan(slope);
          lotW = Math.max(4, lw - Math.abs(slope) * ld);
        }
        let front = 0;
        if (edgeT) front = -Math.PI / 2;
        else if (edgeB) front = Math.PI / 2;
        else if (edgeL) front = Math.PI;
        else front = 0;
        if (edgeL && (edgeT || edgeB) && hash2(a, b, seed + i + j) < 0.5) front = Math.PI;
        if (edgeR && (edgeT || edgeB) && hash2(a, b, seed + i - j) < 0.5) front = 0;
        out.push({ x, z, w: lotW, d: lotD, rot: lotRot, front: front + lotRot, seed: blockSeed + a * 131 + b * 977, weight: onEdge ? 1 : 0.6 });
      }
    }
  }

  function lotsInRect(x0: number, z0: number, x1: number, z1: number): Lot[] {
    const out: Lot[] = [];
    const i0 = Math.floor(x0 / bw) - 1;
    const i1 = Math.floor(x1 / bw) + 1;
    const j0 = Math.floor(z0 / bd) - 1;
    const j1 = Math.floor(z1 / bd) + 1;
    const tmp: Lot[] = [];
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        tmp.length = 0;
        lotsInBlock(i, j, tmp);
        for (const l of tmp) if (l.x >= x0 && l.x < x1 && l.z >= z0 && l.z < z1) out.push(l);
      }
    }
    return out;
  }

  function stripsInRect(x0: number, z0: number, x1: number, z1: number): { points: [number, number][]; width: number }[] {
    const strips: { points: [number, number][]; width: number }[] = [];
    const step = 8;
    const i0 = Math.ceil((x0 - L.curve - sw) / bw);
    const i1 = Math.floor((x1 + L.curve + sw) / bw);
    for (let i = i0; i <= i1; i++) {
      if (!vExists(i)) continue;
      let cur: [number, number][] = [];
      for (let z = z0 - step; z <= z1 + step; z += step) {
        const jj = Math.floor(z / bd);
        if (vSegExists(i, jj)) {
          cur.push([streetX(i, z), z]);
        } else if (cur.length) {
          strips.push({ points: cur, width: widthV(i) });
          cur = [];
        }
      }
      if (cur.length > 1) strips.push({ points: cur, width: widthV(i) });
    }
    const j0 = Math.ceil((z0 - L.curve - sw) / bd);
    const j1 = Math.floor((z1 + L.curve + sw) / bd);
    for (let j = j0; j <= j1; j++) {
      if (!hExists(j)) continue;
      let cur: [number, number][] = [];
      for (let x = x0 - step; x <= x1 + step; x += step) {
        const ii = Math.floor(x / bw);
        if (hSegExists(ii, j)) {
          cur.push([x, streetZ(j, x)]);
        } else if (cur.length) {
          strips.push({ points: cur, width: widthH(j) });
          cur = [];
        }
      }
      if (cur.length > 1) strips.push({ points: cur, width: widthH(j) });
    }
    return strips;
  }

  function node(i: number, j: number): StreetNode {
    const z = j * bd;
    const x = streetX(i, z);
    return { x, z: streetZ(j, x), key: `${i},${j}` };
  }

  function nodesInRect(x0: number, z0: number, x1: number, z1: number): StreetNode[] {
    const out: StreetNode[] = [];
    for (let i = Math.floor(x0 / bw); i <= Math.ceil(x1 / bw); i++) {
      for (let j = Math.floor(z0 / bd); j <= Math.ceil(z1 / bd); j++) {
        if (!vExists(i) || !hExists(j)) continue;
        const n = node(i, j);
        if (n.x >= x0 && n.x < x1 && n.z >= z0 && n.z < z1) out.push(n);
      }
    }
    return out;
  }

  function neighbors(n: StreetNode): StreetNode[] {
    const [i, j] = n.key.split(',').map(Number);
    const out: StreetNode[] = [];
    if (vSegExists(i, j) && hExists(j + 1)) out.push(node(i, j + 1));
    if (vSegExists(i, j - 1) && hExists(j - 1)) out.push(node(i, j - 1));
    if (hSegExists(i, j) && vExists(i + 1)) out.push(node(i + 1, j));
    if (hSegExists(i - 1, j) && vExists(i - 1)) out.push(node(i - 1, j));
    return out;
  }

  return { isStreet, lotsInRect, stripsInRect, nodesInRect, neighbors, parksInRect, isPark };
}

function radialPattern(era: Era, seed: number): CityPattern {
  const L = era.layout;
  const C = SITES.citadel;
  const ringStep = L.blockD;
  const sw = L.streetWidth;
  const innerR = SITES.citadel.clear + 10;

  const spokesAt = (r: number): number => (r < 220 ? 12 : r < 420 ? 24 : 48);
  const ringR = (k: number): number => innerR + k * ringStep + (noise2(k * 1.3, 0.5, seed) - 0.5) * 6;

  function polar(x: number, z: number): [number, number] {
    const dx = x - C.x;
    const dz = z - C.z;
    return [Math.hypot(dx, dz), Math.atan2(dz, dx)];
  }

  function isStreet(x: number, z: number): boolean {
    const [r, a] = polar(x, z);
    if (r < innerR - sw) return false;
    const k = Math.round((r - innerR) / ringStep);
    if (k >= 0 && Math.abs(r - ringR(k)) < sw / 2) return true;
    const n = spokesAt(r);
    const step = (Math.PI * 2) / n;
    const s = Math.round(a / step);
    const da = Math.abs(a - s * step);
    if (da * r < sw / 2 && hash2(s, n, seed) > 0.15) return true;
    return false;
  }

  function lotsInRect(x0: number, z0: number, x1: number, z1: number): Lot[] {
    const out: Lot[] = [];
    const corners = [polar(x0, z0), polar(x1, z0), polar(x0, z1), polar(x1, z1)];
    let rMin = Math.min(...corners.map((c) => c[0]));
    const rMax = Math.max(...corners.map((c) => c[0]));
    if (x0 <= C.x && x1 >= C.x && z0 <= C.z && z1 >= C.z) rMin = 0;
    const k0 = Math.max(0, Math.floor((rMin - innerR) / ringStep) - 1);
    const k1 = Math.floor((rMax - innerR) / ringStep) + 1;
    for (let k = k0; k <= k1; k++) {
      const rA = ringR(k) + sw / 2;
      const rB = ringR(k + 1) - sw / 2;
      if (rB - rA < 4) continue;
      const rMid = (rA + rB) / 2;
      const n = spokesAt(rMid);
      const step = (Math.PI * 2) / n;
      // size lots by the inner arc so rings never overlap toward the centre
      const lotsPerSector = Math.max(1, Math.floor((rA * step - sw) / L.lotSize));
      const depthLots = Math.max(1, Math.floor((rB - rA) / L.lotSize));
      for (let s = 0; s < n; s++) {
        for (let q = 0; q < lotsPerSector; q++) {
          for (let dq = 0; dq < depthLots; dq++) {
            const onEdge = dq === 0 || dq === depthLots - 1 || q === 0 || q === lotsPerSector - 1;
            if (!onEdge && hash2(s * 31 + q, k * 17 + dq, seed + 3) < 0.7) continue;
            const a = s * step + (sw / 2) / rMid + ((q + 0.5) * (rMid * step - sw)) / lotsPerSector / rMid;
            const r = rA + (dq + 0.5) * ((rB - rA) / depthLots);
            const x = C.x + Math.cos(a) * r;
            const z = C.z + Math.sin(a) * r;
            if (x < x0 || x >= x1 || z < z0 || z >= z1) continue;
            const w = Math.min(L.lotSize, (rA * step - sw) / lotsPerSector);
            const d = Math.min(L.lotSize, (rB - rA) / depthLots);
            const facesIn = dq === 0;
            out.push({ x, z, w, d, rot: a + Math.PI / 2, front: facesIn ? a + Math.PI : a, seed: hash2(s + k * 1000, q + dq * 100, seed) * 1e6, weight: onEdge ? 1 : 0.6 });
          }
        }
      }
    }
    return out;
  }

  function stripsInRect(x0: number, z0: number, x1: number, z1: number): { points: [number, number][]; width: number }[] {
    const strips: { points: [number, number][]; width: number }[] = [];
    const corners = [polar(x0, z0), polar(x1, z0), polar(x0, z1), polar(x1, z1)];
    let rMin = Math.min(...corners.map((c) => c[0]));
    const rMax = Math.max(...corners.map((c) => c[0]));
    if (x0 <= C.x && x1 >= C.x && z0 <= C.z && z1 >= C.z) rMin = 0;
    const pad = 20;
    const inRect = (x: number, z: number): boolean => x >= x0 - pad && x < x1 + pad && z >= z0 - pad && z < z1 + pad;
    const k0 = Math.max(0, Math.floor((rMin - innerR) / ringStep) - 1);
    const k1 = Math.floor((rMax - innerR) / ringStep) + 1;
    for (let k = k0; k <= k1; k++) {
      const r = ringR(k);
      const segs = Math.max(24, Math.floor(r / 4));
      let cur: [number, number][] = [];
      for (let i = 0; i <= segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        const x = C.x + Math.cos(a) * r;
        const z = C.z + Math.sin(a) * r;
        if (inRect(x, z)) cur.push([x, z]);
        else if (cur.length) {
          if (cur.length > 1) strips.push({ points: cur, width: sw });
          cur = [];
        }
      }
      if (cur.length > 1) strips.push({ points: cur, width: sw });
    }
    // spokes
    const spokeBands: [number, number][] = [
      [innerR, 220],
      [220, 420],
      [420, 900],
    ];
    for (const [ra, rb] of spokeBands) {
      if (rb < rMin || ra > rMax) continue;
      const n = spokesAt((ra + rb) / 2);
      const step = (Math.PI * 2) / n;
      for (let s = 0; s < n; s++) {
        if (hash2(s, n, seed) <= 0.15) continue;
        const a = s * step;
        const pts: [number, number][] = [];
        for (let r = ra; r <= rb; r += 10) {
          const x = C.x + Math.cos(a) * r;
          const z = C.z + Math.sin(a) * r;
          if (inRect(x, z)) pts.push([x, z]);
        }
        if (pts.length > 1) strips.push({ points: pts, width: sw });
      }
    }
    return strips;
  }

  function node(k: number, s: number, n: number): StreetNode {
    const r = ringR(k);
    const a = (s / n) * Math.PI * 2;
    return { x: C.x + Math.cos(a) * r, z: C.z + Math.sin(a) * r, key: `${k},${s},${n}` };
  }

  function nodesInRect(x0: number, z0: number, x1: number, z1: number): StreetNode[] {
    const out: StreetNode[] = [];
    for (let k = 0; k < 26; k++) {
      const r = ringR(k);
      const n = spokesAt(r);
      for (let s = 0; s < n; s++) {
        const nd = node(k, s, n);
        if (nd.x >= x0 && nd.x < x1 && nd.z >= z0 && nd.z < z1) out.push(nd);
      }
    }
    return out;
  }

  function neighbors(nd: StreetNode): StreetNode[] {
    const [k, s, n] = nd.key.split(',').map(Number);
    const out: StreetNode[] = [node(k, (s + 1) % n, n), node(k, (s + n - 1) % n, n)];
    if (k > 0) {
      const nIn = spokesAt(ringR(k - 1));
      out.push(node(k - 1, Math.round((s * nIn) / n) % nIn, nIn));
    }
    const nOut = spokesAt(ringR(k + 1));
    out.push(node(k + 1, Math.round((s * nOut) / n) % nOut, nOut));
    return out;
  }

  return { isStreet, lotsInRect, stripsInRect, nodesInRect, neighbors, parksInRect: () => [], isPark: () => false };
}

export function makePattern(era: Era, parkChance = 0): CityPattern {
  const seed = 1000 + ERA_SEEDS[era.id];
  if (era.layout.pattern === 'radial') return radialPattern(era, seed);
  return gridPattern(era, seed, parkChance);
}

const ERA_SEEDS: Record<string, number> = {
  sumerian: 1, egyptian: 2, minoan: 3, mycenaean: 4, assyrian: 5, greek: 6, mauryan: 7, roman: 8, mayan: 9,
  viking: 10, khmer: 11, mongol: 12, aztec: 13, sengoku: 14, buccaneer: 15, wildwest: 16, victorian: 17, industrial: 18,
};
