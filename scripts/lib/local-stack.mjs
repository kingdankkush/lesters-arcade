// The local Ranked stack for the rehearsal (rehearsal slice; contract A21, A30, A34, §4.5, §11 rule 12).
//
// startLocalStack() stands up everything production runs, in this process, with only the database,
// the chain and the clock swapped:
//   - the in-process Hardhat chain (chainId 4441, scripts/lib/local-chain.mjs through the settle
//     fixtures' bootLocalChain): the suite deployed, the developer wallet confirmed and every game
//     playable, and the entry fee on;
//   - an UNMIGRATED PGlite (tests/helpers/pglite-client.mjs), so the first requests prove that the
//     handlers migrate through ensureSchema themselves (A34);
//   - every api/*.mjs module mounted exactly as production mounts it,
//     createHandler(() => buildDeps(env, { db, provider, deployment, nowMs })) (A30), the same mount
//     tests/helpers/settle-handler-harness.mjs uses, behind the rewrites READ FROM vercel.json (query
//     strings carried through, named params appended the way Vercel's router does), so routing drift
//     between vercel.json and the handlers fails the rehearsal;
//   - an in-process `api(method, path, { headers, body })` client that feeds each handler a Node
//     request stream and a response object, so the production adapter (body cap, query check, Bearer
//     before the body) is what runs.
// scripts/lib/local-http.mjs serves the same router over node:http, and scripts/lib/rehearsal-driver.mjs
// plays one Ranked session per game through either.
//
// Keys: every key here is a public Hardhat fixture key (the test mnemonic) or a random value made for
// this process. Nothing reads the vault, and nothing prints a key or a secret.

import { randomBytes } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ethers } from 'ethers';

import { localContracts, localWalletKeys } from './local-chain.mjs';
import { deployedDeploymentInput, renderLitvmAddressModule } from '../generate-litvm-addresses.mjs';
import { bootLocalChain } from '../../tests/helpers/settle-fixtures.mjs';
import { createPgliteClient } from '../../tests/helpers/pglite-client.mjs';

export const REPO_ROOT = fileURLToPath(new URL('../..', import.meta.url));
export const LOCAL_STACK_IP = '127.0.0.1';
export const LOCAL_NEON_URL = 'postgresql://rehearsal@pglite.invalid/local-stack';
export const LOCAL_ALLOWED_DOMAINS = Object.freeze(['127.0.0.1', 'localhost']);

// ---------------------------------------------------------------------------
// vercel.json routing.

export function readVercelConfig(root = REPO_ROOT) {
  return JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8'));
}

function closingParen(text, open) {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === '\\') { index += 1; continue; }
    if (text[index] === '(') depth += 1;
    if (text[index] === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`unbalanced ( in the vercel.json source ${text}`);
}

// A vercel.json `source` (path-to-regexp 6: `:name(regex)`, `:name*`, `:name` and bare regex groups)
// as an anchored RegExp with one named group per param.
export function compileVercelSource(source) {
  let out = '';
  for (let index = 0; index < source.length;) {
    const ch = source[index];
    if (ch === ':') {
      let end = index + 1;
      while (end < source.length && /[A-Za-z0-9_]/.test(source[end])) end += 1;
      const name = source.slice(index + 1, end);
      if (source[end] === '(') {
        const close = closingParen(source, end);
        out += `(?<${name}>${source.slice(end + 1, close)})`;
        index = close + 1;
      } else if (source[end] === '*') {
        out += `(?<${name}>.*)`;
        index = end + 1;
      } else {
        out += `(?<${name}>[^/]+)`;
        index = end;
      }
    } else if (ch === '(') {
      const close = closingParen(source, index);
      out += source.slice(index, close + 1);
      index = close + 1;
    } else {
      out += ch.replace(/[.*+?^${}|[\]\\]/g, '\\$&');
      index += 1;
    }
  }
  return new RegExp(`^${out}$`);
}

