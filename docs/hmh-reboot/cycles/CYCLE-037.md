# HMH AAA Continuous Improvement Cycle 037

Date: `2026-07-31`
Status: `LOCAL GATES PASSED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `8fae2b47` (Cycle 036 published handoff; production `802e6cd1`)

## Scope

First execution cycle of the Cycle 036 handoff program. One coherent packet:

1. **Priority A vertical slice** — Lit Valkyrie (hero) + Whale Enforcer
   (ordinary enemy) readability, plus selector regeneration.
2. **Priority E** — exactly two deterministic upgrade choices per level-up.
3. **Priority D1** — pistol always-owned with unlimited reserve; every other
   weapon a true pickup with authored finite reserve ammunition.

Priorities H (world props, terrain blending), B, C, F, G, I, J, K, L and the
two new pickups (Hash Rail, Lightning Ledger) are **not** in this packet.

## Priority A: audit and slice selection

Full-resolution audit of all four heroes and the four ordinary enemies not
covered by the Cycle 035 wave:

| Actor | Verdict |
| --- | --- |
| Lester | Mid: face reads south; `L` logo and scarf weak |
| Lilly | Mid: hair layered; face/glasses weak |
| Lit Commando | Best: headband, bare arms, olive kit all read |
| **Lit Valkyrie** | **Worst hero**: hair one washed-out mass, face invisible in all 8 directions, no mint identification visible |
| Bagholder Rusher | Weak but distinct |
| Forkrunner | Crude but distinct claws |
| Gas Bomber | Backpack reads; head is a blob |
| **Whale Enforcer** | **Worst enemy**: the heavy reads as stacked cardboard boxes |

### Root cause: value contrast, not missing geometry

The Valkyrie source already carried a face (eye whites, mint irises, pupils,
brows, nose, mouth), nine braid groups and a harness. It failed because the
palette put hair (`#e4ddc5`), hair shadow (`#aaa58f`), skin (`#d2a083`) and eye
whites inside one narrow lightness band — and the brows were drawn in the pale
hair-shadow tone. Under the Workbench/AgX policy the whole head collapsed into
a cream blob at 160px.

Changes (all repository-owned source; projection-only):

- hair shadow dropped a full value step (`#78715a`); dedicated dark brow
  material (`#3c382b`); shadow under-cap and parting line so the hair mass has
  structure; eyes ~15% larger; mint emission raised (0.10→0.30) and cheek marks
  enlarged.

The Whale Enforcer likewise had a detail kit (skull fracture, teeth, plates,
bracers) buried by palette: two near-identical browns and oversized flat gold
plates. Changes: primary darkened `#35290f`, secondary lightened `#7d6534`,
undead skin brightened `#7fb086`; added rounded trap slabs (hunched-bruiser
mass), exposed undead hands below the knuckle plates, dark trim between the
chest plates, waist band + buckle, second wound. Render scale untouched.

## Priority E: two-choice level-ups

`resolveChoices` sliced the deterministic ordering to three; it now slices to
two. Same seed, level, ranks and selection sequence produce the same ordered
pair. Consumers updated: progression UI adapter test, cockpit smoke (2 choices,
2 detail panels), release certification (`choiceCount` 3→2).

New `tests/hmh-reboot-two-choice-levelups.test.mjs` (5 tests, RED-first):
exactly two distinct catalog choices; deterministic pair across identical runs;
seed-driven variation; only offered choices selectable; repeatable mastery
tails keep the pair full when the core catalog is maxed.

## Priority D1: weapon ownership and finite reserve

- `HMH_WEAPON_DEFINITIONS` gains `pickupReserveAmmo`: pistol `null`
  (unlimited), shotgun `12`, machine gun `240`, launcher `8`.
- A fresh loadout owns only the pistol (plus whatever `activeWeaponId` a
  harness passes explicitly; the runtime passes the pistol). Owning a finite
  weapon implies carrying its authored reserve; unowned pickups hold zero.
