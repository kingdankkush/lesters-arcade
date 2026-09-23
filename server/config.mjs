// Server configuration (contract §9.2, A28).
//
// readServerConfig never stores a secret string on the returned object.
// Secrets stay in closures and are reached only through functions:
// session.secret(), neon.createClient(), verifier.createSigner(ethers),
// relayer.createWallet(ethers, provider) and cron.matches(header). toJSON,
// toString and the util.inspect hook all return a redacted summary, so a
// config that slips into a log or a response leaks nothing.

import * as nodeCrypto from 'node:crypto';
import { createNeonClient, neonSchemaKeyFor } from '../apps/portal/src/server-neon.mjs';
import { loadDeployment, UNAVAILABLE_DEPLOYMENT } from './deployment.mjs';

export const DEFAULT_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';
export const DEFAULT_MIN_PAID_WEI = '100100000000000000';
export const LEGACY_ENV_NAMES = Object.freeze(['VERIFIER_PRIVATE_KEY', 'RELAYER_PRIVATE_KEY', 'SCORE_REGISTRY_ADDRESS']);
export const PRODUCTION_SESSION_DOMAINS = Object.freeze(['lestersarcade.io', 'www.lestersarcade.io']);
const LOCAL_SESSION_DOMAINS = Object.freeze(['localhost', '127.0.0.1']);
const PRIVATE_KEY = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const INSPECT = Symbol.for('nodejs.util.inspect.custom');

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function present(env, name) {
  return Object.hasOwn(env, name) && env[name] !== undefined && env[name] !== null;
}

function sha256(value) {
  return nodeCrypto.createHash('sha256').update(String(value ?? ''), 'utf8').digest();
}

