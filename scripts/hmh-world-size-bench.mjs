#!/usr/bin/env node
// Diagnostic benchmark only: no shipping map/rules/versions or assets change.
import { performance } from 'node:perf_hooks';
import { cpus, arch, platform } from 'node:os';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createEnemyNavGrid, computeEnemyFlowField, ENEMY_NAV_CELL_SIZE } from '../apps/hmh-reboot/src/enemy-navgrid.mjs';
import { createSizingScenarios, createGatePatchProbes } from './lib/hmh-world-size-fixtures.mjs';
import { buildInstrumentedGrid, compareGatePatch, digestNavGrid, digestFlowField, inspectGridBoundary, inspectNavigationMemory } from './lib/hmh-world-size-diagnostics.mjs';

export function parseSizingArgs(argv) {
  const options = { repetitions: 3, warmups: 1, flowRepetitions: 12, output: null };
  const fields = { repetitions: ['repetitions', 1, 20], warmups: ['warmups', 0, 5], 'flow-repetitions': ['flowRepetitions', 1, 100] };
  for (const arg of argv) {
    const match = /^--([a-z-]+)=(.*)$/.exec(arg);
    if (!match) throw new TypeError(`unknown argument ${arg}; use --repetitions=N --warmups=N --flow-repetitions=N --output=PATH`);
    const [, key, value] = match;
    if (key === 'output') { if (!value) throw new TypeError('output must name a file'); options.output = resolve(value); continue; }
    const field = fields[key];
    if (!field || !/^\d+$/.test(value) || Number(value) < field[1] || Number(value) > field[2]) throw new TypeError(`invalid --${key}`);
    options[field[0]] = Number(value);
  }
  return options;
}

const sha256 = value => createHash('sha256').update(value).digest('hex');
function timingSummary(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const midpoint = Math.floor(sorted.length / 2);
  return { samplesMs: samples, medianMs: sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2,
    minMs: sorted[0], maxMs: sorted.at(-1) };
}