function namedParams(pattern) {
  return [...pattern.source.matchAll(/\(\?<([A-Za-z0-9_]+)>/g)].map((match) => match[1]);
}

// Vercel's router (@vercel/routing-utils replaceSegments): when the destination PATHNAME uses none of
// the source's named params, every named param that is not already a destination query key is
// appended to the query as name=value (contract §4.5, tests/vercel-routing.test.mjs).
export function vercelAppendedParams(rule, pattern = compileVercelSource(rule.source)) {
  const [pathname, search = ''] = rule.destination.split('?');
  const names = namedParams(pattern);
  if (names.some((name) => pathname.includes(`:${name}`))) return [];
  const declared = new Set([...new URLSearchParams(search).keys()]);
  return names.filter((name) => !declared.has(name));
}

export function compileVercelRewrites(config = readVercelConfig()) {
  return Object.freeze((config.rewrites ?? []).map((rule) => {
    const pattern = compileVercelSource(rule.source);
    return Object.freeze({ source: rule.source, destination: rule.destination, pattern, appended: Object.freeze(vercelAppendedParams(rule, pattern)) });
  }));
}

export function compileVercelHeaders(config = readVercelConfig()) {
  return Object.freeze((config.headers ?? []).map((rule) => Object.freeze({ source: rule.source, pattern: compileVercelSource(rule.source), headers: rule.headers })));
}

// First matching rewrite wins; the original query string is carried through (Vercel merges it into
// the destination's). Returns { source, destination } or null.
export function applyVercelRewrites(url, rewrites) {
  const [path, query = ''] = String(url).split('?');
  for (const rule of rewrites) {
    const match = rule.pattern.exec(path);
    if (!match) continue;
    let destination = rule.destination.replace(/:([A-Za-z0-9_]+)/g, (_, name) => match.groups?.[name] ?? '');
    const extra = rule.appended.map((name) => `${name}=${match.groups?.[name] ?? ''}`);
    for (const part of [...extra, ...(query ? [query] : [])]) destination += `${destination.includes('?') ? '&' : '?'}${part}`;
    return { source: rule.source, destination };
  }
  return null;
}

// Every function file under api/ ('api/settle.mjs', 'api/cron/index-chain.mjs', ...).
export function listApiModules(root = REPO_ROOT) {
  const out = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (name.endsWith('.mjs')) out.push(relative(root, path).split(sep).join('/'));
    }
  };
  walk(join(root, 'api'));
  return Object.freeze(out);
}

function apiModuleFor(pathname, apiModules) {
  if (!pathname.startsWith('/api/')) return null;
  const bare = pathname.replace(/\.mjs$/, '').slice(1);
  const file = `${bare}.mjs`;
  return apiModules.includes(file) ? file : null;
}

function staticFileFor(pathname, staticRoot) {
  if (!staticRoot) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const base = resolve(staticRoot);
  const target = resolve(base, `.${decoded}`);
  if (target !== base && !target.startsWith(`${base}${sep}`)) return null;
  try {
    if (statSync(target).isFile()) return target;
  } catch {
    return null;
  }
  return null;
}

// Routes a request URL the way Vercel does for this project: the filesystem first (a function under
// api/, or a static file of the web root when one is served), then vercel.json rewrites, then the
// filesystem again for the destination.
//   → { kind: 'api', module, url, rewrittenFrom } | { kind: 'static', file, url, rewrittenFrom } | { kind: 'none', url }
export function createVercelRouter({ root = REPO_ROOT, config = readVercelConfig(root), staticRoot = null } = {}) {
  const rewrites = compileVercelRewrites(config);
  const headerRules = compileVercelHeaders(config);
  const apiModules = listApiModules(root);
  const resolveUrl = (url, rewrittenFrom = null) => {
    const pathname = String(url).split('?')[0];
    const module = apiModuleFor(pathname, apiModules);
    if (module) return { kind: 'api', module, url, rewrittenFrom };
    const file = staticFileFor(pathname, staticRoot);
    if (file) return { kind: 'static', file, url, rewrittenFrom };
    return null;
  };
  return Object.freeze({
    rewrites,
    headerRules,
    apiModules,
    route(url) {
      const direct = resolveUrl(url);
      if (direct) return direct;
      const rewritten = applyVercelRewrites(url, rewrites);
      if (rewritten) {
        const target = resolveUrl(rewritten.destination, rewritten.source);
        if (target) return target;
        return { kind: 'none', url: rewritten.destination, rewrittenFrom: rewritten.source };
      }
      return { kind: 'none', url, rewrittenFrom: null };
    },
    // The vercel.json `headers` that apply to a request path, in file order (later rules win).
    headersFor(pathname) {
      const found = {};
      for (const rule of headerRules) {
        if (!rule.pattern.test(pathname)) continue;
        for (const header of rule.headers) found[header.key] = header.value;
      }
      return found;
    },
  });
}

