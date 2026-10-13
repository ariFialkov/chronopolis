import { Bone, BufferGeometry, Group, MeshLambertMaterial, Skeleton, SkinnedMesh } from 'three';
import { Mesher } from './mesher';
import type { Hat, Outfit } from './outfit';
import { shade } from '../util/math';

/** Bone indices. The rig is the same for every character. */
const HIPS = 0;
const SPINE = 1;
const CHEST = 2;
const HEAD = 3;
const UARM_L = 4;
const FARM_L = 5;
const UARM_R = 6;
const FARM_R = 7;
const THIGH_L = 8;
const SHIN_L = 9;
const THIGH_R = 10;
const SHIN_R = 11;

const EYE = 0x1a1410;
const LIP = 0x7a4436;

interface Dims {
  sx: number; // shoulder joint x
  chestTop: number; // chest width at the shoulders
  chestBot: number;
  waistTop: number;
  waistBot: number;
  pelvis: number;
  legX: number;
}

function dims(o: Outfit): Dims {
  return o.build === 'f'
    ? { sx: 0.235, chestTop: 0.42, chestBot: 0.34, waistTop: 0.33, waistBot: 0.36, pelvis: 0.4, legX: 0.1 }
    : { sx: 0.27, chestTop: 0.5, chestBot: 0.41, waistTop: 0.39, waistBot: 0.37, pelvis: 0.38, legX: 0.11 };
}

/** Bone layout: [parent, x, y, z] in bind-pose world coordinates. */
function boneLayout(d: Dims): [number, number, number, number][] {
  return [
    [-1, 0, 0.86, 0],
    [HIPS, 0, 1.0, 0],
    [SPINE, 0, 1.2, 0],
    [CHEST, 0, 1.42, 0],
    [CHEST, d.sx, 1.36, 0],
    [UARM_L, d.sx, 1.1, 0],
    [CHEST, -d.sx, 1.36, 0],
    [UARM_R, -d.sx, 1.1, 0],
    [HIPS, d.legX, 0.84, 0],
    [THIGH_L, d.legX, 0.45, 0],
    [HIPS, -d.legX, 0.84, 0],
    [THIGH_R, -d.legX, 0.45, 0],
  ];
}

/** Skirt hem height for a length (0 = mid-thigh, 1 = ankle). */
function hemY(length: number): number {
  return 0.62 - length * 0.54;
}

