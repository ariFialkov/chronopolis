import { PCFShadowMap, Scene, WebGLRenderer } from 'three';
import { ERAS, getEra, HOME_ERA_ID, CHRONOPORT_ERAS } from './eras';
import type { Era } from './eras/types';
import { World, type WorldQuality } from './world/world';
import { renderEraMap } from './world/mapImage';
import { ChronoportManager, PORT_NOTICE_RADIUS, PORT_USE_RADIUS } from './world/chronoports';
import { Input } from './engine/input';
import { ThirdPersonCamera } from './engine/camera';
import { Player } from './player/player';
import { NpcManager } from './npc/npc';
import { QuestManager } from './quests/questManager';
import { UI, nextFrame } from './ui/ui';
import { loadSave, writeSave, clearSave, loadQuality, saveQuality, type SaveData } from './save/save';
import type { Collider } from './world/collision';

type Quality = 'low' | 'medium' | 'high';
const QUALITY: Record<Quality, WorldQuality & { pixelRatio: number }> = {
  low: { nearRadius: 1, farRadius: 3, pixelRatio: 1, shadowMap: 0, shadowRange: 60 },
  medium: { nearRadius: 2, farRadius: 4, pixelRatio: 1.5, shadowMap: 1024, shadowRange: 70 },
  high: { nearRadius: 3, farRadius: 5, pixelRatio: 2, shadowMap: 2048, shadowRange: 110 },
};

