/**
 * World streaming. The city is divided into 80 m chunks that are generated on demand around the
 * player and disposed when far away. Near chunks get full detail (windows, props, trees), far
 * chunks get buildings only, and everything beyond the far radius is hidden by fog.
 */
import { FogExp2, Group, HemisphereLight, DirectionalLight, Mesh, MeshLambertMaterial, PlaneGeometry, Scene, BufferGeometry, OrthographicCamera } from 'three';
import { buildAtlas } from './textures';
import { makeCityMaterial } from './material';
import { SkyDome } from '../engine/sky';
import { surfacesFor, type Surfaces } from './surfaces';
import { buildRoadStrip } from './roads';
import { TILE, type Tile } from './textures';
import type { Era, BuildingTemplate } from '../eras/types';
import { hash2, Rng } from '../util/rng';
import { shade, clamp, mixColor, smoothstep } from '../util/math';
import {
  CHUNK_SIZE, WORLD_HALF, ARTERIALS, ARTERIAL_WIDTH, SITES, terrainHeight, meshHeight, isWater, waterDepth, isArterial, arterialDistance,
  siteClearance, WATER_LEVEL, RING_ROAD, HILL,
} from './macro';
import { makePattern, urbanity, type CityPattern, type Lot } from './pattern';
import { MeshBuilder } from './meshBuilder';
import { buildBuilding, type BuiltBuilding } from './buildings';
import { buildProp, buildTree } from './props';
import { buildLandmark, landmarkKeyForSite } from './landmarks';
import { pointInCollider, rampCollider, topAt, STEP_UP, type Collider } from './collision';
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

export type Detail = 'near' | 'far';

interface Chunk {
  cx: number;
  cz: number;
  detail: Detail;
  mesh: Mesh | null;
  terrain: Mesh | null;
  colliders: Collider[];
  /** the walkable subset of colliders */
  platforms: Collider[];
  buildings: BuiltBuilding[];
}

