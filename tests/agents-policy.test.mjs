import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8');
const syntaxSource = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');

test('WO-67 AGENTS documents render-layer visual verification policy', () => {
  assert.match(agents, /Render-layer visual verification/);
  assert.match(agents, /npm run visual:reboot/);
  assert.match(agents, /npm run visual:reboot:accept/);
  assert.match(agents, /ground plane|ground-plane/);
  assert.match(agents, /prop grounding/);
  assert.match(agents, /depth sort|depth sorting/);
  assert.match(agents, /VISUAL_BASELINES/);
  assert.match(agents, /do not rely on screenshots alone/i);
  assert.match(agents, /commit.*baseline/i);
});

test('WO-67 AGENTS policy test is included in the explicit syntax gate', () => {
  assert.match(syntaxSource, /tests\/agents-policy\.test\.mjs/);
});

test('read order starts from current release truth and scopes historical reading to the selected slice', () => {
  const readOrder = agents.split('## Read order')[1].split('## Current game direction')[0];
  const entries = [...readOrder.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
  assert.deepEqual(entries, [1, 2, 3, 4, 5, 6]);
  assert.match(readOrder, /^1\. `README\.md` top sections/m);
  assert.match(readOrder, /^2\. `docs\/handoffs\/pre-deployment-web3-guide-20260922\.md`/m);
  assert.match(readOrder, /^3\. `docs\/web3\/weekly-jackpot-operations\.md`/m);
  assert.match(readOrder, /^4\. `docs\/handoffs\/hmh-textured-rollout-progress\.md`/m);
  assert.match(readOrder, /2026-09-07-hmh-open-work-register-and-reprompt\.md/);
  assert.match(readOrder, /OPEN-WORK-CURRENT-STATUS\.json` is its 2026-09-08 snapshot, not current status/);
  assert.match(readOrder, /selected slice/);
  assert.doesNotMatch(readOrder, /latest.*CYCLE|0\. /i);
});

test('AGENTS Web3 truth and release baseline match the deployed testnet state', () => {
  const web3 = agents.split('## Web3 truth')[1];
  assert.match(web3, /Ranked Mode is live on the LitVM LiteForge \*\*testnet\*\*/);
  assert.match(web3, /contracts\/deployment-record\.hardened\.json/);
  assert.match(web3, /`JACKPOT_LIVE` is `false`/);
  assert.doesNotMatch(web3, /`SETTLEMENT_LIVE` is false|Hardened predicted contracts are undeployed/);
  const settlement = readFileSync(new URL('../apps/portal/src/settlement.mjs', import.meta.url), 'utf8');
  assert.match(settlement, /^export const SETTLEMENT_LIVE = true;$/m);
  const jackpot = readFileSync(new URL('../apps/portal/src/jackpot-config.mjs', import.meta.url), 'utf8');
  assert.match(jackpot, /^export const JACKPOT_LIVE = false;$/m);
  const safety = agents.split('## Git and deployment safety')[1].split('## Runtime authority')[0];
  assert.match(safety, /Production is released from `fable\/master-list-20260916`/);
  assert.match(safety, /Do not promote a Vercel deployment without the owner's explicit approval/);
  assert.doesNotMatch(safety, /Production deployment is `dpl_5mUEBJ6dZYaW6PANwSc1SfBnJRWo`/);
});

test('HMH sequenced work no longer marks the shipped Cycle 072-074 groups unstarted', () => {
  const roadmap = readFileSync(new URL('../docs/hmh-reboot/AAA-ROADMAP.md', import.meta.url), 'utf8');
  const sequence = roadmap.split('## 7. Sequencing')[1].split('## 8. Owner playbook')[0];
  assert.match(sequence, /Shipped foundation/);
  for (const id of ['P-4', 'K-1', 'U-2', 'P-1', 'P-2', 'P-3', 'P-5', 'W-1', 'W-3', 'W-4', 'U-3', 'U-4', 'U-5', 'V-1', 'V-2', 'V-3', 'V-4', 'V-5']) {
    assert.ok(sequence.includes(id), `reconciled shipped ID absent: ${id}`);
    assert.ok(!sequence.split('\n').some((line) => line.startsWith('- [ ]') && new RegExp(`\\b${id}\\b`).test(line)), `shipped ID remains unstarted: ${id}`);
  }
  assert.match(sequence, /release certification remains open/);
});

test('retired checklist and STACKED plan cannot masquerade as current implementation truth', () => {
  const retired = readFileSync(new URL('../docs/release-readiness-master-task-list-2026-07-09.md', import.meta.url), 'utf8');
  assert.match(retired.slice(0, 900), /SUPERSEDED.*retired Canvas 2D/i);
  const stacked = readFileSync(new URL('../docs/stacked/STACKED-MASTER-PLAN.md', import.meta.url), 'utf8');
  assert.match(stacked.slice(0, 1300), /S-01.*S-03.*accepted/);
  assert.match(stacked.slice(0, 1300), /public and Ranked-eligible/);
  assert.doesNotMatch(stacked.slice(0, 1300), /^## STATUS:.*not publicly playable/m);
  assert.doesNotMatch(stacked.slice(0, 1300), /NOTHING IS BUILT|No STACKED code exists/);
});
