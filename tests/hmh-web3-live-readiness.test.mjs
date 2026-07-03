import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  buildWeb3LiveReadinessReport,
  renderWeb3LiveReadinessMarkdown,
  verifyReplayEnvelopeForSubmission,
  WEB3_LIVE_REQUIRED_GATES,
} from '../apps/portal/src/web3-live-readiness.mjs';
import { buildReplayVerificationEnvelope } from '../apps/portal/src/hmh-run-integrity.mjs';

test('deterministic replay verifier accepts intact envelopes and rejects tampering', () => {
  const envelope = buildReplayVerificationEnvelope({
    seed: 1001,
    gameVersion: 'hmh-live-readiness-test',
    survivalSeconds: 480,
    level: 12,
    totalXp: 2400,
    postCapScoreBonus: 0,
    rngDraws: { spawns: 42, drops: 8, draft: 11 },
    inputChecksum: 'input-feed-v1',
    eventChecksum: 'event-feed-v1',
  });

  const ok = verifyReplayEnvelopeForSubmission(envelope, {
    gameVersion: 'hmh-live-readiness-test',
    survivalSeconds: 480,
    level: 12,
  });
  assert.equal(ok.ok, true, ok.reasons.join('; '));
  assert.equal(ok.replayHash, envelope.replayHash);

  const tampered = verifyReplayEnvelopeForSubmission({ ...envelope, level: 13 }, {
    gameVersion: 'hmh-live-readiness-test',
    survivalSeconds: 480,
    level: 12,
  });
  assert.equal(tampered.ok, false);
  assert.ok(tampered.reasons.some((reason) => reason.includes('replayHash mismatch')));
});

test('Web3 live readiness report separates shipped rails from remaining registry/economy gates', () => {
  assert.deepEqual(WEB3_LIVE_REQUIRED_GATES.map((gate) => gate.id), [
    'deterministic-replay-verifier',
    'chain-read-leaderboards',
    'official-profile-durability',
    'on-chain-registry-economy',
  ]);

  const report = buildWeb3LiveReadinessReport({
    replayVerifier: { ok: true, evidence: ['replay envelope hash verified before submit'] },
    chainReads: { leaderboard: true, playerSessions: true, profile: true, fallback: 'local-cache' },
    profileDurability: { localPersistence: true, chainProfileRead: true, chainProfileWrite: true },
    registryEconomy: { gameRegistry: false, splitConfig: false, legalApproved: false },
  });

  assert.equal(report.summary.status, 'PARTIAL');
  assert.equal(report.gates.find((gate) => gate.id === 'deterministic-replay-verifier').status, 'PASS');
  assert.equal(report.gates.find((gate) => gate.id === 'chain-read-leaderboards').status, 'PASS');
  assert.equal(report.gates.find((gate) => gate.id === 'official-profile-durability').status, 'PASS');
  assert.equal(report.gates.find((gate) => gate.id === 'on-chain-registry-economy').status, 'BLOCKED');
  assert.ok(report.gates.find((gate) => gate.id === 'on-chain-registry-economy').blockers.some((item) => item.includes('GameRegistry')));

  const markdown = renderWeb3LiveReadinessMarkdown(report);
  assert.ok(markdown.includes('deterministic-replay-verifier'));
  assert.ok(markdown.includes('on-chain-registry-economy'));
});

test('Web3 live readiness report is generated and wired into gates', () => {
  const jsonPath = fileURLToPath(new URL('../docs/web3/hmh-web3-live-readiness.json', import.meta.url));
  const mdPath = fileURLToPath(new URL('../docs/web3/hmh-web3-live-readiness.md', import.meta.url));
  assert.equal(existsSync(jsonPath), true);
  assert.equal(existsSync(mdPath), true);
  const report = JSON.parse(readFileSync(jsonPath, 'utf8'));
  assert.equal(report.version, 'hmh-web3-live-readiness-v1');

  const packageJson = readFileSync(new URL('../package.json', import.meta.url), 'utf8');
  const syntaxCheck = readFileSync(new URL('../scripts/syntax-check.mjs', import.meta.url), 'utf8');
  assert.equal(packageJson.includes('design:web3-live'), true);
  assert.equal(syntaxCheck.includes('scripts/hmh-web3-live-readiness.mjs'), true);
  assert.equal(syntaxCheck.includes('tests/hmh-web3-live-readiness.test.mjs'), true);
});
