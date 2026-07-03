import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildLevelOnePolishAcceptanceTour, renderLevelOnePolishAcceptanceMarkdown } from '../apps/portal/src/hmh-level-one-polish-tour.mjs';

const outPath = fileURLToPath(new URL('../docs/game-design/hmh-level-one-polish-acceptance-tour.md', import.meta.url));
const tour = buildLevelOnePolishAcceptanceTour();
await mkdir(dirname(outPath), { recursive: true });
await writeFile(outPath, renderLevelOnePolishAcceptanceMarkdown(tour));
console.log(`Wrote ${outPath}`);
console.log(JSON.stringify(tour.summary, null, 2));
