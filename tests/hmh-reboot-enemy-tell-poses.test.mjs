import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

/**
 * Cycle 074 (E-3): enemy attack tells.
 *
 * The roster poses live in `scripts/hmh-blender/hmh_enemy_poses.py`, a module
 * that imports nothing but `math`, so the anticipation / overshoot / recovery
 * contract can be exercised on the Vercel build image (CPython 3.12, no
 * Blender) exactly the way the reproducibility helpers are. The exporter only
 * applies the returned rotations and locations to `rig.pose.bones`.
 *
 * What the tests pin, per ordinary role profile:
 *  - the tell WIDENS the silhouette (the Cycle 073 wind-up folded the arms
 *    across the chest and made tell the narrowest state in every atlas); the
 *    rifle role, whose hands stay on the weapon, grows taller and lifts its
 *    muzzle instead;
 *  - frame 1 of the tell is a held maximum, larger than the anticipation;
 *  - attack frame 0 overshoots well past the held tell and past idle;
 *  - attack frame 2 is a distinct exposed recovery (head dropped, body sunk),
 *    not a scaled copy of the strike and not idle, because the runtime holds
 *    it for the whole recovery window;
 *  - all nineteen authored frames per role are pairwise distinct (the pipeline
 *    rejects byte-identical renders);
 *  - the boss variant damps limb excursion so its 2 MiB atlas does not grow.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoRootPosix = repoRoot.replaceAll('\\', '/');
const modulePath = path.join(repoRoot, 'scripts', 'hmh-blender', 'hmh_enemy_poses.py');
const manifest = JSON.parse(readFileSync(path.join(repoRoot, 'apps', 'hmh-reboot', 'assets', 'source', 'blender', 'hmh-enemy-roster.json'), 'utf8'));

const ORDINARY_PROFILES = manifest.actors
  .filter((actor) => actor.boss !== true)
  .map((actor) => [actor.actorId, actor.animationProfile.kind, actor.animationProfile.damageResponse, actor.build.stoop]);

function runPoseModule(body) {
  const preamble = [
    'import importlib.util, json, math, sys',
    'from pathlib import Path',
    `root = Path(${JSON.stringify(repoRootPosix)})`,
    "spec = importlib.util.spec_from_file_location('hmh_enemy_poses', root / 'scripts' / 'hmh-blender' / 'hmh_enemy_poses.py')",
    'poses = importlib.util.module_from_spec(spec)',
    'spec.loader.exec_module(poses)',
    `profiles = json.loads(${JSON.stringify(JSON.stringify(ORDINARY_PROFILES))})`,
    'CLIPS = ' + JSON.stringify(Object.fromEntries(Object.entries(manifest.clips).map(([state, clip]) => [state, clip.frames]))),
    'def pose(kind, damage, state, frame, stoop, boss=False):',
    '    return poses.role_pose(kind, damage, state, frame, CLIPS[state], stoop, boss=boss)',
    'def rot(p, bone):',
    "    return p['rotations'].get(bone, [0.0, 0.0, 0.0])",
    'def loc(p, bone):',
    "    return p['locations'].get(bone, [0.0, 0.0, 0.0])",
    'ARM_BONES = ("upper_arm.L", "forearm.L", "upper_arm.R", "forearm.R")',
    'def arm_excursion(p):',
    '    return sum(abs(v) for bone in ARM_BONES for v in rot(p, bone))',
    'def magnitude(p):',
    "    return arm_excursion(p) + sum(abs(v) for v in rot(p, 'chest')) + sum(abs(v) for v in rot(p, 'head'))",
    'def distance(a, b):',
    "    bones = set(a['rotations']) | set(b['rotations'])",
    '    total = sum(abs(x - y) for bone in bones for x, y in zip(rot(a, bone), rot(b, bone)))',
    "    lbones = set(a['locations']) | set(b['locations'])",
    '    total += sum(abs(x - y) * 400.0 for bone in lbones for x, y in zip(loc(a, bone), loc(b, bone)))',
    '    return total',
  ].join('\n');
  const result = spawnSync('python', ['-c', `${preamble}\n${body}`], { cwd: repoRoot, encoding: 'utf8' });
  assert.equal(result.status, 0, `python pose helper failed:\n${result.stderr}`);
  const lastLine = result.stdout.trim().split(/\r?\n/).at(-1);
  return JSON.parse(lastLine);
}

test('the pose module is bpy-free so the pose contract runs on the Vercel build image', () => {
  const source = readFileSync(modulePath, 'utf8');
  const imports = source.split(/\r?\n/).filter((line) => /^(?:import|from)\s/.test(line));
  assert.deepEqual([...new Set(imports)].sort(), ['from __future__ import annotations', 'import math'], `unexpected imports: ${imports.join(', ')}`);
  assert.doesNotMatch(source, /\bbpy\b/);
  assert.match(source, /def role_pose\(/);
  assert.match(source, /def pose_screen_extent\(/, 'the module must expose the silhouette projection used by these tests');
});

test('every ordinary role widens on the tell and builds to a held maximum', () => {
  const report = runPoseModule([
    'out = {}',
    'def muzzle_up(p, kind):',
    "    pts = poses.pose_joint_positions(p, poses.SILHOUETTE_EXTRAS.get(kind, ()))",
    "    point = pts.get('extra0', (0.0, 0.0, 0.0))",
    '    return sum(point[i] * poses.SCREEN_UP[i] for i in range(3))',
    'for actor_id, kind, damage, stoop in profiles:',
    "    idle = pose(kind, damage, 'idle', 0, stoop)",
    "    tell0 = pose(kind, damage, 'tell', 0, stoop)",
    "    tell1 = pose(kind, damage, 'tell', 1, stoop)",
    '    out[actor_id] = {',
    "        'idleWidth': poses.pose_screen_extent(idle, kind)['width'],",
    "        'tell0Width': poses.pose_screen_extent(tell0, kind)['width'],",
    "        'tell1Width': poses.pose_screen_extent(tell1, kind)['width'],",
    "        'idleHeight': poses.pose_screen_extent(idle, kind)['height'],",
    "        'tell0Height': poses.pose_screen_extent(tell0, kind)['height'],",
    "        'tell1Height': poses.pose_screen_extent(tell1, kind)['height'],",
    "        'tell0MuzzleRise': muzzle_up(tell0, kind) - muzzle_up(idle, kind),",
    "        'tell1MuzzleRise': muzzle_up(tell1, kind) - muzzle_up(idle, kind),",
    "        'tell0Magnitude': magnitude(tell0),",
    "        'tell1Magnitude': magnitude(tell1),",
    '    }',
    'print(json.dumps(out))',
  ].join('\n'));
  for (const [actorId, kind] of ORDINARY_PROFILES) {
    const entry = report[actorId];
    if (kind === 'suppression-rifle-burst-v1') {
      // A shouldered rifle keeps both hands on the weapon, so this tell grows
      // UP rather than out: the silhouette gets taller and the muzzle lifts
      // onto the target, further still on the held frame. Asking a rifleman to
      // spread his arms would author a worse pose to satisfy a generic rule.
      assert.ok(entry.tell0Height >= entry.idleHeight * 1.06, `${actorId} shouldering must raise the silhouette: ${entry.tell0Height.toFixed(3)} vs idle ${entry.idleHeight.toFixed(3)}`);
      assert.ok(entry.tell1Height >= entry.tell0Height, `${actorId} held tell must not sink back: ${entry.tell1Height.toFixed(3)} vs ${entry.tell0Height.toFixed(3)}`);
      assert.ok(entry.tell0MuzzleRise >= 0.05, `${actorId} anticipation must lift the muzzle (${entry.tell0MuzzleRise.toFixed(3)})`);
      assert.ok(entry.tell1MuzzleRise >= entry.tell0MuzzleRise + 0.04, `${actorId} held frame must lift the muzzle further (${entry.tell1MuzzleRise.toFixed(3)} vs ${entry.tell0MuzzleRise.toFixed(3)})`);
    } else {
      assert.ok(entry.tell0Width >= entry.idleWidth * 1.12, `${actorId} anticipation must widen the silhouette: ${entry.tell0Width.toFixed(3)} vs idle ${entry.idleWidth.toFixed(3)}`);
      assert.ok(entry.tell1Width >= entry.tell0Width * 0.98, `${actorId} held tell must not shrink back: ${entry.tell1Width.toFixed(3)} vs ${entry.tell0Width.toFixed(3)}`);
    }
    assert.ok(entry.tell1Magnitude >= entry.tell0Magnitude * 1.2, `${actorId} held frame must exceed the anticipation: ${entry.tell1Magnitude.toFixed(1)} vs ${entry.tell0Magnitude.toFixed(1)}`);
  }
});

test('the strike overshoots the held tell and the recovery frame is a distinct exposed pose', () => {
  const report = runPoseModule([
    'out = {}',
    'for actor_id, kind, damage, stoop in profiles:',
    "    idle = pose(kind, damage, 'idle', 0, stoop)",
    "    tell1 = pose(kind, damage, 'tell', 1, stoop)",
    "    a0 = pose(kind, damage, 'attack', 0, stoop)",
    "    a1 = pose(kind, damage, 'attack', 1, stoop)",
    "    a2 = pose(kind, damage, 'attack', 2, stoop)",
    '    out[actor_id] = {',
    "        'tellToStrike': distance(tell1, a0),",
    "        'idleToStrike': distance(idle, a0),",
    "        'strikeToRecovery': distance(a0, a2),",
    "        'followToRecovery': distance(a1, a2),",
    "        'idleToRecovery': distance(idle, a2),",
    "        'recoveryHeadDrop': rot(a2, 'head')[0] - rot(idle, 'head')[0],",
    "        'recoveryPelvisDrop': loc(a2, 'pelvis')[1],",
    "        'strikeChest': rot(a0, 'chest')[0] - rot(idle, 'chest')[0],",
    "        'strikePelvisForward': loc(a0, 'pelvis')[2],",
    '    }',
    'print(json.dumps(out))',
  ].join('\n'));
  for (const [actorId, kind] of ORDINARY_PROFILES) {
    const entry = report[actorId];
    assert.ok(entry.tellToStrike >= 150, `${actorId} strike must swing far from the held tell (${entry.tellToStrike.toFixed(1)})`);
    assert.ok(entry.idleToStrike >= 120, `${actorId} strike must overshoot idle (${entry.idleToStrike.toFixed(1)})`);
    assert.ok(entry.strikeToRecovery >= 80, `${actorId} recovery must not be a scaled strike (${entry.strikeToRecovery.toFixed(1)})`);
    assert.ok(entry.followToRecovery >= 40, `${actorId} recovery must differ from the follow-through (${entry.followToRecovery.toFixed(1)})`);
    assert.ok(entry.idleToRecovery >= 45, `${actorId} recovery must differ from idle (${entry.idleToRecovery.toFixed(1)})`);
    assert.ok(entry.recoveryHeadDrop >= 10, `${actorId} recovery drops the head (${entry.recoveryHeadDrop.toFixed(1)})`);
    assert.ok(entry.recoveryPelvisDrop <= -0.04, `${actorId} recovery sinks the body (${entry.recoveryPelvisDrop})`);
    if (kind === 'suppression-rifle-burst-v1') {
      assert.ok(entry.strikeChest <= -8, `${actorId} rifle burst rocks the body back (${entry.strikeChest.toFixed(1)})`);
    } else {
      assert.ok(entry.strikeChest >= 28, `${actorId} strike commits the chest forward (${entry.strikeChest.toFixed(1)})`);
      assert.ok(entry.strikePelvisForward >= 0.08, `${actorId} strike lunges forward (${entry.strikePelvisForward})`);
    }
  }
});

test('all nineteen frames per role are pairwise distinct and unknown profiles fail closed', () => {
  const report = runPoseModule([
    'out = {"duplicates": {}, "errors": {}}',
    'for actor_id, kind, damage, stoop in profiles:',
    '    seen = {}',
    '    dupes = []',
    '    for state, count in CLIPS.items():',
    '        for frame in range(count):',
    '            key = json.dumps(pose(kind, damage, state, frame, stoop), sort_keys=True)',
    "            if key in seen: dupes.append([seen[key], f'{state}/{frame}'])",
    "            seen[key] = f'{state}/{frame}'",
    '    out["duplicates"][actor_id] = dupes',
    'for label, args in {',
    "    'profile': ('nope-v9', 'shared-impact-v1', 'tell', 0, 2, 0.1),",
    "    'damage': ('shared-roster-v1', 'nope-v9', 'hit', 0, 2, 0.1),",
    "    'state': ('shared-roster-v1', 'shared-impact-v1', 'dance', 0, 2, 0.1),",
    '}.items():',
    '    try:',
    '        poses.role_pose(*args)',
    "        out['errors'][label] = None",
    '    except RuntimeError as error:',
    "        out['errors'][label] = str(error)",
    'print(json.dumps(out))',
  ].join('\n'));
  for (const [actorId] of ORDINARY_PROFILES) {
    assert.deepEqual(report.duplicates[actorId], [], `${actorId} has duplicate authored frames`);
  }
  assert.match(report.errors.profile, /Unknown enemy animation profile/);
  assert.match(report.errors.damage, /Unknown enemy damage response/);
  assert.match(report.errors.state, /Unknown enemy visual state/);
});

test('the boss variant damps limb excursion and lunge so its atlas stays inside the byte cap', () => {
  const report = runPoseModule([
    'out = {}',
    "for state, frame in (('tell', 0), ('tell', 1), ('attack', 0), ('attack', 1), ('attack', 2)):",
    "    ordinary = pose('shared-roster-v1', 'shared-impact-v1', state, frame, 0.1)",
    "    boss = pose('shared-roster-v1', 'shared-impact-v1', state, frame, 0.1, boss=True)",
    "    out[f'{state}/{frame}'] = {",
    "        'ordinaryArms': arm_excursion(ordinary), 'bossArms': arm_excursion(boss),",
    "        'ordinaryLunge': sum(abs(v) for v in loc(ordinary, 'pelvis')), 'bossLunge': sum(abs(v) for v in loc(boss, 'pelvis')),",
    '    }',
    "idle = pose('shared-roster-v1', 'shared-impact-v1', 'idle', 0, 0.1, boss=True)",
    "out['idleUnchanged'] = idle == pose('shared-roster-v1', 'shared-impact-v1', 'idle', 0, 0.1)",
    'print(json.dumps(out))',
  ].join('\n'));
  for (const [key, entry] of Object.entries(report)) {
    if (key === 'idleUnchanged') continue;
    assert.ok(entry.bossArms <= entry.ordinaryArms * 0.72, `${key} boss arm excursion ${entry.bossArms.toFixed(1)} vs ${entry.ordinaryArms.toFixed(1)}`);
    assert.ok(entry.bossLunge <= entry.ordinaryLunge * 0.72 + 1e-9, `${key} boss lunge ${entry.bossLunge} vs ${entry.ordinaryLunge}`);
  }
  assert.equal(report.idleUnchanged, true, 'the boss damping touches only the tell and attack beats');
});

test('idle, run, hit and death poses were ported verbatim from the Cycle 073 exporter', () => {
  // Spot values from the Cycle 073 inline table, so the re-render changes only
  // the tell/attack beats and the accents by intent.
  const report = runPoseModule([
    "idle0 = pose('undead-straight-lunge-v1', 'snapback-stumble-v1', 'idle', 0, 0.22)",
    "death3 = pose('undead-straight-lunge-v1', 'snapback-stumble-v1', 'death', 3, 0.22)",
    "hit0 = pose('undead-shoulder-charge-v1', 'armored-shoulder-absorb-v1', 'hit', 0, 0.14)",
    "run1 = pose('forkrunner-quick-fork-slash-v1', 'crossed-fork-guard-break-v1', 'run', 1, 0.05)",
    'print(json.dumps({',
    "  'idleChest': rot(idle0, 'chest')[0], 'idleArm': rot(idle0, 'upper_arm.L')[0], 'idlePelvisZ': loc(idle0, 'pelvis')[2],",
    "  'deathChest': rot(death3, 'chest')[0], 'deathPelvisZ': loc(death3, 'pelvis')[2], 'deathPelvisRot': rot(death3, 'pelvis')[0],",
    "  'hitChestY': rot(hit0, 'chest')[1], 'hitPelvisZ': loc(hit0, 'pelvis')[2],",
    "  'runThighL': rot(run1, 'thigh.L')[0],",
    '}))',
  ].join('\n'));
  assert.ok(Math.abs(report.idleChest - (10 * 0.22 + 1.6)) < 1e-9);
  assert.equal(report.idleArm, -8);
  assert.ok(Math.abs(report.idlePelvisZ - 0.012) < 1e-9);
  assert.ok(Math.abs(report.deathChest - (10 * 0.22 + 78)) < 1e-9);
  assert.ok(Math.abs(report.deathPelvisZ - -0.42) < 1e-9);
  assert.equal(report.deathPelvisRot, 56);
  // armored-shoulder-absorb-v1 frame 0: chest Y = -12 * sign with sign -1, so +12.
  assert.equal(report.hitChestY, 12);
  assert.ok(Math.abs(report.hitPelvisZ - -0.065) < 1e-9);
  assert.ok(Math.abs(report.runThighL - 38 * Math.sin((2 * Math.PI) / 6)) < 1e-6);
});
