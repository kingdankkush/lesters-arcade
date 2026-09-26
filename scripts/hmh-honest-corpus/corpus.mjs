// The committed corpus: a batch's run summaries, condensed to what the tests
// replay (tests/fixtures/hmh-honest-corpus/real-child-<release>.json). Each
// row keeps the plan facts (label, style, entry, hero, tick cap, seed), how
// the run ended, the child's error count and the summary the child emitted
// over hmh-bridge/v1. Trace, run events and pilot statistics stay in the
// batch's runs/ folder.
import { existsSync, readFileSync } from 'node:fs';
import { endedByOf, readRun } from './verify.mjs';

export const CORPUS_SCHEMA = 'hmh-real-child-corpus-v1';
export const CORPUS_HARNESS = 'scripts/hmh-honest-corpus';
const BUILD_HASH = /^site-\d+\.\d+\.\d+:game-(\d+\.\d+\.\d+):cabinet-(\d+\.\d+\.\d+)$/;

export function corpusRow(run, { id, out }) {
  return {
    label: run.label, style: run.style, entry: run.entry, heroId: run.heroId, tickCap: run.tickCap, seed: id.seed,
    finalTick: out.finalTick, endedBy: endedByOf(out), childErrors: out.errors.length, runSummary: out.runSummary,
  };
}

// → the corpus object for the plan rows present in runsDir that reached a
// summary. `commit` names the child source the batch ran. The release and
// cabinet come from the summaries' build hash, which must be one value.
export function buildCorpus(plan, runsDir, { commit, capturedAt = new Date().toISOString() } = {}) {
  if (!/^[0-9a-f]{7,40}$/.test(String(commit))) throw new TypeError('export needs --commit=<child source sha>');
  const runs = [];
  for (const run of plan) {
    const files = readRun(runsDir, run.label);
    if (!files || !files.out.runSummary) continue;
    if (files.id.seed !== files.out.runSummary.identity.seed) throw new Error(`${run.label}: identity seed differs from the summary's`);
    runs.push(corpusRow(run, files));
  }
  if (!runs.length) throw new Error(`no run with a summary under ${runsDir}`);
  const buildHashes = new Set(runs.map((row) => row.runSummary.identity.buildHash));
  if (buildHashes.size !== 1) throw new Error(`one corpus file holds one child; found build hashes ${[...buildHashes].join(', ')}`);
  const [buildHash] = buildHashes;
  const match = BUILD_HASH.exec(buildHash);
  if (!match) throw new Error(`unexpected build hash ${buildHash}`);
  return { schema: CORPUS_SCHEMA, child: { release: match[1], cabinet: match[2], commit: String(commit), buildHash }, capturedAt, harness: CORPUS_HARNESS, runs };
}

// Existing rows of `file` (by label) replaced or extended by `corpus`'s rows;
// the child must match.
export function mergeCorpus(file, corpus) {
  if (!existsSync(file)) return corpus;
  const existing = JSON.parse(readFileSync(file, 'utf8'));
  if (existing.schema !== CORPUS_SCHEMA) throw new Error(`${file}: schema ${existing.schema}`);
  if (existing.child.buildHash !== corpus.child.buildHash || existing.child.commit !== corpus.child.commit) {
    throw new Error(`${file} holds child ${existing.child.commit} ${existing.child.buildHash}; the batch is ${corpus.child.commit} ${corpus.child.buildHash}`);
  }
  const byLabel = new Map(existing.runs.map((row) => [row.label, row]));
  for (const row of corpus.runs) byLabel.set(row.label, row);
  return { ...existing, capturedAt: corpus.capturedAt, runs: [...byLabel.values()].sort((a, b) => a.label.localeCompare(b.label)) };
}

// Header pretty-printed, one run per line: diffs stay per run and the file
// stays well under a megabyte for a hundred runs.
export function serializeCorpus(corpus) {
  const { runs, ...header } = corpus;
  const head = JSON.stringify(header, null, 1).replace(/\n\}$/, ',\n "runs": [\n');
  return `${head}${runs.map((row) => JSON.stringify(row)).join(',\n')}\n ]\n}\n`;
}