- New `grantWeaponPickup`: ownership + loaded clip + authored reserve, repeat
  pickups bounded at 2× authored. Weapon caches now call this instead of the
  old infinite refill.
- Reload completion draws from finite reserve; a reload cannot start with an
  empty reserve, so an exhausted pickup reads `EMPTY` while the pistol remains
  the fallback. `selectWeapon`, the tick's weapon-next cycle, digit selection
  and the refill-select path all refuse unowned weapons.
- `getWeaponReadabilityStatus` now exposes `owned` and `reserveAmmo`
  (projection-only; HUD label format unchanged this cycle).
- Ammo refills service owned weapons only and never grant ownership.
- New evidence-only `weaponPilot=1` (gated behind `evidenceSafe=1`, matching
  the established pilot pattern) pre-grants the arsenal so combat certification
  can exercise switching and reload without cache traversal. A real run starts
  pistol-only; the collectible smoke covers the true grant path end to end.

New `tests/hmh-reboot-weapon-ownership.test.mjs` (9 tests, RED-first).

**Gameplay note:** this intentionally changes run dynamics (pistol-first
economy) as specified by the handoff. Same-seed determinism is preserved;
results are not comparable with pre-037 runs.

## Test changes, each justified

- `hmh-reboot-weapon-system.test.mjs` — three tests updated to grant weapons
  before switching/refilling (ownership is the new contract); readability
  deep-equal gains the two new fields.