export async function runWorldSizing(options) {
  const directSources = [
    '../apps/hmh-reboot/src/enemy-navgrid.mjs', '../apps/hmh-reboot/src/elevation.mjs',
    '../apps/hmh-reboot/src/level-one-world.mjs', '../apps/hmh-reboot/src/world-design-interactions.mjs',
    './lib/hmh-world-size-fixtures.mjs', './lib/hmh-world-size-diagnostics.mjs', './hmh-world-size-bench.mjs',
  ];
  const sourceSha256 = Object.fromEntries(await Promise.all(directSources.map(async relative => [relative.replace(/^\.\.\//, ''), sha256(await readFile(new URL(relative, import.meta.url)))])));
  const cpu = cpus();
  const report = {
    schema: 'hmh-world-w0a-native-diagnostic-v1', generatedAt: new Date().toISOString(),
    runtime: { node: process.version, platform: platform(), arch: arch(), cpuModel: cpu[0]?.model ?? null, logicalCpus: cpu.length },
    context: {
      environment: 'native Node on development host', browserMeasurement: false, physicalPhoneAcceptance: false,
      futureMapAcceptance: false, performanceGate: false, texturesMeasured: false,
      note: 'Only actual returned nav/flow typed-array bytes and native timings are measured. Synthetic rooms are a representative load, NOT the actual future map.',
      warmup: 'Each scenario gets its own synchronous-build/flow warmup. Build samples alternate across scenarios before the next repetition.',
      flowRefresh: 'One actual computeEnemyFlowField call per sample. Runtime cadence stays at its existing fixed 30 ticks; no simulation or browser work is timed here.',
      instrumentation: 'Chunked builds use clock/query counters and Node setImmediate. This adds overhead and differs from browser idle scheduling.',
      memory: 'No GPU/decoded-texture/process/phone residency, transient BFS queue or GC lifetime is measured.',
      sourceIdentity: 'Direct source file content hashes plus each complete fixture topology hash; no Git dependency.',
    },
    settings: { repetitions: options.repetitions, warmups: options.warmups, flowRepetitions: options.flowRepetitions, cellsPerSlice: 512, sliceBudgetMs: 4, cellSize: ENEMY_NAV_CELL_SIZE },
    sourceSha256, scenarios: [],
  };
  const scenarios = createSizingScenarios();
  const measurements = scenarios.map(subject => ({ subject, builds: [], chunked: [], flows: [], grid: null }));
  for (const record of measurements) for (let warm = 0; warm < options.warmups; warm += 1) {
    const grid = createEnemyNavGrid(record.subject);
    computeEnemyFlowField({ grid, targetX: record.subject.world.bounds.minX + 100, targetY: record.subject.world.bounds.minY + 100 });
  }
  for (let repetition = 0; repetition < options.repetitions; repetition += 1) {
    for (const record of measurements) {
      const start = performance.now();
      const grid = createEnemyNavGrid(record.subject);
      record.builds.push(performance.now() - start);
      const chunked = await buildInstrumentedGrid(record.subject, { cellsPerSlice: 512, sliceBudgetMs: 4 });
      if (digestNavGrid(grid) !== digestNavGrid(chunked.grid)) throw new Error(`synchronous/chunked parity failed: ${record.subject.id}`);
      record.chunked.push({ elapsedMs: chunked.elapsedMs, yields: chunked.yields, groundQueries: chunked.groundQueries,
        processedCells: chunked.slices.reduce((sum, slice) => sum + slice.cells, 0),
        sliceCount: chunked.slices.length, workMs: chunked.slices.reduce((sum, slice) => sum + slice.workMs, 0),
        maxSliceWorkMs: Math.max(...chunked.slices.map(slice => slice.workMs)),
        passes: ['walkability', 'directed-edges'].map(pass => {
          const slices = chunked.slices.filter(slice => slice.pass === pass);
          return { pass, cells: slices.reduce((sum, slice) => sum + slice.cells, 0), groundQueries: slices.reduce((sum, slice) => sum + slice.groundQueries, 0),
            slices: slices.length, workMs: slices.reduce((sum, slice) => sum + slice.workMs, 0), maxSliceWorkMs: Math.max(...slices.map(slice => slice.workMs)) };
        }),
      });
      record.grid = grid;
    }
  }
  for (const record of measurements) {
    const { subject, grid } = record;
    const b = subject.world.bounds;
    const targets = [
      { id: 'near-corner', x: b.minX + 100, y: b.minY + 100 },
      { id: 'centre', x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 },
      { id: 'far-corner', x: b.maxX - 100, y: b.maxY - 100 },
    ];
    let lastField;
    for (const target of targets) {
      const samples = [];
      let expectedDigest;
      for (let repetition = 0; repetition < options.flowRepetitions; repetition += 1) {
        const start = performance.now();
        const field = computeEnemyFlowField({ grid, targetX: target.x, targetY: target.y });
        samples.push(performance.now() - start);
        const digest = digestFlowField(field);
        if (expectedDigest && digest !== expectedDigest) throw new Error(`flow determinism failed: ${subject.id}/${target.id}`);
        expectedDigest = digest; lastField = field;
      }
      record.flows.push({ target, targetCellWalkable: grid.isWalkableAt(target.x, target.y), timing: timingSummary(samples), digest: expectedDigest });
    }
    const boundary = inspectGridBoundary(grid, subject.world.bounds, subject.queryGround);
    const row = {
      id: subject.id, topologyKind: subject.topologyKind, note: subject.note,
      topologySha256: sha256(JSON.stringify(subject.world)), bounds: subject.world.bounds,
      geometry: { surfaces: subject.world.surfaces.length, blockers: subject.world.collisionBlockers.length },
      grid: { columns: grid.columns, rows: grid.rows, cells: grid.walkable.length, digest: digestNavGrid(grid), synchronousChunkedByteParity: true },
      memory: inspectNavigationMemory(grid, lastField), boundary,
      synchronousBuild: timingSummary(record.builds), instrumentedChunkedBuilds: record.chunked, flowRefresh: record.flows,
    };
    report.scenarios.push(row);
  }
  report.gatePatchDifferential = { note: 'Compare ACTUAL local patch with ACTUAL full rebuild. Border cases are diagnostic geometry, not the current map or accepted W1 layouts.', probes: createGatePatchProbes().map(subject => ({ id: subject.id, ...compareGatePatch(subject, subject.gateId) })), currentMapGate: { gateId: 'relay-supply-gate', ...compareGatePatch(scenarios[0], 'relay-supply-gate') } };
  return report;
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseSizingArgs(argv);
  const report = await runWorldSizing(options);
  const output = JSON.stringify(report, null, 2) + '\n';
  if (options.output) { await mkdir(dirname(options.output), { recursive: true }); await writeFile(options.output, output); }
  for (const row of report.scenarios) console.log(`${row.id}: native build median=${row.synchronousBuild.medianMs.toFixed(1)}ms; nav/flow returned arrays=${row.memory.measuredArraysBytes}B; walkable=${row.boundary.walkableCellPct.toFixed(1)}%; outside-centres walkable=${row.boundary.walkableCentresOutsideExactBounds}; parity=PASS`);
  console.log('NATIVE NODE DIAGNOSTIC ONLY: browser=false; physicalPhoneAcceptance=false; futureMapAcceptance=false');
  if (!options.output) console.log(output);
  else console.log(`Receipt: ${options.output}`);
  return report;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
