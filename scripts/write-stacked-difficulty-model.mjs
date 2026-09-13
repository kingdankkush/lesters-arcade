import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { garbageIntervalTicks, reorgCost } from '../apps/portal/src/stacked-sim.mjs';
import { STACKED_FIXED_STEP_HZ, STACKED_MAX_TICKS, BOARD_VISIBLE_ROWS, HASHPOWER_MAX, HASHPOWER_PER_CLEAR } from '../apps/portal/src/stacked-contracts.mjs';

const assumptions = [
  ['beginner',25,0.45,[0.90,0.09,0.01,0],0,[2,3]],
  ['intermediate',55,0.86,[0.60,0.25,0.10,0.05],0,[4,6]],
  ['expert',90,0.955,[0.30,0.30,0.20,0.20],0.10,[6,12]],
  ['elite',130,0.987,[0.15,0.25,0.20,0.40],0.25,[12,30]],
  ['god',180,0.995,[0.08,0.20,0.17,0.55],0.35,[30,40]],
];
const rounded = value => Number(value.toFixed(9));
export function buildStackedDifficultyModel({ stepTicks = 60 } = {}) {
  if (!Number.isInteger(stepTicks) || stepTicks < 1 || stepTicks > 60) throw new RangeError('stepTicks must be 1..60');
  const ticksPerMinute = STACKED_FIXED_STEP_HZ * 60;
  const stepMinutes = stepTicks / ticksPerMinute;
  const pressureStartRow = 14, attainmentFloor = 0.35;
  const tiers = assumptions.map(([id,piecesPerMinute,attainment,mix,spinClearShare,target]) => {
    const linesPerClear = mix.reduce((sum,share,index) => sum + share * (index + 1),0);
    const hashpowerPerClear = mix.reduce((sum,share,index) => sum + share * HASHPOWER_PER_CLEAR[index + 1],spinClearShare);
    const creditsPerLine = hashpowerPerClear / linesPerClear;
    const ownRows = piecesPerMinute * 4 / 10;
    const rates = (tick,height) => {
      const interval = garbageIntervalTicks(Math.floor(tick));
      const injected = Number.isFinite(interval) ? ticksPerMinute / interval : 0;
      const cost = reorgCost(Math.floor(tick));
      const pressure = Math.max(0,Math.min(1,(BOARD_VISIBLE_ROWS - height) / (BOARD_VISIBLE_ROWS - pressureStartRow)));
      const effective = attainment * (attainmentFloor + (1 - attainmentFloor) * pressure);
      const garbage = cost > HASHPOWER_MAX ? injected : Math.max(0,(injected - effective * ownRows * creditsPerLine / cost) / (1 + effective * creditsPerLine / cost));
      return { injected, garbage, rejected:injected-garbage, cost, effective, growth:(1-effective)*(ownRows+garbage) };
    };
    let height = 0, topOutMinutes = null;
    const trace = [];
    for (let tick = 0; tick < STACKED_MAX_TICKS; tick += stepTicks) {
      const initial = rates(tick,height);
      const mid = rates(tick + stepTicks / 2,height + initial.growth * stepMinutes / 2);
      const next = height + mid.growth * stepMinutes;
      trace.push({tick,height:rounded(height),heightAfter:rounded(Math.min(BOARD_VISIBLE_ROWS,next)),injectedRowsPerMinute:rounded(mid.injected),garbageRowsPerMinute:rounded(mid.garbage),rejectedRowsPerMinute:rounded(mid.rejected),reorgCost:mid.cost,effectiveAttainment:rounded(mid.effective)});
      if (next >= BOARD_VISIBLE_ROWS) {
        topOutMinutes = rounded((tick + stepTicks * (BOARD_VISIBLE_ROWS-height)/(next-height)) / ticksPerMinute);
        break;
      }
      height = next;
    }
    return {id,assumptions:{piecesPerMinute,attainment,clearMix:[...mix],spinClearShare},linesPerClear:rounded(linesPerClear),hashpowerPerClear:rounded(hashpowerPerClear),creditsPerLine:rounded(creditsPerLine),targetMinutes:[...target],topOutMinutes,trace};
  });
  return {version:'stacked-difficulty-model-v1',method:'explicit midpoint numerical integration',stepTicks,assumptions:{humanTelemetryAvailable:false,note:'Descriptive assumptions from mechanics section10, not shipped tuning and not fitted to these outputs. CHAIN bonus omitted.',pressureStartRow,attainmentFloor},tiers};
}
export function writeStackedDifficultyModel({ repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..') } = {}) {
  const output = path.join(repoRoot,'docs','stacked','difficulty-model.json');
  mkdirSync(path.dirname(output),{recursive:true});
  writeFileSync(output,`${JSON.stringify(buildStackedDifficultyModel(),null,2)}\n`,'utf8');
  return output;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(`STACKED difficulty model written: ${writeStackedDifficultyModel()}`);
}
