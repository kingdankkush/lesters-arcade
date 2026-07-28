# Hard Money Heroes Cycle 028 Claude continuation handoff

Date: 2026-07-28 PDT
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Continuation branch: `reboot/hmh-aaa-continuous`
Certified Cycle 028 runtime/art source: `fe8153f08c42500a57cce96f907ce5c117f0f8bc`
Certified Cycle 028 commit patch SHA-256: `e7baade05a4f1876a8449ab3c82f3638670166e7a7526c83362c2bd14b6de6ca`
Production source: `a81f1c8f830f3339ebb568de166c108e58f695d3` (Cycle 021)
Production deployment: https://lesters-arcade-gsbj7uxer-justin-agent-projects.vercel.app
Settlement: `SETTLEMENT_LIVE=false`

> This is the current continuation brief. Cycle 028 is certified continuation source, not production. Verify live Git before editing because the documentation closeout commit containing this file should become branch HEAD after push.

## Standing mandate

Continually upgrade the game world, authored level design, level assets, playable characters, enemy models, movement, combat, weapon balance and leveling. Take one bounded, test-first slice per session.

The user has now made these actor requirements explicit:

- playable models must be detailed, reference-faithful 3D Blender models before atlas animation export;
- ordinary human/zombie enemies should use comparable model quality and apparent world size rather than reading as miniatures;
- enemy projectile hurtboxes should become more forgiving, but only in a separately measured deterministic gameplay cycle;
- Lester and Lilly are governed by supplied illustrated character sheets plus pixel/action sprites;
- Lit Commando and Lit Valkyrie should be distinct Rambo/army combat survivors;
- Lit Valkyrie is female and requires long hair.

Every session must preserve fixed-step simulation, parent/child authority and production safety, run the full gate battery, freeze the literal staged binary diff, and push only the continuation branch. Stop for explicit approval before any preview/production promotion or Web3 action.

## Mandatory read order

1. This file.
2. `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`.
3. `docs/handoffs/2026-07-28-hmh-cycle-027-claude-handoff.md`.
4. `docs/handoffs/2026-07-27-hmh-cycle-026-hermes-handoff.md`.
5. `docs/handoffs/2026-07-27-hmh-cycle-021-production-claude-handoff.md`.
6. `docs/handoffs/2026-07-25-hmh-art-pipeline-hermes-handoff.md`.
7. `.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md`.
8. `docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md`.
9. Latest cycle/release/preview ledgers and `docs/hmh-reboot/COMPATIBILITY.json`.

`AGENTS.md` carries repository policy and this read order.

## First action: read-only health check

```bash
cd '/c/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade'
git status --short --branch
git branch --show-current
git rev-parse HEAD
git rev-parse '@{u}'
git log --oneline -12
git grep -n 'SETTLEMENT_LIVE' -- ':!docs/**' ':!*.md'
npm run design:web3-audit
npm run design:web3-live
```

Expected after this handoff is pushed:

- branch `reboot/hmh-aaa-continuous` equals its upstream;
- runtime/art commit `fe8153f08c42500a57cce96f907ce5c117f0f8bc` is in linear history;
- production remains Cycle 021;
- Web3 audit 9/9 PASS;
- live readiness PARTIAL 3/4;
- `SETTLEMENT_LIVE=false`.

If any rail differs, investigate before new model work.

## What Cycle 028 shipped

Cycle ledger: `docs/hmh-reboot/cycles/CYCLE-028.md`

### User-reference analysis

The supplied binaries were analyzed but not copied into Git. Their durable interpretation is:

- `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`
- `apps/hmh-reboot/assets/source/blender/hmh-reference-character-models.json`

Interpretation rule:

- illustrated sheets own facial identity, head/hair treatment, body type and premium material finish;
- pixel/action sheets own combat outfit, gear placement, weapon handling and gameplay silhouette.

### Lester reference model

Implemented `lester-reference-combat-v1` as 48 inspected authored parts:

- enlarged cobalt spherical mascot shell;
- sphere-conforming multi-piece white Lester/Litecoin `L`;
- separate eyes, pupils, brows and smile;
- olive vest front/side panels and shoulder straps;
- cross-body webbing with eight brass rounds;
- belt, buckle and four pouches;
- tan cargo thighs and olive pockets;
- gloves, blue wrist wraps, knee guards and boot soles;
- blue scarf collar and two tails.