export function buildCharacterGeometry(o: Outfit): BufferGeometry {
  const m = new Mesher();
  const d = dims(o);
  const skin = o.skin;
  const hair = o.hair;
  const top = o.coat ? o.coat.color : o.vest ? o.vest.color : o.armor ? o.armor.color : o.toga ? o.toga.color : o.top ?? skin;
  const shirt = o.top ?? skin;
  const sleeve = o.coat ? o.coat.color : o.sleeveColor ?? (o.vest ? shirt : o.top ?? skin);
  const lowerTorso = o.overalls ?? top;
  const legColor = o.overalls ?? o.legs ?? skin;
  const f = o.build === 'f';

  // ---------------- body ----------------
  m.setBone(HIPS).color(o.overalls ?? o.legs ?? (o.skirt ? o.skirt.color : skin));
  m.box(0, 0.76, 0.95, 0, d.pelvis, 0.24, { topW: d.waistBot, topD: 0.23 });
  m.setBone(SPINE).color(lowerTorso);
  m.box(0, 0.92, 1.1, 0, d.waistBot, 0.23, { topW: d.waistTop + 0.02, topD: 0.235 });
  m.setBone(CHEST).color(top);
  m.box(0, 1.08, 1.42, 0, d.chestBot, 0.245, { topW: d.chestTop, topD: 0.235 });
  // shoulders: a rounded cap over each joint
  m.box(0, 1.36, 1.44, 0, d.chestTop + 0.02, 0.22, { topW: d.chestTop - 0.12, topD: 0.16 });
  if (o.top === null && !o.armor && !o.coat && !o.vest && !o.toga && !o.overalls) {
    // bare chest: a hint of pecs and navel shading
    m.color(shade(skin, 0.9));
    m.cube(0.08, 1.31, 0.124, 0.13, 0.08, 0.01);
    m.cube(-0.08, 1.31, 0.124, 0.13, 0.08, 0.01);
  }
  // neckline: a V of skin (or undershirt) at the front
  if (o.neck && o.top !== null) {
    m.color(o.neckColor ?? skin);
    m.rotated(0, 1.42, 0.12, 0, 0, 0, () => {
      m.box(0, 1.3, 1.42, 0.121, 0.03, 0.01, { topW: o.neck === 'wrap' ? 0.16 : 0.14 });
    });
  }
  // neck and head
  m.setBone(HEAD).color(skin);
  m.box(0, 1.36, 1.5, 0.0, 0.12, 0.12);
  m.sphere(0, 1.63, 0.01, 0.2, 0.215, 0.19, 10, 7);
  // ears, nose
  m.color(shade(skin, 0.94));
  m.cube(0.198, 1.6, 0.0, 0.04, 0.08, 0.06);
  m.cube(-0.198, 1.6, 0.0, 0.04, 0.08, 0.06);
  m.cube(0, 1.585, 0.195, 0.045, 0.055, 0.04);
  // eyes, brows, mouth
  m.color(EYE);
  m.cube(0.072, 1.62, 0.183, 0.05, 0.065, 0.03);
  m.cube(-0.072, 1.62, 0.183, 0.05, 0.065, 0.03);
  m.color(0xffffff);
  m.cube(0.082, 1.632, 0.195, 0.016, 0.018, 0.01);
  m.cube(-0.062, 1.632, 0.195, 0.016, 0.018, 0.01);
  m.color(shade(hair, 0.9));
  m.cube(0.075, 1.688, 0.178, 0.08, 0.022, 0.03);
  m.cube(-0.075, 1.688, 0.178, 0.08, 0.022, 0.03);
  m.color(f ? 0xa04a44 : LIP);
  m.cube(0, 1.528, 0.172, 0.07, 0.016, 0.02);

  // arms
  for (const side of [1, -1]) {
    const ua = side > 0 ? UARM_L : UARM_R;
    const fa = side > 0 ? FARM_L : FARM_R;
    const x = d.sx * side;
    const sl = o.sleeves ?? (o.coat ? 'long' : o.top === null ? 'none' : 'short');
    m.setBone(ua).color(sl === 'none' ? skin : sl === 'short' ? skin : sleeve);
    m.box(x, 1.1, 1.38, 0, 0.12, 0.13, { topW: 0.14, topD: 0.15 });
    if (sl === 'short') {
      m.color(sleeve);
      m.box(x, 1.2, 1.4, 0, 0.15, 0.16, { topW: 0.16, topD: 0.17 });
    }
    if (sl === 'wide') {
      // hanging kimono sleeve
      m.color(sleeve);
      m.box(x + side * 0.02, 0.96, 1.38, -0.01, 0.2, 0.28, { topW: 0.17, topD: 0.2 });
    }
    m.setBone(fa).color(sl === 'long' || sl === 'wide' ? sleeve : skin);
    m.box(x, 0.86, 1.11, 0, 0.11, 0.115, { topW: 0.12, topD: 0.125 });
    if ((sl === 'long' || sl === 'wide') && o.cuff !== undefined) {
      m.color(o.cuff);
      m.box(x, 0.86, 0.91, 0, 0.13, 0.135);
    }
    if (o.bracers !== undefined) {
      m.color(o.bracers);
      m.box(x, 0.88, 1.0, 0, 0.13, 0.135);
    }
    m.color(skin);
    m.box(x, 0.74, 0.87, 0.005, 0.1, 0.1, { topW: 0.11 });
    if (o.armor?.shoulders !== undefined) {
      m.setBone(ua).color(o.armor.shoulders);
      m.box(x + side * 0.02, 1.27, 1.42, 0, 0.2, 0.2, { topW: 0.14, topD: 0.16 });
    }
  }

  // legs
  for (const side of [1, -1]) {
    const th = side > 0 ? THIGH_L : THIGH_R;
    const sh = side > 0 ? SHIN_L : SHIN_R;
    const x = d.legX * side;
    m.setBone(th).color(legColor);
    m.box(x, 0.45, 0.86, 0, 0.16, 0.17, { topW: 0.18, topD: 0.19 });
    m.setBone(sh).color(o.legsKnee || o.legs === null && !o.overalls ? skin : legColor);
    m.box(x, 0.07, 0.47, 0, 0.13, 0.14, { topW: 0.155, topD: 0.165 });
    if (o.legsKnee && o.legs !== null) {
      // breeches gathered below the knee
      m.color(shade(legColor, 0.9));
      m.box(x, 0.38, 0.45, 0, 0.165, 0.175);
    }
    if (o.greaves !== undefined) {
      m.color(o.greaves);
      m.box(x, 0.14, 0.44, 0.005, 0.15, 0.16, { topW: 0.165, topD: 0.17 });
    }
    // feet
    const ft = o.feet;
    if (ft.kind === 'boot') {
      const h = ft.height ?? 0.32;
      m.color(ft.color);
      m.box(x, 0.06, h, 0, 0.15, 0.16, { topW: 0.165, topD: 0.17 });
      m.color(shade(ft.color, 0.8));
      m.box(x, h - 0.04, h + 0.01, 0, 0.175, 0.185);
      m.color(ft.color);
      m.box(x, 0, 0.09, 0.04, 0.14, 0.25);
    } else if (ft.kind === 'shoe') {
      m.color(ft.color);
      m.box(x, 0, 0.085, 0.04, 0.135, 0.25);
    } else {
      m.color(skin);
      m.box(x, 0.015, 0.08, 0.04, 0.125, 0.23);
      if (ft.kind === 'sandal') {
        m.color(ft.color);
        m.box(x, 0, 0.022, 0.04, 0.14, 0.25);
        m.box(x, 0.04, 0.065, 0.08, 0.135, 0.04);
        m.box(x, 0.085, 0.11, 0.0, 0.14, 0.15);
      }
    }
  }

  // ---------------- garments ----------------
  if (o.overalls !== undefined) {
    m.setBone(CHEST).color(o.overalls);
    m.box(0, 1.07, 1.3, 0.125, 0.27, 0.02);
    for (const sx of [0.1, -0.1]) {
      m.box(sx, 1.28, 1.44, 0.122, 0.05, 0.02);
      m.box(sx, 1.06, 1.44, -0.122, 0.05, 0.02);
      m.color(0xc9a24a);
      m.cube(sx, 1.29, 0.137, 0.035, 0.035, 0.01);
      m.color(o.overalls);
    }
  }
  if (o.armor) {
    m.setBone(CHEST).color(o.armor.trim ?? shade(o.armor.color, 0.8));
    m.box(0, 1.2, 1.235, 0, d.chestBot + 0.035, 0.27);
    m.box(0, 1.3, 1.335, 0, d.chestBot + 0.06, 0.265);
    m.color(shade(o.armor.color, 1.12));
    m.cube(0, 1.27, 0.128, 0.16, 0.18, 0.012);
  }
  if (o.vest || o.coat) {
    // the shirt (and vest) showing at the front opening
    m.setBone(CHEST);
    if (o.coat && o.vest) {
      m.color(o.vest.color);
      m.box(0, 1.08, 1.4, 0.125, 0.2, 0.012, { topW: 0.15 });
    }
    m.color(shirt);
    m.box(0, 1.2, 1.42, 0.128, 0.09, 0.012, { topW: 0.13 });
    if (o.coat?.trim !== undefined) {
      m.color(o.coat.trim);
      for (const sx of [0.13, -0.13]) m.box(sx, 1.08, 1.42, 0.124, 0.035, 0.012, { topW: 0.035 });
    }
    if (o.vest && !o.coat) {
      m.setBone(SPINE).color(o.vest.color);
      m.box(0, 0.93, 1.1, 0.0, d.waistBot + 0.01, 0.24, { topW: d.waistTop + 0.03 });
    }
  }
  if (o.tie !== undefined) {
    m.setBone(CHEST).color(o.tie);
    m.box(0, 1.17, 1.41, 0.136, 0.045, 0.012, { topW: 0.06 });
  }
  if (o.collar !== undefined) {
    m.setBone(CHEST).color(o.collar);
    m.frustum(0, 1.3, 1.46, 0, d.chestTop / 2 + 0.07, 0.19, 0.12, 0.11, 12, { bottom: false });
  }
  const sashStrip = (color: number, side: number, width: number): void => {
    m.setBone(CHEST).color(color);
    for (const z of [0.132, -0.132]) {
      m.rotated(0, 1.18, z, 0, 0, side * 0.72, () => {
        m.box(0, 0.86, 1.52, z, width, 0.016);
      });
    }
  };
  if (o.toga) {
    // draped over the left shoulder, with a coloured border running across the chest
    m.setBone(CHEST).color(o.toga.color);
    m.box(d.sx * 0.65, 1.0, 1.45, 0, 0.17, 0.27, { topW: 0.15 });
    if (o.toga.trim !== undefined) sashStrip(o.toga.trim, 1, 0.1);
  }
  if (o.sash) sashStrip(o.sash.color, o.sash.side ?? 1, o.sash.width ?? 0.09);
  if (o.cross !== undefined) {
    sashStrip(o.cross, 1, 0.065);
    sashStrip(o.cross, -1, 0.065);
  }
  if (o.cape) {
    m.setBone(CHEST).color(o.cape.color);
    const bottom = 1.42 - o.cape.length * 1.3;
    m.box(0, bottom, 1.43, -0.155, d.chestTop + 0.08, 0.025, { topW: d.chestTop - 0.02, leanZ: 0.03 });
  }

  // skirts and coat tails
  const skirts: { s: import('./outfit').Skirt; top: number }[] = [];
  if (o.skirt) skirts.push({ s: o.skirt, top: 0.98 });
  if (o.toga && !o.skirt) skirts.push({ s: { color: o.toga.color, length: 0.75, flare: 0.05 }, top: 0.98 });
  if (o.coat && o.coat.length > 0) skirts.push({ s: { color: o.coat.color, length: o.coat.length, flare: 0.05, open: true, hem: o.coat.trim }, top: 1.0 });
  for (const { s, top: ty } of skirts) {
    m.setBone(HIPS).color(s.color);
    const by = hemY(s.length);
    const flare = s.flare ?? 0.03;
    const rx0 = (f ? 0.22 : 0.215) + flare + s.length * 0.05;
    const rz0 = 0.165 + flare * 0.8 + s.length * 0.04;
    const rx1 = f ? 0.215 : 0.205;
    const rz1 = 0.14;
    const seg = s.open ? 12 : 10;
    const skip = s.open ? (i: number): boolean => Math.abs(((i + 0.5) / seg) * Math.PI * 2 - Math.PI / 2) < 0.7 : undefined;
    m.doubleSided = !!s.open;
    m.frustum(0, by, ty, 0, rx0, rz0, rx1, rz1, seg, { top: false, bottom: !s.open, skip, colorOf: s.alt !== undefined ? (i) => (i % 2 ? s.alt! : s.color) : undefined });
    const ring = (y: number, h: number, color: number, grow: number): void => {
      const t = (y - by) / (ty - by);
      const rx = rx0 + (rx1 - rx0) * t + grow;
      const rz = rz0 + (rz1 - rz0) * t + grow;
      m.color(color);
      m.frustum(0, y, y + h, 0, rx, rz, rx - 0.003, rz - 0.003, seg, { top: false, bottom: false, skip });
    };
    if (s.hem !== undefined) ring(by, 0.06, s.hem, 0.012);
    if (s.bands) {
      const n = s.bands.length;
      s.bands.forEach((c, k) => ring(by + ((k + 1) / (n + 1)) * (ty - by) * 0.75, 0.045, c, 0.012));
    }
    m.doubleSided = false;
  }
  // belt (always one at the waist of a skirt so the hem of the torso never shows)
  const beltColor = o.belt ?? (o.skirt ? shade(o.skirt.color, 0.85) : undefined);
  if (beltColor !== undefined) {
    m.setBone(HIPS).color(beltColor);
    m.box(0, 0.93, 1.0, 0, d.waistBot + 0.05, 0.27, { topW: d.waistBot + 0.06, topD: 0.275 });
    if (o.buckle !== undefined) {
      m.color(o.buckle);
      m.cube(0, 0.965, 0.142, 0.08, 0.06, 0.015);
    }
  }
  if (o.apron) {
    // hangs from the belt down the front of the skirt (or the legs), following its slope
    m.setBone(HIPS).color(o.apron.color);
    const ah = o.apron.length * 0.62;
    const yb = 0.96 - ah;
    const sk = o.skirt ?? (o.toga ? { length: 0.75, flare: 0.05 } : undefined);
    const frontZ = (y: number): number => {
      if (!sk) return 0.145;
      const by = hemY(sk.length);
      const rz0 = 0.165 + (sk.flare ?? 0.03) * 0.8 + sk.length * 0.04;
      const t = Math.max(0, Math.min(1, (y - by) / (0.98 - by)));
      return rz0 + (0.14 - rz0) * t + 0.014;
    };
    const w = o.apron.width ?? 0.2;
    const zb = frontZ(yb);
    m.box(0, yb, 0.97, zb, w, 0.012, { topW: w * 0.9, leanZ: frontZ(0.97) - zb });
    if (o.apron.trim !== undefined) {
      m.color(o.apron.trim);
      m.box(0, yb, yb + 0.04, zb + 0.004, w + 0.01, 0.012);
    }
  }

  // things at the hip
  if (o.hip) {
    const hc = o.hipColor ?? 0x4a3a2a;
    m.setBone(HIPS).color(hc);
    switch (o.hip) {
      case 'sword':
        m.rotated(d.pelvis / 2 + 0.06, 0.95, 0.02, 0, 0, 0.3, () => m.box(d.pelvis / 2 + 0.06, 0.38, 0.95, 0.02, 0.06, 0.05));
        m.color(0xb8a050);
        m.cube(d.pelvis / 2 + 0.12, 0.98, 0.02, 0.12, 0.025, 0.04);
        break;
      case 'katana':
        m.rotated(d.pelvis / 2 + 0.05, 0.95, 0.05, -0.6, 0, 0.25, () => m.box(d.pelvis / 2 + 0.05, 0.25, 0.98, 0.05, 0.05, 0.045));
        break;
      case 'pouch':
        m.cube(-d.pelvis / 2 - 0.02, 0.86, 0.06, 0.08, 0.12, 0.1);
        break;
      case 'satchel':
        m.cube(d.pelvis / 2 + 0.04, 0.82, 0.02, 0.08, 0.2, 0.2);
        break;
      case 'tools':
        m.cube(d.pelvis / 2 + 0.02, 0.88, 0.05, 0.06, 0.14, 0.1);
        m.color(0x8a8a8a);
        m.cube(-d.pelvis / 2 - 0.02, 0.84, 0.04, 0.04, 0.2, 0.04);
        break;
      case 'holster':
        m.setBone(THIGH_R).color(hc);
        m.cube(-d.legX - 0.1, 0.72, 0.0, 0.06, 0.2, 0.11);
        m.color(0x3a3a3a);
        m.cube(-d.legX - 0.1, 0.84, 0.0, 0.05, 0.06, 0.05);
        break;
    }
  }

  // ---------------- hair and beard ----------------
  hairAndBeard(m, o);
  if (o.hat) hat(m, o.hat);
  return m.build();
}

