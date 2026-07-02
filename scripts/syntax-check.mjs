// Syntax-check runner for Lester's Arcade.
//
// Replaces the former giant single-line `check` npm script. That inline
// `&&` chain hit the Windows command-line length limit (~8191 chars) once the
// project grew past ~114 modules, causing `npm run check` to fail with
// "The command line is too long." This runner keeps the SAME explicit file
// lists (no globbing, so nothing silently escapes the gate) but invokes the
// checks from Node, so the list can grow without any OS length wall — and new
// modules are added by editing an array here instead of a 8KB npm string.
//
// Add new source/test modules to NODE_CHECK_FILES, new Python scripts to
// PY_COMPILE_FILES. Run: `npm run check`.

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));

// Every .mjs / .js module that must parse cleanly (node --check).
const NODE_CHECK_FILES = [
  "apps/portal/src/arcade-core.mjs",
  "apps/portal/src/leaderboard-engine.mjs",
  "apps/portal/src/seeded-rng.mjs",
  "apps/portal/src/enemy-steering.mjs",
  "apps/portal/src/username-registry.mjs",
  "apps/portal/src/settlement.mjs",
  "apps/portal/src/sprite-pipeline.mjs",
  "apps/portal/src/device-model.mjs",
  "apps/portal/src/combat-damage.mjs",
  "apps/portal/src/combat-physics.mjs",
  "apps/portal/src/game-manifest.mjs",
  "apps/portal/src/arcade-sdk.mjs",
  "apps/portal/src/wallet-auth.mjs",
  "apps/portal/src/combat-sprite-bridge.mjs",
  "apps/portal/src/canonical-actors.mjs",
  "apps/portal/src/biome-model.mjs",
  "apps/portal/src/world-obstacles.mjs",
  "apps/portal/src/scene-templates.mjs",
  "apps/portal/src/leaderboard-seed.mjs",
  "apps/portal/src/persistence.mjs",
  "apps/portal/src/arcade-router.mjs",
  "apps/portal/src/hmh-campaign-levels.mjs",
  "apps/portal/src/district-generator.mjs",
  "apps/portal/src/hmh-level-one-sketch-layout.mjs",
  "apps/portal/src/hmh-level-one-ground.mjs",
  "apps/portal/src/hmh-ground-plan.mjs",
  "apps/portal/src/hmh-world-scale.mjs",
  "apps/portal/src/hmh-level-one-quality.mjs",
  "apps/portal/src/hmh-level-one-balance-pass.mjs",
  "apps/portal/assets/generated/hmh-level-one-ground/sbs-cc0/sbs-level-one-ground-manifest.mjs",
  "apps/portal/src/hmh-authored-setpieces.mjs",
  "apps/portal/src/hmh-campaign-runtime.mjs",
  "apps/portal/src/hmh-character-config.mjs",
  "apps/portal/src/hmh-combat-balance.mjs",
  "apps/portal/src/hmh-encounter-visuals.mjs",
  "apps/portal/src/hmh-environment-manager.mjs",
  "apps/portal/src/authored-world-layout.mjs",
  "apps/portal/src/combat-vfx.mjs",
  "apps/portal/main.js",
  "tests/hmh-campaign-levels.test.mjs",
  "tests/hmh-level-one-sketch-layout.test.mjs",
  "tests/hmh-level-one-ground.test.mjs",
  "tests/hmh-ground-plan.test.mjs",
  "tests/hmh-ground-rendering.test.mjs",
  "tests/hmh-world-scale.test.mjs",
  "tests/hmh-asset-footprints.test.mjs",
  "tests/hmh-footprint-runtime.test.mjs",
  "tests/hmh-open-survival.test.mjs",
  "tests/hmh-upgrade-tree.test.mjs",
  "tests/hmh-level-one-curated-world-contract.test.mjs",
  "apps/portal/src/hmh-level-one-curated-world-contract.mjs",
  "tests/hmh-level-one-quality-escalation.test.mjs",
  "tests/hmh-level-one-balance-pass.test.mjs",
  "tests/hmh-authored-setpieces.test.mjs",
  "tests/hmh-campaign-runtime.test.mjs",
  "tests/hmh-character-config.test.mjs",
  "tests/hmh-combat-balance.test.mjs",
  "tests/hmh-encounter-visuals.test.mjs",
  "tests/hmh-environment-manager.test.mjs",
  "tests/authored-world-layout.test.mjs",
  "tests/combat-vfx.test.mjs",
  "tests/combat-sprite-bridge.test.mjs",
  "tests/arcade-core.test.mjs",
  "tests/arcade-router.test.mjs",
  "tests/session-id.test.mjs",
  "tests/hero-sprite-lock.test.mjs",
  "tests/world-obstacles.test.mjs",
  "tests/leaderboard-engine.test.mjs",
  "tests/seeded-rng.test.mjs",
  "tests/seeded-rng-routing.test.mjs",
  "tests/iso-runtime-determinism.test.mjs",
  "tests/username-registry.test.mjs",
  "tests/settlement.test.mjs",
  "tests/sprite-pipeline.test.mjs",
  "tests/device-model.test.mjs",
  "tests/combat-damage.test.mjs",
  "tests/combat-physics.test.mjs",
  "tests/biome-model.test.mjs",
  "tests/scene-templates.test.mjs",
  "tests/persistence.test.mjs",
  "scripts/contract-structure-check.mjs",
  "scripts/compile-contracts.mjs",
  "scripts/verify-generated-assets.mjs",
  "scripts/sprite-qa.mjs",
  "scripts/ground-texture-audit.mjs",
  "scripts/global-art-census.mjs",
  "scripts/art-purge-repair.mjs",
  "scripts/hero-animation-certification.mjs",
  "scripts/art-redo-queue.mjs",
  "scripts/combat-feedback-certification.mjs",
  "scripts/boss-balance-pass.mjs",
  "scripts/hmh-copy-sheet.mjs",
  "scripts/build-asset-footprints.mjs",
  "scripts/report-hmh-animation-coverage.mjs",
  "scripts/roster-coverage-report.mjs",
  "scripts/write-hmh-balance-snapshot.mjs",
  "scripts/smoke-portal-flow.mjs",
  "scripts/smoke-portal-interactions.mjs",
  "scripts/smoke-pixellab-calibration-browser.mjs",
  "scripts/repo-cleanup-audit.mjs",
  "scripts/repo-health.mjs",
  "scripts/vault-sync.mjs",
  "scripts/hooks/pre-commit-size-check.mjs",
  "scripts/write-hmh-level-one-environment-asset-queue.mjs",
  "scripts/write-hmh-weekly-design-review.mjs",
  "scripts/write-hmh-animation-production-requests.mjs",
  "tests/hmh-curated-level-kit.test.mjs",
  "apps/portal/assets/generated/hmh-curated-level-kit/hmh-curated-level-kit-manifest.mjs",
  "apps/portal/assets/generated/hmh-coherent-world/level1-polish/level1-polish-manifest.mjs",
  "apps/portal/assets/generated/hmh-level-one-ground/final-paint/final-paint-level-one-ground-manifest.mjs",
  "apps/portal/assets/generated/hmh-coherent-world/level1-final-animated/level1-final-animated-manifest.mjs",
  "apps/portal/src/games/hmh/loader.mjs",
  "apps/portal/assets/generated/hmh-final-animation-completion/hmh-final-animation-completion-manifest.mjs",
  "tests/hmh-final-animation-completion.test.mjs",
  "apps/portal/assets/generated/hmh-final-setpiece-kit/hmh-final-setpiece-kit-manifest.mjs",
  "apps/portal/assets/generated/hmh-final-combat-vfx/hmh-final-combat-vfx-manifest.mjs",
  "apps/portal/assets/generated/hmh-coherent-world/level-final-ambient/level-final-ambient-manifest.mjs",
  "apps/portal/assets/generated/hmh-final-boss-animations/hmh-final-boss-animations-manifest.mjs",
  "apps/portal/assets/generated/hmh-coherent-world/level2-final-city/level2-final-city-manifest.mjs",
  "tests/hmh-boss-and-level2-world-art.test.mjs",
  "apps/portal/src/hmh-level-three-ground.mjs",
  "apps/portal/src/hmh-ground-selection.mjs",
  "apps/portal/assets/generated/hmh-coherent-world/level3-final-getaway/level3-final-getaway-manifest.mjs",
  "apps/portal/assets/generated/hmh-level-three-ground/final-getaway/level3-final-getaway-ground-manifest.mjs",
  "tests/hmh-level3-getaway-art.test.mjs",
  "apps/portal/src/hmh-level-editor-schema.mjs",
  "apps/portal/src/hmh-level-editor-generated-library.mjs",
  "apps/portal/src/hmh-level-editor-runtime-sprite-library.mjs",
  "apps/portal/src/hmh-level-editor-assets.mjs",
  "apps/portal/src/hmh-level-editor-app.mjs",
  "tests/hmh-level-editor.test.mjs",
  "apps/portal/src/hmh-level-one-aaa-slices.mjs",
  "apps/portal/src/hmh-art-repair.mjs",
  "apps/portal/src/hmh-upgrade-menu-ui.mjs",
  "apps/portal/src/hmh-combat-feedback.mjs",
  "apps/portal/src/hmh-boss-balance-pass.mjs",
  "apps/portal/src/hmh-copy-sheet.mjs",
  "tests/hmh-level-one-aaa-slices.test.mjs",
  "apps/portal/src/hmh-level-one-visible-runtime.mjs",
  "tests/hmh-level-one-visible-runtime.test.mjs",
  "tests/contract-abi-alignment.test.mjs",
  "apps/portal/src/hmh-run-integrity.mjs",
  "apps/portal/src/hmh-run-simulator.mjs",
  "apps/portal/src/hmh-drop-economy.mjs",
  "apps/portal/src/hmh-grenade-economy.mjs",
  "tests/hmh-run-integrity.test.mjs",
  "tests/hmh-run-simulator.test.mjs",
  "tests/hmh-drop-economy.test.mjs",
  "tests/hmh-grenade-economy.test.mjs",
  "tests/hmh-enemy-balance-cards.test.mjs",
  "tests/hmh-level-one-map-bounds.test.mjs",
  "tests/hmh-level-one-boundary-edges.test.mjs",
  "tests/hmh-finite-map-spawn.test.mjs",
  "tests/hmh-bounded-world-ai.test.mjs",
  "tests/hmh-player-interactivity-animation.test.mjs",
  "tests/hmh-global-art-census.test.mjs",
  "tests/hmh-art-purge-repair.test.mjs",
  "tests/hmh-hero-animation-certification.test.mjs",
  "tests/hmh-art-redo-queue.test.mjs",
  "tests/hmh-upgrade-menu-ui.test.mjs",
  "tests/hmh-combat-feedback.test.mjs",
  "tests/hmh-boss-balance-pass.test.mjs",
  "tests/hmh-copy-sheet.test.mjs",
  "apps/portal/src/boss-phase-controller.mjs",
  "tests/boss-phase-controller.test.mjs",
  "apps/portal/src/hmh-level-one-boss.mjs",
  "tests/hmh-level-one-boss.test.mjs",
  "tests/roster-coverage-report.test.mjs",
  "tests/sprite-qa.test.mjs",
  "scripts/syntax-check.mjs"
];