export interface WorldQuality {
  nearRadius: number;
  farRadius: number;
  /** shadow map size, 0 = no shadows */
  shadowMap: number;
  /** half-size of the shadowed area around the player, metres */
  shadowRange: number;
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
  if (arterialDistance(lot.x, lot.z) < margin + ARTERIAL_WIDTH / 2 + 2.4) return false;
  const cs = Math.cos(lot.rot);
  const sn = Math.sin(lot.rot);
  // the body is set back from the lot line, so test points a little inside the lot
  const ix = Math.max(0.5, hw - 0.6);
  const iz = Math.max(0.5, hd - 0.6);
  for (const [lx, lz] of [
    [0, 0],
    [-ix, -iz],
    [ix, -iz],
    [ix, iz],
    [-ix, iz],
    [0, -iz],
    [0, iz],
    [-ix, 0],
    [ix, 0],
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
  private atlas = buildAtlas();
  private material = makeCityMaterial(this.atlas);
  /**
   * The ground is drawn pushed back in depth, so roads, plazas, paths and decks lying a few
   * centimetres above it always win the depth test, even far from the camera.
   */
  private terrainMaterial = ((): MeshLambertMaterial => {
    const m = makeCityMaterial(this.atlas);
    m.polygonOffset = true;
    m.polygonOffsetFactor = 2;
    m.polygonOffsetUnits = 6;
    return m;
  })();
  private staticGroup = new Group();
  private water: Mesh;
  private hemi: HemisphereLight;
  readonly sun: DirectionalLight;
  readonly sky = new SkyDome();
  surfaces: Surfaces;
  private sunDir = { x: 0.45, y: 0.8, z: 0.3 };
  landmarkColliders: Collider[] = [];
  private pending: { cx: number; cz: number; detail: Detail }[] = [];
  /** Walkable landmark colliders (bridge decks, terraces, stairs), for ground height lookups. */
  private landmarkPlatforms: Collider[] = [];

  constructor(scene: Scene, era: Era, quality: WorldQuality) {
    this.scene = scene;
    this.era = era;
    this.quality = quality;
    this.surfaces = surfacesFor(era.id);
    this.pattern = makePattern(era, this.surfaces.parkChance);
    this.hemi = new HemisphereLight(0xffffff, 0x888866, 1.0);
    this.sun = new DirectionalLight(0xffffff, 2.4);
    this.sun.position.set(this.sunDir.x, this.sunDir.y, this.sunDir.z).multiplyScalar(300);
    this.sun.shadow.camera = new OrthographicCamera(-100, 100, 100, -100, 1, 700);
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.6;
    scene.add(this.hemi, this.sun, this.sun.target, this.staticGroup, this.sky.mesh);
    this.water = new Mesh(new PlaneGeometry(WORLD_HALF * 4, WORLD_HALF * 4), new MeshLambertMaterial({ color: 0x3366aa, transparent: true, opacity: 0.86 }));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = WATER_LEVEL;
    this.water.receiveShadow = true;
    scene.add(this.water);
    this.applyQuality();
    this.applyEra();
  }

  applyQuality(): void {
    const q = this.quality;
    this.sun.castShadow = q.shadowMap > 0;
    if (q.shadowMap > 0) {
      this.sun.shadow.mapSize.set(q.shadowMap, q.shadowMap);
      const cam = this.sun.shadow.camera as OrthographicCamera;
      cam.left = cam.bottom = -q.shadowRange;
      cam.right = cam.top = q.shadowRange;
      cam.updateProjectionMatrix();
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
  }

  /** Keep the sun's shadow box centred on the player, snapped to shadow texels to avoid shimmer. */
  private updateSun(px: number, pz: number): void {
    const q = this.quality;
    const texel = (q.shadowRange * 2) / Math.max(1, q.shadowMap);
    const sx = Math.round(px / texel) * texel;
    const sz = Math.round(pz / texel) * texel;
    this.sun.target.position.set(sx, 0, sz);
    this.sun.position.set(sx + this.sunDir.x * 300, this.sunDir.y * 300, sz + this.sunDir.z * 300);
    this.sun.target.updateMatrixWorld();
  }

  setEra(era: Era): void {
    this.era = era;
    this.surfaces = surfacesFor(era.id);
    this.pattern = makePattern(era, this.surfaces.parkChance);
    for (const k of [...this.chunks.keys()]) this.unload(k);
    this.pending.length = 0;
    this.applyEra();
  }

  private applyEra(): void {
    const e = this.era;
    this.scene.background = null;
    this.sky.setEra(e);
    this.scene.fog = new FogExp2(e.fog, e.fogDensity);
    this.hemi.color.set(mixColor(e.sky, 0xffffff, 0.55));
    this.hemi.groundColor.set(mixColor(e.ground, 0x8a8a8a, 0.4));
    this.hemi.intensity = 0.95;
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
    this.landmarkPlatforms = this.landmarkColliders.filter((c) => c.top !== undefined);
  }

  private buildArterials(): void {
    const mb = new MeshBuilder();
    const e = this.era;
    for (const line of ARTERIALS) this.buildArterialLine(mb, line);
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
        mb.material(e.layout.pattern === 'spread' ? TILE.WOOD : TILE.STONE, 0.35);
        for (let i = 0; i < n; i++) {
          const t = (i + 0.5) / n;
          const x = ax + (bx - ax) * t;
          const z = az + (bz - az) * t;
          if (isWater(x, z)) continue;
          if (isArterial(x, z, ARTERIAL_WIDTH + 8)) continue; // gates
          const y = terrainHeight(x, z);
          const rot = Math.atan2(bz - az, bx - ax);
          mb.box(x, y - 1, z, 20.4, 7, 2.5, wallColor, rot, 0.75);
          // walkway crenellations
          for (let k = -4; k <= 4; k++) mb.box(x + Math.cos(rot) * k * 2.4, y + 6, z + Math.sin(rot) * k * 2.4, 1.1, 1.0, 2.7, shade(wallColor, 0.95), rot);
          if (i % 4 === 0) mb.box(x, y - 1, z, 5, 10, 5, shade(wallColor, 0.95), rot, 0.75);
          this.landmarkColliders.push({ x, z, hw: 10.2, hd: 1.3, rot: Math.atan2(bz - az, bx - ax), h: 7, tag: 'wall' });
        }
      }
    }
    const mesh = new Mesh(mb.build(), this.material);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.staticGroup.add(mesh);
  }

  /**
   * One arterial: road pieces on land, bridges wherever the road would dip near or under the water.
   * A bridge starts and ends on dry ground (its abutments), so its deck meets the road exactly and
   * never sits below the water line; the deck is a walkable ramp collider with railed sides.
   */
  private buildArterialLine(mb: MeshBuilder, line: ReadonlyArray<readonly [number, number]>): void {
    const e = this.era;
    const surf = this.surfaces;
    const w = ARTERIAL_WIDTH;
    const hw = w / 2;
    const cum = [0];
    for (let i = 0; i < line.length - 1; i++) cum.push(cum[i] + Math.hypot(line[i + 1][0] - line[i][0], line[i + 1][1] - line[i][1]));
    const total = cum[cum.length - 1];
    /** point and unit direction at arc length s */
    const at = (s: number): [number, number, number, number] => {
      let i = 0;
      while (i < line.length - 2 && cum[i + 1] < s) i++;
      const len = cum[i + 1] - cum[i] || 1;
      const t = clamp((s - cum[i]) / len, 0, 1);
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      return [ax + (bx - ax) * t, az + (bz - az) * t, (bx - ax) / len, (bz - az) / len];
    };
    // where does the road need a deck? anywhere the ground across it dips toward the water
    const LOW = WATER_LEVEL + 0.6;
    const ds = 2;
    const ns = Math.ceil(total / ds);
    const low: boolean[] = [];
    for (let k = 0; k <= ns; k++) {
      const [x, z] = at(Math.min(total, k * ds));
      low.push(isWater(x, z) || meshHeight(x, z) < LOW);
    }
    const bridges: { a: number; b: number; ha: number; hb: number }[] = [];
    /** stretches where the road runs off into the sea at the end of its line: it stops at the shore */
    const dead: [number, number][] = [];
    for (let k = 0; k <= ns; k++) {
      if (!low[k]) continue;
      let j = k;
      while (j < ns && low[j + 1]) j++;
      if (k === 0 || j === ns) {
        dead.push(k === 0 ? [-1, j * ds] : [k * ds, total + 1]);
        k = j;
        continue;
      }
      // abutments: one sample onto solid ground on each side, plus a little margin
      const a = Math.max(0, (k - 1) * ds - 2);
      const b = Math.min(total, (j + 1) * ds + 2);
      const prev = bridges[bridges.length - 1];
      if (prev && a - prev.b < 8) prev.b = b;
      else bridges.push({ a, b, ha: 0, hb: 0 });
      k = j;
    }
    const roadY = (s: number): number => {
      const [x, z] = at(s);
      return meshHeight(x, z) + 0.07;
    };
    for (const br of bridges) {
      br.ha = roadY(br.a);
      br.hb = roadY(br.b);
    }
    /**
     * Deck height along a bridge: meets the road at both abutments, clears the water in between,
     * and never dips below the ground it passes over.
     */
    const deckAt = (br: { a: number; b: number; ha: number; hb: number }, s: number): number => {
      const t = clamp((s - br.a) / (br.b - br.a), 0, 1);
      const base = br.ha + (br.hb - br.ha) * t;
      const crest = Math.max(br.ha, br.hb, WATER_LEVEL + 2.6);
      // ramps take at most ~25 m to reach the crest, so long causeways stay level
      const ramp = Math.min(1, Math.min(s - br.a, br.b - s) / 25, 2.4 * Math.sin(Math.PI * t));
      const [x, z, ux, uz] = at(s);
      const g = Math.max(meshHeight(x, z), meshHeight(x - uz * hw, z + ux * hw), meshHeight(x + uz * hw, z - ux * hw)) + 0.07;
      return Math.max(g, base + (crest - base) * ramp);
    };
    // breakpoints: polyline corners, bridge ends, and at most 8 m apart
    const marks = new Set<number>(cum);
    for (const br of bridges) {
      marks.add(br.a);
      marks.add(br.b);
    }
    const sorted = [...marks].sort((p, q) => p - q);
    const cuts: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const n = Math.max(1, Math.ceil((sorted[i + 1] - sorted[i]) / 8));
      for (let k = 0; k < n; k++) cuts.push(sorted[i] + ((sorted[i + 1] - sorted[i]) * k) / n);
    }
    cuts.push(total);
    const heightAt = (x: number, z: number): number => meshHeight(x, z);
    const stone = shade(e.road, 0.75);
    /** interior corners: arc length, turn side (+1 toward the left normal) and parapet mitre length */
    const corners: { s: number; turn: number; ext: number }[] = [];
    for (let i = 1; i < line.length - 1; i++) {
      const [, , ax, az] = at(cum[i] - 0.5);
      const [, , bx, bz] = at(cum[i] + 0.5);
      const cross = ax * bz - az * bx;
      const ang = Math.acos(clamp(ax * bx + az * bz, -1, 1));
      if (ang < 0.05) continue;
      corners.push({ s: cum[i], turn: Math.sign(cross), ext: (hw - 0.25) * Math.tan(ang / 2) });
    }
    for (let i = 0; i < cuts.length - 1; i++) {
      const s0 = cuts[i];
      const s1 = cuts[i + 1];
      if (s1 - s0 < 0.05) continue;
      const mid = (s0 + s1) / 2;
      const [x0, z0, ux, uz] = at(s0 + 0.01);
      const [x1, z1] = at(s1 - 0.0001);
      if (dead.some(([a, b]) => mid > a && mid < b)) continue;
      const br = bridges.find((b) => mid > b.a && mid < b.b);
      if (!br) {
        buildRoadStrip(mb, [[x0, z0], [x1, z1]], w, surf, heightAt, { lanes: true, minor: false });
        continue;
      }
      const nx = -uz;
      const nz = ux;
      const first = Math.abs(s0 - br.a) < 0.01;
      const last = Math.abs(s1 - br.b) < 0.01;
      const y0 = deckAt(br, s0);
      const y1 = deckAt(br, s1);
      // deck surface; at the abutments the edges follow the road's own corner heights
      const edge = (x: number, z: number, side: number, y: number, end: boolean): number => (end ? meshHeight(x + nx * hw * side, z + nz * hw * side) + 0.07 : y);
      const y0L = edge(x0, z0, 1, y0, first);
      const y0R = edge(x0, z0, -1, y0, first);
      const y1L = edge(x1, z1, 1, y1, last);
      const y1R = edge(x1, z1, -1, y1, last);
      mb.material(surf.road, surf.road === TILE.COBBLE ? 0.6 : 0.35);
      mb.setColor(shade(surf.roadColor, 0.97));
      mb.quad(x0 + nx * hw, y0L, z0 + nz * hw, x1 + nx * hw, y1L, z1 + nz * hw, x1 - nx * hw, y1R, z1 - nz * hw, x0 - nx * hw, y0R, z0 - nz * hw);
      if (surf.laneMarks) {
        mb.material(TILE.ASPHALT, 0.3);
        mb.setColor(surf.laneColor);
        mb.quad(x0 + nx * 0.1, y0 + 0.012, z0 + nz * 0.1, x1 + nx * 0.1, y1 + 0.012, z1 + nz * 0.1, x1 - nx * 0.1, y1 + 0.012, z1 - nz * 0.1, x0 - nx * 0.1, y0 + 0.012, z0 - nz * 0.1);
      }
      // fascia and soffit: a solid deck 1.2 m thick (buried at the abutments)
      mb.material(TILE.STONE, 0.35);
      mb.setColor(stone);
      slab(mb, x0, z0, x1, z1, -hw, hw, Math.min(y0L, y0R) - 1.2, y0, Math.min(y1L, y1R) - 1.2, y1, { top: false, caps: false });
      // parapets with end posts, mitred where the road turns a corner on the deck
      const pc = shade(stone, 1.1);
      const cEnd = corners.find((k) => Math.abs(k.s - s1) < 0.01);
      const cStart = corners.find((k) => Math.abs(k.s - s0) < 0.01);
      if (cEnd) {
        // fill the outside of the turn with a square of deck
        mb.material(surf.road, surf.road === TILE.COBBLE ? 0.6 : 0.35);
        mb.setColor(shade(surf.roadColor, 0.97));
        const yc = y1 - 0.012;
        mb.quad(x1 - ux * hw + nx * hw, yc, z1 - uz * hw + nz * hw, x1 + ux * hw + nx * hw, yc, z1 + uz * hw + nz * hw, x1 + ux * hw - nx * hw, yc, z1 + uz * hw - nz * hw, x1 - ux * hw - nx * hw, yc, z1 - uz * hw - nz * hw);
        this.landmarkColliders.push({ x: x1, z: z1, hw, hd: hw, rot: Math.atan2(uz, ux), h: 0, top: y1, tag: 'bridge' });
        mb.material(TILE.STONE, 0.35);
      }
      mb.setColor(pc);
      for (const side of [-1, 1]) {
        const o0 = side > 0 ? hw - 0.5 : -hw;
        const o1 = side > 0 ? hw : -hw + 0.5;
        const pa = side > 0 ? y0L : y0R;
        const pb = side > 0 ? y1L : y1R;
        // the inside rail stops short of the corner, the outside rail runs on to meet the next leg
        const len0 = s1 - s0;
        const e0 = cStart ? clamp(cStart.turn === side ? -cStart.ext : cStart.ext, -len0 + 0.3, hw) : 0;
        const e1 = cEnd ? clamp(cEnd.turn === side ? -cEnd.ext : cEnd.ext, -len0 + 0.3, hw) : 0;
        const qx0 = x0 - ux * e0;
        const qz0 = z0 - uz * e0;
        const qx1 = x1 + ux * e1;
        const qz1 = z1 + uz * e1;
        if (e0 + e1 + len0 < 0.5) continue;
        slab(mb, qx0, qz0, qx1, qz1, o0, o1, pa - 0.1, pa + 1.05, pb - 0.1, pb + 1.05, { top: true, caps: true });
        const len = e0 + e1 + len0;
        this.landmarkColliders.push({ x: (qx0 + qx1) / 2 + nx * side * (hw - 0.25), z: (qz0 + qz1) / 2 + nz * side * (hw - 0.25), hw: len / 2 + 0.1, hd: 0.3, rot: Math.atan2(uz, ux), h: 1.1, tag: 'parapet' });
        if (first) mb.box(x0 + nx * side * (hw - 0.25) + ux * 0.4, pa - 0.3, z0 + nz * side * (hw - 0.25) + uz * 0.4, 0.9, 1.75, 0.9, shade(pc, 0.92), Math.atan2(uz, ux));
        if (last) mb.box(x1 + nx * side * (hw - 0.25) - ux * 0.4, pb - 0.3, z1 + nz * side * (hw - 0.25) - uz * 0.4, 0.9, 1.75, 0.9, shade(pc, 0.92), Math.atan2(uz, ux));
      }
      // walkable deck
      // (overlapping the next piece a little so there is never a seam to fall through)
      const deck = rampCollider(x0, z0, y0, x1, z1, y1, w - 0.6, 'bridge');
      deck.hw += 0.15;
      this.landmarkColliders.push(deck);
      // abutment blocks anchor each end into the bank
      if (first || last) {
        const ax = first ? x0 : x1;
        const az = first ? z0 : z1;
        const ay = first ? y0 : y1;
        const back = first ? -1 : 1;
        mb.setColor(shade(stone, 0.9));
        mb.box(ax + ux * back * 1.5, Math.min(ay, meshHeight(ax, az)) - 2.5, az + uz * back * 1.5, 3, ay - 0.2 - (Math.min(ay, meshHeight(ax, az)) - 2.5), w + 1.4, shade(stone, 0.9), Math.atan2(uz, ux));
      }
      // piers in the water
      const pm = at(mid);
      if (waterDepth(pm[0], pm[1]) > 2 && Math.floor(mid / 16) !== Math.floor(s0 / 16)) {
        const py = deckAt(br, mid) - 1.15;
        const rot = Math.atan2(uz, ux);
        mb.box(pm[0], -5, pm[1], 2.6, py + 5, w * 0.92, stone, rot);
        mb.box(pm[0], -5, pm[1], 2.4, WATER_LEVEL + 5.6, 2.4, stone, rot + Math.PI / 4);
      }
      // lamps on the parapets
      if (Math.floor(mid / 24) !== Math.floor(s0 / 24) && !first && !last) {
        const rot = Math.atan2(uz, ux);
        const ym = deckAt(br, mid);
        for (const side of [-1, 1]) {
          mb.material(TILE.CONCRETE, 1);
          const lx = pm[0] + nx * side * (hw - 0.25);
          const lz = pm[1] + nz * side * (hw - 0.25);
          mb.box(lx, ym + 1.0, lz, 0.3, 2.6, 0.3, 0x3a3a3a, rot);
          mb.box(lx, ym + 3.6, lz, 0.6, 0.5, 0.6, 0xffe8a0, rot);
        }
      }
    }
  }

