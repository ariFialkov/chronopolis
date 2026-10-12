/**
 * Procedural texture atlas. 4x4 tiles of 256 px, mostly greyscale luminance variation so the
 * vertex colour supplies the hue. Sampled through a shader patch (see material.ts) so each
 * face can pick its own repeating tile while the whole chunk stays one draw call.
 */
import { CanvasTexture, LinearMipmapLinearFilter, LinearFilter, SRGBColorSpace } from 'three';
import { hash2 } from '../util/rng';

export const TILE = {
  PLASTER: 0,
  BRICK: 1,
  STONE: 2,
  WOOD: 3,
  ROOFTILE: 4,
  THATCH: 5,
  SLATE: 6,
  COBBLE: 7,
  ASPHALT: 8,
  DIRT: 9,
  GRASS: 10,
  SAND: 11,
  SLAB: 12,
  MUDBRICK: 13,
  TIMBERFRAME: 14,
  CONCRETE: 15,
} as const;
export type Tile = (typeof TILE)[keyof typeof TILE];

export const ATLAS_TILES = 4;
const T = 256;

function noiseFill(ctx: CanvasRenderingContext2D, ox: number, oy: number, base: number, amp: number, grain: number, seed: number): void {
  const img = ctx.createImageData(T, T);
  for (let y = 0; y < T; y++) {
    for (let x = 0; x < T; x++) {
      const gx = Math.floor(x / grain);
      const gy = Math.floor(y / grain);
      const n = (hash2(gx, gy, seed) - 0.5) * amp + (hash2(x, y, seed + 1) - 0.5) * amp * 0.5;
      const v = Math.max(0, Math.min(255, Math.round((base + n) * 255)));
      const i = (y * T + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, ox, oy);
}

function lines(ctx: CanvasRenderingContext2D, ox: number, oy: number, horizontal: boolean, spacing: number, width: number, shade: string, offsetEvery = 0, offset = 0): void {
  ctx.fillStyle = shade;
  for (let p = 0; p < T; p += spacing) {
    if (horizontal) ctx.fillRect(ox, oy + p, T, width);
    else ctx.fillRect(ox + p, oy, width, T);
  }
  if (offsetEvery) {
    // brick/stone joints: vertical joints offset every other course
    let row = 0;
    for (let y = 0; y < T; y += spacing) {
      const o = row % 2 === 0 ? 0 : offset;
      for (let x = o; x < T + offset; x += offsetEvery) ctx.fillRect(ox + (x % T), oy + y, width, spacing);
      row++;
    }
  }
}

function tileOrigin(i: number): [number, number] {
  return [(i % ATLAS_TILES) * T, Math.floor(i / ATLAS_TILES) * T];
}

export function buildAtlas(): CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = T * ATLAS_TILES;
  const ctx = canvas.getContext('2d')!;
  const at = (i: number): [number, number] => tileOrigin(i);
  let o: [number, number];

  o = at(TILE.PLASTER);
  noiseFill(ctx, o[0], o[1], 0.86, 0.1, 3, 1);
  o = at(TILE.BRICK);
  noiseFill(ctx, o[0], o[1], 0.8, 0.16, 2, 2);
  lines(ctx, o[0], o[1], true, 16, 2, 'rgba(40,30,25,0.55)', 32, 16);
  o = at(TILE.STONE);
  noiseFill(ctx, o[0], o[1], 0.82, 0.14, 4, 3);
  lines(ctx, o[0], o[1], true, 42, 3, 'rgba(30,30,30,0.5)', 86, 43);
  o = at(TILE.WOOD);
  noiseFill(ctx, o[0], o[1], 0.8, 0.12, 1, 4);
  ctx.save();
  ctx.translate(o[0], o[1]);
  for (let y = 0; y < T; y += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.04 + 0.05 * hash2(y, 1, 5)})`;
    ctx.fillRect(0, y, T, 1);
  }
  ctx.restore();
  lines(ctx, o[0], o[1], false, 32, 2, 'rgba(20,15,10,0.55)');
  o = at(TILE.ROOFTILE);
  noiseFill(ctx, o[0], o[1], 0.82, 0.1, 2, 6);
  ctx.save();
  ctx.translate(o[0], o[1]);
  for (let y = 0; y < T; y += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y, T, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(0, y + 3, T, 2);
    const off = (y / 16) % 2 === 0 ? 0 : 16;
    for (let x = off; x < T; x += 32) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, y + 3, 2, 13);
    }
  }
  ctx.restore();
  o = at(TILE.THATCH);
  noiseFill(ctx, o[0], o[1], 0.8, 0.22, 1, 7);
  ctx.save();
  ctx.translate(o[0], o[1]);
  for (let x = 0; x < T; x += 3) {
    ctx.fillStyle = `rgba(0,0,0,${0.08 + 0.18 * hash2(x, 2, 8)})`;
    ctx.fillRect(x, 0, 1, T);
  }
  for (let y = 0; y < T; y += 48) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, y, T, 4);
  }
  ctx.restore();
  o = at(TILE.SLATE);
  noiseFill(ctx, o[0], o[1], 0.78, 0.12, 3, 9);
  lines(ctx, o[0], o[1], true, 20, 3, 'rgba(0,0,0,0.45)', 40, 20);
  o = at(TILE.COBBLE);
  noiseFill(ctx, o[0], o[1], 0.8, 0.18, 6, 10);
  ctx.save();
  ctx.translate(o[0], o[1]);
  for (let y = 0; y < T; y += 14) {
    const off = (y / 14) % 2 === 0 ? 0 : 7;
    for (let x = -7; x < T; x += 14) {
      ctx.fillStyle = `rgba(0,0,0,${0.1 + 0.2 * hash2(x, y, 11)})`;
      ctx.beginPath();
      ctx.ellipse(x + off + 7, y + 7, 7, 6.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.08 + 0.18 * hash2(x, y, 12)})`;
      ctx.beginPath();
      ctx.ellipse(x + off + 7, y + 6, 5, 4.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  o = at(TILE.ASPHALT);
  noiseFill(ctx, o[0], o[1], 0.84, 0.12, 1, 13);
  o = at(TILE.DIRT);
  noiseFill(ctx, o[0], o[1], 0.84, 0.16, 3, 14);
  ctx.save();
  ctx.translate(o[0], o[1]);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + 0.1 * hash2(i, 3, 15)})`;
    ctx.beginPath();
    ctx.ellipse(hash2(i, 4, 15) * T, hash2(i, 5, 15) * T, 4 + hash2(i, 6, 15) * 14, 2 + hash2(i, 7, 15) * 5, hash2(i, 8, 15) * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  o = at(TILE.GRASS);
  noiseFill(ctx, o[0], o[1], 0.84, 0.2, 2, 16);
  ctx.save();
  ctx.translate(o[0], o[1]);
  for (let i = 0; i < 400; i++) {
    ctx.fillStyle = `rgba(${hash2(i, 1, 17) > 0.5 ? '255,255,255' : '0,0,0'},0.12)`;
    ctx.fillRect(hash2(i, 2, 17) * T, hash2(i, 3, 17) * T, 1, 3 + hash2(i, 4, 17) * 4);
  }
  ctx.restore();
  o = at(TILE.SAND);
  noiseFill(ctx, o[0], o[1], 0.88, 0.08, 2, 18);
  o = at(TILE.SLAB);
  noiseFill(ctx, o[0], o[1], 0.86, 0.08, 4, 19);
  lines(ctx, o[0], o[1], true, 64, 3, 'rgba(0,0,0,0.35)');
  lines(ctx, o[0], o[1], false, 64, 3, 'rgba(0,0,0,0.35)');
  o = at(TILE.MUDBRICK);
  noiseFill(ctx, o[0], o[1], 0.84, 0.12, 3, 20);
  lines(ctx, o[0], o[1], true, 20, 2, 'rgba(60,40,20,0.28)', 48, 24);
  o = at(TILE.TIMBERFRAME);
  noiseFill(ctx, o[0], o[1], 0.88, 0.08, 3, 21);
  ctx.save();
  ctx.translate(o[0], o[1]);
  ctx.fillStyle = 'rgba(40,25,15,0.8)';
  ctx.fillRect(0, 0, 10, T);
  ctx.fillRect(T / 2 - 5, 0, 10, T);
  ctx.fillRect(0, 0, T, 10);
  ctx.fillRect(0, T / 2 - 5, T, 10);
  ctx.beginPath();
  ctx.moveTo(10, 10);
  ctx.lineTo(T / 2 - 5, T / 2 - 5);
  ctx.lineTo(T / 2 - 15, T / 2 - 5);
  ctx.lineTo(10, 22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  o = at(TILE.CONCRETE);
  noiseFill(ctx, o[0], o[1], 0.86, 0.06, 2, 22);
  lines(ctx, o[0], o[1], true, 85, 2, 'rgba(0,0,0,0.25)');

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = false; // tile row 0 is the top of the canvas
  tex.generateMipmaps = true;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 4;
  return tex;
}
