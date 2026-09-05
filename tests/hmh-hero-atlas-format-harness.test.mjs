// Cycle 074 (P-6): the hero atlas format harness is a measurement tool, not a
// runtime change. These tests pin the pure parts -- the statistics, the 256 px
// extrapolation and the memo rendering -- so the memo the owner reads cannot
// drift from the numbers the harness measured. Nothing here spawns Python or a
// browser; the harness entry point does that and is run by hand.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  ATLAS_FORMAT_VARIANTS,
  KTX2_STATUS,
  buildDecisionRows,
  deltaPercent,
  estimateTransferMs,
  extrapolateTo256,
  formatBytes,
  percentile,
  renderDecisionMemo,
  summarizeRuns,
} from '../scripts/hmh-hero-atlas-format-harness.mjs';

function repoText(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
}

const conversion = {
  hero: 'lester-original',
  source: { bytes: 3_242_471, width: 2048, height: 2048, frames: 648, frameSize: 160 },
  variants: {
    png: { file: 'lester-original.png', bytes: 3_242_471, encodeMs: 0, fidelity: { identical: true, visibleMaxChannelDelta: 0, visibleMeanRgbDelta: 0, alphaChanged: 0 } },
    'webp-lossless': { file: 'lester-original.lossless.webp', bytes: 2_499_518, encodeMs: 9_505, fidelity: { identical: true, visibleMaxChannelDelta: 0, visibleMeanRgbDelta: 0, alphaChanged: 0 } },
    'webp-q90': { file: 'lester-original.q90.webp', bytes: 906_980, encodeMs: 14_608, fidelity: { identical: false, visibleMaxChannelDelta: 68, visibleMeanRgbDelta: 3.337, alphaChanged: 0 } },
  },
  toolchain: { python: '3.11.16', pillow: '12.3.0', numpy: '2.4.6' },
};

function fakeRuns(base) {
  return Array.from({ length: 7 }, (_, index) => ({
    fetchMs: base + index,
    decodeMs: base / 2 + index,
    pixiLoadMs: base * 1.5 + index,
    uploadMs: 1 + index * 0.1,
    firstRenderMs: 0.5 + index * 0.1,
  }));
}

const measurements = {
  desktop: {
    label: 'desktop 1440x900 dsf 1',
    cpuThrottle: 1,
    variants: { png: fakeRuns(40), 'webp-lossless': fakeRuns(30), 'webp-q90': fakeRuns(20) },
  },
  'iphone-13': {
    label: 'iphone-13 390x844 dsf 3, CPU x4 (proxy)',
    cpuThrottle: 4,
    variants: { png: fakeRuns(160), 'webp-lossless': fakeRuns(120), 'webp-q90': fakeRuns(80) },
  },
};

test('P-6: percentile and summary are deterministic and nearest-rank', () => {
  assert.equal(percentile([5, 1, 3], 50), 3);
  assert.equal(percentile([5, 1, 3], 95), 5);
  assert.equal(percentile([10], 95), 10);
  assert.throws(() => percentile([], 50));
  const summary = summarizeRuns(fakeRuns(40));
  assert.equal(summary.runs, 7);
  assert.equal(summary.fetchMs.median, 43);
  assert.equal(summary.fetchMs.p95, 46);
  assert.equal(summary.decodeMs.median, 23);
});

test('P-6: the 256 px extrapolation shows the atlas no longer fits one 2048 page', () => {
  const out = extrapolateTo256({ bytes: 3_242_471, frameSize: 160, atlasSize: 2048 });
  assert.equal(out.areaFactor, 2.56);
  assert.equal(out.estimatedBytes, Math.round(3_242_471 * 2.56));
  assert.equal(out.fitsSinglePageAt, 4096);
  assert.equal(out.pagesAt2048, 3);
  assert.equal(out.decodedRgbaBytesSinglePage, 4096 * 4096 * 4);
  assert.equal(out.decodedRgbaBytesPaged, 3 * 2048 * 2048 * 4);
  assert.equal(out.fitsPerHeroCap, false, '8.3 MB estimated against the 3,407,872 cap');
  const small = extrapolateTo256({ bytes: 906_980, frameSize: 160, atlasSize: 2048 });
  assert.equal(small.fitsPerHeroCap, true);
});