  /** Era one-offs that are not tied to a site: the Roman aqueduct marching across the east bank. */
  private buildEraSpecials(mb: MeshBuilder): void {
    const e = this.era;
    if (e.id === 'roman') {
      // from the hills north-east down to the baths: along z = -100 (just north of Meridian Way), x 240..600
      const stone = 0xd9cfbc;
      mb.material(TILE.STONE, 0.35);
      const z = -120 - ARTERIAL_WIDTH / 2 - 10.5;
      for (let x = 230; x <= 610; x += 8) {
        if (isWater(x, z)) continue;
        const y = terrainHeight(x, z);
        // the channel runs level; piers grow taller where the ground falls away
        const channelY = terrainHeight(610, z) + 12;
        const top = Math.max(6, channelY - y);
        mb.box(x, y - 1, z, 2.2, top + 1, 2.6, stone, 0, 0.75);
        this.landmarkColliders.push({ x, z, hw: 1.1, hd: 1.3, rot: 0, h: top, tag: 'aqueduct' });
        // arch between this pier and the next
        mb.material(TILE.CONCRETE, 0.3);
        mb.archQuad(x + 4, y + 2, z + 1.31, 5.6, top - 3.5, 0, 1, 0x1e2228);
        mb.archQuad(x + 4, y + 2, z - 1.31, 5.6, top - 3.5, 0, -1, 0x1e2228);
        mb.material(TILE.STONE, 0.35);
        mb.box(x + 4, y + top - 2.6, z, 8.2, 2.6, 2.6, stone);
        mb.box(x + 4, y + top, z, 8.2, 1.3, 3.2, shade(stone, 0.92));
      }
    }
  }

