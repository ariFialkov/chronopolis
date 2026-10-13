import { Group, Mesh, MeshBasicMaterial, OctahedronGeometry, Scene } from 'three';
import type { Era, NpcArchetype } from '../eras/types';
import { Character } from '../characters/character';
import { CAST, outfitKeyForRole, varyOutfit, VARIANTS } from '../characters/cast';
import { Rng, hash2 } from '../util/rng';
import { angleLerp } from '../util/math';
import type { World } from '../world/world';
import type { StreetNode } from '../world/pattern';
import { CHUNK_SIZE, isWater, siteClearance } from '../world/macro';
import { pointInCollider, topAt, STEP_UP, type Collider } from '../world/collision';

export interface QuestNpcSpec {
  id: string;
  name: string;
  role: string;
  x: number;
  z: number;
  look: NpcArchetype;
  /** 'npc' = a person, 'object' = something to inspect (a tablet, a notice) */
  kind: 'npc' | 'object';
}

export class Npc {
  readonly figure: Character | null;
  readonly group: Group;
  x: number;
  z: number;
  y = 0;
  yaw = 0;
  speed = 0;
  readonly name: string;
  readonly role: string;
  readonly lines: string[];
  readonly questId: string | null;
  readonly isObject: boolean;
  target: StreetNode | null = null;
  current: StreetNode | null = null;
  talking = 0;
  idle = 0;

  constructor(arch: NpcArchetype, name: string, x: number, z: number, questId: string | null, isObject: boolean, eraId = 'industrial', variant = 0) {
    this.name = name;
    this.role = arch.role;
    this.lines = arch.lines;
    this.questId = questId;
    this.isObject = isObject;
    this.x = x;
    this.z = z;
    if (isObject) {
      this.figure = null;
      this.group = new Group();
      const m = new Mesh(new OctahedronGeometry(0.35), new MeshBasicMaterial({ color: 0xffd36a }));
      m.position.y = 1.2;
      m.name = 'marker';
      this.group.add(m);
      const base = new Mesh(new OctahedronGeometry(0.5), new MeshBasicMaterial({ color: 0x8a7a5a }));
      base.scale.set(1, 0.4, 1);
      base.position.y = 0.2;
      this.group.add(base);
    } else {
      const cast = CAST[eraId] ?? CAST.industrial;
      // story characters from 1938 keep their own clothes wherever they turn up
      const story = arch.outfit && !cast.roles[arch.outfit] ? CAST.industrial.roles[arch.outfit] : undefined;
      let key = arch.outfit && cast.roles[arch.outfit] ? arch.outfit : outfitKeyForRole(eraId, arch.role);
      if (!cast.roles[key]) key = Object.keys(cast.roles)[0];
      this.figure = story
        ? new Character(story, `story:${arch.outfit}`)
        : new Character(varyOutfit(cast.roles[key], variant), `${eraId}:${key}:${variant}`);
      this.group = this.figure.group;
      if (questId) {
        const m = new Mesh(new OctahedronGeometry(0.22), new MeshBasicMaterial({ color: 0xffd36a }));
        m.position.y = 2.5;
        m.name = 'marker';
        this.group.add(m);
      }
    }
  }
}

const MAX_AMBIENT = 42;
const SPAWN_RADIUS = 110;
const DESPAWN_RADIUS = 150;

export class NpcManager {
  private scene: Scene;
  private world: World;
  private era: Era;
  private npcs: Npc[] = [];
  private quest: Npc[] = [];
  private rng = new Rng(12345);
  private spawnCooldown = 0;
  private tmp: Collider[] = [];
  private time = 0;

  constructor(scene: Scene, world: World, era: Era) {
    this.scene = scene;
    this.world = world;
    this.era = era;
  }

  setEra(era: Era): void {
    this.era = era;
    for (const n of this.npcs) this.remove(n);
    this.npcs = [];
    this.clearQuestNpcs();
  }

  clearQuestNpcs(): void {
    for (const n of this.quest) this.remove(n);
    this.quest = [];
  }

  setQuestNpcs(specs: QuestNpcSpec[]): void {
    this.clearQuestNpcs();
    for (const s of specs) {
      const n = new Npc(s.look, s.name, s.x, s.z, s.id, s.kind === 'object', this.era.id, 0);
      n.y = this.world.groundY(s.x, s.z);
      n.group.position.set(n.x, n.y, n.z);
      this.scene.add(n.group);
      this.quest.push(n);
    }
  }

  private remove(n: Npc): void {
    this.scene.remove(n.group);
    n.figure?.dispose();
  }

  get all(): Npc[] {
    return this.npcs.concat(this.quest);
  }

