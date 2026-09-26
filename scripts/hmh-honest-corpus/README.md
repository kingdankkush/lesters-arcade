# HMH real-child honest corpus

Real headless runs of the **unmodified** Hard Money Heroes child
(`apps/hmh-reboot/src/main.mjs`) under Ranked identities, verified as Ranked
verifies them, and condensed into a committed corpus that the verifier tests
replay. It exists so that a verifier rule is never added on the strength of a
model alone: `tests/fixtures/ranked/hmh-honest-corpus.mjs` is a **scripted
model** of honest play (combat is scheduled, not simulated); every summary
here came out of the child's own simulation, accumulator and progression.

## What runs

- `child-driver.mjs` boots the child in Node against `dom-env.mjs` (browser
  globals; virtual clock, one 60 Hz frame per driven frame) and
  `pixi-stub.mjs` (a no-op display tree; rendering is projection-only), acts as
  the parent over `hmh-bridge/v1` (`portal:connect`, `portal:init` with a
  Ranked session), and drives one frame at a time with a virtual gamepad.
  Every message the child posts is validated with `validateChildMessage`.
- `register-hooks.mjs` redirects `pixi.js` to the stub and wraps a few of
  `main.mjs`'s imports with the read-only spies of `spies/`, which re-export
  the real module and only remember the state object a factory returns, so a
  pilot can see what a player sees. Nothing writes simulation state.
- `pilot.mjs` holds the honest pilots (`STYLE_DEFAULTS`): suicide, kamikaze,
  camper, idle, brawler, grenadier, hunter, explorer, turtle and greedy. A
  pilot reads visible state (positions, pickups, sites, its own health,
  charges and weapons) and answers with a gamepad: left stick move, right
  stick aim, LB grenade, RB weapon-next. Firing, melee and dodges stay
  automatic, as in the shipped input model.
- `plan.mjs` is the 68-row plan (style x entry x tick cap) and each row's
  identity: a seed ticket issued with the **public fixture secret** of
  `tests/fixtures/ranked/build-fixtures.mjs`, its salt searched until the seed
  lands on the planned level entry. The seed binds the build hash, so every
  child release plays fresh seeds from the same plan. `SAMPLE_LABELS` is the
  twelve-run sample (every style, entry and hero) that proves the harness on a
  new child.
- `identity.mjs` derives the build hash the portal would send for this
  checkout: `site-<SITE_VERSION>:game-<GAME_VERSION>:cabinet-<HMH_CABINET_VERSION>`.
- `verify.mjs` verifies a run as Ranked would: `verifyRankedRun` on a full
  §5.1 body (ticket, identity, a session envelope from the child's own run
  events) and `validateRebootRunPlausibility` on the summary, plus how close
  the run came to every v6 rule (`margins`).
- `corpus.mjs` condenses a batch into the committed corpus format.

## Commands

```bash
node scripts/hmh-honest-corpus/batch.mjs plan
node scripts/hmh-honest-corpus/batch.mjs run --sample --concurrency=4     # the twelve-run sample
node scripts/hmh-honest-corpus/batch.mjs run --only=r08-brawler-relay-3000
node scripts/hmh-honest-corpus/batch.mjs run                              # all 68 rows (about 25 min at 6)
node scripts/hmh-honest-corpus/batch.mjs verify                           # runs/results.json; exit 1 on any reject
node scripts/hmh-honest-corpus/batch.mjs report
node scripts/hmh-honest-corpus/batch.mjs export --commit=$(git rev-parse --short HEAD) \
  --out=tests/fixtures/hmh-honest-corpus/real-child-<release>.json [--merge]
node scripts/hmh-honest-corpus/smoke.mjs 600                              # boot only
```

Runs are headless Node processes; they need no browser and no heavy lock. Keep
`--concurrency` at 6 or below (each child process may take up to 3 GB). A run
takes 40 to 240 s of wall time; the batch folder (`runs/`, ignored by git)
keeps one `.identity.json` and one `.run.json` per label, with the summary,
every bridge message, the run events, the upgrade log, the pilot statistics
and any error the child threw.

`--runs=<dir>` points every command at another batch folder (for instance a
batch captured elsewhere). `export` refuses a batch whose summaries carry more
than one build hash: one corpus file holds one child release.

## The committed corpus

`tests/fixtures/hmh-honest-corpus/real-child-<release>.json`, one file per
child release (`hmh-real-child-corpus-v1`): the child's release, cabinet,
source commit and build hash, then one line per run with the plan facts
(label, style, entry, hero, tick cap, seed), the final tick, how the run ended
(`death`, or `death-after-surrender` once the pilot reached its tick cap and
walked into the crowd), the child's error count and the run summary exactly as
the child emitted it.

`tests/server-verify-hmh-real-corpus.test.mjs` pins each file's run count and
summary digest and replays every summary through `validateRunSummaryPayload`
and `validateRebootRunPlausibility`: no run may be rejected, and each run must
carry exactly the flags listed for it (soft near-ceiling flags on skilled
honest runs are expected; a consistency reject never is).
`tests/server-verify-hmh-real-corpus-harness.test.mjs` checks the plan, the
identities (the 1.8.3 seeds are this plan's under the 1.8.3 build hash) and
one headless boot of this checkout's child.

## Adding runs

1. Run a batch (`run --sample`, `--only=`, or the whole plan).
2. `verify` and read the report: every run must verify `ok` or `flagged`
   with a listed soft flag. A `rejected` honest run is a verifier bug, not a
   corpus problem.
3. `export --merge` into the file for this child's release, with the commit
   the child source is at.
4. Re-pin the count and digest in the corpus test and list any new flag.

A new verifier reject needs honest coverage of the play it bounds before it
lands. When the corpora lack it (melee-only play, Forked Standard kills, tiny
runs), write a pilot style for it in `pilot.mjs`, add plan rows, and commit the
runs here first.
