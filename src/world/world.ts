/**
 * World streaming. The city is divided into 80 m chunks that are generated on demand around the
 * player and disposed when far away. Near chunks get full detail (windows, props, trees), far
 * chunks get buildings only, and everything beyond the far radius is hidden by fog.
 */
import { Color, FogExp2, Group, HemisphereLight, DirectionalLight, Mesh, MeshLambertMaterial, PlaneGeometry, Scene, BufferGeometry } from 'three';
import type { Era, BuildingTemplate } from '../eras/types';
import { hash2, Rng } from '../util/rng';
import { shade, clamp } from '../util/math';
import {
  CHUNK_SIZE, WORLD_HALF, ARTERIALS, ARTERIAL_WIDTH, SITES, terrainHeight, isWater, waterDepth, isArterial, arterialDistance,
  siteClearance, WATER_LEVEL, RING_ROAD, HILL, isBridge,
} from './macro';
import { makePattern, urbanity, type CityPattern, type Lot } from './pattern';
import { MeshBuilder } from './meshBuilder';
import { buildBuilding, type BuiltBuilding } from './buildings';
import { buildProp, buildTree } from './props';
import { buildLandmark, landmarkKeyForSite } from './landmarks';
import type { Collider } from './collision';
import { CHRONOPORT_ERAS } from '../eras';
import { CAMPAIGN } from '../quests/campaign';

/** Points that must never be built over: chronoports and quest locations. */
const RESERVED: { x: number; z: number; r: number }[] = [];
for (const e of CHRONOPORT_ERAS) RESERVED.push({ x: e.chronoport!.x, z: e.chronoport!.z, r: 9 });
for (const q of CAMPAIGN) {
  for (const st of q.steps) {
    if (st.kind === 'talk' || st.kind === 'read' || st.kind === 'goto') RESERVED.push({ x: st.x, z: st.z, r: 6 });
  }
}
export function isReserved(x: number, z: number, pad: number): boolean {
  for (const p of RESERVED) if (Math.hypot(p.x - x, p.z - z) < p.r + pad) return true;
  return false;
}

export const BRIDGE_DECK = 0.6;
export type Detail = 'near' | 'far';

interface Chunk {
  cx: number;
  cz: number;
  detail: Detail;
  mesh: Mesh | null;
  terrain: Mesh | null;
  colliders: Collider[];
  buildings: BuiltBuilding[];
}

export interface WorldQuality {
  nearRadius: number;
  farRadius: number;
}

function key(cx: number, cz: number): string {
  return `${cx},${cz}`;
}

/** Decides whether a lot gets a building. Shared with the map renderer so the map matches the world. */
export function lotBuildChance(era: Era, lot: Lot): number {
  const u = urbanity(era, lot.x, lot.z);
  let p = era.layout.density * lot.weight * u;
  if (u < 0.12 && era.layout.fields) p = 0.025 * lot.weight; // farmsteads
  return p;
}

export function lotIsClear(lot: Lot, hw: number, hd: number, pattern: CityPattern): boolean {
  if (siteClearance(lot.x, lot.z)) return false;
  const margin = Math.max(hw, hd);
  if (isReserved(lot.x, lot.z, margin)) return false;
  if (arterialDistance(lot.x, lot.z) < margin + ARTERIAL_WIDTH / 2 + 1.5) return false;
  const cs = Math.cos(lot.rot);
  const sn = Math.sin(lot.rot);
  for (const [lx, lz] of [
    [0, 0],
    [-hw, -hd],
    [hw, -hd],
    [hw, hd],
    [-hw, hd],
  ]) {
    const x = lot.x + lx * cs - lz * sn;
    const z = lot.z + lx * sn + lz * cs;
    if (waterDepth(x, z) > -6) return false;
    if (pattern.isStreet(x, z)) return false;
    if (Math.abs(x) > WORLD_HALF - 10 || Math.abs(z) > WORLD_HALF - 10) return false;
  }
  return true;
}

