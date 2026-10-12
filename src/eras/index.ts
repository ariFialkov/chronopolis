import { ANCIENT_ERAS } from './ancient';
import { LATER_ERAS } from './later';
import type { Era } from './types';
import { BUILDING_STYLES } from './styles';

export const ERAS: Era[] = [...ANCIENT_ERAS, ...LATER_ERAS].sort((a, b) => a.year - b.year);
for (const e of ERAS) {
  const st = BUILDING_STYLES[e.id];
  if (!st) throw new Error(`No building style for era ${e.id}`);
  e.buildings = st;
}
export const HOME_ERA_ID = 'industrial';
const byId = new Map<string, Era>(ERAS.map((e) => [e.id, e]));

export function getEra(id: string): Era {
  const e = byId.get(id);
  if (!e) throw new Error(`Unknown era ${id}`);
  return e;
}

export const CHRONOPORT_ERAS: Era[] = ERAS.filter((e) => e.chronoport !== null);
