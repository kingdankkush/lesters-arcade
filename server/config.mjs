// Server configuration (contract §9.2, A28).
//
// readServerConfig never stores a secret string on the returned object.
// Secrets stay in closures and are reached only through functions:
// session.secret(), neon.createClient(), verifier.createSigner(ethers),
// relayer.createWallet(ethers, provider) and cron.matches(header). toJSON,
// toString and the util.inspect hook all return a redacted summary, so a
// config that slips into a log or a response leaks nothing.
//
// config.jackpot (Chikun Weekly Jackpot design §C.1) is a separate frozen
// part: the keeper key lives only in the closure keeper.createWallet(ethers,
// provider), JACKPOT_CONTRACT_ADDRESS is cross-checked against the statically
// imported LITVM_JACKPOT (so the Vercel file tracer bundles it), and nothing
// jackpot-related ever reaches `missing` or `settlementReady`: a jackpot
// misconfiguration can never 503 /api/settle or the settle-retry cron.
// Test seam (J2 → J3): readServerConfig(env, { deployment, jackpotDeployment })
// overrides the committed (undeployed) LITVM_JACKPOT; never read from env.

import * as nodeCrypto from 'node:crypto';
import { createNeonClient, neonSchemaKeyFor } from '../apps/portal/src/server-neon.mjs';
import { LITVM_JACKPOT } from '../apps/portal/src/generated/litvm-jackpot.mjs';
import { loadDeployment, UNAVAILABLE_DEPLOYMENT } from './deployment.mjs';

export const DEFAULT_RPC_URL = 'https://liteforge.rpc.caldera.xyz/http';
// Settle floor (contract A27): the 0.01 zkLTC entry fee plus the 0.002 zkLTC settlement reserve (owner decision
// 2026-09-26; 0.102 before). Release order: this floor ships BEFORE the operator's GameRegistry.setEntryFee, because
// runs paid at the old 0.102 still clear it, while 0.012 runs would fail the old floor (402 entry-underpaid).
// tests/server-http-config.test.mjs pins it to contracts/deploy-config.testnet.json (fee + reserve).
export const DEFAULT_MIN_PAID_WEI = '12000000000000000';
// 0.01 zkLTC per keeper transaction (design §C.1, JACKPOT_MAX_TX_FEE_WEI).
export const DEFAULT_JACKPOT_MAX_TX_FEE_WEI = '10000000000000000';
export const JACKPOT_ENV_NAMES = Object.freeze(['JACKPOT_KEEPER_PRIVATE_KEY', 'JACKPOT_CONTRACT_ADDRESS', 'JACKPOT_PAUSED', 'JACKPOT_UI_HIDDEN', 'JACKPOT_MAX_TX_FEE_WEI', 'JACKPOT_ADMIN_WALLET']);
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

