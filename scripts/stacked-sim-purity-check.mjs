import fs from 'node:fs';

const file = 'apps/portal/src/stacked-sim.mjs';
const source = fs.readFileSync(file, 'utf8');
const banned = ['Date', 'performance', 'Math.random', 'Math.hypot', 'Math.pow', '**', 'toFixed', 'window', 'document', 'navigator'];
const failures = banned.filter((token) => source.includes(token));
const imports = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
for (const specifier of imports) if (!['./seeded-rng.mjs','./stacked-contracts.mjs'].includes(specifier)) failures.push(`import:${specifier}`);
if (failures.length) { console.error(`STACKED sim purity failed: ${failures.join(', ')}`); process.exitCode = 1; }
else console.log(`STACKED sim purity passed: ${banned.length} banned tokens absent; ${imports.length} imports allowed.`);