  private buildLandmarks(): void {
    const mb = new MeshBuilder();
    this.buildEraSpecials(mb);
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
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.staticGroup.add(mesh);
  }

  /** Called each frame with the player position. Builds at most one chunk per call. */
  update(px: number, pz: number, budgetMs = 6): void {
    this.updateSun(px, pz);
    this.sky.follow(px, 0, pz);
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
    const surf = this.surfaces;
    const strips = this.pattern.stripsInRect(x0, z0, x1, z1);
    const heightAt = (x: number, z: number): number => meshHeight(x, z);
    const roadEdge = ARTERIAL_WIDTH / 2 + 0.2;
    for (const strip of strips) {
      const canal = surf.canals && hash2(Math.round(strip.points[0][0]), Math.round(strip.points[0][1]), 88) < 0.45;
      for (let i = 0; i < strip.points.length - 1; i++) {
        let [ax, az] = strip.points[i];
        let [bx, bz] = strip.points[i + 1];
        const mx = (ax + bx) / 2;
        const mz = (az + bz) / 2;
        // each piece belongs to exactly one chunk
        if (mx < x0 || mx >= x1 || mz < z0 || mz >= z1) continue;
        if (waterDepth(mx, mz) > -4) continue;
        const site = siteClearance(mx, mz);
        if (site && site.id !== 'market') continue;
        const u = urbanity(e, mx, mz);
        if (u < (e.layout.pattern === 'spread' ? 0.02 : 0.15)) continue;
        // trim the piece so it meets the arterial's road edge exactly
        const da = arterialDistance(ax, az);
        const db = arterialDistance(bx, bz);
        if (da < roadEdge && db < roadEdge) continue;
        if (da < roadEdge || db < roadEdge) {
          let lo = 0;
          let hi = 1;
          // bisect along the piece for the point where the arterial edge is crossed
          const inside = (t: number): boolean => arterialDistance(ax + (bx - ax) * t, az + (bz - az) * t) < roadEdge;
          const aInside = da < roadEdge;
          for (let k = 0; k < 8; k++) {
            const mid = (lo + hi) / 2;
            if (inside(mid) === aInside) lo = mid;
            else hi = mid;
          }
          const t = (lo + hi) / 2;
          if (aInside) {
            ax = ax + (bx - ax) * t;
            az = az + (bz - az) * t;
          } else {
            bx = ax + (bx - ax) * t;
            bz = az + (bz - az) * t;
          }
          if (Math.hypot(bx - ax, bz - az) < 0.5) continue;
        }
        buildRoadStrip(mb, [[ax, az], [bx, bz]], strip.width, surf, heightAt, {
          lanes: false,
          minor: true,
          canal: canal && u > 0.4,
          lift: strip.layer * 0.025,
        });
      }
    }

    // parks and gardens
    for (const park of this.pattern.parksInRect(x0, z0, x1, z1)) {
      this.buildPark(mb, park, detail, colliders, rng);
    }

    // buildings
    const lots = this.pattern.lotsInRect(x0, z0, x1, z1);
    for (const lot of lots) {
      const p = lotBuildChance(e, lot);
      if (hash2(Math.round(lot.x * 10), Math.round(lot.z * 10), 9) > p) continue;
      const hw = lot.w * 0.5;
      const hd = lot.d * 0.5;
      if (!lotIsClear(lot, hw, hd, this.pattern)) continue;
      const y = meshHeight(lot.x, lot.z);
      const lrng = new Rng(lot.seed >>> 0);
      const u = urbanity(e, lot.x, lot.z);
      let tmpl: BuildingTemplate | undefined;
      if (u < 0.12) tmpl = e.buildings[Math.min(1, e.buildings.length - 1)];
      const b = buildBuilding(mb, lot, e, y, lrng, tmpl, detail === 'near', meshHeight);
      if (!b) continue;
      colliders.push(b);
      for (const c of b.extra) colliders.push(c);
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
        // beside the entrance, never on the way up to it
        const side = (rng.chance(0.5) ? 1 : -1) * rng.range(2.2, 3.4);
        const px = b.doorX + (dx / len) * 0.6 + (-dz / len) * side;
        const pz = b.doorZ + (dz / len) * 0.6 + (dx / len) * side;
        if (px < x0 || px >= x1 || pz < z0 || pz >= z1) continue;
        if (isArterial(px, pz, ARTERIAL_WIDTH + 2) || isWater(px, pz) || meshHeight(px, pz) < WATER_LEVEL + 0.5 || isReserved(px, pz, 1)) continue;
        if (colliders.some((c) => Math.abs(c.x - px) < c.hw + 1 && Math.abs(c.z - pz) < c.hd + 1 && c !== b)) continue;
        const r = buildProp(mb, px, meshHeight(px, pz), pz, kind, rng, rng.range(0, Math.PI * 2));
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
          if (isWater(x, z) || meshHeight(x, z) < WATER_LEVEL + 0.5 || siteClearance(x, z)) continue;
          if (urbanity(e, x, z) < 0.2) continue;
          if (colliders.some((c) => Math.abs(c.x - x) < c.hw + 1 && Math.abs(c.z - z) < c.hd + 1)) continue;
          const kind = e.props.includes('lamp') ? 'lamp' : e.props.includes('gaslamp') ? 'gaslamp' : e.props.includes('torch') ? 'torch' : e.props.includes('lantern') ? 'lantern' : rng.pick(e.props);
          const r = buildProp(mb, x, meshHeight(x, z), z, kind, rng, 0);
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
            if (waterDepth(px, pz) > -3 || meshHeight(px, pz) < WATER_LEVEL + 0.5 || isArterial(px, pz, ARTERIAL_WIDTH + 3) || this.pattern.isStreet(px, pz) || isReserved(px, pz, 1)) continue;
            const site = siteClearance(px, pz);
            if (site) continue;
            if (Math.hypot(px - HILL.x, pz - HILL.z) < HILL.plateau + 10 && u < 0.3) continue;
            if (colliders.some((c) => Math.abs(c.x - px) < c.hw + 2 && Math.abs(c.z - pz) < c.hd + 2)) continue;
            const r = buildTree(mb, px, meshHeight(px, pz), pz, e.trees, rng);
            if (r > 0) colliders.push({ x: px, z: pz, hw: r, hd: r, rot: 0, h: 5, tag: 'tree' });
          }
        }
      }
    }

    let mesh: Mesh | null = null;
    if (!mb.isEmpty()) {
      mesh = new Mesh(mb.build(), this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    }
    terrain.receiveShadow = true;
    this.scene.add(terrain);
    return { cx, cz, detail, mesh, terrain, colliders, platforms: colliders.filter((c) => c.top !== undefined), buildings };
  }

  private buildPark(mb: MeshBuilder, park: { x: number; z: number; w: number; d: number; seed: number }, detail: Detail, colliders: Collider[], rng: Rng): void {
    const e = this.era;
    const surf = this.surfaces;
    if (surf.park === 'none') return;
    const hw = park.w / 2 - 0.5;
    const hd = park.d / 2 - 0.5;
    mb.material(surf.parkTile, 0.3);
    mb.setColor(shade(surf.parkColor, 0.9 + 0.2 * hash2(park.seed, 1, 3)));
    terrainPatch(mb, park.x - hw, park.z - hd, park.x + hw, park.z + hd, 2.5, 0.03);
    // low wall or hedge around gardens
    if (surf.park === 'garden') {
      mb.material(TILE.STONE, 0.6);
      const wc = shade(surf.plazaColor, 0.85);
      wallAlong(mb, park.x - hw, park.z - hd, park.x + hw, park.z - hd, 0.4, 0.7, wc);
      wallAlong(mb, park.x - hw, park.z + hd, park.x + hw, park.z + hd, 0.4, 0.7, wc);
      wallAlong(mb, park.x - hw, park.z - hd, park.x - hw, park.z + hd, 0.4, 0.7, wc);
      wallAlong(mb, park.x + hw, park.z - hd, park.x + hw, park.z + hd, 0.4, 0.7, wc);
      colliders.push({ x: park.x, z: park.z - hd, hw: hw - 3, hd: 0.2, rot: 0, h: 0.7 }, { x: park.x, z: park.z + hd, hw: hw - 3, hd: 0.2, rot: 0, h: 0.7 });
      colliders.push({ x: park.x - hw, z: park.z, hw: 0.2, hd: hd - 3, rot: 0, h: 0.7 }, { x: park.x + hw, z: park.z, hw: 0.2, hd: hd - 3, rot: 0, h: 0.7 });
    }
    // paths: a cross through the middle
    mb.material(surf.pathTile, 0.4);
    mb.setColor(surf.pathColor);
    terrainPatch(mb, park.x - hw, park.z - 1.4, park.x + hw, park.z + 1.4, 2.5, 0.05);
    terrainPatch(mb, park.x - 1.4, park.z - hd, park.x + 1.4, park.z + hd, 2.5, 0.05);
    if (detail !== 'near') return;
    const prng = new Rng(park.seed >>> 0);
    // centrepiece
    const centre = e.props.includes('fountain') ? 'fountain' : e.props.includes('statue') ? 'statue' : e.props.includes('well') ? 'well' : e.props.includes('shrine') ? 'shrine' : 'altar';
    if (meshHeight(park.x, park.z) > WATER_LEVEL + 0.5) {
      const r = buildProp(mb, park.x, meshHeight(park.x, park.z), park.z, centre, prng);
      if (r > 0.3) colliders.push({ x: park.x, z: park.z, hw: r, hd: r, rot: 0, h: 2 });
    }
    // trees
    if (e.trees !== 'none') {
      const n = surf.park === 'orchard' ? 12 : 8;
      for (let i = 0; i < n; i++) {
        let tx: number;
        let tz: number;
        if (surf.park === 'orchard') {
          const cols = 4;
          tx = park.x - hw + 3 + ((i % cols) + 0.5) * ((park.w - 6) / cols);
          tz = park.z - hd + 3 + (Math.floor(i / cols) + 0.5) * ((park.d - 6) / 3);
        } else {
          tx = park.x + prng.range(-hw + 2, hw - 2);
          tz = park.z + prng.range(-hd + 2, hd - 2);
        }
        if (Math.abs(tx - park.x) < 2.5 || Math.abs(tz - park.z) < 2.5) continue; // keep paths clear
        if (meshHeight(tx, tz) < WATER_LEVEL + 0.5 || waterDepth(tx, tz) > -3) continue;
        const tr = buildTree(mb, tx, meshHeight(tx, tz), tz, e.trees, prng);
        if (tr > 0) colliders.push({ x: tx, z: tz, hw: tr, hd: tr, rot: 0, h: 5, tag: 'tree' });
      }
    }
    // benches / lanterns along the path
    const side = e.props.includes('bench') ? 'bench' : e.props.includes('lantern') ? 'lantern' : e.props.includes('torch') ? 'torch' : null;
    if (side) {
      for (const [ox, oz, rot] of [
        [-hw * 0.5, -2.4, 0],
        [hw * 0.5, 2.4, Math.PI],
        [-2.4, hd * 0.5, Math.PI / 2],
        [2.4, -hd * 0.5, -Math.PI / 2],
      ] as [number, number, number][]) {
        if (meshHeight(park.x + ox, park.z + oz) < WATER_LEVEL + 0.5) continue;
        const pr = buildProp(mb, park.x + ox, meshHeight(park.x + ox, park.z + oz), park.z + oz, side, prng, rot);
        if (pr > 0.3) colliders.push({ x: park.x + ox, z: park.z + oz, hw: pr, hd: pr, rot: 0, h: 1 });
      }
    }
  }

  private buildTerrain(x0: number, z0: number): Mesh {
    const n = 16;
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
        const [color, tile] = this.groundColor(cx, cz);
        mb.material(tile, 0.25);
        mb.setColor(color);
        const y00 = terrainHeight(ax, az);
        const y10 = terrainHeight(bx, az);
        const y11 = terrainHeight(bx, bz);
        const y01 = terrainHeight(ax, bz);
        mb.quad(ax, y00, az, ax, y01, bz, bx, y11, bz, bx, y10, az);
        // paved plaza discs around sites
        const site = siteClearance(cx, cz);
        if (site && !isWater(cx, cz)) {
          mb.material(this.surfaces.plaza, 0.35);
          mb.setColor(this.surfaces.plazaColor);
          mb.quad(ax, y00 + 0.03, az, ax, y01 + 0.03, bz, bx, y11 + 0.03, bz, bx, y10 + 0.03, az);
        }
      }
    }
    const mesh = new Mesh(mb.build(), this.terrainMaterial);
    // ground first, always: everything lying on it (roads, plazas, paths, decks) draws afterwards
    mesh.renderOrder = -1;
    return mesh;
  }

  private groundColor(x: number, z: number): [number, Tile] {
    const e = this.era;
    const surf = this.surfaces;
    const wd = waterDepth(x, z);
    if (wd > -10) return [shade(0xc9b68a, 0.95 + 0.1 * hash2(x, z, 1)), TILE.SAND]; // shore sand
    const h = terrainHeight(x, z);
    const u = urbanity(e, x, z);
    let c: number;
    let tile: Tile;
    if (e.layout.fields && u < 0.25) {
      // patchwork fields
      const fx = Math.floor(x / 42);
      const fz = Math.floor(z / 34);
      const hh = hash2(fx, fz, 12);
      const crops = [shade(surf.outskirtsColor, 1.1), 0xb8a85a, 0x8fa860, 0xc9b06a, shade(surf.outskirtsColor, 0.9), 0x7f9a4a];
      c = crops[Math.floor(hh * crops.length)];
      c = shade(c, 1 + (hash2(x, z, 2) - 0.5) * 0.08);
      tile = hh < 0.5 ? TILE.GRASS : TILE.DIRT;
    } else if (u < 0.3) {
      c = shade(surf.outskirtsColor, 1 + (hash2(x, z, 3) - 0.5) * 0.08);
      tile = surf.outskirts;
    } else {
      const t = smoothstep(0.3, 0.7, u);
      c = mixColor(surf.outskirtsColor, surf.coreColor, t);
      c = shade(c, 1 + (hash2(x, z, 3) - 0.5) * 0.05);
      tile = t > 0.5 ? surf.core : surf.outskirts;
    }
    if (h > 6) c = shade(c, 1 - clamp((h - 6) / 40, 0, 0.3));
    return [c, tile];
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

  /**
   * Walkable ground height at a point: the terrain, or the highest floor, step, terrace or deck
   * there that is within step reach of `fromY` (pass the current height of whoever is walking;
   * leave it out to get the topmost surface).
   */
  groundY(x: number, z: number, fromY = Infinity): number {
    let g = meshHeight(x, z);
    const lim = fromY + STEP_UP;
    const scan = (list: Collider[]): void => {
      for (const c of list) {
        const r = c.hw + c.hd;
        if (Math.abs(c.x - x) > r || Math.abs(c.z - z) > r) continue;
        if (!pointInCollider(c, x, z)) continue;
        const t = topAt(c, x, z);
        if (t > g && t <= lim) g = t;
      }
    };
    const ccx = Math.floor(x / CHUNK_SIZE);
    const ccz = Math.floor(z / CHUNK_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        const ch = this.chunks.get(key(ccx + dx, ccz + dz));
        if (ch && ch.platforms.length) scan(ch.platforms);
      }
    }
    scan(this.landmarkPlatforms);
    return g;
  }

  get loadedChunkCount(): number {
    return this.chunks.size;
  }

  dispose(): void {
    for (const k of [...this.chunks.keys()]) this.unload(k);
    this.material.dispose();
    this.terrainMaterial.dispose();
    (this.water.geometry as BufferGeometry).dispose();
  }
}