function hairAndBeard(m: Mesher, o: Outfit): void {
  const hc = o.hair;
  m.setBone(HEAD).color(hc);
  const style = o.hairStyle;
  const hatHides = o.hat && ['fez', 'turban', 'hood', 'kabuto', 'bandana', 'skullcap'].includes(o.hat.kind);
  if (style !== 'bald') {
    // a cap of hair tilted back so the hairline sits above the brows and the back covers the nape
    // (nearly spherical so the tilt never lets the scalp show through)
    m.rotated(0, 1.635, 0.0, -0.62, 0, 0, () => m.sphere(0, 1.635, 0.0, 0.226, 0.232, 0.228, 12, 4, -0.22, Math.PI / 2));
    void hatHides;
  }
  switch (style) {
    case 'long':
    case 'braid':
      m.box(0, 1.28, 1.66, -0.13, 0.34, 0.12, { topW: 0.4, topD: 0.16 });
      m.box(0.185, 1.38, 1.64, -0.01, 0.07, 0.17);
      m.box(-0.185, 1.38, 1.64, -0.01, 0.07, 0.17);
      if (style === 'braid') m.box(0, 0.95, 1.3, -0.17, 0.08, 0.07);
      break;
    case 'shoulder':
      m.box(0, 1.4, 1.66, -0.12, 0.36, 0.12, { topW: 0.4, topD: 0.15 });
      m.box(0.19, 1.47, 1.64, -0.01, 0.06, 0.16);
      m.box(-0.19, 1.47, 1.64, -0.01, 0.06, 0.16);
      break;
    case 'bob':
      m.box(0, 1.48, 1.66, -0.1, 0.4, 0.16, { topW: 0.42 });
      m.box(0.2, 1.5, 1.65, 0.0, 0.05, 0.18);
      m.box(-0.2, 1.5, 1.65, 0.0, 0.05, 0.18);
      break;
    case 'bun':
      m.sphere(0, 1.72, -0.21, 0.09, 0.08, 0.08, 7, 4);
      break;
    case 'buns':
      m.sphere(0.13, 1.82, -0.05, 0.07, 0.07, 0.07, 7, 4);
      m.sphere(-0.13, 1.82, -0.05, 0.07, 0.07, 0.07, 7, 4);
      break;
    case 'topknot':
      m.sphere(0, 1.89, -0.03, 0.075, 0.07, 0.075, 7, 4);
      break;
    default:
      break;
  }
  const beard = o.beard ?? 'none';
  if (beard === 'none') return;
  m.color(o.beardColor ?? hc);
  m.cube(0, 1.558, 0.19, 0.13, 0.03, 0.035);
  switch (beard) {
    case 'goatee':
      m.cube(0, 1.47, 0.155, 0.09, 0.08, 0.06);
      break;
    case 'short':
      m.box(0, 1.43, 1.515, 0.07, 0.28, 0.2, { topW: 0.36, topD: 0.24 });
      break;
    case 'full':
      m.box(0, 1.38, 1.515, 0.07, 0.28, 0.21, { topW: 0.37, topD: 0.24 });
      break;
    case 'long':
      m.box(0, 1.26, 1.515, 0.08, 0.18, 0.17, { topW: 0.36, topD: 0.24 });
      break;
    case 'square':
      m.box(0, 1.22, 1.515, 0.08, 0.3, 0.19, { topW: 0.36, topD: 0.24 });
      m.color(shade(o.beardColor ?? hc, 0.7));
      m.box(0, 1.3, 1.32, 0.08, 0.31, 0.2);
      m.box(0, 1.39, 1.41, 0.08, 0.33, 0.21);
      break;
    default:
      break;
  }
}

