import type { MeshBuilder } from './meshBuilder';
import type { Surfaces } from './surfaces';
import { shade } from '../util/math';
import { TILE } from './textures';

export interface StripOptions {
  lanes: boolean;
  /** minor street vs arterial look */
  minor: boolean;
  /** render as a canal instead of a road */
  canal?: boolean;
  /** extra height so crossing roads do not z-fight (metres) */
  lift?: number;
}

/**
 * Draws a road along a polyline with optional lane markings.
 * heightAt gives the ground height; the road sits 4 cm above it.
 */
export function buildRoadStrip(mb: MeshBuilder, pts: [number, number][], width: number, surf: Surfaces, heightAt: (x: number, z: number) => number, opt: StripOptions): void {
  const roadTile = opt.minor ? surf.minorRoad : surf.road;
  const roadColor = opt.minor ? surf.minorRoadColor : surf.roadColor;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i];
    const [bx, bz] = pts[i + 1];
    const dx = bx - ax;
    const dz = bz - az;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const ux = dx / len;
    const uz = dz / len;
    const nx = -uz;
    const nz = ux;
    const hw = width / 2;
    const lift = 0.07 + (opt.lift ?? 0);
    // sample the ground at every corner so the road hugs slopes in both directions
    const H = (px: number, pz: number): number => heightAt(px, pz) + lift;
    const yaL = H(ax + nx * hw, az + nz * hw);
    const yaR = H(ax - nx * hw, az - nz * hw);
    const ybL = H(bx + nx * hw, bz + nz * hw);
    const ybR = H(bx - nx * hw, bz - nz * hw);
    const ya = (yaL + yaR) / 2;
    const yb = (ybL + ybR) / 2;
    if (opt.canal) {
      // water channel: sunken bed with stone edges
      mb.material(TILE.STONE, 0.5);
      mb.setColor(shade(surf.plazaColor, 0.8));
      const e = 0.7;
      // edges
      mb.quad(ax + nx * hw, ya, az + nz * hw, bx + nx * hw, yb, bz + nz * hw, bx + nx * (hw - e), yb, bz + nz * (hw - e), ax + nx * (hw - e), ya, az + nz * (hw - e));
      mb.quad(ax - nx * (hw - e), ya, az - nz * (hw - e), bx - nx * (hw - e), yb, bz - nz * (hw - e), bx - nx * hw, yb, bz - nz * hw, ax - nx * hw, ya, az - nz * hw);
      // inner walls down to the water
      const depth = 1.2;
      mb.quad(ax + nx * (hw - e), ya, az + nz * (hw - e), bx + nx * (hw - e), yb, bz + nz * (hw - e), bx + nx * (hw - e), yb - depth, bz + nz * (hw - e), ax + nx * (hw - e), ya - depth, az + nz * (hw - e));
      mb.quad(ax - nx * (hw - e), ya - depth, az - nz * (hw - e), bx - nx * (hw - e), yb - depth, bz - nz * (hw - e), bx - nx * (hw - e), yb, bz - nz * (hw - e), ax - nx * (hw - e), ya, az - nz * (hw - e));
      // water surface
      mb.material(TILE.ASPHALT, 0.2);
      mb.setColor(0x3a8a8c);
      mb.quad(ax + nx * (hw - e), ya - depth * 0.6, az + nz * (hw - e), bx + nx * (hw - e), yb - depth * 0.6, bz + nz * (hw - e), bx - nx * (hw - e), yb - depth * 0.6, bz - nz * (hw - e), ax - nx * (hw - e), ya - depth * 0.6, az - nz * (hw - e));
      continue;
    }
    mb.material(roadTile, roadTile === TILE.COBBLE ? 0.6 : roadTile === TILE.SLAB ? 0.35 : 0.3);
    mb.setColor(roadColor);
    // a grid of small quads (every ~2 m along, edges and centreline across) so the surface follows
    // the ground over crests and dips instead of cutting under them
    const across = [hw, 0, -hw];
    // as few subdivisions as keep the surface within a few cm of the ground (flat ground: one quad)
    const fits = (m: number): boolean => {
      for (const o of across) {
        const ox = nx * o;
        const oz = nz * o;
        for (let k = 0; k < m; k++) {
          const y0 = H(ax + (bx - ax) * (k / m) + ox, az + (bz - az) * (k / m) + oz);
          const y1 = H(ax + (bx - ax) * ((k + 1) / m) + ox, az + (bz - az) * ((k + 1) / m) + oz);
          for (const f of [0.25, 0.5, 0.75]) {
            const t = (k + f) / m;
            if (H(ax + (bx - ax) * t + ox, az + (bz - az) * t + oz) - (y0 + (y1 - y0) * f) > 0.03) return false;
          }
        }
      }
      return true;
    };
    let n = 1;
    while (n < Math.ceil(len / 1.5) && !fits(n)) n *= 2;
    let prev = across.map((o) => H(ax + nx * o, az + nz * o));
    for (let k = 1; k <= n; k++) {
      const t0 = (k - 1) / n;
      const t1 = k / n;
      const px0 = ax + (bx - ax) * t0;
      const pz0 = az + (bz - az) * t0;
      const px1 = ax + (bx - ax) * t1;
      const pz1 = az + (bz - az) * t1;
      const cur = across.map((o) => H(px1 + nx * o, pz1 + nz * o));
      for (let j = 0; j < across.length - 1; j++) {
        const o0 = across[j];
        const o1 = across[j + 1];
        mb.quad(px0 + nx * o0, prev[j], pz0 + nz * o0, px1 + nx * o0, cur[j], pz1 + nz * o0, px1 + nx * o1, cur[j + 1], pz1 + nz * o1, px0 + nx * o1, prev[j + 1], pz0 + nz * o1);
      }
      prev = cur;
    }

    if (opt.lanes && surf.laneMarks && !opt.minor) {
      mb.material(TILE.ASPHALT, 0.3);
      mb.setColor(surf.laneColor);
      // dashed centre line
      for (let t = 0; t < len; t += 6) {
        const t1 = Math.min(len, t + 3);
        const x0 = ax + ux * t;
        const z0 = az + uz * t;
        const x1 = ax + ux * t1;
        const z1 = az + uz * t1;
        const y0 = H(x0, z0) + 0.012;
        const y1 = H(x1, z1) + 0.012;
        mb.quad(x0 + nx * 0.1, y0, z0 + nz * 0.1, x1 + nx * 0.1, y1, z1 + nz * 0.1, x1 - nx * 0.1, y1, z1 - nz * 0.1, x0 - nx * 0.1, y0, z0 - nz * 0.1);
      }
    }

  }
}
