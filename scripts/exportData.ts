/**
 * Writes the game's content (eras, building styles, ground surfaces, outfits, campaign) as JSON
 * for the Godot version, which reads everything from godot/data.
 * Run: npx esbuild scripts/exportData.ts --bundle --platform=node --format=esm --outfile=node_modules/.cache/exportData.mjs && node node_modules/.cache/exportData.mjs
 */
import { writeFileSync } from 'node:fs';
import { ERAS, HOME_ERA_ID } from '../src/eras';
import { SURFACES } from '../src/world/surfaces';
import { CAST } from '../src/characters/cast';
import { CAMPAIGN } from '../src/quests/campaign';

const out = 'godot/data';
const write = (name: string, data: unknown): void => {
  writeFileSync(`${out}/${name}`, JSON.stringify(data, null, 1));
  console.log('wrote', name);
};
write('eras.json', { home: HOME_ERA_ID, eras: ERAS });
write('surfaces.json', SURFACES);
write('cast.json', CAST);
write('campaign.json', CAMPAIGN);