The first face pass caused white pieces to peek over the north/back silhouette. It was rejected and corrected by conforming the face pieces closer to the sphere before the final reproducible build.

### Four-hero derived model direction

#### Lester

Polished illustrated mascot head plus pixel combat body. Keep the spherical blue logo face, expressive eyes/smile, olive vest, bandolier, cargo gear, scarf and heavy boots.

#### Lilly

Illustrated face, teal-green eyes, round teal-lens glasses and long layered wavy teal hair, combined with the pixel sheet's black/teal/gold tactical jacket, cargo trousers, knee pads, pouches and combat boots. Do not use combat heels or a full-length formal coat.

#### Lit Commando

Visible human male face, dark hair, red headband/tails, olive sleeveless top, muscular bare arms, cross webbing/ammunition, utility belt, cargo trousers, knife sheath and boots. No sealed helmet, robot/mech head, mascot sphere, glasses or teal hair.

#### Lit Valkyrie

Visible human female face, long platinum braid/high ponytail, olive fitted sleeveless tactical top, cross harness, gloves, thigh holster, charcoal cargo trousers, knee pads and boots. No short helmet-like hair. She must remain distinct from Lilly.

### Pipeline and generated assets

Pinned Blender `5.1.2` rebuilt the shared production scene twice:

- four actors;
- 648 frames each;
- 2,592 total frames;
- four 2048×2048 atlases;
- 640 unique animated frames per actor;
- A/B premultiplied RGBA reproducibility `0 / 0 / 0` for every actor;
- no empty frames;
- existing 14-bone rig, layer order and `weapon_socket` preserved.

Because the production heroes share one Blender scene, all four atlas/JSON/contact-sheet/metrics families changed even though only Lester geometry is implemented. The hero selector PNG, JSON provenance and browser module were regenerated from the new pixels.

### Asset budgets

- Lester atlas: `3,227,618` bytes.
- Four-hero aggregate: `11,124,674 / 12,582,912` bytes.
- Lossless Pillow optimization was tested and did not reduce the atlas.
- Per-hero cap was measured and changed from 3 MiB to 3.25 MiB.
- The stricter 12 MiB four-hero aggregate cap remains unchanged.

### Browser rail repairs

- Production-hero mobile smoke now expects the canonical four child-owned controls, not the stale eight-control layout.
- The old Cycle 007 policy test now verifies a dated current HMH handoff instead of hardcoded Cycle 006/007 names.

## Cycle 028 certification

- Exact runtime/art commit: `fe8153f08c42500a57cce96f907ce5c117f0f8bc`.
- Exact binary commit patch SHA-256: `e7baade05a4f1876a8449ab3c82f3638670166e7a7526c83362c2bd14b6de6ca`.
- Focused frozen tests: 29/29.
- Release ledger: 1,777 total / 1,725 passing / 52 accepted legacy failures / 0 unexpected.
- Syntax: 332 JavaScript modules / 49 Python scripts.
- Visual regression: 8/8 unchanged; max mean delta 0.061.
- Lester production browser smoke: desktop and 390×844 mobile PASS.
- Six-frame run, independent torso aim and pistol-fire layers observed.
- Five-profile candidate browser matrix: PASS.
- Combat desktop/mobile/bridge: PASS.
- Cockpit, portal E2E and four-device mobile controls: PASS.
- Network: four scenarios, zero request/HTTP/console/page failures.
- Performance: desktop p95 7 ms; mobile p95 7 ms.
- Bundle: 1,021,358 / 1,050,000 bytes.
- Security: zero findings; third-party checks PASS.
- Asset QA: PASS under per-hero and aggregate budgets.
- Repository health, CDN and docs links: PASS.
- Exact architecture review reproduced the binary hash and returned no blockers/PASS.
- Principal exact-index review and frozen post-test hash: PASS.
- Two other delegated reviewers were not counted: one repeatedly omitted `--binary`; another provider stalled. Claude CLI was also not counted because its OAuth token returned 401 revoked. Do not reinterpret those failures as reviews.

No deployment, transaction, wallet/signature request, contract action or settlement change occurred.

## Highest-value next bounded slice: Lilly model

Implement `lilly-reference-combat-v1` test-first.

### Acceptance

