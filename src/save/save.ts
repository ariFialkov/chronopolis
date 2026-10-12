import type { QuestState } from '../quests/types';

export interface SaveData {
  version: number;
  era: string;
  x: number;
  z: number;
  yaw: number;
  camYaw: number;
  discovered: string[];
  hints: string[];
  insights: string[];
  flags: string[];
  quests: QuestState;
  playtime: number;
  quality: 'low' | 'medium' | 'high';
  savedAt: number;
}

const KEY = 'chronopolis.save.v1';

export function loadSave(): SaveData | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as SaveData;
    if (d.version !== 1) return null;
    return d;
  } catch {
    return null;
  }
}

export function writeSave(d: SaveData): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
    return true;
  } catch {
    return false;
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function loadQuality(): 'low' | 'medium' | 'high' | null {
  try {
    const q = localStorage.getItem('chronopolis.quality');
    return q === 'low' || q === 'medium' || q === 'high' ? q : null;
  } catch {
    return null;
  }
}

export function saveQuality(q: 'low' | 'medium' | 'high'): void {
  try {
    localStorage.setItem('chronopolis.quality', q);
  } catch {
    /* ignore */
  }
}
