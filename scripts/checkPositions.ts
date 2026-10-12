/**
 * Sanity check: every quest location, chronoport and the start point must be on dry land and
 * outside every era's landmark colliders. Run with: npm run check:positions
 */
import { ERAS, CHRONOPORT_ERAS } from '../src/eras';
import { CAMPAIGN } from '../src/quests/campaign';
import { SITES, terrainHeight, isWater, waterDepth } from '../src/world/macro';
import { MeshBuilder } from '../src/world/meshBuilder';
import { buildLandmark, landmarkKeyForSite } from '../src/world/landmarks';
import { pointInCollider, type Collider } from '../src/world/collision';
import { Rng, hash2 } from '../src/util/rng';

let problems = 0;
const points: { label: string; era: string | null; x: number; z: number }[] = [];
points.push({ label: 'start', era: 'industrial', x: 160, z: 438 });
for (const e of CHRONOPORT_ERAS) points.push({ label: `port:${e.id}`, era: null, x: e.chronoport!.x, z: e.chronoport!.z });
for (const q of CAMPAIGN) {
  for (const s of q.steps) {
    if (s.kind === 'talk' || s.kind === 'read' || s.kind === 'goto') points.push({ label: `${q.id}/${s.kind}:${'name' in s ? s.name : s.label}`, era: s.era, x: s.x, z: s.z });
  }
}
for (const era of ERAS) {
  const cols: Collider[] = [];
  for (const id in SITES) {
    const site = SITES[id];
    const k = landmarkKeyForSite(era, id);
    if (!k) continue;
    const mb = new MeshBuilder();
    const rng = new Rng(hash2(site.x, site.z, 77) * 1e9);
    cols.push(...buildLandmark(mb, k, site, era, terrainHeight(site.x, site.z), rng));
  }
  for (const p of points) {
    if (p.era && p.era !== era.id) continue;
    if (isWater(p.x, p.z) || waterDepth(p.x, p.z) > -2) {
      console.log(`WATER   ${era.id.padEnd(10)} ${p.label} (${p.x},${p.z}) depth=${waterDepth(p.x, p.z).toFixed(1)}`);
      problems++;
    }
    for (const c of cols) {
      if (pointInCollider(c, p.x, p.z, 1.0)) {
        console.log(`BLOCKED ${era.id.padEnd(10)} ${p.label} (${p.x},${p.z}) by ${c.tag ?? 'landmark'} at (${c.x.toFixed(0)},${c.z.toFixed(0)}) ${(c.hw * 2).toFixed(0)}x${(c.hd * 2).toFixed(0)}`);
        problems++;
      }
    }
  }
}
console.log(problems ? `${problems} problem(s)` : `all ${points.length} points clear in ${ERAS.length} eras`);
process.exit(problems ? 1 : 0);
