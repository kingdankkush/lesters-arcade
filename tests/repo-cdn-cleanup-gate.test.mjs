import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

import {
  buildRepoCdnCleanupGate,
  classifyCdnCandidate,
  renderRepoCdnCleanupMarkdown,
} from '../scripts/repo-cdn-cleanup-gate.mjs';

const generatedMarkdownPath = new URL('../docs/cleanup/repo-cdn-cleanup-gate.md', import.meta.url);
const generatedJsonPath = new URL('../docs/cleanup/repo-cdn-cleanup-gate.json', import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const syntaxSource = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');

test('repo CDN cleanup gate classifies media as CDN candidates without deleting runtime assets', () => {
  const audio = classifyCdnCandidate({ path: 'assets/audio/playlist/theme.mp3', sizeBytes: 6 * 1024 * 1024, runtimeReferenced: true });
  const video = classifyCdnCandidate({ path: 'assets/video/intro.mp4', sizeBytes: 8 * 1024 * 1024, runtimeReferenced: true });
  const png = classifyCdnCandidate({ path: 'assets/generated/hmh-level/ground.png', sizeBytes: 5 * 1024 * 1024, runtimeReferenced: true });

  assert.equal(audio.action, 'cdn-candidate');
  assert.equal(audio.destructive, false);
  assert.equal(audio.requiresApproval, true);
  assert.equal(video.action, 'cdn-candidate');
  assert.equal(png.action, 'keep-runtime');
});

test('repo CDN cleanup gate keeps destructive actions behind explicit approval', () => {
  const report = buildRepoCdnCleanupGate({
    generatedAt: '2026-07-03T00:00:00.000Z',
    totals: { workingTreeBytes: 560 * 1024 * 1024, gitBytes: 1400 * 1024 * 1024, assetBytes: 534 * 1024 * 1024 },
    largestFiles: [
      { path: 'apps/portal/assets/video/hard-money-heroes-intro.mp4', sizeBytes: 8 * 1024 * 1024, runtimeReferenced: true },
      { path: 'apps/portal/assets/audio/playlist/theme.mp3', sizeBytes: 6 * 1024 * 1024, runtimeReferenced: true },
    ],
    cdnCandidates: [
      { path: 'assets/video/hard-money-heroes-intro.mp4', sizeBytes: 8 * 1024 * 1024, runtimeReferenced: true },
      { path: 'assets/audio/playlist/theme.mp3', sizeBytes: 6 * 1024 * 1024, runtimeReferenced: true },
    ],
    vault: { exists: true, remoteConfigured: false },
  });

  assert.equal(report.status, 'approval-gated');
  assert.equal(report.cdnCandidates.length, 2);
  assert.equal(report.safeActions.every((action) => action.destructive === false), true);
  assert.equal(report.destructiveActions.every((action) => action.requiresExplicitApproval === true), true);
  assert.match(renderRepoCdnCleanupMarkdown(report), /No destructive action performed/);
});

test('repo CDN cleanup gate is generated and wired into package/syntax gates', () => {
  assert.equal(packageJson.scripts['repo:cdn-gate'], 'node scripts/repo-cdn-cleanup-gate.mjs');
  assert.match(syntaxSource, /scripts\/repo-cdn-cleanup-gate\.mjs/);
  assert.match(syntaxSource, /tests\/repo-cdn-cleanup-gate\.test\.mjs/);
  assert.equal(existsSync(generatedMarkdownPath), true);
  assert.equal(existsSync(generatedJsonPath), true);
});
