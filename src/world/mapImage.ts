/** Renders a top-down raster of the whole city for an era: water, roads, blocks, sites. */
import type { Era } from '../eras/types';
import { hash2 } from '../util/rng';
import { WORLD_HALF, isWater, isArterial, terrainHeight, SITES, ARTERIAL_WIDTH } from './macro';
import { makePattern, urbanity } from './pattern';
import { lotBuildChance, lotIsClear } from './world';

export const MAP_PX = 420;
export const MAP_SCALE = MAP_PX / (WORLD_HALF * 2); // px per meter

export function worldToMap(x: number, z: number): [number, number] {
  return [(x + WORLD_HALF) * MAP_SCALE, (z + WORLD_HALF) * MAP_SCALE];
}

function hex(c: number): string {
  return '#' + c.toString(16).padStart(6, '0');
}

export function renderEraMap(era: Era): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = MAP_PX;
  canvas.height = MAP_PX;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(MAP_PX, MAP_PX);
  const pattern = makePattern(era);
  const ground = era.ground;
  const water = era.water;
  const road = era.layout.pavedArterials ? era.road : era.dirt;
  for (let py = 0; py < MAP_PX; py++) {
    for (let px = 0; px < MAP_PX; px++) {
      const x = px / MAP_SCALE - WORLD_HALF;
      const z = py / MAP_SCALE - WORLD_HALF;
      let c = ground;
      if (isWater(x, z)) c = water;
      else {
        const h = terrainHeight(x, z);
        const u = urbanity(era, x, z);
        const f = 1 + (hash2(px, py, 5) - 0.5) * 0.1 - (h > 4 ? Math.min(0.3, h / 80) : 0) + (u < 0.2 && era.layout.fields ? 0.08 : 0);
        c = shadeHex(c, f);
        if (isArterial(x, z, ARTERIAL_WIDTH + 2)) c = road;
        else if (u > 0.15 && pattern.isStreet(x, z)) c = shadeHex(road, 1.12);
      }
      const i = (py * MAP_PX + px) * 4;
      img.data[i] = (c >> 16) & 255;
      img.data[i + 1] = (c >> 8) & 255;
      img.data[i + 2] = c & 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  // building blocks
  const lots = pattern.lotsInRect(-WORLD_HALF, -WORLD_HALF, WORLD_HALF, WORLD_HALF);
  ctx.fillStyle = hex(shadeHex(era.buildings[0].wallColors[0], 0.8));
  for (const lot of lots) {
    const p = lotBuildChance(era, lot);
    if (hash2(Math.round(lot.x * 10), Math.round(lot.z * 10), 9) > p) continue;
    const hw = lot.w * 0.5 * 0.95;
    const hd = lot.d * 0.5 * 0.95;
    if (!lotIsClear(lot, hw, hd, pattern)) continue;
    const [mx, my] = worldToMap(lot.x, lot.z);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(lot.rot);
    ctx.fillRect(-hw * MAP_SCALE * 0.8, -hd * MAP_SCALE * 0.8, hw * MAP_SCALE * 1.6, hd * MAP_SCALE * 1.6);
    ctx.restore();
  }
  // sites
  for (const id in SITES) {
    const s = SITES[id];
    const [mx, my] = worldToMap(s.x, s.z);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath();
    ctx.arc(mx, my, s.clear * MAP_SCALE * 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  return canvas;
}

function shadeHex(c: number, f: number): number {
  const r = Math.max(0, Math.min(255, ((c >> 16) & 255) * f));
  const g = Math.max(0, Math.min(255, ((c >> 8) & 255) * f));
  const b = Math.max(0, Math.min(255, (c & 255) * f));
  return (r << 16) | (g << 8) | b;
}