1. Add an explicit fail-closed Lilly detail kit and minimum authored-part count.
2. Build a recognizable human face with teal-green eyes and round teal-lens glasses.
3. Replace five rectangular hair blocks with at least nine separated crown/side/back wavy teal locks.
4. Keep hair clear of shoulders and weapon stocks in front, side, back and diagonal frames.
5. Add a black/teal cropped tactical jacket with gold piping, `L` belt mark, cargo pouches, knee pads and black/gold lace-up boots.
6. Preserve 14 bones, `weapon_socket`, four atlas layers, 648 frames, clip cadence and projection-only authority.
7. Run the full four-hero reproducibility pipeline; all shared outputs may change.
8. Rebuild selector provenance.
9. Review native front/east/north/west comparisons and live desktop/mobile evidence.
10. Run the full gate battery and exact-index reviews.
11. Write `CYCLE-029.md`.

Do not combine Lilly with Commando, Valkyrie, enemy hitboxes or global actor-scale changes.

## Remaining model/gameplay sequence

1. Lilly reference model.
2. Lit Commando Rambo/army human rebuild.
3. Lit Valkyrie female commando with long platinum hair.
4. Measured hero/enemy projection-scale readability review so ordinary enemies do not read as miniatures.
5. Separate enemy-hurtbox generosity cycle.
6. Rebuild enemy families two at a time to hero-quality human/zombie standards.
7. Projection-only recoil, cloth/scarf/hair secondary motion and hit-reaction cycles.

## Planned enemy hurtbox cycle

Current regular-enemy projectile hurt capsule:

- radius `max(8, enemy.radius × 0.72)`;
- y-axis half-length `8`.

Proposed hypothesis:

- radius `max(10, enemy.radius × 0.90)`;
- y-axis half-length `10`;
- physical collision body unchanged.

Required proof:

- RED projectile/hurt-shape tests;
- seeded hit-rate comparison before/after;
- 60/30/20 schedule equivalence;
- replay hash stability;
- dense-crowd and cover behavior;
- desktop/mobile live shooting acceptance.

Do not change collision bodies, route clearance, movement spacing or AI as a shortcut.

## Full gate battery

Use one verified local listener and pin local origin:

```bash
cd '/c/Users/just_/Desktop/Projects/Web3 Gaming/Lesters-Arcade'
export HMH_REBOOT_ORIGIN='http://127.0.0.1:8791'

node --test tests/hmh-reboot-reference-character-models.test.mjs
npm run check
npm run test:release
npm run build
npm run visual:reboot
npm run smoke:hmh:production-hero:lester
npm run smoke:hmh:performance
npm run certify:hmh:browser
node scripts/hmh-reboot-combat-browser-smoke.mjs
npm run smoke:hmh:cockpit
npm run smoke:portal:e2e
npm run smoke:hmh:mobile-controls
npm run audit:hmh:network
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run assets:qa:hmh-reboot
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
git diff --check
```

For any production-hero geometry change:

```bash
npm run assets:hmh:production-hero-pilot
python scripts/build-hmh-reboot-hero-selector-atlas.py
```

The production-hero pipeline renders all four heroes twice and can take many minutes. Do not inspect or stage the tree while it temporarily removes/rebuilds outputs. Never run a second Blender job while the PID lock is active.

Restore only known generated security/CDN drift before staging. Never commit raw frames, `.blend1`, scratch montages, screenshots, caches or temporary optimized PNG experiments.

## Exact-index discipline

```bash
git diff --cached --check
git diff --cached --binary | sha256sum
test -z "$(git diff --name-only)"
```

Any staged correction requires a new binary hash and fresh exact review. A timeout, completion notification, malformed command, non-binary hash or hidden-reasoning/empty model response is not PASS.

## Authority invariants

Preserve:

- PixiJS `8.19.0`;
- fixed 60 Hz simulation and four catch-up steps;
- deterministic 60/30/20 partitions;
- canonical collision, damage, ground, replay, save and bridge authority;
- parent authority for wallets, profiles, sessions, leaderboards, completion and settlement;
- Free/Ranked isolation;
- human survivor/zombie actor canon;
- nonfatal art/audio fallback;
- Cycle 021 production and rollback until exact promotion approval;
- `SETTLEMENT_LIVE=false`.

## End-of-session handback

Every later cycle should provide the commit ID and exact patch hash, cycle ledger, RED/GREEN proof, Blender metrics, desktop/mobile visual findings, full gate results, exact reviewer verdicts, remote branch verification, explicit production/Web3 non-action, and one bounded next slice.
