import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  HMH_ANCHOR_SET_STATUS,
  HMH_ANCHOR_SLOTS,
  HMH_ANCHOR_SOURCE_POLICIES,
  buildAnchorCandidateAudit,
  renderAnchorCandidateAuditMarkdown,
} from '../apps/portal/src/hmh-anchor-set.mjs';

function repoText(path) {
  return readFileSync(fileURLToPath(new URL(`../${path}`, import.meta.url)), 'utf8');
}

test('WO-76 declares exactly ten approval-gated anchor slots in the required order', () => {
  assert.equal(HMH_ANCHOR_SET_STATUS.workOrder, 'WO-76');
  assert.equal(HMH_ANCHOR_SET_STATUS.status, 'PARTIAL_ANCHOR_APPROVAL_1_OF_10');
  assert.equal(HMH_ANCHOR_SET_STATUS.approvedAnchorCount, 1);
  assert.equal(HMH_ANCHOR_SET_STATUS.runtimeIntegrationAllowed, false);
  assert.equal(HMH_ANCHOR_SET_STATUS.requiresHumanApproval, true);
  assert.deepEqual(HMH_ANCHOR_SLOTS.map((slot) => slot.id), [
    'storefront-facade',
    'bank-deco-corner',
    'signature-street-tree',
    'wet-asphalt-ground-family',
    'streetlamp-light-cone',
    'lit-commando-idle-key-pose',
    'highest-spawn-enemy-redesign',
    'major-boss-key-pose',
    'micro-scene-composition',
    'ui-chrome-sample',
  ]);
  assert.equal(HMH_ANCHOR_SLOTS.every((slot) => slot.targetCandidateCount.min >= 12 && slot.targetCandidateCount.max >= slot.targetCandidateCount.min), true);
});

test('WO-76 source policy excludes script-drawn placeholder packs from anchor contenders', () => {
  assert.equal(HMH_ANCHOR_SOURCE_POLICIES.placeholderPacksAllowedAsAnchorCandidates, false);
  for (const scriptName of [
    'generate-hmh-pickup-icons.py',
    'generate-hmh-vfx-ui-chrome.py',
    'generate-hmh-level-one-authored-stamp-art.py',
    'generate-hmh-achievement-atlas.py',
  ]) {
    assert.equal(HMH_ANCHOR_SOURCE_POLICIES.placeholderScriptDenylist.includes(scriptName), true);
  }
});

test('WO-76 candidate audit includes existing real PixelLab/final-paint art and identifies gaps', () => {
  const audit = buildAnchorCandidateAudit();
  assert.equal(audit.workOrder, 'WO-76');
  assert.equal(audit.slots.length, 10);
  assert.equal(audit.candidateSources.some((source) => source.id === 'hmh-production-art-pass'), true);
  assert.equal(audit.candidateSources.some((source) => source.id === 'pixellab-calibration'), true);
  assert.equal(audit.candidateSources.some((source) => source.id === 'level-one-final-paint-ground'), true);
  assert.equal(audit.placeholderDebt.some((entry) => entry.script === 'generate-hmh-pickup-icons.py'), true);
  assert.equal(audit.slots.some((slot) => slot.status === 'needs-generation'), true, 'the audit should not pretend existing art fills every slot');
  assert.equal(audit.slots.find((slot) => slot.id === 'lit-commando-idle-key-pose').existingCandidates.length >= 1, true);
});

test('WO-76 markdown is a contact-sheet style approval artifact, not an integration manifest', () => {
  const markdown = renderAnchorCandidateAuditMarkdown(buildAnchorCandidateAudit());
  assert.match(markdown, /# WO-76 AI Anchor Set Candidate Audit/);
  assert.match(markdown, /HALT: Justin approval required/);
  assert.match(markdown, /storefront-facade/);
  assert.match(markdown, /lit-commando-idle-key-pose/);
  assert.match(markdown, /generate-hmh-pickup-icons\.py/);
  assert.doesNotMatch(markdown, /runtimeIntegrationAllowed:\s*true/);
});

test('WO-76 draft docs track partial approval while keeping full set blocked', () => {
  const pipeline = repoText('docs/art/PIPELINE.md');
  const anchorSet = repoText('docs/art/ANCHOR_SET.md');
  assert.match(pipeline, /Universal WO-76 prompt preamble/);
  assert.match(pipeline, /match the approved WO-76 storefront-facade anchor/);
  assert.match(anchorSet, /Full anchor set status: UNAPPROVED — 1\/10 slots approved/);
  assert.match(anchorSet, /Storefront facade — APPROVED/);
});

test('WO-76 approved storefront anchor has image and prompt provenance', () => {
  const provenance = JSON.parse(repoText('docs/art/anchors/storefront-facade.provenance.json'));
  const anchorPath = fileURLToPath(new URL('../docs/art/anchors/storefront-facade.png', import.meta.url));

  assert.equal(provenance.workOrder, 'WO-76');
  assert.equal(provenance.slot, 'storefront-facade');
  assert.equal(provenance.approvedCandidate, 14);
  assert.equal(provenance.status, 'APPROVED_BY_JUSTIN_2026-07-06');
  assert.match(provenance.exactPrompt, /Textless blank-sign storefront only/);
  assert.equal(existsSync(anchorPath), true);
});

test('WO-76 storefront survivor sheet is approval-gated and raw outputs stay ignored', () => {
  const report = JSON.parse(repoText('docs/art/wo76/wo76-storefront-facade-review-report.json'));
  const markdown = repoText('docs/art/wo76/wo76-storefront-facade-survivors.md');
  const gitignore = repoText('.gitignore');
  const survivorSheetPath = fileURLToPath(new URL('../docs/art/wo76/wo76-storefront-facade-survivor-sheet.png', import.meta.url));

  assert.equal(report.workOrder, 'WO-76');
  assert.equal(report.slot, 'storefront-facade');
  assert.equal(report.status, 'HALT_AWAITING_JUSTIN_PICK_OR_REROLL');
  assert.equal(report.generatedCandidateCount, 20);
  assert.equal(report.survivorCandidateCount, 12);
  assert.equal(report.survivors.length, 12);
  assert.equal(report.rejects.some((entry) => entry.reason.includes('Readable/fake')), true);
  assert.match(markdown, /HALT: Justin pick\/reroll required/);
  assert.match(markdown, /Rejected before Justin review/);
  assert.equal(existsSync(survivorSheetPath), true);
  assert.match(gitignore, /^\.art-staging\/$/m);
});

test('WO-76 scripts and tests are wired into the project gates', () => {
  const packageJson = JSON.parse(repoText('package.json'));
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  assert.equal(packageJson.scripts['design:anchor-candidates'], 'node scripts/hmh-anchor-candidate-audit.mjs');
  assert.equal(syntaxCheck.includes('apps/portal/src/hmh-anchor-set.mjs'), true);
  assert.equal(syntaxCheck.includes('scripts/hmh-anchor-candidate-audit.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-anchor-set.test.mjs'), true);
});
