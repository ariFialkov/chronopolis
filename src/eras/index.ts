import { ANCIENT_ERAS } from './ancient';
import { LATER_ERAS } from './later';
import type { Era } from './types';

export const ERAS: Era[] = [...ANCIENT_ERAS, ...LATER_ERAS].sort((a, b) => a.year - b.year);
export const HOME_ERA_ID = 'industrial';
const byId = new Map<string, Era>(ERAS.map((e) => [e.id, e]));

export function getEra(id: string): Era {
  const e = byId.get(id);
  if (!e) throw new Error(`Unknown era ${id}`);
  return e;
}

export const CHRONOPORT_ERAS: Era[] = ERAS.filter((e) => e.chronoport !== null);
