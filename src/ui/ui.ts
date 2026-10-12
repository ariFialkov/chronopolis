import type { Era } from '../eras/types';
import { ERAS, getEra, CHRONOPORT_ERAS } from '../eras';
import { MAP_PX, worldToMap } from '../world/mapImage';
import { SITES, districtAt, WORLD_HALF } from '../world/macro';
import type { Marker, QuestManager } from '../quests/questManager';
import type { Input } from '../engine/input';

function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`missing #${id}`);
  return el;
}

export interface JournalData {
  era: Era;
  mapImage: HTMLCanvasElement;
  playerX: number;
  playerZ: number;
  playerYaw: number;
  marker: Marker | null;
  discovered: Set<string>;
  hints: Set<string>;
  insights: Set<string>;
  quests: QuestManager;
}

export class UI {
  readonly hud = $('hud');
  private eraName = $('era-name');
  private eraYear = $('era-year');
  private district = $('district');
  private objectiveTitle = $('objective-title');
  private objectiveText = $('objective-text');
  private prompt = $('prompt');
  private toasts = $('toasts');
  private minimap = $('minimap') as HTMLCanvasElement;
  private dialogueEl = $('dialogue');
  private dialogueSpeaker = $('dialogue-speaker');
  private dialogueText = $('dialogue-text');
  private journal = $('journal');
  private bigmap = $('bigmap') as HTMLCanvasElement;
  private pause = $('pause');
  private title = $('title');
  private transition = $('transition');
  private loading = $('loading');
  private touch = $('touch-controls');
  private journalTab = 'map';
  private dialogueLines: string[] = [];
  private dialogueIndex = 0;
  private dialogueResolve: (() => void) | null = null;
  onJournalClose: () => void = () => {};
  onPauseResume: () => void = () => {};
  onPauseSave: () => void = () => {};
  onPauseQuality: () => void = () => {};
  onPauseQuit: () => void = () => {};

  constructor(input: Input) {
    if (input.isTouch) {
      this.touch.classList.remove('hidden');
      input.setJoystickElements($('joy-base'), $('joy-knob'));
      input.bindButton($('btn-interact'), 'interact');
      input.bindButton($('btn-jump'), 'jump');
      input.bindButton($('btn-sprint'), 'sprint');
      input.bindButton($('btn-map'), 'map');
      input.bindButton($('btn-pause'), 'pause');
      $('title-hint').textContent = 'Left side: joystick. Right side: drag to look. E talks and uses doors.';
    }
    for (const tab of Array.from(this.journal.querySelectorAll<HTMLElement>('.tab'))) {
      tab.addEventListener('click', () => this.showTab(tab.dataset.tab!));
    }
    $('journal-close').addEventListener('click', () => this.onJournalClose());
    $('pause-resume').addEventListener('click', () => this.onPauseResume());
    $('pause-save').addEventListener('click', () => this.onPauseSave());
    $('pause-quality').addEventListener('click', () => this.onPauseQuality());
    $('pause-quit').addEventListener('click', () => this.onPauseQuit());
    $('pause-controls').addEventListener('click', () => $('controls-help').classList.toggle('hidden'));
    this.dialogueEl.addEventListener('click', () => this.advanceDialogue());
  }

  // ----- title -----
  showTitle(hasSave: boolean, onNew: () => void, onContinue: () => void): void {
    this.title.classList.remove('hidden');
    this.hud.classList.add('hidden');
    const c = $('title-continue') as HTMLButtonElement;
    c.disabled = !hasSave;
    c.style.opacity = hasSave ? '1' : '0.4';
    c.onclick = () => hasSave && onContinue();
    $('title-new').onclick = () => {
      if (hasSave && !confirm('Start a new game? Your saved city will be overwritten.')) return;
      onNew();
    };
  }
  hideTitle(): void {
    this.title.classList.add('hidden');
    this.hud.classList.remove('hidden');
  }
  setInstallHint(text: string): void {
    $('install-hint').textContent = text;
  }

  // ----- loading / transition -----
  showLoading(text: string): void {
    $('loading-text').textContent = text;
    this.loading.classList.remove('hidden');
  }
  hideLoading(): void {
    this.loading.classList.add('hidden');
  }
  async playTransition(era: Era, work: () => Promise<void>): Promise<void> {
    $('transition-year').textContent = era.yearLabel;
    $('transition-name').textContent = era.name;
    $('transition-tag').textContent = era.tagline;
    this.transition.classList.remove('hidden');
    await nextFrame();
    this.transition.classList.add('show');
    await wait(650);
    await work();
    await wait(1400);
    this.transition.classList.remove('show');
    await wait(650);
    this.transition.classList.add('hidden');
  }

