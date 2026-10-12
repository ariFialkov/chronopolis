import type { MeshBuilder } from './meshBuilder';
import type { Surfaces } from './surfaces';
import { shade } from '../util/math';
import { TILE } from './textures';

export interface StripOptions {
  sidewalk: boolean;
  lanes: boolean;
  /** called per piece: return false to skip the sidewalk piece there (junctions) */
  sidewalkOk?: (x: number, z: number) => boolean;
  /** minor street vs arterial look */
  minor: boolean;
  /** render as a canal instead of a road */
  canal?: boolean;
  /** extra height so crossing roads do not z-fight (metres) */
  lift?: number;
}

/**
 * Draws a road along a polyline with optional raised sidewalks, curbs and lane markings.
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
    // split down the centreline so the crown follows the ground
    const yaC = H(ax, az);
    const ybC = H(bx, bz);
    mb.quad(ax + nx * hw, yaL, az + nz * hw, bx + nx * hw, ybL, bz + nz * hw, bx, ybC, bz, ax, yaC, az);
    mb.quad(ax, yaC, az, bx, ybC, bz, bx - nx * hw, ybR, bz - nz * hw, ax - nx * hw, yaR, az - nz * hw);

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

    if (opt.sidewalk && surf.sidewalk !== null && surf.sidewalkWidth > 0) {
      const sw = surf.sidewalkWidth;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      for (const s of [-1, 1]) {
        if (opt.sidewalkOk) {
          // the whole piece must be clear of crossing streets, not just its midpoint
          const cx = nx * s * (hw + sw / 2);
          const cz = nz * s * (hw + sw / 2);
          if (!opt.sidewalkOk(mx + cx, mz + cz) || !opt.sidewalkOk(ax + cx, az + cz) || !opt.sidewalkOk(bx + cx, bz + cz)) continue;
        }
        const h = 0.14;
        const i0 = hw;
        const i1 = hw + sw;
        // the slab's eight corners: inner/outer edge at both ends, ground and top
        const ix0 = ax + nx * s * i0;
        const iz0 = az + nz * s * i0;
        const ix1 = bx + nx * s * i0;
        const iz1 = bz + nz * s * i0;
        const ox0 = ax + nx * s * i1;
        const oz0 = az + nz * s * i1;
        const ox1 = bx + nx * s * i1;
        const oz1 = bz + nz * s * i1;
        const gi0 = H(ix0, iz0);
        const gi1 = H(ix1, iz1);
        const go0 = H(ox0, oz0);
        const go1 = H(ox1, oz1);
        // slab top follows the road edge height; the outer bottom follows the ground outside
        const ti0 = gi0 + h;
        const ti1 = gi1 + h;
        const to0 = Math.max(go0, gi0 - 0.3) + h;
        const to1 = Math.max(go1, gi1 - 0.3) + h;
        const bi0 = gi0 - 0.08;
        const bi1 = gi1 - 0.08;
        const bo0 = Math.min(go0, to0 - 0.05) - 0.08;
        const bo1 = Math.min(go1, to1 - 0.05) - 0.08;
        mb.material(surf.sidewalk, 0.5);
        mb.setColor(surf.sidewalkColor);
        // top (counter-clockwise from above)
        if (s > 0) mb.quad(ix0, ti0, iz0, ix1, ti1, iz1, ox1, to1, oz1, ox0, to0, oz0);
        else mb.quad(ox0, to0, oz0, ox1, to1, oz1, ix1, ti1, iz1, ix0, ti0, iz0);
        mb.material(TILE.CONCRETE, 1);
        mb.setColor(surf.curbColor);
        // curb face toward the road
        if (s > 0) mb.quad(ix0, bi0, iz0, ix0, ti0, iz0, ix1, ti1, iz1, ix1, bi1, iz1);
        else mb.quad(ix1, bi1, iz1, ix1, ti1, iz1, ix0, ti0, iz0, ix0, bi0, iz0);
        // outer face
        mb.setColor(shade(surf.curbColor, 0.9));
        if (s > 0) mb.quad(ox1, bo1, oz1, ox1, to1, oz1, ox0, to0, oz0, ox0, bo0, oz0);
        else mb.quad(ox0, bo0, oz0, ox0, to0, oz0, ox1, to1, oz1, ox1, bo1, oz1);
        // end caps so a piece never shows as an open shell
        if (s > 0) {
          mb.quad(ox0, bo0, oz0, ox0, to0, oz0, ix0, ti0, iz0, ix0, bi0, iz0);
          mb.quad(ix1, bi1, iz1, ix1, ti1, iz1, ox1, to1, oz1, ox1, bo1, oz1);
        } else {
          mb.quad(ix0, bi0, iz0, ix0, ti0, iz0, ox0, to0, oz0, ox0, bo0, oz0);
          mb.quad(ox1, bo1, oz1, ox1, to1, oz1, ix1, ti1, iz1, ix1, bi1, iz1);
        }
      }
    }
  }
}