test('P-6: analytic transfer time is bytes over bandwidth, whole milliseconds', () => {
  // 3,242,471 bytes at 10 Mbps = 25,939,768 bits / 10,000 bits per ms.
  assert.equal(estimateTransferMs(3_242_471, 10), 2594);
  assert.equal(estimateTransferMs(3_242_471, 50), 519);
  assert.equal(estimateTransferMs(0, 10), 0);
});

test('P-6: formatting helpers are stable', () => {
  assert.equal(formatBytes(3_242_471), '3,242,471');
  assert.equal(deltaPercent(2_499_518, 3_242_471), '-22.9%');
  assert.equal(deltaPercent(3_242_471, 3_242_471), '0.0%');
  assert.equal(deltaPercent(4_000_000, 3_242_471), '+23.4%');
});

test('P-6: the decision rows cover every variant plus an honest KTX2 row', () => {
  const rows = buildDecisionRows({ conversion, measurements });
  assert.deepEqual(rows.map((row) => row.format), [...ATLAS_FORMAT_VARIANTS, 'ktx2']);
  const ktx2 = rows.at(-1);
  assert.equal(ktx2.bytes, null);
  assert.equal(ktx2.status, KTX2_STATUS);
  assert.match(KTX2_STATUS, /not measurable on this host: no encoder installed/);
  const lossless = rows[1];
  assert.equal(lossless.bytes, 2_499_518);
  assert.equal(lossless.delta, '-22.9%');
  assert.equal(lossless.desktop.decodeMs.median, 18);
  assert.equal(lossless['iphone-13'].fetchMs.p95, 126);
  assert.equal(lossless.gpuBytes2048, 2048 * 2048 * 4);
});

test('P-6: the memo carries the table, the four 8.3.2 options, the KTX2 install pointer and the S-2 status', () => {
  const memo = renderDecisionMemo({
    conversion,
    measurements,
    generatedAt: '2026-09-05T00:00:00.000Z',
    baseCommit: '90a744d4',
    s2Status: 'test-status-line',
  });
  assert.match(memo, /^# Hero atlas format decision memo/m);
  assert.match(memo, /\| Format \| Bytes \|/);
  assert.match(memo, /\| PNG \(shipped\) \| 3,242,471 \|/);
  assert.match(memo, /\| WebP lossless \(exact\) \| 2,499,518 \| 2,000 \| 400 \| -22\.9% \|/);
  assert.match(memo, /\| WebP lossy q90 \| 906,980 \| 726 \| 145 \| -72\.0% \|/);
  assert.match(memo, /\| KTX2 \(UASTC\) \| not measurable on this host: no encoder installed[^|]*\| n\/a \| n\/a \| n\/a \|/);
  assert.match(memo, /## What the numbers say/);
  // Fixture: desktop q90 decode median 13 ms against PNG 23 ms.
  assert.match(memo, /WebP lossy q90 decodes in 13 ms \(-10\.0 ms vs PNG\)/, 'decode comparison must be computed from the rows');
  assert.match(memo, /KTX-Software/);
  assert.match(memo, /toktx/);
  assert.match(memo, /raise the 12(\.6 MB| MiB)/i);
  assert.match(memo, /lossless WebP/);
  assert.match(memo, /KTX2/);
  assert.match(memo, /one hero at a time/);
  assert.match(memo, /## S-2 status/);
  assert.match(memo, /test-status-line/);
  assert.match(memo, /proxy/i, 'iPhone numbers must be labelled as a headless proxy, not a device measurement');
  assert.match(memo, /10 Mbps/);
  assert.match(memo, /\| PNG \(shipped\) \| 3,242,471 \| 2,594 \| 519 \|/, 'analytic transfer columns');
  assert.match(memo, /DECISIONS\.md/);
  assert.doesNotMatch(memo, /undefined|NaN/);
});

test('P-6: the harness, converter and this test are registered in the syntax check', () => {
  const syntaxCheck = repoText('scripts/syntax-check.mjs');
  for (const file of [
    'scripts/hmh-hero-atlas-format-harness.mjs',
    'tests/hmh-hero-atlas-format-harness.test.mjs',
    'scripts/hmh-hero-atlas-format-convert.py',
    'tests/hmh-reboot-combat-audio-routing.test.mjs',
  ]) {
    assert.ok(syntaxCheck.includes(`"${file}"`), `${file} missing from syntax-check`);
  }
});
