/** Oriented box colliders on the ground plane. */
export interface Collider {
  x: number;
  z: number;
  hw: number;
  hd: number;
  rot: number;
  /** height of the obstacle, for the minimap and NPC avoidance */
  h: number;
  tag?: string;
}

export function pointInCollider(c: Collider, px: number, pz: number, pad = 0): boolean {
  const dx = px - c.x;
  const dz = pz - c.z;
  const cs = Math.cos(-c.rot);
  const sn = Math.sin(-c.rot);
  const lx = dx * cs - dz * sn;
  const lz = dx * sn + dz * cs;
  return Math.abs(lx) < c.hw + pad && Math.abs(lz) < c.hd + pad;
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