function redactUrl(value) {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}/…`;
  } catch {
    return '[redacted]';
  }
}

function parsePostgresUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!/^postgres(ql)?:$/.test(url.protocol) || !url.hostname) return null;
    return url;
  } catch {
    return null;
  }
}

export function readServerConfig(env = process.env, { deployment = null } = {}) {
  const source = env && typeof env === 'object' ? env : {};
  const environment = text(source.VERCEL_ENV) || 'production';
  const isProduction = environment === 'production';
  const chainId = Number.isSafeInteger(Number(source.LITVM_CHAIN_ID)) && Number(source.LITVM_CHAIN_ID) > 0 ? Number(source.LITVM_CHAIN_ID) : 4441;
  const rpcUrl = text(source.RPC_URL) || DEFAULT_RPC_URL;
  const paused = source.SETTLEMENT_PAUSED === 'true';
  const minPaidWei = /^[0-9]{1,78}$/.test(text(source.RANKED_MIN_PAID_WEI)) ? text(source.RANKED_MIN_PAID_WEI) : DEFAULT_MIN_PAID_WEI;
  const startBlockText = text(source.INDEX_START_BLOCK);
  const indexStartBlock = /^[0-9]{1,15}$/.test(startBlockText) ? Number(startBlockText) : null;
  const dep = deployment && typeof deployment === 'object' ? deployment : UNAVAILABLE_DEPLOYMENT;

  // Session secret (closure only).
  const sessionSecret = typeof source.SESSION_SECRET === 'string' ? source.SESSION_SECRET : '';
  const sessionConfigured = sessionSecret.length >= 32;
  const domainList = text(source.SESSION_ALLOWED_DOMAINS).split(',').map((value) => value.trim()).filter(Boolean);
  const allowedDomains = Object.freeze(domainList.length
    ? domainList
    : [...PRODUCTION_SESSION_DOMAINS, ...(text(source.VERCEL_ENV) && !isProduction ? LOCAL_SESSION_DOMAINS : [])]);
  const session = Object.freeze({
    configured: sessionConfigured,
    allowedDomains,
    secret() {
      if (!sessionConfigured) throw new Error('session-not-configured');
      return sessionSecret;
    },
  });

  // Neon connection string (closure only). schemaKey is host plus database,
  // never the password.
  const neonUrl = typeof source.NEON_DATABASE_URL === 'string' ? source.NEON_DATABASE_URL.trim() : '';
  const neonParsed = parsePostgresUrl(neonUrl);
  const neon = Object.freeze({
    configured: Boolean(neonParsed),
    schemaKey: neonParsed ? neonSchemaKeyFor(neonUrl) : null,
    createClient({ fetchImpl = globalThis.fetch } = {}) {
      if (!neonParsed) return null;
      return createNeonClient({ connectionString: neonUrl, fetchImpl });
    },
  });

  const verifierKey = text(source.RANKED_VERIFIER_PRIVATE_KEY);
  const verifierConfigured = PRIVATE_KEY.test(verifierKey);
  const verifier = Object.freeze({
    configured: verifierConfigured,
    createSigner(ethers) {
      if (!verifierConfigured) throw new Error('verifier-not-configured');
      return new ethers.Wallet(verifierKey);
    },
  });

  const relayerKey = text(source.RANKED_RELAYER_PRIVATE_KEY);
  const relayerConfigured = PRIVATE_KEY.test(relayerKey);
  const relayer = Object.freeze({
    configured: relayerConfigured,
    createWallet(ethers, provider) {
      if (!relayerConfigured) throw new Error('relayer-not-configured');
      return new ethers.Wallet(relayerKey, provider);
    },
  });

  const registryText = text(source.RANKED_SCORE_REGISTRY_ADDRESS);
  const registryConfigured = ADDRESS.test(registryText);
  const registryAddress = registryConfigured ? registryText.toLowerCase() : null;
  const deployedRegistry = String(dep?.addresses?.scoreSubmissionRegistry ?? '').toLowerCase();
  const scoreRegistry = Object.freeze({
    configured: registryConfigured,
    address: registryAddress,
    matchesDeployment: Boolean(registryAddress && deployedRegistry && registryAddress === deployedRegistry),
  });

  const cronSecret = typeof source.CRON_SECRET === 'string' ? source.CRON_SECRET : '';
  const cronConfigured = cronSecret.length >= 32;
  const cron = Object.freeze({
    configured: cronConfigured,
    // SHA-256 both sides, then a constant-time compare (A24).
    matches(authorizationHeader) {
      if (!cronConfigured || typeof authorizationHeader !== 'string') return false;
      return nodeCrypto.timingSafeEqual(sha256(authorizationHeader), sha256(`Bearer ${cronSecret}`));
    },
  });

  const legacyEnvPresent = Object.freeze(LEGACY_ENV_NAMES.filter((name) => present(source, name)));
  const missing = [];
  if (!sessionConfigured) missing.push('SESSION_SECRET');
  if (!neon.configured) missing.push('NEON_DATABASE_URL');
  if (!verifierConfigured) missing.push('RANKED_VERIFIER_PRIVATE_KEY');
  if (!relayerConfigured) missing.push('RANKED_RELAYER_PRIVATE_KEY');
  if (!registryConfigured) missing.push('RANKED_SCORE_REGISTRY_ADDRESS');
  for (const name of legacyEnvPresent) missing.push(`legacy-env-present:${name}`);
  if (dep?.status !== 'deployed') missing.push('deployment-not-deployed');
  if (registryConfigured && dep?.status === 'deployed' && !scoreRegistry.matchesDeployment) missing.push('address-mismatch');
  const missingList = Object.freeze(missing);
  const settlementReady = missingList.length === 0;

  const summary = () => ({
    chainId,
    rpcUrl: redactUrl(rpcUrl),
    environment,
    isProduction,
    paused,
    minPaidWei,
    indexStartBlock,
    session: { configured: sessionConfigured, allowedDomains: [...allowedDomains] },
    neon: { configured: neon.configured },
    verifier: { configured: verifierConfigured },
    relayer: { configured: relayerConfigured },
    scoreRegistry: { configured: registryConfigured, address: registryAddress, matchesDeployment: scoreRegistry.matchesDeployment },
    cron: { configured: cronConfigured },
    deployment: { status: dep?.status ?? 'unavailable', chainId: dep?.chainId ?? null },
    settlementReady,
    missing: [...missingList],
    legacyEnvPresent: [...legacyEnvPresent],
  });
  const redacted = () => `ServerConfig ${JSON.stringify(summary())}`;

  return Object.freeze({
    chainId,
    rpcUrl,
    environment,
    isProduction,
    paused,
    minPaidWei,
    indexStartBlock,
    session,
    neon,
    verifier,
    relayer,
    scoreRegistry,
    cron,
    deployment: dep,
    settlementReady,
    missing: missingList,
    legacyEnvPresent,
    toJSON: summary,
    toString: redacted,
    [INSPECT]: redacted,
  });
}

function nowFunction(value) {
  if (typeof value === 'function') return value;
  if (Number.isFinite(value)) return () => value;
  return () => Date.now();
}

// Shared deps for the index endpoints (A30). `cache` is the calling module's
// own module-scope object, so each function keeps one Neon client per
// process and the ensureSchema memo hits (A34). Overrides are exactly db,
// provider, deployment, nowMs, fetchImpl and crypto.
export async function buildBaseDeps(env = process.env, overrides = {}, cache = {}) {
  const deployment = overrides.deployment ?? await loadDeployment();
  const config = readServerConfig(env, { deployment });
  const fetchImpl = overrides.fetchImpl ?? globalThis.fetch;
  let db = null;
  if (Object.hasOwn(overrides, 'db')) {
    db = overrides.db ?? null;
  } else if (config.neon.configured) {
    if (!cache.db || cache.dbKey !== config.neon.schemaKey) {
      cache.db = config.neon.createClient({ fetchImpl });
      cache.dbKey = config.neon.schemaKey;
    }
    db = cache.db;
  }
  return {
    config,
    db,
    deployment,
    nowMs: nowFunction(overrides.nowMs),
    fetchImpl,
    crypto: overrides.crypto ?? nodeCrypto,
    provider: overrides.provider ?? null,
  };
}