function hat(m: Mesher, h: Hat): void {
  m.setBone(HEAD).color(h.color);
  const c2 = h.color2 ?? shade(h.color, 0.75);
  const band = (y0: number, y1: number, r: number, color: number): void => {
    m.color(color);
    m.frustum(0, y0, y1, 0.0, r, r * 0.97, r * 0.99, r * 0.96, 12, { top: false, bottom: false });
  };
  const dome = (y: number, rx: number, ry: number, rz: number, color: number, lat0 = 0): void => {
    m.color(color);
    m.sphere(0, y, 0.0, rx, ry, rz, 10, 4, lat0, Math.PI / 2);
  };
  const cone = (x: number, y0: number, y1: number, z: number, r: number, color: number): void => {
    m.color(color);
    m.frustum(x, y0, y1, z, r, r, 0, 0, 6);
  };
  switch (h.kind) {
    case 'headband':
      band(1.69, 1.75, 0.222, h.color);
      break;
    case 'skullcap':
      dome(1.69, 0.228, 0.2, 0.222, h.color, -0.15);
      if (h.color2 !== undefined) band(1.67, 1.73, 0.232, h.color2);
      break;
    case 'fez': {
      const ht = h.size ?? 0.26;
      m.color(h.color);
      m.frustum(0, 1.68, 1.68 + ht, 0, 0.205, 0.2, 0.19, 0.185, 12);
      if (h.color2 !== undefined) band(1.68, 1.74, 0.212, h.color2);
      if (h.color3 !== undefined) band(1.68 + ht - 0.05, 1.68 + ht, 0.195, h.color3);
      break;
    }
    case 'spike':
      dome(1.68, 0.235, 0.215, 0.228, h.color, -0.1);
      band(1.66, 1.71, 0.238, c2);
      cone(0, 1.86, 2.02, 0, 0.045, h.color2 ?? h.color);
      break;
    case 'crest':
      dome(1.68, 0.235, 0.215, 0.23, h.color, -0.1);
      m.color(h.color);
      m.box(0.2, 1.48, 1.68, 0.06, 0.04, 0.15);
      m.box(-0.2, 1.48, 1.68, 0.06, 0.04, 0.15);
      m.color(c2);
      m.box(0, 1.84, 2.08, -0.03, 0.07, 0.36, { topD: 0.44 });
      m.box(0, 1.5, 1.86, -0.24, 0.06, 0.06);
      break;
    case 'pschent':
      m.color(h.color);
      m.frustum(0, 1.7, 2.1, 0, 0.21, 0.2, 0.15, 0.14, 10, { colorOf: (i) => (i % 2 ? c2 : h.color) });
      band(1.69, 1.77, 0.222, h.color3 ?? 0xd9a52a);
      break;
    case 'horns':
      band(1.69, 1.8, 0.224, h.color);
      dome(1.79, 0.2, 0.06, 0.19, h.color);
      m.color(c2);
      m.cube(0, 1.86, 0, 0.5, 0.05, 0.06);
      for (const s of [1, -1]) m.rotated(s * 0.24, 1.86, 0, 0, 0, -s * 0.35, () => m.box(s * 0.24, 1.86, 2.08, 0, 0.05, 0.05, { topW: 0.03 }));
      break;
    case 'wreath':
      m.color(h.color);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const x = Math.cos(a) * 0.218;
        const z = Math.sin(a) * 0.208;
        m.rotated(x, 1.74, z, 0, -a, 0.4, () => m.cube(x, 1.74, z, 0.04, 0.05, 0.08));
      }
      break;
    case 'athena':
      dome(1.68, 0.235, 0.22, 0.23, h.color, -0.15);
      cone(0, 1.86, 2.04, 0, 0.05, h.color);
      m.color(h.color);
      for (const s of [1, -1]) m.rotated(s * 0.19, 1.8, 0, 0, 0, -s * 0.7, () => m.box(s * 0.19, 1.8, 1.98, 0, 0.04, 0.04, { topW: 0.01 }));
      break;
    case 'turban':
      m.sphere(0, 1.73, 0, 0.25, 0.14, 0.245, 10, 4);
      m.color(shade(h.color, 0.92));
      m.sphere(0, 1.81, -0.01, 0.2, 0.1, 0.2, 10, 3);
      if (h.color2 !== undefined) {
        m.color(h.color2);
        m.cube(0, 1.75, 0.235, 0.06, 0.07, 0.03);
      }
      break;
    case 'feathers': {
      const size = h.size ?? 0.5;
      const n = 9 + Math.round(size * 6);
      const spread = 1.0 + size * 0.45;
      const len = 0.2 + size * 0.32;
      for (let i = 0; i < n; i++) {
        const a = -spread + (2 * spread * i) / (n - 1);
        m.color(i % 2 && h.color3 !== undefined ? h.color3 : shade(h.color, 0.92 + (i % 3) * 0.06));
        m.rotated(0, 1.78, -0.1, -0.25, 0, a, () => m.box(0, 1.78, 1.78 + len, -0.1, 0.075, 0.025, { topW: 0.1 }));
      }
      band(1.68, 1.79, 0.228, c2);
      m.color(c2);
      m.cube(0, 1.76, 0.225, 0.09, 0.09, 0.03);
      break;
    }
    case 'viking':
      dome(1.68, 0.235, 0.22, 0.23, h.color, -0.08);
      band(1.66, 1.71, 0.24, c2);
      m.color(h.color);
      m.box(0, 1.56, 1.7, 0.225, 0.04, 0.03);
      if (h.spike) cone(0, 1.86, 1.98, 0, 0.04, h.color);
      if (h.horns) {
        m.color(0xe8dcc0);
        for (const s of [1, -1]) {
          m.rotated(s * 0.2, 1.76, 0, 0, 0, -s * 1.0, () => m.box(s * 0.2, 1.76, 1.94, 0, 0.06, 0.06, { topW: 0.045, topD: 0.045 }));
          m.rotated(s * 0.35, 1.86, 0, 0, 0, -s * 0.15, () => m.box(s * 0.35, 1.86, 2.0, 0, 0.045, 0.045, { topW: 0.015, topD: 0.015 }));
        }
      }
      break;
    case 'mukuta':
      band(1.68, 1.76, 0.226, h.color);
      m.color(h.color);
      m.frustum(0, 1.76, 1.91, 0, 0.19, 0.18, 0.11, 0.1, 10);
      m.frustum(0, 1.91, 2.01, 0, 0.11, 0.1, 0.065, 0.06, 8);
      cone(0, 2.01, 2.24, 0, 0.05, h.color);
      for (const s of [1, -1]) m.rotated(s * 0.17, 1.76, 0.02, 0, 0, -s * 0.35, () => cone(s * 0.17, 1.76, 1.94, 0.02, 0.035, h.color));
      cone(0, 1.76, 1.93, 0.17, 0.035, h.color);
      break;
    case 'mongol':
      m.color(h.color);
      m.frustum(0, 1.67, 1.79, 0, 0.23, 0.22, 0.27, 0.26, 12, { top: false });
      dome(1.77, 0.205, 0.15, 0.2, shade(h.color, 0.96));
      m.color(c2);
      m.sphere(0, 1.95, 0, 0.035, 0.035, 0.035, 6, 3);
      if (h.horns) {
        m.color(h.color);
        for (const s of [1, -1]) m.rotated(s * 0.14, 1.86, 0, 0, 0, -s * 0.6, () => m.box(s * 0.14, 1.86, 2.0, 0, 0.035, 0.035, { topW: 0.01 }));
      }
      break;
    case 'jingasa':
      dome(1.76, 0.205, 0.11, 0.2, h.color);
      m.color(h.color);
      m.frustum(0, 1.74, 1.8, 0, 0.37, 0.36, 0.2, 0.195, 12, { top: false });
      break;
    case 'kasa':
      m.frustum(0, 1.74, 2.02, 0, 0.47, 0.46, 0.02, 0.02, 12);
      break;
    case 'kabuto':
      dome(1.68, 0.245, 0.225, 0.24, h.color, -0.1);
      m.doubleSided = true;
      m.frustum(0, 1.5, 1.7, 0, 0.36, 0.35, 0.245, 0.24, 12, { top: false, bottom: false, skip: (i) => i === 2 || i === 3 });
      m.doubleSided = false;
      m.color(c2);
      m.cube(0, 1.8, 0.215, 0.12, 0.07, 0.03);
      for (const s of [1, -1]) {
        m.rotated(s * 0.05, 1.8, 0.22, 0, 0, -s * 0.5, () => m.box(s * 0.05, 1.8, 2.1, 0.22, 0.04, 0.03));
        m.rotated(s * 0.2, 2.06, 0.22, 0, 0, s * 0.9, () => m.box(s * 0.2, 2.06, 2.16, 0.22, 0.035, 0.03));
      }
      break;
    case 'tricorn':
      m.color(h.color);
      m.frustum(0, 1.74, 1.88, 0, 0.205, 0.2, 0.18, 0.175, 10);
      m.frustum(0, 1.76, 1.84, 0, 0.36, 0.36, 0.38, 0.38, 3, { phase: Math.PI / 2 });
      if (h.color2 !== undefined) {
        m.color(h.color2);
        m.cube(0, 1.82, 0.27, 0.07, 0.07, 0.02);
      }
      break;
    case 'bandana':
      dome(1.69, 0.232, 0.19, 0.226, h.color, -0.12);
      m.cube(0, 1.66, -0.23, 0.1, 0.08, 0.06);
      break;
    case 'tophat':
      m.frustum(0, 1.76, 1.785, 0, 0.31, 0.3, 0.31, 0.3, 12);
      m.frustum(0, 1.785, 2.11, 0, 0.195, 0.19, 0.205, 0.2, 12);
      band(1.79, 1.84, 0.2, c2);
      break;
    case 'bowler':
      m.frustum(0, 1.76, 1.78, 0, 0.29, 0.28, 0.29, 0.28, 12);
      dome(1.78, 0.2, 0.17, 0.2, h.color);
      band(1.78, 1.82, 0.202, c2);
      break;
    case 'flatcap':
      m.sphere(0, 1.79, 0.02, 0.235, 0.095, 0.245, 10, 4);
      m.box(0, 1.755, 1.775, 0.2, 0.26, 0.12);
      break;
    case 'cowboy':
      m.frustum(0, 1.76, 1.79, 0, 0.42, 0.36, 0.42, 0.36, 12);
      for (const s of [1, -1]) m.rotated(s * 0.36, 1.78, 0, 0, 0, s * 0.5, () => m.box(s * 0.38, 1.77, 1.79, 0, 0.1, 0.5));
      m.frustum(0, 1.79, 1.99, 0, 0.19, 0.17, 0.16, 0.14, 10);
      band(1.79, 1.83, 0.192, c2);
      break;
    case 'bonnet':
      dome(1.7, 0.25, 0.22, 0.25, h.color, -0.1);
      m.color(h.color);
      m.frustum(0, 1.68, 1.71, 0, 0.32, 0.32, 0.3, 0.3, 12);
      if (h.spike) cone(0, 1.9, 1.96, 0, 0.03, h.color);
      break;
    case 'ladyhat':
      m.frustum(0, 1.77, 1.79, 0, 0.28, 0.27, 0.28, 0.27, 12);
      m.frustum(0, 1.79, 1.9, 0, 0.17, 0.165, 0.15, 0.145, 10);
      band(1.79, 1.83, 0.172, c2);
      break;
    case 'hood':
      m.rotated(0, 1.63, 0.01, -0.45, 0, 0, () => m.sphere(0, 1.63, 0, 0.245, 0.25, 0.235, 10, 4, -0.5, Math.PI / 2));
      m.box(0, 1.36, 1.6, -0.13, 0.36, 0.12, { topW: 0.42 });
      break;
  }
  if (h.goggles) {
    for (const s of [1, -1]) {
      m.color(0xb88a3a);
      m.rotated(s * 0.075, 1.82, 0.2, Math.PI / 2, 0, 0, () => m.frustum(s * 0.075, 1.8, 1.84, 0.2, 0.045, 0.045, 0.045, 0.045, 8));
      m.color(0x3a5a6a);
      m.cube(s * 0.075, 1.82, 0.235, 0.05, 0.05, 0.01);
    }
  }
}