export class World {
  readonly scene: Scene;
  era: Era;
  pattern: CityPattern;
  quality: WorldQuality;
  private chunks = new Map<string, Chunk>();
  private material = new MeshLambertMaterial({ vertexColors: true });
  private staticGroup = new Group();
  private water: Mesh;
  private hemi: HemisphereLight;
  private sun: DirectionalLight;
  landmarkColliders: Collider[] = [];
  private pending: { cx: number; cz: number; detail: Detail }[] = [];

  constructor(scene: Scene, era: Era, quality: WorldQuality) {
    this.scene = scene;
    this.era = era;
    this.quality = quality;
    this.pattern = makePattern(era);
    this.hemi = new HemisphereLight(0xffffff, 0x888866, 1.2);
    this.sun = new DirectionalLight(0xffffff, 2.2);
    this.sun.position.set(0.5, 1, 0.35).multiplyScalar(300);
    scene.add(this.hemi, this.sun, this.staticGroup);
    this.water = new Mesh(new PlaneGeometry(WORLD_HALF * 4, WORLD_HALF * 4), new MeshLambertMaterial({ color: 0x3366aa, transparent: true, opacity: 0.86 }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = WATER_LEVEL;
    scene.add(this.water);
    this.applyEra();
  }

  setEra(era: Era): void {
    this.era = era;
    this.pattern = makePattern(era);
    for (const k of [...this.chunks.keys()]) this.unload(k);
    this.pending.length = 0;
    this.applyEra();
  }

  private applyEra(): void {
    const e = this.era;
    this.scene.background = new Color(e.sky);
    this.scene.fog = new FogExp2(e.fog, e.fogDensity);
    this.hemi.color.set(e.sky);
    this.hemi.groundColor.set(e.ground);
    this.sun.color.set(e.sun);
    this.sun.intensity = e.sunIntensity;
    (this.water.material as MeshLambertMaterial).color.set(e.water);
    // rebuild static geometry (arterials, landmarks)
    for (const child of [...this.staticGroup.children]) {
      this.staticGroup.remove(child);
      (child as Mesh).geometry.dispose();
    }
    this.landmarkColliders = [];
    this.buildArterials();
    this.buildLandmarks();
  }

  private buildArterials(): void {
    const mb = new MeshBuilder();
    const e = this.era;
    const paved = e.layout.pavedArterials;
    const roadColor = paved ? e.road : e.dirt;
    const w = ARTERIAL_WIDTH;
    for (const line of ARTERIALS) {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i];
        const [bx, bz] = line[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const steps = Math.ceil(len / 8);
        const dx = (bx - ax) / len;
        const dz = (bz - az) / len;
        const nx = -dz * (w / 2);
        const nz = dx * (w / 2);
        for (let s = 0; s < steps; s++) {
          const t0 = s / steps;
          const t1 = (s + 1) / steps;
          const x0 = ax + (bx - ax) * t0;
          const z0 = az + (bz - az) * t0;
          const x1 = ax + (bx - ax) * t1;
          const z1 = az + (bz - az) * t1;
          const water0 = isWater(x0, z0);
          const water1 = isWater(x1, z1);
          const y0 = water0 || water1 ? Math.max(terrainHeight(x0, z0), BRIDGE_DECK) + 0.05 : terrainHeight(x0, z0) + 0.05;
          const y1 = water0 || water1 ? Math.max(terrainHeight(x1, z1), BRIDGE_DECK) + 0.05 : terrainHeight(x1, z1) + 0.05;
          const bridge = water0 || water1;
          mb.setColor(bridge ? shade(e.road, 0.9) : roadColor);
          mb.quad(x0 + nx, y0, z0 + nz, x1 + nx, y1, z1 + nz, x1 - nx, y1, z1 - nz, x0 - nx, y0, z0 - nz);
          if (bridge) {
            // deck sides, railings and piers
            const stone = shade(e.road, 0.75);
            mb.setColor(stone);
            mb.quad(x0 + nx, y0 - 1.2, z0 + nz, x1 + nx, y1 - 1.2, z1 + nz, x1 + nx, y1, z1 + nz, x0 + nx, y0, z0 + nz);
            mb.quad(x0 - nx, y0, z0 - nz, x1 - nx, y1, z1 - nz, x1 - nx, y1 - 1.2, z1 - nz, x0 - nx, y0 - 1.2, z0 - nz);
            mb.box((x0 + x1) / 2 + nx * 0.95, y0, (z0 + z1) / 2 + nz * 0.95, len / steps, 1.0, 0.4, stone, Math.atan2(dz, dx));
            mb.box((x0 + x1) / 2 - nx * 0.95, y0, (z0 + z1) / 2 - nz * 0.95, len / steps, 1.0, 0.4, stone, Math.atan2(dz, dx));
            if (s % 2 === 0 && water0) mb.box(x0, -5, z0, 3, y0 + 4, w * 0.8, stone, Math.atan2(dz, dx));
          }
        }
      }
    }
    // city wall along the ring road for walled eras
    if (e.layout.walls) {
      const r = RING_ROAD + 12;
      const wallColor = shade(e.buildings[0].wallColors[0], 0.8);
      const sides: [number, number, number, number][] = [
        [-r, -r, r, -r],
        [r, -r, r, r],
        [r, r, -r, r],
        [-r, r, -r, -r],
      ];
      for (const [ax, az, bx, bz] of sides) {
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.ceil(len / 20);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const x = ax + (bx - ax) * t;
          const z = az + (bz - az) * t;
          if (isWater(x, z)) continue;
          if (isArterial(x, z, ARTERIAL_WIDTH + 8)) continue; // gates
          const y = terrainHeight(x, z);
          mb.box(x, y - 1, z, 20.4, 7, 2.5, wallColor, Math.atan2(bz - az, bx - ax));
          if (i % 4 === 0) mb.box(x, y - 1, z, 5, 10, 5, shade(wallColor, 0.95), Math.atan2(bz - az, bx - ax));
          this.landmarkColliders.push({ x, z, hw: 10.2, hd: 1.3, rot: Math.atan2(bz - az, bx - ax), h: 7, tag: 'wall' });
        }
      }
    }
    const mesh = new Mesh(mb.build(), this.material);
    mesh.frustumCulled = false;
    this.staticGroup.add(mesh);
  }