// ---------------------------------------------------------------------------
// Handler mounts (A30).

// Mounts every api/*.mjs module as production does, with only db, provider, deployment and nowMs
// overridden. `env` is read on every request (buildDeps runs per request), so the stack can pause
// settlement or allow a new domain without remounting.
export function createHandlerMounts({ root = REPO_ROOT, env, overrides }) {
  const mounted = new Map();
  return async function handlerFor(module) {
    if (!mounted.has(module)) {
      mounted.set(module, (async () => {
        const mod = await import(pathToFileURL(join(root, module)).href);
        if (typeof mod.createHandler !== 'function' || typeof mod.buildDeps !== 'function') throw new Error(`${module} does not export the A30 seam (createHandler, buildDeps)`);
        return mod.createHandler(() => mod.buildDeps(env, overrides()));
      })());
      mounted.get(module).catch(() => mounted.delete(module));
    }
    return mounted.get(module);
  };
}

// A Node-response stand-in that keeps binary bodies intact.
export function createMemoryResponse() {
  const headers = {};
  const chunks = [];
  let finished = false;
  return {
    statusCode: 200,
    headersSent: false,
    setHeader(key, value) { headers[String(key).toLowerCase()] = Array.isArray(value) ? value.map(String) : String(value); },
    getHeader(key) { return headers[String(key).toLowerCase()]; },
    removeHeader(key) { delete headers[String(key).toLowerCase()]; },
    hasHeader(key) { return Object.hasOwn(headers, String(key).toLowerCase()); },
    getHeaders() { return { ...headers }; },
    writeHead(status, extra = {}) {
      this.statusCode = status;
      for (const [key, value] of Object.entries(extra)) this.setHeader(key, value);
      return this;
    },
    write(chunk) {
      if (chunk !== undefined && chunk !== null) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      return true;
    },
    end(chunk) {
      if (chunk !== undefined && chunk !== null) this.write(chunk);
      finished = true;
      this.headersSent = true;
      return this;
    },
    get finished() { return finished; },
    get headers() { return { ...headers }; },
    get bodyBuffer() { return Buffer.concat(chunks); },
  };
}

// Decodes a response body by its content type: JSON → value, text → string, anything else → Buffer.
export function decodeResponseBody(contentType, buffer) {
  const type = String(contentType ?? '').toLowerCase();
  if (buffer.length === 0) return null;
  if (type.includes('application/json')) {
    try {
      return JSON.parse(buffer.toString('utf8'));
    } catch {
      return buffer.toString('utf8');
    }
  }
  if (type.startsWith('text/') || type.includes('xml') || type.includes('javascript')) return buffer.toString('utf8');
  return buffer;
}

function lowerHeaders(headers = {}) {
  return Object.fromEntries(Object.entries(headers).filter(([, value]) => value !== undefined && value !== null).map(([key, value]) => [key.toLowerCase(), String(value)]));
}

// The in-process client: (method, path, { headers, body }) → { status, headers, body }. The handler
// receives a real Node Readable as its request (so readJsonBody streams it under the cap) with the
// ROUTED url, exactly like a Vercel function behind the rewrite.
export function createInProcessApi({ router, handlerFor, beforeRequest = async () => {}, ip = LOCAL_STACK_IP }) {
  return async function api(method, path, { headers = {}, body } = {}) {
    const route = router.route(path);
    if (route.kind !== 'api') {
      return { status: 404, headers: { 'content-type': 'application/json; charset=utf-8' }, body: { ok: false, error: 'not-found', route: route.kind } };
    }
    await beforeRequest();
    const handler = await handlerFor(route.module);
    const payload = body === undefined || body === null ? null : Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    const req = Readable.from(payload ? [payload] : []);
    req.method = String(method).toUpperCase();
    req.url = route.url;
    req.headers = {
      'x-forwarded-for': ip,
      ...(payload ? { 'content-type': 'application/json', 'content-length': String(payload.length) } : {}),
      ...lowerHeaders(headers),
    };
    const res = createMemoryResponse();
    await handler(req, res);
    return { status: res.statusCode, headers: res.headers, body: decodeResponseBody(res.getHeader('content-type'), res.bodyBuffer) };
  };
}