// ---------------- runtime ----------------

const material = new MeshLambertMaterial({ vertexColors: true });
const geoCache = new Map<string, BufferGeometry>();

/** A rigged, animated person built from an outfit. One draw call. */
export class Character {
  readonly group = new Group();
  readonly mesh: SkinnedMesh;
  private bones: Bone[];
  private phase = 0;
  private t = Math.random() * 10;
  private longSkirt: boolean;

  constructor(outfit: Outfit, cacheKey?: string) {
    let geo = cacheKey ? geoCache.get(cacheKey) : undefined;
    if (!geo) {
      geo = buildCharacterGeometry(outfit);
      if (cacheKey) geoCache.set(cacheKey, geo);
    }
    this.mesh = new SkinnedMesh(geo, material);
    const layout = boneLayout(dims(outfit));
    this.bones = layout.map(() => new Bone());
    layout.forEach(([parent, x, y, z], i) => {
      const b = this.bones[i];
      if (parent < 0) {
        b.position.set(x, y, z);
        this.mesh.add(b);
      } else {
        const p = layout[parent];
        b.position.set(x - p[1], y - p[2], z - p[3]);
        this.bones[parent].add(b);
      }
    });
    this.mesh.updateMatrixWorld(true);
    this.mesh.bind(new Skeleton(this.bones));
    this.mesh.castShadow = true;
    this.mesh.computeBoundingSphere();
    this.group.add(this.mesh);
    this.longSkirt = !!(outfit.skirt && outfit.skirt.length > 0.6 && !outfit.skirt.open);
  }

