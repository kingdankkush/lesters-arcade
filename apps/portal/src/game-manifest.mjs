// Lester's Arcade — Game Manifest schema + registry (pure, DOM-free, testable).
//
// A `game.manifest.json` is the contract for putting a cabinet on the arcade
// floor. Every game — first-party (Hard Money Heroes) or third-party — declares
// one. The parent shell reads the manifest to render the cabinet, gate ranked
// eligibility, enforce the sandbox, and (eventually) record the manifest hash on
// the on-chain GameRegistry. Audit §4.4.
//
// This module is the SINGLE SOURCE OF TRUTH for manifest shape + validation. It
// has no DOM/network access so it can be unit-tested in Node and reused by:
//   - the runtime (render cabinets / coming-soon roadmap cards)
//   - the third-party intake + security-review pipeline (audit §5.2)
//   - the on-chain registry (manifest checksum)

// The SDK contract version this platform implements. A manifest must target a
// compatible major. Bumping the major means breaking SDK changes.
export const ARCADE_SDK_VERSION = '1.0.0';

// Aspect ratios every cabinet MUST support (audit: 9:16 portrait + 16:9
// landscape full-bleed). A manifest may add more but must include these.
export const REQUIRED_ASPECTS = Object.freeze(['9:16', '16:9']);

export const CONTROL_SCHEMES = Object.freeze([
  'twin-stick',        // move + aim (HMH)
  'single-stick',      // move only, auto-aim
  'tap',               // tap/click only (flappy-style)
  'dpad-buttons',      // d-pad + action buttons
  'pointer',           // mouse/touch pointer
]);

export const GAME_STATUSES = Object.freeze(['playable', 'coming-soon', 'disabled']);

export const CAPABILITIES = Object.freeze([
  'leaderboard',   // submits scores to cadence boards
  'achievements',  // unlocks parent-profile achievements
  'ranked',        // eligible for on-chain ranked runs
  'audio',         // plays its own audio (parent ducks arcade music)
  'haptics',       // requests vibration on supported devices
]);

const ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/; // 3-48 chars, kebab
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const HEX_WALLET_PATTERN = /^0x[a-fA-F0-9]{40}$/;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function majorOf(semver) {
  return Number(String(semver).split('.')[0]);
}

// Validate a candidate manifest. Pure: returns { valid, errors[], manifest }.
// `manifest` is a normalized + frozen copy when valid (defaults applied), else
// null. Errors are stable, human-readable strings (one per failed rule).
export function validateGameManifest(input) {
  const errors = [];
  if (!isPlainObject(input)) {
    return { valid: false, errors: ['manifest must be an object'], manifest: null };
  }

  // --- id ---
  if (typeof input.id !== 'string' || !ID_PATTERN.test(input.id)) {
    errors.push('id must be a 3-48 char lowercase kebab-case slug');
  }

  // --- name / title ---
  const name = input.name ?? input.title;
  if (typeof name !== 'string' || name.trim().length < 2 || name.length > 48) {
    errors.push('name must be a string of 2-48 characters');
  }

  // --- version (semver) ---
  if (typeof input.version !== 'string' || !SEMVER_PATTERN.test(input.version)) {
    errors.push('version must be semver (e.g. 1.0.0)');
  }

  // --- sdkVersion: must be compatible major with this platform ---
  if (typeof input.sdkVersion !== 'string' || !SEMVER_PATTERN.test(input.sdkVersion)) {
    errors.push('sdkVersion must be semver (e.g. 1.0.0)');
  } else if (majorOf(input.sdkVersion) !== majorOf(ARCADE_SDK_VERSION)) {
    errors.push(`sdkVersion major ${majorOf(input.sdkVersion)} is incompatible with platform SDK ${ARCADE_SDK_VERSION}`);
  }

  // --- status ---
  const status = input.status ?? 'coming-soon';
  if (!GAME_STATUSES.includes(status)) {
    errors.push(`status must be one of: ${GAME_STATUSES.join(', ')}`);
  }

  // --- aspectSupport: must include the required aspects ---
  const aspectSupport = Array.isArray(input.aspectSupport) ? input.aspectSupport : [];
  for (const required of REQUIRED_ASPECTS) {
    if (!aspectSupport.includes(required)) {
      errors.push(`aspectSupport must include ${required} (9:16 + 16:9 are mandatory)`);
    }
  }

  // --- controlScheme ---
  if (!CONTROL_SCHEMES.includes(input.controlScheme)) {
    errors.push(`controlScheme must be one of: ${CONTROL_SCHEMES.join(', ')}`);
  }

  // --- capabilities (optional, but must be from the known set) ---
  const capabilities = Array.isArray(input.capabilities) ? input.capabilities : [];
  for (const cap of capabilities) {
    if (!CAPABILITIES.includes(cap)) errors.push(`unknown capability: ${cap}`);
  }

  // --- rankedEligible: ranked requires the leaderboard + ranked capabilities ---
  const rankedEligible = Boolean(input.rankedEligible);
  if (rankedEligible && !(capabilities.includes('ranked') && capabilities.includes('leaderboard'))) {
    errors.push('rankedEligible games must declare both the "ranked" and "leaderboard" capabilities');
  }

  // --- entry: where the sandboxed cabinet loads from (relative path) ---
  if (typeof input.entry !== 'string' || input.entry.trim() === '') {
    errors.push('entry must be a non-empty path to the cabinet entry point');
  } else if (/^https?:\/\//i.test(input.entry)) {
    // Cabinets load same-origin into the sandboxed iframe; no remote entry.
    errors.push('entry must be a same-origin relative path, not an absolute URL');
  }

  // --- endpoints: declared network allowlist (CSP pins these). Optional. ---
  const endpoints = Array.isArray(input.endpoints) ? input.endpoints : [];
  for (const ep of endpoints) {
    if (typeof ep !== 'string' || !/^https:\/\//i.test(ep)) {
      errors.push(`endpoint must be an https URL: ${ep}`);
    }
  }

  // --- devWallet: optional, but if present must be a valid EVM address ---
  if (input.devWallet != null && !HEX_WALLET_PATTERN.test(String(input.devWallet))) {
    errors.push('devWallet must be a valid 0x EVM address when provided');
  }

  if (errors.length > 0) {
    return { valid: false, errors, manifest: null };
  }

  const manifest = Object.freeze({
    id: input.id,
    name,
    version: input.version,
    sdkVersion: input.sdkVersion,
    status,
    aspectSupport: Object.freeze([...aspectSupport]),
    controlScheme: input.controlScheme,
    capabilities: Object.freeze([...capabilities]),
    rankedEligible,
    entry: input.entry,
    endpoints: Object.freeze([...endpoints]),
    devWallet: input.devWallet ?? null,
    description: typeof input.description === 'string' ? input.description : '',
  });
  return { valid: true, errors: [], manifest };
}

