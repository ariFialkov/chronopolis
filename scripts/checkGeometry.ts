/** Builds detailed buildings for every era in node and scans the vertex data for NaN/Infinity. */
import { ERAS } from '../src/eras';
import { MeshBuilder } from '../src/world/meshBuilder';
import { makePattern } from '../src/world/pattern';
import { buildBuilding } from '../src/world/buildings';
import { lotBuildChance, lotIsClear } from '../src/world/world';
import { terrainHeight } from '../src/world/macro';
import { hash2, Rng } from '../src/util/rng';
import { surfacesFor } from '../src/world/surfaces';

let bad = 0;
for (const era of ERAS) {
  const pattern = makePattern(era, surfacesFor(era.id).parkChance);
  const lots = pattern.lotsInRect(-320, -240, -160, -80);
  let built = 0;
  let clear = 0;
  for (const lot of lots) {
    const p = lotBuildChance(era, lot);
    if (hash2(Math.round(lot.x * 10), Math.round(lot.z * 10), 9) > p) continue;
    if (!lotIsClear(lot, lot.w / 2, lot.d / 2, pattern)) continue;
    clear++;
    const mb = new MeshBuilder();
    const b = buildBuilding(mb, lot, era, terrainHeight(lot.x, lot.z), new Rng(lot.seed >>> 0), undefined, true, terrainHeight);
    if (!b) continue;
    built++;
    const g = mb.build();
    const pos = g.attributes.position.array as Float32Array;
    for (let i = 0; i < pos.length; i++) {
      if (!Number.isFinite(pos[i])) {
        bad++;
        console.log(`NaN in ${era.id} template=${b.template.tag ?? b.template.features?.join('+')} at lot (${lot.x.toFixed(0)},${lot.z.toFixed(0)})`);
        break;
      }
    }
  }
  console.log(`${era.id.padEnd(10)} lots=${lots.length} clear=${clear} built=${built}`);
}
console.log(bad ? `${bad} bad buildings` : 'all geometry finite');
process.exit(bad ? 1 : 0);
