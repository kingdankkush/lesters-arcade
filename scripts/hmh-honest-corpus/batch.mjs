// Real headless runs of this checkout's HMH child under Ranked identities, and
// their verification and export. The child is apps/hmh-reboot/src/main.mjs,
// unmodified, booted by child-driver.mjs against the DOM/Pixi stand-ins and
// driven by the honest pilots of pilot.mjs one 60 Hz frame at a time.
//
//   node scripts/hmh-honest-corpus/batch.mjs plan
//   node scripts/hmh-honest-corpus/batch.mjs run [--only=label,..|--sample|--melee] [--concurrency=4] [--runs=dir]
//   node scripts/hmh-honest-corpus/batch.mjs verify [--runs=dir] [--out=file]
//   node scripts/hmh-honest-corpus/batch.mjs report [--results=file]
//   node scripts/hmh-honest-corpus/batch.mjs export --commit=<sha> --out=file [--runs=dir] [--merge]
//
// `runs` is a batch folder (default scripts/hmh-honest-corpus/runs/, ignored by
// git): one .identity.json and one .run.json per plan label, plus results.json
// from verify. Runs are child processes (one per plan row, at most
// --concurrency at a time; keep it at 6 or below).
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HARNESS_BUILD_HASH, HARNESS_RELEASE, SEASON_ID } from './identity.mjs';
import { MELEE_LABELS, PLAN, SAMPLE_LABELS, identityFor } from './plan.mjs';
import { verifyAll } from './verify.mjs';
import { buildCorpus, mergeCorpus, serializeCorpus } from './corpus.mjs';
import { printReport } from './report.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

function runProcess(spec) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--max-old-space-size=3072', 'run-one.mjs', JSON.stringify(spec)], { cwd: HERE, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.stderr.on('data', (chunk) => { err += chunk; });
    child.on('close', (code) => resolve({ code, out: out.trim(), err: err.split('\n').filter((line) => !/^\s+at |Native|^\s*$/.test(line)).slice(-6).join('\n') }));
  });
}

async function runAll({ only, concurrency, runsDir }) {
  mkdirSync(runsDir, { recursive: true });
  const unknown = (only ?? []).filter((label) => !PLAN.some((run) => run.label === label));
  if (unknown.length) throw new Error(`not in the plan: ${unknown.join(', ')}`);
  const plan = only ? PLAN.filter((run) => only.includes(run.label)) : PLAN;
  console.log(`child ${HARNESS_RELEASE} buildHash ${HARNESS_BUILD_HASH} season ${SEASON_ID}: ${plan.length} runs, concurrency ${concurrency}, into ${runsDir}`);
  const queue = [];
  for (const run of plan) {
    const id = await identityFor(run);
    writeFileSync(path.join(runsDir, `${run.label}.identity.json`), JSON.stringify({ run, ...id }));
    queue.push({ run, id });
  }
  let active = 0;
  let cursor = 0;
  let failures = 0;
  await new Promise((done) => {
    const pump = () => {
      if (cursor >= queue.length && active === 0) return done();
      while (active < concurrency && cursor < queue.length) {
        const { run, id } = queue[cursor++];
        active += 1;
        const spec = { label: run.label, seed: id.seed, style: run.style, tickCap: run.tickCap, surrenderFrames: run.surrenderFrames ?? 30_000, heroId: run.heroId, buildHash: HARNESS_BUILD_HASH, seasonId: SEASON_ID, out: path.join(runsDir, `${run.label}.run.json`) };
        const started = Date.now();
        runProcess(spec).then((result) => {
          active -= 1;
          if (result.code) failures += 1;
          console.log(`[${new Date().toISOString().slice(11, 19)}] ${result.out || `${run.label} exit ${result.code}`} (${((Date.now() - started) / 1000).toFixed(0)}s)${result.code ? `\n${result.err}` : ''}`);
          pump();
        });
      }
    };
    pump();
  });
  return failures;
}

const [command = 'plan', ...args] = process.argv.slice(2);
const opts = Object.fromEntries(args.map((arg) => { const [k, v] = arg.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const runsDir = path.resolve(opts.runs ? String(opts.runs) : path.join(HERE, 'runs'));

if (command === 'plan') {
  for (const run of PLAN) console.log(run.label.padEnd(34), run.heroId.padEnd(13), SAMPLE_LABELS.includes(run.label) ? 'sample' : '');
  console.log(`${PLAN.length} runs; child ${HARNESS_RELEASE} buildHash ${HARNESS_BUILD_HASH}`);
} else if (command === 'run') {
  const only = opts.sample ? [...SAMPLE_LABELS] : opts.melee ? [...MELEE_LABELS] : opts.only ? String(opts.only).split(',') : null;
  const failures = await runAll({ only, concurrency: Math.min(6, Math.max(1, Number(opts.concurrency ?? 4))), runsDir });
  process.exitCode = failures ? 1 : 0;
} else if (command === 'verify') {
  const results = await verifyAll(PLAN, runsDir);
  const present = results.filter((r) => !r.missing);
  for (const r of present) {
    const p = r.plausibility;
    console.log(`${r.label.padEnd(34)} tick=${String(r.finalTick).padStart(6)} ${r.endedBy.padEnd(22)} kills=${String(r.stats?.kills ?? '-').padStart(4)} verify=${r.verifyRankedRun ? (r.verifyRankedRun.ok ? 'ok' : r.verifyRankedRun.error) : '-'} plaus=${p?.verdict ?? '-'} ${p?.flags.map((f) => `${f.id}(${f.value}/${f.limit})`).join(' ') ?? ''} errs=${r.childErrors}`);
  }
  const out = opts.out ? path.resolve(String(opts.out)) : path.join(runsDir, 'results.json');
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), child: { release: HARNESS_RELEASE, buildHash: HARNESS_BUILD_HASH }, runs: results }, null, 1));
  console.log(`${present.length} of ${results.length} plan rows present; results in ${out}`);
  const bad = present.filter((r) => !r.verifyRankedRun?.ok || r.plausibility?.verdict === 'rejected' || r.schemaError);
  process.exitCode = bad.length ? 1 : 0;
} else if (command === 'report') {
  printReport(JSON.parse(readFileSync(opts.results ? path.resolve(String(opts.results)) : path.join(runsDir, 'results.json'), 'utf8')));
} else if (command === 'export') {
  if (!opts.out) throw new Error('export needs --out=<corpus file>');
  const out = path.resolve(String(opts.out));
  let corpus = buildCorpus(PLAN, runsDir, { commit: opts.commit, capturedAt: opts.capturedAt ? String(opts.capturedAt) : undefined });
  if (opts.merge) corpus = mergeCorpus(out, corpus);
  mkdirSync(path.dirname(out), { recursive: true });
  writeFileSync(out, serializeCorpus(corpus));
  console.log(`${corpus.runs.length} runs of child ${corpus.child.release} (${corpus.child.commit}, ${corpus.child.buildHash}) written to ${out}`);
} else {
  throw new Error(`unknown command ${command}; use plan | run | verify | report | export`);
}