  private buildLandmarks(): void {
    const mb = new MeshBuilder();
    for (const id in SITES) {
      const site = SITES[id];
      const k = landmarkKeyForSite(this.era, id);
      if (!k) continue;
      const rng = new Rng(hash2(site.x, site.z, 77) * 1e9);
      const y = terrainHeight(site.x, site.z);
      const cols = buildLandmark(mb, k, site, this.era, y, rng);
      for (const c of cols) this.landmarkColliders.push(c);
    }
    const mesh = new Mesh(mb.build(), this.material);
    mesh.frustumCulled = false;
    this.staticGroup.add(mesh);
  }

  /** Called each frame with the player position. Builds at most one chunk per call. */
  update(px: number, pz: number, budgetMs = 6): void {
    const ccx = Math.floor(px / CHUNK_SIZE);
    const ccz = Math.floor(pz / CHUNK_SIZE);
    const { nearRadius, farRadius } = this.quality;
    // unload far chunks
    for (const [k, ch] of this.chunks) {
      const d = Math.max(Math.abs(ch.cx - ccx), Math.abs(ch.cz - ccz));
      if (d > farRadius + 1) this.unload(k);
      else if (ch.detail === 'far' && d <= nearRadius) this.queue(ch.cx, ch.cz, 'near');
      else if (ch.detail === 'near' && d > nearRadius + 1) this.queue(ch.cx, ch.cz, 'far');
    }
    // queue missing chunks, nearest first
    for (let r = 0; r <= farRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const cx = ccx + dx;
          const cz = ccz + dz;
          if (Math.abs(cx * CHUNK_SIZE) > WORLD_HALF + CHUNK_SIZE || Math.abs(cz * CHUNK_SIZE) > WORLD_HALF + CHUNK_SIZE) continue;
          if (!this.chunks.has(key(cx, cz))) this.queue(cx, cz, r <= nearRadius ? 'near' : 'far');
        }
      }
    }
    const start = performance.now();
    while (this.pending.length && performance.now() - start < budgetMs) {
      // nearest pending first
      let bi = 0;
      let bd = Infinity;
      for (let i = 0; i < this.pending.length; i++) {
        const p = this.pending[i];
        const d = Math.max(Math.abs(p.cx - ccx), Math.abs(p.cz - ccz));
        if (d < bd) {
          bd = d;
          bi = i;
        }
      }
      const p = this.pending.splice(bi, 1)[0];
      const desired = bd <= nearRadius ? 'near' : 'far';
      this.load(p.cx, p.cz, desired);
    }
  }

  /** Synchronously build everything around a point (used on era entry, behind a loading screen). */
  warmup(px: number, pz: number): void {
    this.update(px, pz, 1e9);
    this.update(px, pz, 1e9);
  }

  get pendingCount(): number {
    return this.pending.length;
  }

  private queue(cx: number, cz: number, detail: Detail): void {
    if (this.pending.some((p) => p.cx === cx && p.cz === cz)) return;
    this.pending.push({ cx, cz, detail });
  }

  private unload(k: string): void {
    const ch = this.chunks.get(k);
    if (!ch) return;
    if (ch.mesh) {
      this.scene.remove(ch.mesh);
      ch.mesh.geometry.dispose();
    }
    if (ch.terrain) {
      this.scene.remove(ch.terrain);
      ch.terrain.geometry.dispose();
    }
    this.chunks.delete(k);
  }

  private load(cx: number, cz: number, detail: Detail): void {
    const k = key(cx, cz);
    const existing = this.chunks.get(k);
    if (existing && existing.detail === detail) return;
    if (existing) this.unload(k);
    const ch = this.buildChunk(cx, cz, detail);
    this.chunks.set(k, ch);
  }

  private buildChunk(cx: number, cz: number, detail: Detail): Chunk {
    const e = this.era;
    const x0 = cx * CHUNK_SIZE;
    const z0 = cz * CHUNK_SIZE;
    const x1 = x0 + CHUNK_SIZE;
    const z1 = z0 + CHUNK_SIZE;
    const rng = new Rng(hash2(cx, cz, 4242) * 1e9);
    const mb = new MeshBuilder();
    const colliders: Collider[] = [];
    const buildings: BuiltBuilding[] = [];

    // terrain
    const terrain = this.buildTerrain(x0, z0);

    // minor streets
    const strips = this.pattern.stripsInRect(x0, z0, x1, z1);
    const roadColor = e.layout.pattern === 'spread' || !e.layout.pavedArterials ? e.dirt : shade(e.road, 1.05);
    for (const strip of strips) {
      for (let i = 0; i < strip.points.length - 1; i++) {
        const [ax, az] = strip.points[i];
        const [bx, bz] = strip.points[i + 1];
        const mx = (ax + bx) / 2;
        const mz = (az + bz) / 2;
        if (waterDepth(mx, mz) > -4) continue;
        const site = siteClearance(mx, mz);
        if (site && site.id !== 'market') continue;
        const u = urbanity(e, mx, mz);
        if (u < (e.layout.pattern === 'spread' ? 0.02 : 0.15)) continue;
        const dx = bx - ax;
        const dz = bz - az;
        const len = Math.hypot(dx, dz) || 1;
        const nx = (-dz / len) * (strip.width / 2);
        const nz = (dx / len) * (strip.width / 2);
        const ya = terrainHeight(ax, az) + 0.04;
        const yb = terrainHeight(bx, bz) + 0.04;
        mb.setColor(roadColor);
        mb.quad(ax + nx, ya, az + nz, bx + nx, yb, bz + nz, bx - nx, yb, bz - nz, ax - nx, ya, az - nz);
      }
    }

    // buildings
    const lots = this.pattern.lotsInRect(x0, z0, x1, z1);
    for (const lot of lots) {
      const p = lotBuildChance(e, lot);
      if (hash2(Math.round(lot.x * 10), Math.round(lot.z * 10), 9) > p) continue;
      const hw = (lot.w * 0.5) * 0.95;
      const hd = (lot.d * 0.5) * 0.95;
      if (!lotIsClear(lot, hw, hd, this.pattern)) continue;
      const y = terrainHeight(lot.x, lot.z);
      const lrng = new Rng(lot.seed >>> 0);
      const u = urbanity(e, lot.x, lot.z);
      let tmpl: BuildingTemplate | undefined;
      if (u < 0.12) tmpl = e.buildings[Math.min(1, e.buildings.length - 1)];
      const b = buildBuilding(mb, lot, e, y, lrng, tmpl);
      if (!b) continue;
      colliders.push(b);
      buildings.push(b);
    }

    if (detail === 'near') {
      // props near doors and along streets
      for (const b of buildings) {
        if (!rng.chance(e.propDensity * 0.35)) continue;
        const kind = rng.pick(e.props);
        const dx = b.doorX - b.x;
        const dz = b.doorZ - b.z;
        const len = Math.hypot(dx, dz) || 1;
        const px = b.doorX + (dx / len) * 1.6 + (-dz / len) * rng.range(-2, 2);
        const pz = b.doorZ + (dz / len) * 1.6 + (dx / len) * rng.range(-2, 2);
        if (px < x0 || px >= x1 || pz < z0 || pz >= z1) continue;
        if (isArterial(px, pz, ARTERIAL_WIDTH + 2) || isWater(px, pz) || isReserved(px, pz, 1)) continue;
        if (colliders.some((c) => Math.abs(c.x - px) < c.hw + 1 && Math.abs(c.z - pz) < c.hd + 1 && c !== b)) continue;
        const r = buildProp(mb, px, terrainHeight(px, pz), pz, kind, rng, rng.range(0, Math.PI * 2));
        if (r > 0.3) colliders.push({ x: px, z: pz, hw: r, hd: r, rot: 0, h: 2, tag: 'prop' });
      }
      // street furniture along arterials
      const step = 18;
      for (let x = x0; x < x1; x += step) {
        for (let z = z0; z < z1; z += step) {
          const h = hash2(x, z, 55);
          if (h > 0.6) continue;
          const d = arterialDistance(x, z);
          if (d < ARTERIAL_WIDTH / 2 + 1 || d > ARTERIAL_WIDTH / 2 + 2.5) continue;
          if (isWater(x, z) || siteClearance(x, z)) continue;
          if (urbanity(e, x, z) < 0.2) continue;
          if (colliders.some((c) => Math.abs(c.x - x) < c.hw + 1 && Math.abs(c.z - z) < c.hd + 1)) continue;
          const kind = e.props.includes('lamp') ? 'lamp' : e.props.includes('gaslamp') ? 'gaslamp' : e.props.includes('torch') ? 'torch' : e.props.includes('lantern') ? 'lantern' : rng.pick(e.props);
          const r = buildProp(mb, x, terrainHeight(x, z), z, kind, rng, 0);
          if (r > 0.3) colliders.push({ x, z, hw: r, hd: r, rot: 0, h: 2, tag: 'prop' });
        }
      }
      // trees
      if (e.trees !== 'none') {
        const cell = 9;
        for (let x = x0; x < x1; x += cell) {
          for (let z = z0; z < z1; z += cell) {
            const h = hash2(x, z, 33);
            const u = urbanity(e, x, z);
            const dens = e.treeDensity * (0.08 + 0.3 * (1 - u));
            if (h > dens) continue;
            const px = x + hash2(x, z, 34) * cell;
            const pz = z + hash2(x, z, 35) * cell;
            if (waterDepth(px, pz) > -3 || isArterial(px, pz, ARTERIAL_WIDTH + 3) || this.pattern.isStreet(px, pz) || isReserved(px, pz, 1)) continue;
            const site = siteClearance(px, pz);
            if (site) continue;
            if (Math.hypot(px - HILL.x, pz - HILL.z) < HILL.plateau + 10 && u < 0.3) continue;
            if (colliders.some((c) => Math.abs(c.x - px) < c.hw + 2 && Math.abs(c.z - pz) < c.hd + 2)) continue;
            const r = buildTree(mb, px, terrainHeight(px, pz), pz, e.trees, rng);
            if (r > 0) colliders.push({ x: px, z: pz, hw: r, hd: r, rot: 0, h: 5, tag: 'tree' });
          }
        }
      }
    }

    let mesh: Mesh | null = null;
    if (!mb.isEmpty()) {
      mesh = new Mesh(mb.build(), this.material);
      this.scene.add(mesh);
    }
    this.scene.add(terrain);
    return { cx, cz, detail, mesh, terrain, colliders, buildings };
  }

  private buildTerrain(x0: number, z0: number): Mesh {
    const e = this.era;
    const n = 8;
    const s = CHUNK_SIZE / n;
    const mb = new MeshBuilder();
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const ax = x0 + i * s;
        const az = z0 + j * s;
        const bx = ax + s;
        const bz = az + s;
        const cx = ax + s / 2;
        const cz = az + s / 2;
        const color = this.groundColor(cx, cz);
        mb.setColor(color);
        const y00 = terrainHeight(ax, az);
        const y10 = terrainHeight(bx, az);
        const y11 = terrainHeight(bx, bz);
        const y01 = terrainHeight(ax, bz);
        mb.quad(ax, y00, az, ax, y01, bz, bx, y11, bz, bx, y10, az);
        // paved plaza discs around sites
        const site = siteClearance(cx, cz);
        if (site && !isWater(cx, cz)) {
          mb.setColor(shade(e.road, 1.15));
          mb.quad(ax, y00 + 0.03, az, ax, y01 + 0.03, bz, bx, y11 + 0.03, bz, bx, y10 + 0.03, az);
        }
      }
    }
    const mesh = new Mesh(mb.build(), this.material);
    return mesh;
  }

  private groundColor(x: number, z: number): number {
    const e = this.era;
    const wd = waterDepth(x, z);
    if (wd > -10) return shade(0xc9b68a, 0.95 + 0.1 * hash2(x, z, 1)); // shore sand
    const h = terrainHeight(x, z);
    const u = urbanity(e, x, z);
    let c = e.ground;
    if (e.layout.fields && u < 0.25) {
      // patchwork fields
      const fx = Math.floor(x / 42);
      const fz = Math.floor(z / 34);
      const hh = hash2(fx, fz, 12);
      const crops = [shade(e.ground, 1.1), 0xb8a85a, 0x8fa860, 0xc9b06a, shade(e.ground, 0.9), 0x7f9a4a];
      c = crops[Math.floor(hh * crops.length)];
      c = shade(c, 1 - 0.25 * (1 - clamp(u * 4, 0, 1)) * 0 + (hash2(x, z, 2) - 0.5) * 0.08);
    } else {
      c = shade(c, 1 + (hash2(x, z, 3) - 0.5) * 0.12);
    }
    if (h > 6) c = shade(c, 1 - clamp((h - 6) / 40, 0, 0.3));
    return c;
  }

  /** Colliders near a point (3x3 chunk neighbourhood plus landmarks). */
  collidersNear(px: number, pz: number, radius: number, out: Collider[]): Collider[] {
    out.length = 0;
    const ccx = Math.floor(px / CHUNK_SIZE);
    const ccz = Math.floor(pz / CHUNK_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const ch = this.chunks.get(key(ccx + dx, ccz + dz));
        if (!ch) continue;
        for (const c of ch.colliders) {
          const r = Math.max(c.hw, c.hd) + radius;
          if (Math.abs(c.x - px) < r && Math.abs(c.z - pz) < r) out.push(c);
        }
      }
    }
    for (const c of this.landmarkColliders) {
      const r = Math.max(c.hw, c.hd) + radius;
      if (Math.abs(c.x - px) < r && Math.abs(c.z - pz) < r) out.push(c);
    }
    return out;
  }

  /** Buildings with a given template tag within a radius. */
  buildingsNear(px: number, pz: number, radius: number): BuiltBuilding[] {
    const out: BuiltBuilding[] = [];
    for (const ch of this.chunks.values()) {
      for (const b of ch.buildings) if (Math.hypot(b.x - px, b.z - pz) < radius) out.push(b);
    }
    return out;
  }

  /** Walkable ground height at a point (terrain or bridge deck). */
  groundY(x: number, z: number): number {
    const t = terrainHeight(x, z);
    if (isBridge(x, z)) return Math.max(t, BRIDGE_DECK);
    return t;
  }

  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  dispose(): void {
    for (const k of [...this.chunks.keys()]) this.unload(k);
    this.material.dispose();
    (this.water.geometry as BufferGeometry).dispose();
  }
}