/** Ground-following patch: a grid of quads with per-corner terrain heights plus a lift. */
function terrainPatch(mb: MeshBuilder, x0: number, z0: number, x1: number, z1: number, step: number, lift: number): void {
  const nx = Math.max(1, Math.ceil((x1 - x0) / step));
  const nz = Math.max(1, Math.ceil((z1 - z0) / step));
  for (let i = 0; i < nx; i++) {
    for (let j = 0; j < nz; j++) {
      const ax = x0 + ((x1 - x0) * i) / nx;
      const bx = x0 + ((x1 - x0) * (i + 1)) / nx;
      const az = z0 + ((z1 - z0) * j) / nz;
      const bz = z0 + ((z1 - z0) * (j + 1)) / nz;
      mb.quad(ax, meshHeight(ax, az) + lift, az, ax, meshHeight(ax, bz) + lift, bz, bx, meshHeight(bx, bz) + lift, bz, bx, meshHeight(bx, az) + lift, az);
    }
  }
}

/** A low wall in segments that step with the terrain. */
function wallAlong(mb: MeshBuilder, ax: number, az: number, bx: number, bz: number, thick: number, h: number, color: number): void {
  const len = Math.hypot(bx - ax, bz - az);
  const n = Math.max(1, Math.ceil(len / 6));
  const rot = Math.atan2(bz - az, bx - ax);
  for (let i = 0; i < n; i++) {
    const t0 = i / n;
    const t1 = (i + 1) / n;
    const mx = ax + (bx - ax) * ((t0 + t1) / 2);
    const mz = az + (bz - az) * ((t0 + t1) / 2);
    const y = Math.min(meshHeight(ax + (bx - ax) * t0, az + (bz - az) * t0), meshHeight(ax + (bx - ax) * t1, az + (bz - az) * t1));
    const top = Math.max(meshHeight(ax + (bx - ax) * t0, az + (bz - az) * t0), meshHeight(ax + (bx - ax) * t1, az + (bz - az) * t1)) + h;
    mb.box(mx, y - 0.2, mz, len / n + 0.05, top - y + 0.2, thick, color, rot);
  }
}