- `hmh-reboot-progression-ui-adapters.test.mjs` — three-choice assertions are
  now two-choice (Justin's explicit requirement).
- `hmh-reboot-cockpit-browser-smoke.mjs`, `hmh-reboot-release-browser-certification.mjs`
  — same contract change.
- `hmh-reboot-combat-browser-smoke.mjs` — evidence URLs add `weaponPilot=1`.

## The exact-byte roster gate was structurally flaky, and this cycle proves it

Re-rendering the roster failed reproducibility three times in a row — on a
**different frame each run**:

| Run | Unstable frame | Delta |
| --- | --- | --- |
| 1 | `whale-enforcer body tell south-west` | 5 subpixels, all ±1 LSB |
| 2 | `whale-enforcer body death south-west` | ±1 LSB |
| 3 | `gas-bomber body hit north` — **an actor this cycle never touched** | ±1 LSB |

The first two runs made my new whale geometry look causal (both smooth-sphere
silhouettes; I faceted them, following the props pipeline's own "faceted orb"
precedent, and those frames stabilised). Run 3 falsified that theory: the
jitter belongs to the renderer, not the geometry. Cycle 035's `.tmp` debug
directories (`cold-dither-spike`, A/B Workbench comparisons of the *same tell
frame*) show the previous agent fighting exactly this, and Cycle 026 hit the
identical class in the props pipeline and recorded "a small tolerance" as the
durable fix.

**Fix installed:** the roster comparison now accepts a drifted frame only when
every differing subpixel is within ±1 LSB and at most 8 subpixels differ in
that frame; metadata JSON must remain byte-exact; anything wider still fails
(real non-determinism changes hundreds of subpixels). When jitter is
tolerated, the FIRST render is blessed as the shipped artifact, so the output
remains a deterministic choice. The policy is recorded in the roster metrics
(`reproducibilityPolicy`) and pinned by `assets:qa:hmh-reboot`.

This is a release-harness change and is called out for review accordingly.
The props pipeline retains its exact gate (its energy nudge still holds);
migrating it to the same policy is recorded as follow-up debt.

## Deferred and recorded

- World prop kit and terrain blending (Priority H) — next cycle; design note
  for the fringe-strip approach is in the task list.
- Locomotion/attack/death animation improvement (A5–A6) — the A slice this
  cycle is model/material readability; animation is its own packet.
- Weapon-tree integration into run progression (E3), XP from Litecoin pickups
  and combos (E4) — not started.
- Reserve-ammo HUD display — status fields exist; HUD composition is a
  follow-up so the compact label contract stays stable this cycle.

## Renders

- Heroes: 4 actors × 648 frames, **0 changed pixels** across cold rebuilds;
  Valkyrie face/braid verified at 4× (mint eyes, brows, fringe, harness read).
- Selector turntable atlas regenerated from the improved hero sources
  (hash change vs HEAD verified — selection art cannot drift from gameplay art).
- Enemy roster: 7 actors, 1,368 frames, 0 duplicates; final verify consumed
  **zero** tolerance (`toleratedFrames: {}`). Whale inspected: hunched trap
  mass, sunken undead skull, exposed hands, segmented plates.

## Gates

| Gate | Result |
| --- | --- |
| `npm run check` | PASS — 337 JS modules + 49 Python scripts |
| `npm run test:release` | PASS — `1813 total / 1761 passing / 52 accepted legacy / 0 unexpected` (+14 vs 036) |
| `npm run build` | PASS — bundle 1000.9 KB (~25 KB headroom) |
| `assets:hmh:production-hero-pilot` | PASS — exact (0 pixels) |
| `assets:hmh:enemy-roster:verify` | PASS — under the new policy, zero tolerance consumed |
| `build:hmh:hero-selector` | rebuilt from improved heroes |
| `npm run assets:qa:hmh-reboot` | PASS — pins the reproducibility policy |
| `npm run visual:reboot` | PASS — 8/8 unchanged |
| `npm run certify:hmh:browser` | PASS — five profiles, 2-choice + weaponPilot |
| `npm run smoke:hmh:mobile-controls` | PASS — 4/4 devices |
| combat / cockpit / collectible smokes | PASS — collectible smoke proves the real (non-pilot) grant path: auto-miner cache → granted, ammo 120 |
| `npm run smoke:hmh:performance` | PASS — p95 7 ms / 7 ms, unchanged |
| `design:security-audit` / `design:web3-audit` | PASS — 5/5, 9/9 |
| `design:third-party-security` | PASS — 3/3 |
| `repo:health:strict`, `repo:cdn-gate`, `docs:links` | PASS |

Evidence server on `127.0.0.1:8791` started for certification and stopped
afterward, per the handoff.

## Independent review

Adversarial exact-index review of staged packet
`1423ef68d187cbee67cb1e1dec5c0b803ed2eee3f3d770ff3d8a57c2fbffe08d`:
verdict **BLOCK**, two findings, both fixed and re-verified:

1. **Release-harness (HIGH):** when the tolerance blessed the first render,
   the metrics byte ledger still described the discarded second pass, so the
   first genuinely tolerated run would fail `assets:qa` — defeating the
   policy's purpose. Fixed: on restore, raw frames are restored alongside the
   artifacts and the ledger is re-stat'ed from what actually ships.
2. **UI (MEDIUM):** the desktop level-up grid still declared three columns, so
   two choices rendered beside a permanently empty third. Fixed to two.

The review also verified: the tolerance chain cannot pass real geometric or
pose drift (frame rects and `opaquePixels` live in the byte-exact JSON);
`reproducibleVerified` cannot report true after a raise; shipped PNG and JSON
always come from the same pass; no path fires or selects an unowned weapon;
reserve cannot go negative; `weaponPilot` is unreachable from portal-mounted
sessions (fixed iframe src, no query params); enemy scales 0.75/0.86 and all
gameplay bounds untouched; every ledger number re-executed and confirmed.
Noted as unverifiable offline: the three-run flake table itself (requires
renders). Post-fix delta re-gated: `check`, `assets:qa`, cockpit smoke and
five-profile certification all pass.

## Deployment state

Not pushed at ledger-write time. Push to the continuation branch is explicitly
approved for this session; production and rollback remain the Cycle 036
identities until a candidate is separately approved for promotion.
