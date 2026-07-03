import { validateGameManifest } from './game-manifest.mjs';

export const CABINET_SANDBOX_DEFAULT = Object.freeze({
  allow: Object.freeze(['scripts']),
  walletAccess: false,
  sameOriginAccess: false,
});

function freezeSandbox(input = {}) {
  const allow = Array.isArray(input.allow) && input.allow.length ? [...input.allow] : [...CABINET_SANDBOX_DEFAULT.allow];
  return Object.freeze({
    allow: Object.freeze([...new Set(allow)].sort()),
    walletAccess: Boolean(input.walletAccess),
    sameOriginAccess: Boolean(input.sameOriginAccess),
  });
}

export function validateSandboxedCabinetManifest(input) {
  const base = validateGameManifest(input);
  if (!base.valid) return base;
  const errors = [];
  const sandbox = freezeSandbox(input.sandbox);
  if (!sandbox.allow.includes('scripts')) errors.push('sandbox.allow must include scripts so the cabinet can boot');
  if (sandbox.allow.includes('same-origin') || sandbox.allow.includes('allow-same-origin')) {
    errors.push('sandbox.allow must not include same-origin/allow-same-origin');
  }
  if (sandbox.walletAccess) errors.push('sandbox.walletAccess must be false');
  if (sandbox.sameOriginAccess) errors.push('sandbox.sameOriginAccess must be false');
  if (errors.length) return { valid: false, errors, manifest: null };
  return {
    valid: true,
    errors: [],
    manifest: Object.freeze({ ...base.manifest, sandbox }),
  };
}

export function buildCabinetSandboxPolicy(manifest) {
  const sandbox = freezeSandbox(manifest?.sandbox);
  const allow = sandbox.allow.filter((token) => token === 'scripts');
  const endpoints = Array.isArray(manifest?.endpoints) ? manifest.endpoints : [];
  const connectSrc = ["'self'", ...endpoints].join(' ');
  return Object.freeze({
    sandboxAttribute: allow.map((token) => `allow-${token}`).join(' '),
    allowAttribute: 'fullscreen',
    referrerPolicy: 'no-referrer',
    loading: 'lazy',
    csp: Object.freeze({
      defaultSrc: "'none'",
      scriptSrc: "'self'",
      imgSrc: "'self' data: blob:",
      mediaSrc: "'self' blob:",
      styleSrc: "'self' 'unsafe-inline'",
      connectSrc,
      frameAncestors: "'self'",
    }),
    flags: Object.freeze({
      canRunScripts: allow.includes('scripts'),
      canAccessParentOrigin: sandbox.sameOriginAccess || sandbox.allow.includes('same-origin') || sandbox.allow.includes('allow-same-origin'),
      canAccessWalletProvider: sandbox.walletAccess,
    }),
  });
}

export function buildMockParentHarnessModel({ manifestId = 'template-cabinet' } = {}) {
  return Object.freeze({
    id: 'lesters-arcade-mock-parent-harness-v1',
    manifestId,
    transport: 'postMessage',
    scenarios: Object.freeze([
      Object.freeze({ id: 'free-session-events', goal: 'init/start/stat/gameOver events parse and stay practice-only' }),
      Object.freeze({ id: 'ranked-chain-guard', goal: 'ranked score intents are blocked unless wallet + LitVM chain facts pass' }),
      Object.freeze({ id: 'malformed-message-rejection', goal: 'bad source, wrong gameId, bad SDK major, and invalid payloads are rejected' }),
      Object.freeze({ id: 'rate-limit-flood-drop', goal: 'excess event floods are dropped by the parent limiter' }),
      Object.freeze({ id: 'wallet-isolation', goal: 'cabinet context has no provider/signer and can only request wallet intent' }),
    ]),
    instructions: Object.freeze([
      'Serve the candidate cabinet in the sandbox iframe and communicate only through postMessage.',
      'The first valid game event should be arcade.ready, followed by arcade.sessionStart after parent start.',
      'Use arcade.requestWalletAction for privileged intents; never touch window.ethereum directly.',
      'Run malformed-message and flood scenarios before requesting ranked eligibility review.',
    ]),
  });
}