  // ----- hud -----
  setEra(era: Era): void {
    this.eraName.textContent = era.name;
    this.eraYear.textContent = `${era.civ} · ${era.yearLabel}`;
  }
  setDistrict(era: Era, x: number, z: number): void {
    const d = districtAt(x, z);
    this.district.textContent = era.districtNames[d] ?? '';
  }
  setObjective(title: string, text: string): void {
    this.objectiveTitle.textContent = title;
    this.objectiveText.textContent = text;
  }
  setPrompt(text: string | null): void {
    if (!text) this.prompt.classList.add('hidden');
    else {
      this.prompt.textContent = text;
      this.prompt.classList.remove('hidden');
    }
  }
  notify(text: string): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = text;
    this.toasts.appendChild(el);
    while (this.toasts.children.length > 4) this.toasts.removeChild(this.toasts.firstChild!);
    setTimeout(() => el.remove(), 5000);
  }

  drawMinimap(map: HTMLCanvasElement, px: number, pz: number, yaw: number, marker: Marker | null, eraId: string, ports: { x: number; z: number; found: boolean }[]): void {
    const ctx = this.minimap.getContext('2d')!;
    const W = this.minimap.width;
    const viewM = 130; // meters across
    const scale = W / viewM;
    ctx.save();
    ctx.clearRect(0, 0, W, W);
    ctx.imageSmoothingEnabled = true;
    const [mx, my] = worldToMap(px, pz);
    const srcW = (viewM / (WORLD_HALF * 2)) * MAP_PX;
    ctx.drawImage(map, mx - srcW / 2, my - srcW / 2, srcW, srcW, 0, 0, W, W);
    const toScreen = (x: number, z: number): [number, number] => [W / 2 + (x - px) * scale, W / 2 + (z - pz) * scale];
    for (const p of ports) {
      const [sx, sz] = toScreen(p.x, p.z);
      if (sx < -10 || sx > W + 10 || sz < -10 || sz > W + 10) continue;
      ctx.strokeStyle = p.found ? '#6ad0ff' : 'rgba(106,208,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sx, sz, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (marker && marker.era === eraId) {
      const [sx, sz] = toScreen(marker.x, marker.z);
      const dx = sx - W / 2;
      const dz = sz - W / 2;
      const d = Math.hypot(dx, dz);
      const r = W / 2 - 10;
      const cx = d > r ? W / 2 + (dx / d) * r : sx;
      const cz = d > r ? W / 2 + (dz / d) * r : sz;
      ctx.fillStyle = '#ffd36a';
      ctx.beginPath();
      ctx.moveTo(cx, cz - 7);
      ctx.lineTo(cx + 6, cz);
      ctx.lineTo(cx, cz + 7);
      ctx.lineTo(cx - 6, cz);
      ctx.closePath();
      ctx.fill();
    }
    // player
    ctx.translate(W / 2, W / 2);
    ctx.rotate(-yaw);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(6, 6);
    ctx.lineTo(0, 3);
    ctx.lineTo(-6, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // ----- dialogue -----
  get dialogueOpen(): boolean {
    return !this.dialogueEl.classList.contains('hidden');
  }
  showDialogue(speaker: string, lines: string[]): Promise<void> {
    this.dialogueLines = lines;
    this.dialogueIndex = 0;
    this.dialogueSpeaker.textContent = speaker;
    this.dialogueText.textContent = lines[0] ?? '';
    this.dialogueEl.classList.remove('hidden');
    return new Promise((resolve) => (this.dialogueResolve = resolve));
  }
  advanceDialogue(): void {
    if (!this.dialogueOpen) return;
    this.dialogueIndex++;
    if (this.dialogueIndex >= this.dialogueLines.length) {
      this.dialogueEl.classList.add('hidden');
      const r = this.dialogueResolve;
      this.dialogueResolve = null;
      r?.();
    } else {
      this.dialogueText.textContent = this.dialogueLines[this.dialogueIndex];
    }
  }

  // ----- journal -----
  get journalOpen(): boolean {
    return !this.journal.classList.contains('hidden');
  }
  openJournal(data: JournalData): void {
    this.journal.classList.remove('hidden');
    this.renderJournal(data);
  }
  closeJournal(): void {
    this.journal.classList.add('hidden');
  }
  private showTab(tab: string): void {
    this.journalTab = tab;
    for (const t of Array.from(this.journal.querySelectorAll<HTMLElement>('.tab'))) t.classList.toggle('active', t.dataset.tab === tab);
    for (const p of Array.from(this.journal.querySelectorAll<HTMLElement>('.tab-page'))) p.classList.toggle('hidden', p.id !== `tab-${tab}`);
  }
  renderJournal(d: JournalData): void {
    this.showTab(this.journalTab);
    // map
    const ctx = this.bigmap.getContext('2d')!;
    const S = this.bigmap.width;
    const k = S / MAP_PX;
    ctx.clearRect(0, 0, S, S);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(d.mapImage, 0, 0, S, S);
    const toS = (x: number, z: number): [number, number] => {
      const [mx, my] = worldToMap(x, z);
      return [mx * k, my * k];
    };
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    for (const id in SITES) {
      const s = SITES[id];
      const [sx, sz] = toS(s.x, s.z);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillText(d.era.districtNames[districtAt(s.x, s.z)] ?? s.label, sx + 1, sz + 1);
      ctx.fillStyle = '#fff';
      ctx.fillText(d.era.districtNames[districtAt(s.x, s.z)] ?? s.label, sx, sz);
    }
    for (const e of CHRONOPORT_ERAS) {
      const p = e.chronoport!;
      const found = d.discovered.has(e.id);
      const hinted = d.hints.has(e.id);
      if (!found && !hinted) continue;
      const [sx, sz] = toS(p.x, p.z);
      ctx.strokeStyle = found ? '#6ad0ff' : '#ffd36a';
      ctx.lineWidth = 2;
      ctx.setLineDash(found ? [] : [3, 3]);
      ctx.beginPath();
      ctx.arc(sx, sz, found ? 7 : 14, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      if (found) {
        ctx.fillStyle = '#6ad0ff';
        ctx.fillText(e.yearLabel, sx, sz - 10);
      }
    }
    if (d.marker && d.marker.era === d.era.id) {
      const [sx, sz] = toS(d.marker.x, d.marker.z);
      ctx.fillStyle = '#ffd36a';
      ctx.beginPath();
      ctx.moveTo(sx, sz - 10);
      ctx.lineTo(sx + 8, sz);
      ctx.lineTo(sx, sz + 10);
      ctx.lineTo(sx - 8, sz);
      ctx.closePath();
      ctx.fill();
      ctx.fillText(d.marker.label, sx, sz - 14);
    }
    const [px, pz] = toS(d.playerX, d.playerZ);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-d.playerYaw);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    $('map-legend').innerHTML = `<b>${d.era.name}</b>, ${d.era.yearLabel}<br>${d.era.lore}<br><br><span style="color:#fff">&#9650;</span> you &nbsp; <span style="color:#ffd36a">&#9670;</span> objective &nbsp; <span style="color:#6ad0ff">&#9711;</span> chronoport found &nbsp; <span style="color:#ffd36a">&#9711;</span> rumoured`;

    // quests
    const qEl = $('tab-quests');
    qEl.innerHTML = '';
    const active = d.quests.active;
    if (!active.length) qEl.innerHTML = '<p class="small">No active objectives. Explore the city, talk to people, and look for doors.</p>';
    for (const q of active) {
      const step = d.quests.currentStep(q);
      const el = document.createElement('div');
      el.className = 'quest';
      const stepEra = step.kind === 'findPort' ? 'industrial' : step.era;
      el.innerHTML = `<h3>${q.title}</h3><p>${q.summary}</p><p class="step">&#9670; ${step.objective}${stepEra !== d.era.id ? ` <i>(in ${getEra(stepEra).yearLabel})</i>` : ''}</p>`;
      qEl.appendChild(el);
    }
    for (const q of d.quests.completed) {
      const el = document.createElement('div');
      el.className = 'quest done';
      el.innerHTML = `<h3>${q.title}</h3><p>Complete</p>`;
      qEl.appendChild(el);
    }

    // ports
    const pEl = $('tab-ports');
    pEl.innerHTML = `<p class="small">Chronoports are rings of stone that stand in the same place in every era. Each opens on one year, and from that year leads home to 1938. ${d.discovered.size} of ${CHRONOPORT_ERAS.length} found.</p>`;
    for (const e of ERAS) {
      if (!e.chronoport) continue;
      const found = d.discovered.has(e.id);
      const hinted = d.hints.has(e.id);
      const el = document.createElement('div');
      el.className = `port ${found ? 'found' : hinted ? 'hinted' : ''}`;
      const where = found ? `Found: ${e.chronoport.placeName}.` : hinted ? `Rumour: ${e.chronoport.hint}` : 'Location unknown. Explore, or ask around.';
      el.innerHTML = `<h3>${found || hinted ? `${e.civ} · ${e.yearLabel}` : '??? · ' + e.yearLabel}</h3><p>${where}</p>`;
      pEl.appendChild(el);
    }

    // insights
    const iEl = $('tab-insights');
    iEl.innerHTML = `<p class="small">Every civilization you visit fell for a reason. ${d.insights.size} of ${ERAS.length - 1} lessons recorded.</p>`;
    for (const e of ERAS) {
      if (e.id === 'industrial') continue;
      const has = d.insights.has(e.id);
      const el = document.createElement('div');
      el.className = `insight ${has ? '' : 'locked'}`;
      el.innerHTML = has ? `<h3>${e.insight.title} <span class="small">(${e.civ}, ${e.yearLabel})</span></h3><p>${e.insight.text}</p>` : `<h3>${e.civ}, ${e.yearLabel}</h3><p>Not yet understood.</p>`;
      iEl.appendChild(el);
    }
  }

  // ----- pause -----
  get pauseOpen(): boolean {
    return !this.pause.classList.contains('hidden');
  }
  openPause(quality: string): void {
    $('pause-quality').textContent = `Quality: ${quality}`;
    this.pause.classList.remove('hidden');
  }
  closePause(): void {
    this.pause.classList.add('hidden');
  }
  setQualityLabel(q: string): void {
    $('pause-quality').textContent = `Quality: ${q}`;
  }
}

export function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
export function nextFrame(): Promise<void> {
  return new Promise((r) => requestAnimationFrame(() => r()));
}