// ---------------------------------------------------------------------------
// The stack.

function randomSecret() {
  return randomBytes(32).toString('hex');
}

// Every table a rejected or paused request must leave untouched: sessions, evidence, achievements,
// profiles, the relayer lease and the indexer cursor. (auth_nonces and rate_limits move with every
// sign-in and request by design.)
export const SNAPSHOT_TABLES = Object.freeze(['verified_sessions', 'session_evidence', 'achievement_unlocks', 'wallet_profiles', 'relayer_lease', 'indexer_state']);

// The row count AND an md5 of every row's text (ordered) per table, so an UPDATE to any column of any
// row changes the snapshot, not only an INSERT or a DELETE.
export async function snapshotLocalRows(db, tables = SNAPSHOT_TABLES) {
  const out = {};
  for (const table of tables) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await db.query('SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = $1', [table]);
    if (exists[0].n === 0) {
      out[table] = { rows: 0, digest: null };
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const [row] = await db.query(`SELECT count(*)::int AS n, md5(coalesce(string_agg(t::text, E'\\n' ORDER BY t::text), '')) AS digest FROM ${table} t`);
    out[table] = { rows: row.n, digest: row.digest };
  }
  return out;
}

// Starts the local stack. Returns:
//   { chain, record, deployment, db, env, wallets, api, router, handlerFor, nowMs, syncClock,
//     advanceTime(seconds), advanceServerClock(seconds), eip1193 (clock-tracking), driverChain(),
//     localControls, allowDomain(host), close() }
export async function startLocalStack({ allowedDomains = LOCAL_ALLOWED_DOMAINS, ip = LOCAL_STACK_IP, root = REPO_ROOT, log = () => {} } = {}) {
  log('local stack: booting the in-process chain (4441) and deploying the suite');
  const local = await bootLocalChain();
  const { chain, record, deployment } = local;
  try {
    // Fees on (the deploy leaves them on; this makes the precondition explicit and idempotent).
    const operatorEntry = localContracts(record, chain.wallets.operator).rankedEntry;
    if (!(await operatorEntry.entryFeeEnabled())) await (await operatorEntry.setEntryFeeEnabled(true)).wait();

    const keys = localWalletKeys();
    const registry = record.addresses.scoreSubmissionRegistry.toLowerCase();
    const env = {
      VERCEL_ENV: 'development',
      SESSION_ALLOWED_DOMAINS: [...allowedDomains].join(','),
      SESSION_SECRET: randomSecret(),
      NEON_DATABASE_URL: LOCAL_NEON_URL,
      RANKED_VERIFIER_PRIVATE_KEY: keys.verifier,
      RANKED_RELAYER_PRIVATE_KEY: keys.relayer,
      RANKED_SCORE_REGISTRY_ADDRESS: registry,
      CRON_SECRET: randomSecret(),
      LITVM_CHAIN_ID: '4441',
    };
    const db = createPgliteClient();

    // The server clock is the timestamp the chain would give its next block: Hardhat stamps
    // max(latest + 1, wall clock + the evm_increaseTime total). Every request re-reads the latest
    // block first, so chain-time checks (A26) see what LiteForge would show at that moment.
    // advanceServerClock() moves the server clock alone, as wall time passes on a chain that makes no
    // empty blocks (LiteForge is Arbitrum Orbit): the tests of the driver's real-time path use it so
    // the chain's latest block time stands still while the server's clock moves on.
    let increasedSeconds = 0;
    let serverOnlySeconds = 0;
    let latestSeconds = 0;
    const nowMs = () => Math.max(Date.now() + (increasedSeconds + serverOnlySeconds) * 1000, (latestSeconds + 1) * 1000);
    const advanceServerClock = (seconds) => {
      serverOnlySeconds += Math.max(0, Number(seconds) || 0);
      return nowMs();
    };
    const syncClock = async () => {
      const block = await chain.provider.getBlock('latest');
      latestSeconds = Math.max(latestSeconds, Number(block.timestamp));
      return nowMs();
    };
    await syncClock();

    // The chain's EIP-1193 provider with time travel tracked, for the JSON-RPC proxy of local-http.
    const TIME_METHODS = new Set(['evm_increaseTime', 'evm_mine', 'hardhat_mine', 'evm_setNextBlockTimestamp']);
    const eip1193 = {
      async request(args) {
        const result = await chain.eip1193.request(args);
        if (args?.method === 'evm_increaseTime') increasedSeconds += Number(BigInt(args.params?.[0] ?? 0));
        if (TIME_METHODS.has(args?.method)) await syncClock();
        return result;
      },
    };
    const advanceTime = async (seconds) => {
      const whole = Math.max(0, Math.ceil(Number(seconds)));
      if (whole > 0) await eip1193.request({ method: 'evm_increaseTime', params: [whole] });
      await eip1193.request({ method: 'evm_mine', params: [] });
      return nowMs();
    };

    const overrides = () => ({ db, provider: chain.provider, deployment, nowMs });
    const router = createVercelRouter({ root });
    const handlerFor = createHandlerMounts({ root, env, overrides });
    const api = createInProcessApi({ router, handlerFor, beforeRequest: syncClock, ip });
    const allowDomain = (host) => {
      const domains = new Set(String(env.SESSION_ALLOWED_DOMAINS).split(',').filter(Boolean));
      domains.add(String(host));
      env.SESSION_ALLOWED_DOMAINS = [...domains].join(',');
    };

    // Operator levers the local-only negative checks need (never available on the live target).
    const localControls = Object.freeze({
      async setPaused(paused) {
        if (paused) env.SETTLEMENT_PAUSED = 'true';
        else delete env.SETTLEMENT_PAUSED;
      },
      async setEntryFeeEnabled(enabled) {
        const entry = localContracts(record, chain.wallets.operator).rankedEntry;
        if ((await entry.entryFeeEnabled()) !== enabled) await (await entry.setEntryFeeEnabled(enabled)).wait();
        return entry.entryFeeEnabled();
      },
      snapshotRows: () => snapshotLocalRows(db),
    });

    const stack = {
      chain,
      record,
      deployment,
      db,
      env,
      wallets: chain.wallets,
      router,
      handlerFor,
      api,
      nowMs,
      syncClock,
      advanceTime,
      advanceServerClock,
      eip1193,
      allowDomain,
      localControls,
      cronSecret: () => env.CRON_SECRET,
      // The driver's chain view of this stack (contract §8 addresses from the local record).
      driverChain() {
        return { provider: chain.provider, deployment, relayer: record.relayer.toLowerCase(), advanceTime };
      },
      async close() {
        await db.close();
        await chain.close();
      },
    };
    log(`local stack: ready (score registry ${registry})`);
    return stack;
  } catch (error) {
    await chain.close().catch(() => {});
    throw error;
  }
}

// An ethers read/write provider over a JSON-RPC URL with fast polling (the local proxy mines at once).
export function jsonRpcProvider(url, { pollingInterval = 100 } = {}) {
  return new ethers.JsonRpcProvider(url, 4441, { staticNetwork: true, cacheTimeout: -1, pollingInterval });
}

// Writes a generated address module (status 'deployed') for a local deployment record into `dir`,
// for the operator CLIs' `--deployment <module.mjs>` option (accepted only with a loopback --rpc).
// The repo's own module is never touched.
export function writeLocalAddressModule(record, dir) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `litvm-addresses-local-${randomBytes(4).toString('hex')}.mjs`);
  writeFileSync(path, renderLitvmAddressModule(deployedDeploymentInput(record)), 'utf8');
  return path;
}