// Every Python script that must compile (python -m py_compile).
const PY_COMPILE_FILES = [
  "scripts/slice-lester-production-sprites.py",
  "scripts/ingest-hard-money-heroes-user-assets.py",
  "scripts/inventory-hmh-environment-assets.py",
  "scripts/ingest-hmh-environment-assets.py",
  "scripts/ingest-hmh-cabinet-sprites.py",
  "scripts/ingest-arcade-playlist-music.py",
  "scripts/generate-hmh-expanded-pixel-pack.py",
  "scripts/pixellab-hmh-isometric-production-wave.py",
  "scripts/generate-hmh-production-art-pass.py",
  "scripts/pixellab-hmh-environment-wave-2.py",
  "scripts/ingest-hmh-canonical-art.py",
  "scripts/ingest-hmh-level-environment.py",
  "scripts/clean-hmh-level-design-alpha.py",
  "scripts/generate-hmh-level-one-sketch-assets.py",
  "scripts/build-hmh-curated-level-kit.py",
  "scripts/ingest-hmh-sbs-isometric-tiles.py",
  "scripts/generate-hmh-level-one-polish-assets.py",
  "scripts/generate-hmh-level-one-final-paint-ground.py",
  "scripts/generate-hmh-level-one-final-animated-props.py",
  "scripts/generate-hmh-final-animation-completion.py",
  "scripts/generate-hmh-final-setpiece-kit.py",
  "scripts/generate-hmh-final-vfx-and-ambient.py",
  "scripts/generate-hmh-final-boss-and-level2-city.py",
  "scripts/generate-hmh-level3-getaway-art.py",
  "scripts/pixellab-hmh-level1-asset-wave.py"
];

