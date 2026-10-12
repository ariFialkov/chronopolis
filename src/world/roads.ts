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
    const ya = heightAt(ax, az) + 0.04;
    const yb = heightAt(bx, bz) + 0.04;
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
    mb.quad(ax + nx * hw, ya, az + nz * hw, bx + nx * hw, yb, bz + nz * hw, bx - nx * hw, yb, bz - nz * hw, ax - nx * hw, ya, az - nz * hw);

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
        const y0 = ya + ((yb - ya) * t) / len + 0.01;
        const y1 = ya + ((yb - ya) * t1) / len + 0.01;
        mb.quad(x0 + nx * 0.1, y0, z0 + nz * 0.1, x1 + nx * 0.1, y1, z1 + nz * 0.1, x1 - nx * 0.1, y1, z1 - nz * 0.1, x0 - nx * 0.1, y0, z0 - nz * 0.1);
      }
    }

    if (opt.sidewalk && surf.sidewalk !== null && surf.sidewalkWidth > 0) {
      const sw = surf.sidewalkWidth;
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      for (const s of [-1, 1]) {
        if (opt.sidewalkOk && !opt.sidewalkOk(mx + nx * s * (hw + sw / 2), mz + nz * s * (hw + sw / 2))) continue;
        const h = 0.14;
        const i0 = hw;
        const i1 = hw + sw;
        mb.material(surf.sidewalk, surf.sidewalk === TILE.WOOD ? 0.5 : 0.5);
        mb.setColor(surf.sidewalkColor);
        // top (counter-clockwise from above for both sides)
        if (s > 0) mb.quad(ax + nx * i0, ya + h, az + nz * i0, bx + nx * i0, yb + h, bz + nz * i0, bx + nx * i1, yb + h, bz + nz * i1, ax + nx * i1, ya + h, az + nz * i1);
        else mb.quad(ax - nx * i1, ya + h, az - nz * i1, bx - nx * i1, yb + h, bz - nz * i1, bx - nx * i0, yb + h, bz - nz * i0, ax - nx * i0, ya + h, az - nz * i0);
        // curb face toward the road
        mb.material(TILE.CONCRETE, 1);
        mb.setColor(surf.curbColor);
        if (s > 0) mb.quad(ax + nx * i0, ya, az + nz * i0, ax + nx * i0, ya + h, az + nz * i0, bx + nx * i0, yb + h, bz + nz * i0, bx + nx * i0, yb, bz + nz * i0);
        else mb.quad(bx - nx * i0, yb, bz - nz * i0, bx - nx * i0, yb + h, bz - nz * i0, ax - nx * i0, ya + h, az - nz * i0, ax - nx * i0, ya, az - nz * i0);
      }
    }
  }
}
