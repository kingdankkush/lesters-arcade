import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { keccak256, keccakUtf8, utf8Bytes } from '../apps/portal/src/keccak256.mjs';
import {
  canonicalManifestPayload,
  createGameRegistry,
  manifestChecksum,
  manifestRegistryAnchor,
  validateGameManifest,
} from '../apps/portal/src/game-manifest.mjs';

// The oracle: the vendored ethers the manifest digests used before (polish-2).
const ethers = await import('../apps/portal/vendor/ethers.min.js');
const repoRoot = fileURLToPath(new URL('..', import.meta.url));

// Deterministic bytes, so every run hashes the same corpus.
function pseudoRandomBytes(length, seed) {
  const bytes = new Uint8Array(length);
  let x = seed >>> 0 || 1;
  for (let index = 0; index < length; index += 1) {
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    bytes[index] = x & 0xff;
  }
  return bytes;
}

const RATE = 136;

test('keccak256 matches published Keccak-256 vectors, not SHA3-256', () => {
  const empty = keccak256(new Uint8Array());
  assert.equal(empty, '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470');
  assert.notEqual(empty, '0xa7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a', 'SHA3-256 of the empty input');
  assert.equal(keccakUtf8('abc'), '0x4e03657aea45a94fc7d47ba826c8d667c0d1e6e33a64a036ec44f58fa12d6c45');
  assert.equal(keccakUtf8('The quick brown fox jumps over the lazy dog'), '0x4d741b6f1eb29cb2a9b9911c82f56fa8d73b04959d3d9d222895df6c0b28aa15');
  // The ERC-20 transfer selector is the first 4 bytes of this digest.
  assert.equal(keccakUtf8('transfer(address,uint256)').slice(0, 10), '0xa9059cbb');
});

test('keccak256 equals ethers.keccak256 for every length across three rate blocks', () => {
  for (let length = 0; length <= 3 * RATE + 2; length += 1) {
    const bytes = pseudoRandomBytes(length, length + 1);
    assert.equal(keccak256(bytes), ethers.keccak256(bytes), `${length} bytes`);
  }
});

test('keccak256 equals ethers.keccak256 at the rate boundaries and on long inputs', () => {
  const lengths = [RATE - 1, RATE, RATE + 1, 2 * RATE - 1, 2 * RATE, 2 * RATE + 1, 1000, 4096, 65_536, 1_000_003];
  for (const length of lengths) {
    for (const bytes of [pseudoRandomBytes(length, 7 * length + 3), new Uint8Array(length), new Uint8Array(length).fill(0xff)]) {
      assert.equal(keccak256(bytes), ethers.keccak256(bytes), `${length} bytes starting ${bytes[0]}`);
    }
  }
  // A subarray view hashes its own bytes only.
  const backing = pseudoRandomBytes(600, 99);
  const view = backing.subarray(17, 17 + RATE + 1);
  assert.equal(keccak256(view), ethers.keccak256(view));
  assert.equal(keccak256(view), keccak256(Uint8Array.from(view)));
});

test('keccakUtf8 equals ethers.id on ASCII, multibyte UTF-8 and the rate boundaries', () => {
  const corpus = [
    '',
    ' ',
    'a',
    'sample-game',
    'lester-blaster',
    'chikun',
    'stacked',
    'hmh-season-1-2026',
    'chikun:canvas-runtime-v7',
    'Hello, world!',
    '{"id":"sample-game","name":"Sample"}',
    '\u0000\u0001\u007f',
    'é', 'ñandú', 'Grüße', 'Ω≈ç√∫', '€', '日本語', 'Lester’s Arcade', '\ufb00\uffff',
    '😀', '🐔 Chikun’s Escape 🥚', 'a😀b😀c', '\ud83d\ude00', '𝕃𝕚𝕥𝕍𝕄',
    // A lone low surrogate: ethers encodes the code unit as three bytes.
    '\udc00', 'x\udfffy',
    // UTF-8 byte lengths around the 136-byte rate, including a multibyte
    // character that straddles the block edge.
    'a'.repeat(RATE - 1), 'a'.repeat(RATE), 'a'.repeat(RATE + 1),
    'a'.repeat(RATE - 2) + 'é', 'a'.repeat(RATE - 1) + 'é', 'a'.repeat(RATE - 2) + '€', 'a'.repeat(RATE - 1) + '😀',
    'a'.repeat(2 * RATE - 1), 'a'.repeat(2 * RATE), 'a'.repeat(2 * RATE + 1),
    'ü'.repeat(68), '€'.repeat(45), '😀'.repeat(34),
    // Long inputs.
    'abcdefghijklmnopqrstuvwxyz0123456789'.repeat(300),
    'Hard Money Heroes · 日本語 · 😀 '.repeat(2000),
  ];
  for (const text of corpus) {
    const label = `${JSON.stringify(text.slice(0, 24))} (${text.length} units)`;
    assert.deepEqual(utf8Bytes(text), ethers.toUtf8Bytes(text), `UTF-8 of ${label}`);
    assert.equal(keccakUtf8(text), ethers.id(text), label);
  }
  assert.deepEqual([...utf8Bytes('\udc00')], [0xed, 0xb0, 0x80], 'not U+FFFD, as TextEncoder would write');
});

