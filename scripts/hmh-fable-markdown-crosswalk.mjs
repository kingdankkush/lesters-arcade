import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FABLE_MARKDOWN_CROSSWALK = Object.freeze({
  auditedAt: '2026-07-03',
  sourceFiles: Object.freeze([
    '.hermes/desktop-attachments/hmh-ship-v1-master-todo.md',
    '.hermes/desktop-attachments/hermes-wave2-core-loop-handoff.md',
    '.hermes/desktop-attachments/hermes-wave3-sprites-animation-handoff.md',
    '.hermes/desktop-attachments/hermes-repo-cleanup-guide.md',
    'OPEN_QUESTIONS.md',
    'docs/THIRD_PARTY_GAME_ONBOARDING.md',
  ]),
  completedLocalWorkOrders: Object.freeze([
    Object.freeze({ id: 'WO-30', title: 'copywriting pass and copy sheet', evidence: 'docs/game-design/hard-money-heroes-copy-sheet.md; npm run design:copy-sheet' }),
    Object.freeze({ id: 'WO-32', title: 'combat feedback certification', evidence: 'docs/art/COMBAT_FEEDBACK_CERTIFICATION.md; npm run design:combat-feedback' }),
    Object.freeze({ id: 'WO-33', title: 'boss balance pass', evidence: 'docs/game-design/hard-money-heroes-boss-balance.md; npm run design:boss-balance' }),
    Object.freeze({ id: 'WO-34', title: 'structured playtest and bug sweep', evidence: 'docs/qa/hard-money-heroes-playtest-sweep.md; npm run design:playtest-sweep' }),
    Object.freeze({ id: 'WO-35', title: 'avatar/profile persistence parity', evidence: 'docs/qa/hard-money-heroes-profile-parity.md; npm run design:profile-parity' }),
    Object.freeze({ id: 'WO-36', title: 'load-speed optimization pass', evidence: 'docs/performance/hard-money-heroes-load-speed.md; npm run design:load-speed' }),
    Object.freeze({ id: 'WO-37', title: 'device and input QA matrix', evidence: 'docs/qa/hard-money-heroes-device-input-qa.md; npm run design:device-input' }),
    Object.freeze({ id: 'WO-38', title: 'Web3 wallet to settlement to leaderboard audit', evidence: 'docs/qa/hard-money-heroes-web3-settlement-audit.md; npm run design:web3-audit' }),
    Object.freeze({ id: 'WO-39', title: 'security audit sweep', evidence: 'docs/security/hard-money-heroes-security-audit.md; npm run design:security-audit' }),
    Object.freeze({ id: 'WO-40', title: 'upgrade menu presentation', evidence: 'tests/hmh-upgrade-menu-ui.test.mjs; upgrade-menu runtime markers' }),
    Object.freeze({ id: 'WO-41', title: 'game audio and SFX system upgrade', evidence: 'docs/audio/hard-money-heroes-audio-system.md; npm run design:audio-system' }),
  ]),
  remainingImplementableWaves: Object.freeze([
    Object.freeze({ id: 'Wave 2 / EPIC 1', priority: 'P0', title: 'endless survival economy and difficulty loop', status: 'local-implementable-slices-shipped', notes: 'XP curve targets Fable 60-80 level bands, 80-level draft depth is protected, post-cap XP converts into score, long-run telemetry reports cap/post-cap pressure, pure game-feel physics contracts are covered, and integrity now rejects over-cap levels plus impossible post-cap score claims. Remaining work is live playtest tuning and future backend replay re-simulation infrastructure.' }),
    Object.freeze({ id: 'Wave 3 / EPIC 2-3', priority: 'P0', title: 'sprite QA, hero/enemy matrices, metadata, telegraph decals', status: 'remaining-major-work', notes: 'Requires PixelLab/contact-sheet production and Justin sign-off before new animation batches; current repo has coverage reports and QA tooling, not the full generated matrix.' }),
    Object.freeze({ id: 'EPIC 4-5', priority: 'P0', title: 'terrain autotiling, authored world chunks, water/bridges, elevation', status: 'remaining-major-work', notes: 'Requires new terrain/elevation systems plus art integration; cannot be honestly completed as a small audit fix.' }),
    Object.freeze({ id: 'EPIC 6', priority: 'P0/P1', title: 'lighting, shadows, VFX, retro presentation', status: 'remaining-major-work', notes: 'Requires rendering/performance work after core loop and art matrices are locked.' }),
    Object.freeze({ id: 'EPIC 7', priority: 'P0/P1', title: 'replay verification, live leaderboards, remaining contracts, profile pages', status: 'remaining-major-work', notes: 'Depends on deterministic replay and explicit real-funds/contract approval.' }),
    Object.freeze({ id: 'EPIC 10.1', priority: 'P0', title: 'repo cleanup/history rewrite', status: 'approval-gated', notes: 'History rewrite or fresh-repo reseed needs explicit destructive-operation approval even though repo-health guardrails exist.' }),
  ]),
  gatedQuestions: Object.freeze([
    Object.freeze({ file: 'OPEN_QUESTIONS.md', title: 'LitVM RPC/token/faucet verification before contract deployment', gate: 'external-verification' }),
    Object.freeze({ file: 'OPEN_QUESTIONS.md', title: 'real paid asset, refund policy, third-party revenue, brand/legal sign-off', gate: 'Justin/legal/economy decision' }),
    Object.freeze({ file: 'docs/THIRD_PARTY_GAME_ONBOARDING.md', title: 'Chikun playable implementation', gate: 'separate third-party cabinet scope' }),
    Object.freeze({ file: 'OPEN_QUESTIONS.md', title: 'role email vs existing ad Gmail', gate: 'Justin decision; existing Gmail was intentionally set' }),
  ]),
  productionReadyChecks: Object.freeze([
    'WO-30 through WO-41 have tracked reports/tests or runtime markers.',
    'The ignored .hermes desktop-attachment task files are now summarized in this tracked crosswalk.',
    'Remaining Fable items are not small misses; they are future waves or approval-gated decisions.',
  ]),
});