let failures = 0;

function checkNode(rel) {
  const abs = join(root, rel);
  if (!existsSync(abs)) {
    console.error(`MISSING (node --check): ${rel}`);
    failures += 1;
    return;
  }
  const r = spawnSync(process.execPath, ['--check', abs], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`SYNTAX ERROR: ${rel}\n${r.stderr || r.stdout}`);
    failures += 1;
  }
}

function pythonExe() {
  // Prefer `python`, fall back to `python3`.
  for (const exe of ['python', 'python3']) {
    const probe = spawnSync(exe, ['--version'], { encoding: 'utf8' });
    if (!probe.error && probe.status === 0) return exe;
  }
  return null;
}

function checkPython(files) {
  if (files.length === 0) return;
  const exe = pythonExe();
  if (!exe) {
    console.error('python not found on PATH; cannot py_compile scripts');
    failures += 1;
    return;
  }
  const missing = files.filter((f) => !existsSync(join(root, f)));
  for (const m of missing) {
    console.error(`MISSING (py_compile): ${m}`);
    failures += 1;
  }
  const present = files.filter((f) => existsSync(join(root, f))).map((f) => join(root, f));
  if (present.length === 0) return;
  const r = spawnSync(exe, ['-m', 'py_compile', ...present], { encoding: 'utf8' });
  if (r.status !== 0) {
    console.error(`PYTHON SYNTAX ERROR:\n${r.stderr || r.stdout}`);
    failures += 1;
  }
}

for (const f of NODE_CHECK_FILES) checkNode(f);
checkPython(PY_COMPILE_FILES);

if (failures > 0) {
  console.error(`\nSyntax check FAILED: ${failures} problem(s).`);
  process.exit(1);
}
console.log(`Syntax check passed: ${NODE_CHECK_FILES.length} JS modules + ${PY_COMPILE_FILES.length} Python scripts.`);