/**
 * A straight prism between two cross-sections: from (ax,az) to (bx,bz), spanning lateral offsets
 * o0..o1 (left of the direction is positive), with its own bottom and top height at each end.
 */
function slab(mb: MeshBuilder, ax: number, az: number, bx: number, bz: number, o0: number, o1: number, botA: number, topA: number, botB: number, topB: number, opt: { top: boolean; caps: boolean }): void {
  const len = Math.hypot(bx - ax, bz - az) || 1;
  const ux = (bx - ax) / len;
  const uz = (bz - az) / len;
  const nx = -uz;
  const nz = ux;
  const A = (o: number, y: number): [number, number, number] => [ax + nx * o, y, az + nz * o];
  const B = (o: number, y: number): [number, number, number] => [bx + nx * o, y, bz + nz * o];
  const q = (p: [number, number, number][]): void => mb.quad(...p[0], ...p[1], ...p[2], ...p[3]);
  if (opt.top) q([A(o1, topA), B(o1, topB), B(o0, topB), A(o0, topA)]);
  q([A(o0, botA), B(o0, botB), B(o1, botB), A(o1, botA)]);
  q([B(o1, botB), B(o1, topB), A(o1, topA), A(o1, botA)]);
  q([A(o0, botA), A(o0, topA), B(o0, topB), B(o0, botB)]);
  if (opt.caps) {
    q([A(o0, botA), A(o1, botA), A(o1, topA), A(o0, topA)]);
    q([B(o1, botB), B(o0, botB), B(o0, topB), B(o1, topB)]);
  }
}
