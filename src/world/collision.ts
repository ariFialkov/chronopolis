/** Oriented box colliders on the ground plane. */
export interface Collider {
  x: number;
  z: number;
  hw: number;
  hd: number;
  rot: number;
  /** height of the obstacle above the ground, for camera and NPC avoidance (solid colliders) */
  h: number;
  tag?: string;
  /**
   * Walkable surface: absolute world height of the top at the collider's centre. A collider with a
   * top is a floor, step, terrace or deck: it only blocks when its top is out of step reach, and the
   * player can stand on it.
   */
  top?: number;
  /** rise of the top per metre along the collider's local x axis (ramps, stairs, bridge decks) */
  slope?: number;
}

/** How high the player can step up without jumping. */
export const STEP_UP = 0.7;

export function pointInCollider(c: Collider, px: number, pz: number, pad = 0): boolean {
  const dx = px - c.x;
  const dz = pz - c.z;
  const cs = Math.cos(-c.rot);
  const sn = Math.sin(-c.rot);
  const lx = dx * cs - dz * sn;
  const lz = dx * sn + dz * cs;
  return Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad;
}

/** Height of a walkable collider's top at a point (clamped to the collider's extent). */
export function topAt(c: Collider, px: number, pz: number): number {
  if (c.top === undefined) return Infinity;
  if (!c.slope) return c.top;
  const dx = px - c.x;
  const dz = pz - c.z;
  const lx = dx * Math.cos(c.rot) + dz * Math.sin(c.rot);
  return c.top + c.slope * Math.max(-c.hw, Math.min(c.hw, lx));
}

/** Walkable collider spanning from (ax,az) at height ya to (bx,bz) at height yb, `width` wide. */
export function rampCollider(ax: number, az: number, ya: number, bx: number, bz: number, yb: number, width: number, tag?: string): Collider {
  const len = Math.hypot(bx - ax, bz - az) || 1;
  return {
    x: (ax + bx) / 2,
    z: (az + bz) / 2,
    hw: len / 2,
    hd: width / 2,
    rot: Math.atan2(bz - az, bx - ax),
    h: 0,
    top: (ya + yb) / 2,
    slope: (yb - ya) / len,
    tag,
  };
}

/** Does this collider stop something standing at height y? */
export function blocks(c: Collider, px: number, pz: number, y: number): boolean {
  if (c.top !== undefined) return topAt(c, px, pz) > y + STEP_UP;
  return c.h >= 0.4;
}

/** Push a circle (px,pz,r) out of a collider. Returns the corrected position. */
export function resolveCircle(c: Collider, px: number, pz: number, r: number): [number, number] {
  const dx = px - c.x;
  const dz = pz - c.z;
  const cs = Math.cos(-c.rot);
  const sn = Math.sin(-c.rot);
  let lx = dx * cs - dz * sn;
  let lz = dx * sn + dz * cs;
  const ox = c.hw + r - Math.abs(lx);
  const oz = c.hd + r - Math.abs(lz);
  if (ox <= 0 || oz <= 0) return [px, pz];
  if (ox < oz) lx += ox * (lx < 0 ? -1 : 1);
  else lz += oz * (lz < 0 ? -1 : 1);
  const cs2 = Math.cos(c.rot);
  const sn2 = Math.sin(c.rot);
  return [c.x + lx * cs2 - lz * sn2, c.z + lx * sn2 + lz * cs2];
}