  nearest(px: number, pz: number, radius: number): Npc | null {
    let best: Npc | null = null;
    let bd = radius;
    for (const n of this.all) {
      const d = Math.hypot(n.x - px, n.z - pz);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return best;
  }

  /** Make an NPC stop and face the player. */
  engage(n: Npc, px: number, pz: number): void {
    n.talking = 2.5;
    n.yaw = Math.atan2(px - n.x, pz - n.z);
    if (n.figure) n.group.rotation.y = n.yaw;
  }

  update(dt: number, px: number, pz: number): void {
    this.time += dt;
    // despawn
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i];
      if (Math.hypot(n.x - px, n.z - pz) > DESPAWN_RADIUS) {
        this.remove(n);
        this.npcs.splice(i, 1);
      }
    }
    // spawn
    this.spawnCooldown -= dt;
    const want = Math.round(MAX_AMBIENT * this.era.npcDensity);
    if (this.npcs.length < want && this.spawnCooldown <= 0) {
      this.spawnCooldown = 0.12;
      this.trySpawn(px, pz);
    }
    // move
    for (const n of this.npcs) this.step(n, dt, px, pz);
    for (const n of this.quest) {
      if (n.talking > 0) n.talking -= dt;
      const m = n.group.getObjectByName('marker');
      if (m) {
        m.rotation.y += dt * 2;
        m.position.y = (n.isObject ? 1.2 : 2.5) + Math.sin(this.time * 3) * 0.12;
      }
      if (n.figure) n.figure.animate(dt, 0);
    }
  }

  private trySpawn(px: number, pz: number): void {
    const a = this.rng.range(0, Math.PI * 2);
    const r = this.rng.range(35, SPAWN_RADIUS);
    const sx = px + Math.cos(a) * r;
    const sz = pz + Math.sin(a) * r;
    const cx = Math.floor(sx / CHUNK_SIZE) * CHUNK_SIZE;
    const cz = Math.floor(sz / CHUNK_SIZE) * CHUNK_SIZE;
    const nodes = this.world.pattern.nodesInRect(cx, cz, cx + CHUNK_SIZE, cz + CHUNK_SIZE);
    if (!nodes.length) return;
    const node = this.rng.pick(nodes);
    if (isWater(node.x, node.z) || siteClearance(node.x, node.z)) return;
    if (this.world.loadedChunkCount === 0) return;
    const arch = this.rng.weighted(this.era.npcs);
    const name = arch.names[Math.floor(hash2(Math.round(node.x), Math.round(node.z), 3) * arch.names.length)];
    const n = new Npc(arch, name, node.x, node.z, null, false, this.era.id, Math.floor(hash2(Math.round(node.x), Math.round(node.z), 7) * VARIANTS));
    n.current = node;
    n.y = this.world.groundY(n.x, n.z);
    n.yaw = this.rng.range(0, Math.PI * 2);
    n.group.position.set(n.x, n.y, n.z);
    this.scene.add(n.group);
    this.npcs.push(n);
  }

  private step(n: Npc, dt: number, px: number, pz: number): void {
    if (n.talking > 0) {
      n.talking -= dt;
      n.figure?.animate(dt, 0);
      return;
    }
    if (n.idle > 0) {
      n.idle -= dt;
      n.figure?.animate(dt, 0);
      return;
    }
    if (!n.target) {
      if (!n.current) return;
      const nb = this.world.pattern.neighbors(n.current).filter((k) => !isWater(k.x, k.z));
      if (!nb.length) {
        n.idle = 2;
        return;
      }
      n.target = this.rng.pick(nb);
      if (this.rng.chance(0.25)) n.idle = this.rng.range(1, 4);
    }
    const dx = n.target.x - n.x;
    const dz = n.target.z - n.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.8) {
      n.current = n.target;
      n.target = null;
      return;
    }
    const want = Math.atan2(dx, dz);
    n.yaw = angleLerp(n.yaw, want, Math.min(1, dt * 6));
    const sp = 1.4;
    let nx = n.x + Math.sin(n.yaw) * sp * dt;
    let nz = n.z + Math.cos(n.yaw) * sp * dt;
    // keep out of buildings and the player
    const cols = this.world.collidersNear(nx, nz, 1, this.tmp);
    for (const c of cols) {
      if ((c.top !== undefined ? topAt(c, nx, nz) > n.y + STEP_UP : c.h > 0.5) && pointInCollider(c, nx, nz, 0.35)) {
        n.idle = 0.6;
        n.target = null;
        return;
      }
    }
    if (Math.hypot(nx - px, nz - pz) < 0.9) {
      nx = n.x;
      nz = n.z;
    }
    n.x = nx;
    n.z = nz;
    n.y = this.world.groundY(n.x, n.z, n.y);
    n.group.position.set(n.x, n.y, n.z);
    n.group.rotation.y = n.yaw;
    n.figure?.animate(dt, sp);
  }
}
