import type { Quest, QuestState, QuestStep } from './types';
import { CAMPAIGN } from './campaign';
import { getEra } from '../eras';
import type { NpcArchetype } from '../eras/types';
import type { QuestNpcSpec } from '../npc/npc';

export interface QuestContext {
  eraId: string;
  playerX: number;
  playerZ: number;
  discovered: Set<string>;
  insights: Set<string>;
  flags: Set<string>;
  hints: Set<string>;
  notify(text: string): void;
  onQuestsChanged(): void;
}

export interface Marker {
  x: number;
  z: number;
  era: string;
  label: string;
  questId: string;
}

const DEFAULT_LOOK: NpcArchetype = { role: '', weight: 1, body: 0x8a7a6a, legs: 0x3a3a3a, skin: 0xd8b094, hat: 'none', hatColor: 0, names: [], lines: [] };

export class QuestManager {
  state: QuestState = { completed: [], stepIndex: {} };
  private ctx: QuestContext;

  constructor(ctx: QuestContext) {
    this.ctx = ctx;
  }

  load(state: QuestState): void {
    this.state = { completed: [...state.completed], stepIndex: { ...state.stepIndex } };
  }

  isAvailable(q: Quest): boolean {
    if (this.state.completed.includes(q.id)) return false;
    if (!q.requires.every((r) => this.state.completed.includes(r))) return false;
    if (q.requiresInsights && this.ctx.insights.size < q.requiresInsights) return false;
    return true;
  }

  get active(): Quest[] {
    return CAMPAIGN.filter((q) => this.isAvailable(q));
  }

  get completed(): Quest[] {
    return CAMPAIGN.filter((q) => this.state.completed.includes(q.id));
  }

  currentStep(q: Quest): QuestStep {
    return q.steps[this.state.stepIndex[q.id] ?? 0];
  }

  /** The step the HUD tracks: the first active quest whose current step is in this era, else any. */
  trackedQuest(): Quest | null {
    const act = this.active;
    if (!act.length) return null;
    const here = act.find((q) => stepEra(this.currentStep(q)) === this.ctx.eraId);
    return here ?? act[0];
  }

  markerFor(q: Quest): Marker | null {
    const s = this.currentStep(q);
    const eraId = stepEra(s);
    switch (s.kind) {
      case 'talk':
      case 'read':
      case 'goto':
        return { x: s.x, z: s.z, era: eraId, label: s.kind === 'goto' ? s.label : s.name, questId: q.id };
      case 'findPort': {
        const p = getEra(s.port).chronoport!;
        // only point to it once the hint is known
        if (!this.ctx.hints.has(s.port) && !this.ctx.discovered.has(s.port)) return null;
        return { x: p.x, z: p.z, era: 'industrial', label: `Chronoport (${getEra(s.port).yearLabel})`, questId: q.id };
      }
      case 'travel': {
        // point to a usable port: in home era, the port to that era; elsewhere, the port home
        const target = s.era === 'industrial' ? this.ctx.eraId : s.era;
        const e = getEra(target);
        if (!e.chronoport) return null;
        return { x: e.chronoport.x, z: e.chronoport.z, era: this.ctx.eraId, label: `Chronoport`, questId: q.id };
      }
    }
  }

  /** Quest NPCs and objects that should exist in the current era right now. */
  questNpcs(): QuestNpcSpec[] {
    const out: QuestNpcSpec[] = [];
    for (const q of this.active) {
      const s = this.currentStep(q);
      if (s.kind === 'talk' && s.era === this.ctx.eraId) {
        out.push({ id: s.npcId, name: s.name, role: s.role, x: s.x, z: s.z, kind: 'npc', look: { ...DEFAULT_LOOK, ...(s.look ?? {}), role: s.role, lines: s.lines } });
      } else if (s.kind === 'read' && s.era === this.ctx.eraId) {
        out.push({ id: s.objectId, name: s.name, role: 'Inspect', x: s.x, z: s.z, kind: 'object', look: { ...DEFAULT_LOOK, lines: s.lines } });
      }
    }
    return out;
  }

  /** Returns dialogue lines if this npc/object id belongs to an active step. */
  linesFor(id: string): { speaker: string; lines: string[]; questId: string } | null {
    for (const q of this.active) {
      const s = this.currentStep(q);
      if (s.kind === 'talk' && s.npcId === id) return { speaker: s.name, lines: s.lines, questId: q.id };
      if (s.kind === 'read' && s.objectId === id) return { speaker: s.name, lines: s.lines, questId: q.id };
    }
    return null;
  }

  /** Called when a quest talk/read dialogue finished. */
  completeInteraction(id: string): void {
    for (const q of this.active) {
      const s = this.currentStep(q);
      if ((s.kind === 'talk' && s.npcId === id) || (s.kind === 'read' && s.objectId === id)) {
        this.advance(q);
        return;
      }
    }
  }

  /** Poll passive conditions (goto, findPort, travel). */
  update(): void {
    for (const q of this.active) {
      const s = this.currentStep(q);
      let done = false;
      if (s.kind === 'goto') done = s.era === this.ctx.eraId && Math.hypot(this.ctx.playerX - s.x, this.ctx.playerZ - s.z) < s.radius;
      else if (s.kind === 'findPort') done = this.ctx.discovered.has(s.port);
      else if (s.kind === 'travel') done = this.ctx.eraId === s.era;
      if (done) this.advance(q);
    }
  }

  private advance(q: Quest): void {
    const i = (this.state.stepIndex[q.id] ?? 0) + 1;
    if (i >= q.steps.length) {
      this.state.completed.push(q.id);
      delete this.state.stepIndex[q.id];
      if (q.insight) {
        this.ctx.insights.add(q.insight);
        this.ctx.notify(`Insight: ${getEra(q.insight).insight.title}`);
      }
      for (const h of q.revealHints ?? []) {
        this.ctx.hints.add(h);
        this.ctx.notify(`Journal updated: a clue about the ${getEra(h).yearLabel} door`);
      }
      for (const f of q.flags ?? []) this.ctx.flags.add(f);
      this.ctx.notify(q.completeText ? `${q.title} complete. ${q.completeText}` : `${q.title} complete.`);
      // newly unlocked quests
      for (const nq of CAMPAIGN) {
        if (this.isAvailable(nq) && !(nq.id in this.state.stepIndex)) {
          this.state.stepIndex[nq.id] = 0;
          this.ctx.notify(`New objective: ${nq.title}`);
        }
      }
    } else {
      this.state.stepIndex[q.id] = i;
      const ns = q.steps[i];
      this.ctx.notify(ns.objective);
    }
    this.ctx.onQuestsChanged();
  }

  /** Make sure initially available quests have a step index (new game). */
  init(): void {
    for (const q of CAMPAIGN) if (this.isAvailable(q) && !(q.id in this.state.stepIndex)) this.state.stepIndex[q.id] = 0;
  }
}

export function stepEra(s: QuestStep): string {
  switch (s.kind) {
    case 'findPort':
      return 'industrial';
    default:
      return s.era;
  }
}
