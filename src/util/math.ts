export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const smoothstep = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
export const dist2 = (ax: number, az: number, bx: number, bz: number): number => {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
};
export const dist = (ax: number, az: number, bx: number, bz: number): number =>
  Math.sqrt(dist2(ax, az, bx, bz));

/** Shade a 24-bit color by factor (1 = unchanged). */
export function shade(color: number, f: number): number {
  const r = clamp(((color >> 16) & 255) * f, 0, 255);
  const g = clamp(((color >> 8) & 255) * f, 0, 255);
  const b = clamp((color & 255) * f, 0, 255);
  return (r << 16) | (g << 8) | b;
}

export function mixColor(a: number, b: number, t: number): number {
  const r = lerp((a >> 16) & 255, (b >> 16) & 255, t);
  const g = lerp((a >> 8) & 255, (b >> 8) & 255, t);
  const bl = lerp(a & 255, b & 255, t);
  return (r << 16) | (g << 8) | bl;
}

export function angleLerp(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

/** Distance from point to segment (2D). */
export function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const vx = bx - ax;
  const vz = bz - az;
  const wx = px - ax;
  const wz = pz - az;
  const len2 = vx * vx + vz * vz;
  let t = len2 > 0 ? (wx * vx + wz * vz) / len2 : 0;
  t = clamp(t, 0, 1);
  const cx = ax + vx * t;
  const cz = az + vz * t;
  return Math.hypot(px - cx, pz - cz);
}