// The jackpot part of the config (design §C.1). Secrets stay in closures; the
// frozen object carries only public facts. `jackpotDeployment` overrides the
// statically imported LITVM_JACKPOT (tests and the local rehearsal only).
export function readJackpotConfig(source, { jackpotDeployment = null } = {}) {
  const env = source && typeof source === 'object' ? source : {};
  const dep = jackpotDeployment && typeof jackpotDeployment === 'object' ? jackpotDeployment : LITVM_JACKPOT;
  const instance = dep?.instances?.chikun ?? null;
  const deployed = dep?.status === 'deployed';

  const keeperKey = text(env.JACKPOT_KEEPER_PRIVATE_KEY);
  const keeperConfigured = PRIVATE_KEY.test(keeperKey);
  const keeper = Object.freeze({
    configured: keeperConfigured,
    // The keeper wallet, created only when a send is due (A28 pattern).
    createWallet(ethers, provider) {
      if (!keeperConfigured) throw new Error('keeper-not-configured');
      return new ethers.Wallet(keeperKey, provider);
    },
    // The keeper's public address (lowercase), or null; never the key.
    address(ethers) {
      if (!keeperConfigured) return null;
      return ethers.computeAddress(keeperKey).toLowerCase();
    },
  });

  const contractText = text(env.JACKPOT_CONTRACT_ADDRESS);
  const contractConfigured = ADDRESS.test(contractText);
  const contractAddress = contractConfigured ? contractText.toLowerCase() : null;
  const deployedAddress = String(instance?.address ?? '').toLowerCase();
  const contract = Object.freeze({
    configured: contractConfigured,
    address: contractAddress,
    matchesDeployment: Boolean(deployed && contractAddress && ADDRESS.test(deployedAddress) && contractAddress === deployedAddress),
  });

  const feeText = text(env.JACKPOT_MAX_TX_FEE_WEI);
  const maxTxFeeWei = /^[0-9]{1,78}$/.test(feeText) && BigInt(feeText) > 0n ? feeText : DEFAULT_JACKPOT_MAX_TX_FEE_WEI;
  // JACKPOT_ADMIN_WALLET is an extra constraint on the review API, never the
  // only gate. A value that is present but not an address locks the review
  // API for everyone (fail closed).
  const adminText = text(env.JACKPOT_ADMIN_WALLET);
  const adminWallet = Object.freeze({
    configured: adminText !== '',
    address: ADDRESS.test(adminText) ? adminText.toLowerCase() : null,
    invalid: adminText !== '' && !ADDRESS.test(adminText),
  });

  const missing = [];
  if (!keeperConfigured) missing.push('JACKPOT_KEEPER_PRIVATE_KEY');
  if (!contractConfigured) missing.push('JACKPOT_CONTRACT_ADDRESS');
  if (!deployed) missing.push('jackpot-not-deployed');
  if (contractConfigured && deployed && !contract.matchesDeployment) missing.push('jackpot-address-mismatch');
  const missingList = Object.freeze(missing);
  const ready = keeperConfigured && contractConfigured && contract.matchesDeployment && deployed;
  // The read endpoints (GET /api/jackpot, the replay, the owner review) need
  // no key: they stay up without the keeper (design §C.1 "reads continue"),
  // so clearing a leaked keeper key never hides the jackpot or locks the
  // admin out of the review page (§E emergency stop 4). `ready` gates the cron.
  const readable = contractConfigured && contract.matchesDeployment && deployed;

  const summary = () => ({
    ready,
    readable,
    keeper: { configured: keeperConfigured },
    contract: { configured: contractConfigured, address: contractAddress, matchesDeployment: contract.matchesDeployment },
    paused: env.JACKPOT_PAUSED === 'true',
    uiHidden: env.JACKPOT_UI_HIDDEN === 'true',
    maxTxFeeWei,
    adminWallet: { configured: adminWallet.configured, address: adminWallet.address, invalid: adminWallet.invalid },
    deployment: { status: dep?.status ?? 'unavailable', chainId: dep?.chainId ?? null },
    missing: [...missingList],
  });
  return Object.freeze({
    ready,
    readable,
    keeper,
    contract,
    paused: env.JACKPOT_PAUSED === 'true',
    uiHidden: env.JACKPOT_UI_HIDDEN === 'true',
    maxTxFeeWei,
    adminWallet,
    deployment: dep,
    missing: missingList,
    toJSON: summary,
    toString: () => `JackpotConfig ${JSON.stringify(summary())}`,
    [INSPECT]: () => `JackpotConfig ${JSON.stringify(summary())}`,
  });
}

export function readServerConfig(env = process.env, { deployment = null, jackpotDeployment = null } = {}) {
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
  // Separate from `missing` and `settlementReady` by construction (§C.1).
  const jackpot = readJackpotConfig(source, { jackpotDeployment });

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
    jackpot: jackpot.toJSON(),
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
    jackpot,
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
// provider, deployment, nowMs, fetchImpl and crypto; the jackpot handlers
// also pass jackpotDeployment (design §C.1), which only reaches the config.
export async function buildBaseDeps(env = process.env, overrides = {}, cache = {}) {
  const deployment = overrides.deployment ?? await loadDeployment();
  const config = readServerConfig(env, { deployment, jackpotDeployment: overrides.jackpotDeployment ?? null });
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