const START = { x: 160, z: 438 }; // the Docks waterfront, 1938

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private input: Input;
  private ui: UI;
  private cam: ThirdPersonCamera;
  private world: World;
  private player: Player;
  private npcs: NpcManager;
  private ports: ChronoportManager;
  private quests: QuestManager;
  private era: Era;
  private quality: Quality;
  private mapCache = new Map<string, HTMLCanvasElement>();
  private discovered = new Set<string>();
  private hints = new Set<string>();
  private insights = new Set<string>();
  private flags = new Set<string>();
  private playtime = 0;
  private mode: 'title' | 'play' | 'busy' = 'title';
  private lastT = 0;
  private frame = 0;
  private autosaveT = 0;
  private colTmp: Collider[] = [];

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.input = new Input(canvas);
    this.quality = loadQuality() ?? (this.input.isTouch ? 'low' : 'medium');
    this.applyRendererQuality();
    this.ui = new UI(this.input);
    this.cam = new ThirdPersonCamera(window.innerWidth / window.innerHeight);
    this.era = getEra(HOME_ERA_ID);
    this.world = new World(this.scene, this.era, QUALITY[this.quality]);
    this.player = new Player(this.scene);
    this.npcs = new NpcManager(this.scene, this.world, this.era);
    this.ports = new ChronoportManager(this.scene, this.world);
    this.quests = new QuestManager({
      get eraId() {
        return self.era.id;
      },
      get playerX() {
        return self.player.x;
      },
      get playerZ() {
        return self.player.z;
      },
      discovered: this.discovered,
      insights: this.insights,
      flags: this.flags,
      hints: this.hints,
      notify: (t) => this.ui.notify(t),
      onQuestsChanged: () => this.refreshQuestNpcs(),
    });
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.ui.onJournalClose = () => this.ui.closeJournal();
    this.ui.onPauseResume = () => this.ui.closePause();
    this.ui.onPauseSave = () => {
      this.save();
      this.ui.notify('Game saved.');
    };
    this.ui.onPauseQuality = () => this.cycleQuality();
    this.ui.onPauseQuit = () => {
      this.save();
      this.ui.closePause();
      this.showTitle();
    };
    this.showTitle();
    requestAnimationFrame((t) => this.loop(t));
  }

  private applyRendererQuality(): void {
    const q = QUALITY[this.quality];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, q.pixelRatio));
    this.renderer.shadowMap.enabled = q.shadowMap > 0;
    this.renderer.shadowMap.type = PCFShadowMap;
    this.renderer.shadowMap.needsUpdate = true;
  }

  private cycleQuality(): void {
    const order: Quality[] = ['low', 'medium', 'high'];
    this.quality = order[(order.indexOf(this.quality) + 1) % order.length];
    saveQuality(this.quality);
    this.applyRendererQuality();
    this.world.quality = QUALITY[this.quality];
    this.world.applyQuality();
    this.ui.setQualityLabel(this.quality);
    this.resize();
  }

  private resize(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.cam.resize(window.innerWidth / window.innerHeight);
  }

  private showTitle(): void {
    this.mode = 'title';
    this.input.releasePointer();
    this.input.blocked = true;
    const save = loadSave();
    this.ui.showTitle(!!save, () => this.newGame(), () => save && this.continueGame(save));
  }

  private async newGame(): Promise<void> {
    clearSave();
    this.discovered.clear();
    this.hints.clear();
    this.insights.clear();
    this.flags.clear();
    this.playtime = 0;
    this.quests.load({ completed: [], stepIndex: {} });
    this.quests.init();
    this.ui.hideTitle();
    await this.enterEra(getEra(HOME_ERA_ID), START.x, START.z, true);
    this.cam.yaw = Math.PI;
    this.ui.notify('1938. The Docks. Danny is shouting about Austria again.');
  }

  private async continueGame(s: SaveData): Promise<void> {
    this.discovered = new Set(s.discovered);
    this.hints = new Set(s.hints);
    this.insights = new Set(s.insights);
    this.flags = new Set(s.flags);
    this.playtime = s.playtime;
    // the quest context holds references to the sets, so rebuild it
    this.rebindQuestContext();
    this.quests.load(s.quests);
    this.quests.init();
    this.ui.hideTitle();
    const era = ERAS.find((e) => e.id === s.era) ?? getEra(HOME_ERA_ID);
    await this.enterEra(era, s.x, s.z, true);
    this.player.yaw = s.yaw;
    this.cam.yaw = s.camYaw;
  }

  private rebindQuestContext(): void {
    const self = this;
    this.quests = new QuestManager({
      get eraId() {
        return self.era.id;
      },
      get playerX() {
        return self.player.x;
      },
      get playerZ() {
        return self.player.z;
      },
      discovered: this.discovered,
      insights: this.insights,
      flags: this.flags,
      hints: this.hints,
      notify: (t) => this.ui.notify(t),
      onQuestsChanged: () => this.refreshQuestNpcs(),
    });
  }

  private mapFor(era: Era): HTMLCanvasElement {
    let m = this.mapCache.get(era.id);
    if (!m) {
      m = renderEraMap(era);
      this.mapCache.set(era.id, m);
    }
    return m;
  }

  /** Switch the world to an era and place the player. Shows the loading screen. */
  private async enterEra(era: Era, x: number, z: number, initial: boolean): Promise<void> {
    this.mode = 'busy';
    this.input.blocked = true;
    this.ui.showLoading(initial ? 'Building the city...' : `Rebuilding the city for ${era.yearLabel}...`);
    await nextFrame();
    await nextFrame();
    this.era = era;
    this.world.setEra(era);
    this.ports.refreshHeights(this.world);
    this.npcs.setEra(era);
    this.player.teleport(x, z, this.world);
    this.cam.snapTo(x, this.player.y, z);
    this.world.warmup(x, z);
    this.mapFor(era);
    this.ui.setEra(era);
    this.ui.setDistrict(era, x, z);
    this.refreshQuestNpcs();
    this.quests.update();
    this.ui.hideLoading();
    this.mode = 'play';
    this.input.blocked = false;
    this.autosaveT = 0;
  }

  private refreshQuestNpcs(): void {
    this.npcs.setQuestNpcs(this.quests.questNpcs());
  }

  private async travel(targetEraId: string, arriveX: number, arriveZ: number): Promise<void> {
    const era = getEra(targetEraId);
    this.mode = 'busy';
    this.input.blocked = true;
    this.input.releasePointer();
    this.save();
    await this.ui.playTransition(era, async () => {
      await this.enterEra(era, arriveX, arriveZ, false);
      this.mode = 'busy';
      this.input.blocked = true;
    });
    this.mode = 'play';
    this.input.blocked = false;
    this.quests.update();
    this.save();
  }

  save(): void {
    if (this.mode === 'title') return;
    writeSave({
      version: 1,
      era: this.era.id,
      x: this.player.x,
      z: this.player.z,
      yaw: this.player.yaw,
      camYaw: this.cam.yaw,
      discovered: [...this.discovered],
      hints: [...this.hints],
      insights: [...this.insights],
      flags: [...this.flags],
      quests: this.quests.state,
      playtime: this.playtime,
      quality: this.quality,
      savedAt: Date.now(),
    });
  }

  private loop(t: number): void {
    requestAnimationFrame((tt) => this.loop(tt));
    const dt = Math.min(0.05, (t - this.lastT) / 1000 || 0.016);
    this.lastT = t;
    this.frame++;
    this.input.poll();
    if (this.mode === 'play') this.updatePlay(dt);
    else if (this.mode === 'title') {
      // slow idle orbit behind the title screen
      this.cam.yaw += dt * 0.05;
      this.cam.update(this.player.x, this.player.y, this.player.z, dt, [], (x, z) => this.world.groundY(x, z));
    }
    this.renderer.render(this.scene, this.cam.camera);
    this.input.endFrame();
  }

  private updatePlay(dt: number): void {
    const s = this.input.state;
    const ui = this.ui;
    // overlays
    if (ui.dialogueOpen) {
      this.input.blocked = true;
      if (s.interact || s.pause) ui.advanceDialogue();
      this.cam.update(this.player.x, this.player.y, this.player.z, dt, this.world.collidersNear(this.player.x, this.player.z, 20, this.colTmp), (x, z) => this.world.groundY(x, z));
      this.npcs.update(dt, this.player.x, this.player.z);
      this.ports.update(dt, this.era, HOME_ERA_ID);
      return;
    }
    if (ui.journalOpen) {
      this.input.blocked = true;
      if (s.map || s.pause) ui.closeJournal();
      return;
    }
    if (ui.pauseOpen) {
      this.input.blocked = true;
      if (s.pause) ui.closePause();
      return;
    }
    this.input.blocked = false;
    if (s.map) {
      this.input.releasePointer();
      ui.openJournal(this.journalData());
      return;
    }
    if (s.pause) {
      this.input.releasePointer();
      ui.openPause(this.quality);
      return;
    }

    this.playtime += dt;
    this.autosaveT += dt;
    if (this.autosaveT > 20) {
      this.autosaveT = 0;
      this.save();
    }

    this.cam.rotate(s.lookX, s.lookY);
    if (s.zoom) this.cam.zoom(s.zoom);
    this.player.update(dt, s.moveX, s.moveY, s.sprint, s.jump, this.cam.forward(), this.world);
    this.world.update(this.player.x, this.player.z, 5);
    this.npcs.update(dt, this.player.x, this.player.z);
    this.ports.update(dt, this.era, HOME_ERA_ID);
    this.quests.update();

    // chronoport discovery
    const near = this.ports.nearest(this.player.x, this.player.z, PORT_NOTICE_RADIUS);
    if (near && !this.discovered.has(near.era.id)) {
      this.discovered.add(near.era.id);
      ui.notify(`Chronoport discovered: ${near.era.civ}, ${near.era.yearLabel}. Recorded in your journal.`);
      this.quests.update();
      this.save();
    }

    // interaction prompt
    let prompt: string | null = null;
    let action: (() => void) | null = null;
    const qn = this.npcs.nearest(this.player.x, this.player.z, 2.8);
    const port = this.ports.nearest(this.player.x, this.player.z, PORT_USE_RADIUS);
    if (qn && qn.questId) {
      const d = this.quests.linesFor(qn.questId);
      if (d) {
        prompt = qn.isObject ? `E: Read ${qn.name}` : `E: Talk to ${qn.name}`;
        action = () => {
          this.npcs.engage(qn, this.player.x, this.player.z);
          this.input.releasePointer();
          void ui.showDialogue(qn.isObject ? qn.name : `${qn.name}, ${qn.role}`, d.lines).then(() => this.quests.completeInteraction(d.questId && qn.questId ? qn.questId : ''));
        };
      }
    }
    if (!prompt && port) {
      const active = this.ports.isActive(port, this.era, HOME_ERA_ID);
      const dest = this.era.id === port.era.id ? getEra(HOME_ERA_ID) : port.era;
      prompt = active ? `E: Enter the chronoport to ${dest.yearLabel}` : `The ring is cold. It opens only from 1938 or from ${port.era.yearLabel}.`;
      if (active) {
        action = () => {
          const p = port.era.chronoport!;
          void this.travel(dest.id, p.x + 6, p.z + 5);
        };
      }
    }
    if (!prompt && qn && !qn.questId) {
      prompt = `E: Talk to ${qn.name}`;
      action = () => {
        this.npcs.engage(qn, this.player.x, this.player.z);
        const line = qn.lines[Math.floor(Math.random() * qn.lines.length)];
        // ambient NPCs occasionally drop a chronoport rumour
        const rumour = this.pickRumour();
        void ui.showDialogue(`${qn.name}, ${qn.role}`, rumour && Math.random() < 0.18 ? [line, rumour] : [line]);
      };
    }
    ui.setPrompt(prompt);
    if (s.interact && action) action();

    // HUD
    const q = this.quests.trackedQuest();
    if (q) {
      const step = this.quests.currentStep(q);
      ui.setObjective(q.title, step.objective);
    } else ui.setObjective('Free roam', 'Explore the city. Find the remaining doors.');
    if (this.frame % 3 === 0) {
      const marker = q ? this.quests.markerFor(q) : null;
      ui.drawMinimap(
        this.mapFor(this.era),
        this.player.x,
        this.player.z,
        this.cam.yaw,
        marker,
        this.era.id,
        CHRONOPORT_ERAS.filter((e) => this.discovered.has(e.id) || this.hints.has(e.id)).map((e) => ({ x: e.chronoport!.x, z: e.chronoport!.z, found: this.discovered.has(e.id) })),
      );
    }
    if (this.frame % 30 === 0) ui.setDistrict(this.era, this.player.x, this.player.z);

    this.cam.update(this.player.x, this.player.y, this.player.z, dt, this.world.collidersNear(this.player.x, this.player.z, 20, this.colTmp), (x, z) => this.world.groundY(x, z));
  }

  private pickRumour(): string | null {
    if (this.era.id !== HOME_ERA_ID) return null;
    const unknown = CHRONOPORT_ERAS.filter((e) => !this.discovered.has(e.id) && !this.hints.has(e.id));
    if (!unknown.length) return null;
    const e = unknown[Math.floor(Math.random() * unknown.length)];
    this.hints.add(e.id);
    this.ui.notify(`Journal updated: a rumour about a door (${e.yearLabel}).`);
    return `You want to know about the old doors? ${e.chronoport!.hint} Do not tell the Bureau I said so.`;
  }

  private journalData(): import('./ui/ui').JournalData {
    const q = this.quests.trackedQuest();
    return {
      era: this.era,
      mapImage: this.mapFor(this.era),
      playerX: this.player.x,
      playerZ: this.player.z,
      playerYaw: this.cam.yaw,
      marker: q ? this.quests.markerFor(q) : null,
      discovered: this.discovered,
      hints: this.hints,
      insights: this.insights,
      quests: this.quests,
    };
  }

  /** Exposed for debugging in the console. */
  debug(): { era: string; x: number; z: number; chunks: number; pending: number; mode: string; triangles: number; calls: number; quests: import('./quests/types').QuestState; discovered: string[]; insights: string[] } {
    return {
      era: this.era.id, x: this.player.x, z: this.player.z, chunks: this.world.loadedChunkCount, pending: this.world.pendingCount, mode: this.mode,
      triangles: this.renderer.info.render.triangles, calls: this.renderer.info.render.calls, quests: this.quests.state, discovered: [...this.discovered], insights: [...this.insights],
    };
  }

  /** Debug: jump straight to an era at a position (console: chronopolis.debugTravel('roman')). */
  debugTravel(eraId: string, x?: number, z?: number): Promise<void> {
    const e = getEra(eraId);
    const px = x ?? (e.chronoport ? e.chronoport.x + 6 : START.x);
    const pz = z ?? (e.chronoport ? e.chronoport.z + 5 : START.z);
    return this.travel(eraId, px, pz);
  }

  /** Debug: aim the camera. */
  debugLook(yaw: number, pitch: number, distance = 9): void {
    this.cam.yaw = yaw;
    this.cam.pitch = pitch;
    this.cam.zoom((distance - this.cam.distance) / 1.1);
  }

  /** Debug: teleport within the current era. */
  debugTeleport(x: number, z: number): void {
    this.player.teleport(x, z, this.world);
    this.cam.snapTo(x, this.player.y, z);
    this.world.warmup(x, z);
  }

  get canvasEl(): HTMLCanvasElement {
    return this.canvas;
  }
}