  /** speed in m/s drives the walk cycle; standing still breathes and sways a little. */
  animate(dt: number, speed: number): void {
    const b = this.bones;
    this.t += dt;
    this.phase += dt * Math.min(14, 1.2 + speed * 2.4);
    let amp = Math.min(0.85, speed * 0.17);
    if (this.longSkirt) amp *= 0.55;
    const s = Math.sin(this.phase) * amp;
    b[THIGH_L].rotation.x = -s;
    b[THIGH_R].rotation.x = s;
    b[SHIN_L].rotation.x = Math.max(0, Math.sin(this.phase + 0.6)) * amp * 1.3;
    b[SHIN_R].rotation.x = Math.max(0, Math.sin(this.phase + Math.PI + 0.6)) * amp * 1.3;
    const breathe = Math.sin(this.t * 1.7) * (1 - Math.min(1, speed));
    b[UARM_L].rotation.x = s * 0.9;
    b[UARM_R].rotation.x = -s * 0.9;
    b[UARM_L].rotation.z = 0.07 + breathe * 0.015;
    b[UARM_R].rotation.z = -0.07 - breathe * 0.015;
    b[FARM_L].rotation.x = -0.2 - amp * 0.35;
    b[FARM_R].rotation.x = -0.2 - amp * 0.35;
    b[HIPS].position.y = 0.86 + Math.abs(Math.sin(this.phase)) * amp * 0.05 - amp * 0.02;
    b[CHEST].rotation.y = s * 0.18;
    b[CHEST].rotation.x = breathe * 0.02 + amp * 0.06;
    b[HEAD].rotation.y = -s * 0.1;
  }

  dispose(): void {
    this.mesh.skeleton.dispose();
  }
}