test('keccakUtf8 refuses what ethers.id refuses', () => {
  for (const text of ['\ud800', 'abc\ud83d', '\ud83d\u0041', '\ud83dx\ude00']) {
    assert.throws(() => ethers.id(text), `ethers refuses ${JSON.stringify(text)}`);
    assert.throws(() => keccakUtf8(text), TypeError, JSON.stringify(text));
  }
  for (const value of [null, undefined, 42, {}, ['a']]) {
    assert.throws(() => ethers.id(value));
    assert.throws(() => keccakUtf8(value), TypeError);
  }
  assert.throws(() => keccak256('0x00'), TypeError, 'bytes only; hex strings are not parsed');
  assert.throws(() => keccak256([1, 2, 3]), TypeError);
});

test('every shipped cabinet manifest keeps the digest and gameId ethers gave it', () => {
  const registry = createGameRegistry();
  for (const slug of ['hard-money-heroes', 'chikun', 'stacked', 'template-cabinet']) {
    const input = JSON.parse(readFileSync(`${repoRoot}apps/portal/games/${slug}/game.manifest.json`, 'utf8'));
    const { valid, errors, manifest } = validateGameManifest(input);
    assert.ok(valid, `${slug}: ${errors.join('; ')}`);
    const payload = canonicalManifestPayload(manifest);
    assert.equal(manifestChecksum(manifest), ethers.id(payload), `${slug} checksum`);
    const anchor = manifestRegistryAnchor(manifest);
    assert.equal(anchor.gameId, ethers.id(manifest.id), `${slug} gameId`);
    assert.equal(anchor.manifestChecksum, ethers.keccak256(ethers.toUtf8Bytes(payload)));
    const registered = registry.register(input);
    assert.equal(registered.checksum, ethers.id(payload), `${slug} registry checksum`);
  }
});

// The modules a bundle loads before anything is imported on demand: every
// dynamic import() stays outside, so only static edges are followed.
async function staticGraph(entry) {
  const { build } = await import('esbuild');
  const result = await build({
    entryPoints: [entry],
    absWorkingDir: repoRoot,
    bundle: true,
    write: false,
    format: 'esm',
    metafile: true,
    logLevel: 'silent',
    outdir: 'keccak256-test-out',
    external: ['pixi.js'],
    plugins: [{
      name: 'dynamic-imports-stay-lazy',
      setup(buildApi) {
        buildApi.onResolve({ filter: /.*/ }, (args) => (args.kind === 'dynamic-import' ? { path: args.path, external: true } : null));
      },
    }],
  });
  return new Set(Object.keys(result.metafile.inputs));
}

test('ethers is off the first paint of the portal and the Chikun child', async () => {
  const source = readFileSync(new URL('../apps/portal/src/game-manifest.mjs', import.meta.url), 'utf8');
  assert.equal(/from '[^']*ethers[^']*'|import\([^)]*ethers/.test(source), false, 'game-manifest.mjs imports no ethers');
  assert.match(source, /^import \{ keccakUtf8 \} from '\.\/keccak256\.mjs';$/m);
  const ETHERS = 'apps/portal/vendor/ethers.min.js';
  const KECCAK = 'apps/portal/src/keccak256.mjs';
  const [portal, chikun, hmh, stacked] = await Promise.all([
    'apps/portal/main.js',
    'apps/chikun/src/main.mjs',
    'apps/hmh-reboot/src/main.mjs',
    'apps/stacked/src/main.mjs',
  ].map(staticGraph));
  assert.ok(portal.has('apps/portal/src/game-manifest.mjs') && chikun.has('apps/portal/src/game-manifest.mjs'), 'both still validate manifests on first paint');
  assert.equal(portal.has(ETHERS), false, 'the portal loads ethers only on demand');
  assert.equal(chikun.has(ETHERS), false, 'the Chikun child loads ethers only on demand');
  assert.ok(portal.has(KECCAK) && chikun.has(KECCAK));
  assert.equal(hmh.has(KECCAK), false, 'the HMH child initial JS does not grow');
  assert.equal(stacked.has(KECCAK), false, 'the STACKED entry does not grow');
});