export function renderFableMarkdownCrosswalk(data = FABLE_MARKDOWN_CROSSWALK) {
  const lines = [];
  lines.push('# Hard Money Heroes Fable Markdown Crosswalk');
  lines.push('');
  lines.push(`Generated: ${data.auditedAt}`);
  lines.push('');
  lines.push('This report captures the ignored/local Fable markdown task files in a tracked repo artifact so the production branch has an honest source of truth for what was completed, what remains, and what is gated.');
  lines.push('');
  lines.push('## Audited source files');
  for (const file of data.sourceFiles) lines.push(`- \`${file}\``);
  lines.push('');
  lines.push('## Completed in the shipped WO sweep');
  lines.push('');
  lines.push('| Work order | Result | Evidence |');
  lines.push('|---|---|---|');
  for (const item of data.completedLocalWorkOrders) lines.push(`| ${item.id} | ${item.title} | ${item.evidence} |`);
  lines.push('');
  lines.push('## Remaining implementable Fable waves');
  lines.push('');
  lines.push('| Area | Priority | Status | What remains |');
  lines.push('|---|---:|---|---|');
  for (const item of data.remainingImplementableWaves) lines.push(`| ${item.id}: ${item.title} | ${item.priority} | ${item.status} | ${item.notes} |`);
  lines.push('');
  lines.push('## Gated / not safe to finish without approval');
  lines.push('');
  lines.push('| File | Decision | Gate |');
  lines.push('|---|---|---|');
  for (const item of data.gatedQuestions) lines.push(`| ${item.file} | ${item.title} | ${item.gate} |`);
  lines.push('');
  lines.push('## Production conclusion');
  lines.push('');
  for (const check of data.productionReadyChecks) lines.push(`- ${check}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

export function writeFableMarkdownCrosswalk({ root = fileURLToPath(new URL('..', import.meta.url)) } = {}) {
  const docsDir = path.join(root, 'docs/qa');
  mkdirSync(docsDir, { recursive: true });
  const outPath = path.join(docsDir, 'hard-money-heroes-fable-markdown-crosswalk.md');
  writeFileSync(outPath, renderFableMarkdownCrosswalk(), 'utf8');
  return outPath;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const outPath = writeFableMarkdownCrosswalk();
  console.log(`Wrote ${path.relative(fileURLToPath(new URL('..', import.meta.url)), outPath)}`);
}