// Deterministic, dependency-free checksum of a manifest's load-bearing fields.
// Used to detect drift and (eventually) anchor the manifest on-chain. Not a
// cryptographic hash — a stable 32-bit FNV-1a over the canonical field order so
// the same manifest always yields the same checksum across runs/machines.
export function manifestChecksum(manifest) {
  const canonical = [
    manifest.id,
    manifest.name,
    manifest.version,
    manifest.sdkVersion,
    manifest.status,
    [...manifest.aspectSupport].sort().join(','),
    manifest.controlScheme,
    [...manifest.capabilities].sort().join(','),
    String(manifest.rankedEligible),
    manifest.entry,
    [...manifest.endpoints].sort().join(','),
    manifest.devWallet ?? '',
  ].join('|');
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `m_${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

// A registry that ingests manifests once and answers the questions the shell +
// pipeline ask. Invalid manifests are REJECTED (never silently registered) so a
// malformed third-party game can't slip onto the floor.
export function createGameRegistry() {
  const games = new Map(); // id -> { manifest, checksum }
  const rejections = [];   // { input, errors }

  return {
    register(input) {
      const { valid, errors, manifest } = validateGameManifest(input);
      if (!valid) {
        rejections.push({ input, errors });
        return { ok: false, errors };
      }
      if (games.has(manifest.id)) {
        const dupe = [`duplicate game id: ${manifest.id}`];
        rejections.push({ input, errors: dupe });
        return { ok: false, errors: dupe };
      }
      games.set(manifest.id, { manifest, checksum: manifestChecksum(manifest) });
      return { ok: true, errors: [], manifest, checksum: manifestChecksum(manifest) };
    },
    get(id) {
      return games.get(id) ?? null;
    },
    has(id) {
      return games.has(id);
    },
    list() {
      return [...games.values()].map((g) => g.manifest);
    },
    // Cabinets to render on the floor: playable first, then coming-soon, never
    // disabled. Each carries a `locked` flag so coming-soon renders as a roadmap
    // card (not a dead link) per the audit acceptance.
    cabinets() {
      return this.list()
        .filter((m) => m.status !== 'disabled')
        .sort((a, b) => (a.status === 'playable' ? -1 : 1) - (b.status === 'playable' ? -1 : 1))
        .map((m) => ({
          id: m.id,
          name: m.name,
          status: m.status,
          locked: m.status !== 'playable',
          rankedEligible: m.rankedEligible,
          controlScheme: m.controlScheme,
          description: m.description,
        }));
    },
    rejections() {
      return [...rejections];
    },
    size() {
      return games.size;
    },
  };
}
