# Hard Money Heroes Cycle 030 Hermes continuation handoff

Date: 2026-07-29 PDT
Repository: `C:\Users\just_\Desktop\Projects\Web3 Gaming\Lesters-Arcade`
Continuation branch: `reboot/hmh-aaa-continuous`
Certified Cycle 029 Lilly source: `3784080bf0aa79cad7cbe1c7b13a9b6f9c094109`
Cycle 029 exact commit patch SHA-256: `9c7d2acbc9f6b5d3e2390f94b5ccc3561a9dab7d959e390d927f5e508e496132`
Certified Cycle 030 Lit Commando source: `d5a860d491739184a35e61fe9fd5f88c1c65743b`
Cycle 030 exact commit patch SHA-256: `38d5588b47d24067167c0749b7c36753bd350491a8aa7a10407d92161ea34950`
Production source remains Cycle 021: `a81f1c8f830f3339ebb568de166c108e58f695d3`
Settlement: `SETTLEMENT_LIVE=false`

> This is the current continuation brief. Cycles 029 and 030 are certified local continuation source, not production. The branch is intentionally ahead of its remote. Verify live Git before editing.

## Standing mandate

Continually improve the authored game world, level layouts and assets, human heroes, zombie enemies, movement, combat, weapon identity and balance, leveling/progression, portal presentation, website accessibility, responsiveness, performance and security.

Take one bounded, test-first slice at a time. Do not combine unrelated world, gameplay, asset, progression and website changes into one candidate.

## Mandatory read order

1. This file.
2. `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`.
3. `docs/hmh-reboot/cycles/CYCLE-030.md`.
4. `docs/hmh-reboot/cycles/CYCLE-029.md`.
5. `docs/handoffs/2026-07-28-hmh-cycle-028-claude-handoff.md`.
6. `.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md`.
7. `docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md`.
8. Latest release/preview ledgers and `docs/hmh-reboot/COMPATIBILITY.json`.

`AGENTS.md` remains repository authority.

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

Expected after this documentation closeout commit:

- branch `reboot/hmh-aaa-continuous` is ahead of its upstream by local certified commits;
- Cycle 029 source `3784080b...` and Cycle 030 source `d5a860d4...` remain in linear history;
- production remains Cycle 021;
- Web3 audit remains `9/9 PASS`;
- live readiness remains honestly `PARTIAL 3/4`;
- `SETTLEMENT_LIVE=false`.

Do not push, merge, deploy or promote without explicit approval.

## What Cycle 029 completed

Ledger: `docs/hmh-reboot/cycles/CYCLE-029.md`

Lilly now consumes fail-closed `lilly-tactical-veteran-v1` authored geometry:

- recognizable feminine human face;
- teal-green eyes;
- round teal-lens glasses;
- twelve separated long wavy teal locks;
- cropped black/teal tactical jacket with gold piping;
- cargo trousers, pouches, knee pads and black/gold boots;
- shared rig, 14 bones and projection-only gameplay parity;
- 58 inspected authored parts;
- zero external dependencies.

Exact-index local review certified deterministic/gameplay correctness, visual/performance evidence and security/release scope against patch digest `9c7d2acb...e496132` before the local commit.

## What Cycle 030 completed

Ledger: `docs/hmh-reboot/cycles/CYCLE-030.md`

Lit Commando now consumes fail-closed `lit-commando-rambo-v1` authored geometry. The prior metallic helmet/visor/armor-sphere treatment was removed.

The rebuilt model has:

- visible square-jawed human male face with scar;
- layered dark hair;
- red combat headband with two directional tails;
- olive sleeveless field shirt;
- bare muscular shoulders and arms;
- cross-body webbing, six ammunition blocks and dog tags;
- belt, buckle, four pouches and dark cargo gear;
- knee protection, heavy boots and right-thigh knife sheath;
- shared rig, 14 bones and projection-only gameplay parity;
- 61 inspected authored parts;
- zero external dependencies.

Full-resolution contact-sheet review covered all eight directions and sampled locomotion, fire, hurt, dash, melee, grenade and death states. No blocker clipping, identity drift or animation-readability failure remained.

Exact-index local review certified deterministic/gameplay correctness, visual/performance evidence and security/release scope against patch digest `38d5588b...ea34950` before the local commit.

## Current measured rails

Character-pipeline evidence after Cycle 030:

- each hero: 648 atlas frames;
- each hero: 640 unique animated frames;
- empty frames: 0;
- transparent-corner failures: 0;
- decoded-pixel reproducibility: 0 / 0 / 0;
- four-hero aggregate: `11,983,865 / 12,582,912` bytes;
- remaining atlas headroom: `599,047` bytes;
- selector atlas: `361,886 / 524,288` bytes;
- runtime authority: `projection-only`;
- gameplay body: `human-medium-collision-v1`.

Certification after Cycle 030:

- focused reference/model/atlas/selector tests: `25/25`;
- syntax: `332` JavaScript modules / `49` Python scripts;
- release ledger: `1,779` total / `1,727` passing / `52` accepted legacy failures / `0` unexpected;
- build: PASS;
- HMH bundle: `1,021,358 / 1,050,000` bytes;
- production asset QA: PASS;
- visual regression: `8/8` unchanged;
- desktop/mobile performance p95: `7 ms`;
- five-profile Chrome certification: PASS;
- combat, cockpit, portal E2E and mobile-control browser gates: PASS;
- network audit: four scenarios, zero HTTP/request/console/page failures;
- security: `5/5`, findings `0`;
- third-party sandbox: `3/3`;
- Web3 settlement audit: `9/9`;
- strict repository health, CDN gate, documentation links and diff checks: PASS.

The browser and asset commands regenerated security/CDN reports during certification. Those unrelated command-generated report diffs were restored before each exact-index review.

## Immediate next bounded wave: Cycle 031

Implement Lit Valkyrie's reference-faithful `lit-valkyrie-rambo-v1` model before moving into gameplay or website changes.

Acceptance brief:

- athletic adult human female commando;
- visible feminine face, not a helmet or mech;
- long platinum-blonde braid/high ponytail with at least seven separated lock groups;
- olive fitted sleeveless tactical top;
- compact black/olive cross harness;
- fingerless gloves and thigh holster;
- charcoal cargo trousers, knee pads and combat boots;
- restrained mint/cyan identification accents;
- no Lilly glasses, teal hair, sealed helmet, robot or mascot-sphere treatment;
- preserve shared rig, atlas layers, 648-frame contract and projection-only authority;
- remain inside the four-hero 12 MiB aggregate asset budget.

Required sequence:

1. Inspect current Lit Valkyrie contact sheet and generated metrics.
2. Add a RED fail-closed manifest/generator contract.
3. Implement the smallest coherent authored detail kit.
4. Rebuild the deterministic Blender scene, all four hero atlases and selector atlas.
5. Inspect the full-resolution contact sheet across every direction and sampled action.
6. Run focused tests, asset QA, visual/performance/browser/network/security/Web3/repository/documentation gates.
7. Restore unrelated generated report churn.
8. Freeze the literal staged binary diff by SHA-256.
9. Obtain independent exact-index blocker review.
10. Commit locally only when blocker-free.

## Prioritized waves after Cycle 031

Keep these separate and test-first:

1. **Actor scale parity:** measure heroes and ordinary human/zombie enemies at the runtime camera; correct visual scale without changing collision authority accidentally.
2. **Enemy hurtbox generosity:** seed and measure projectile-vs-zombie contact; increase forgiving hurt capsules independently from art size.
3. **Zombie family quality:** rebuild two enemy families per cycle with human/zombie anatomy, readable anticipation/contact/recovery and performant atlases.
4. **Authored world/level pass:** reduce repeated procedural-feeling spaces; improve routes, landmarks, encounter arenas, interiors, elevation, terrain transitions, lighting and environmental storytelling.
5. **Movement/combat pass:** measure acceleration, deceleration, dash, collision, input buffering, camera response, token allocation, telegraphs, hit reactions and crowd readability.
6. **Weapons/progression pass:** measure DPS/TTK, ammunition/reload/heat, role separation, XP curves, unlock cadence and difficulty bands with deterministic simulations.
7. **Portal/website pass:** improve hero presentation, feature hierarchy, responsive/mobile layout, keyboard and screen-reader behavior, reduced motion, loading/performance, security and verified browser/network behavior.

Do not claim the broader program is complete after one wave.

## Pipeline traps

- The full production-hero generator renders every actor twice and takes roughly 13 minutes on this machine. Use a tracked background process with completion notification.
- The generator rewrites all four hero atlases because they share one Blender source. Stage the complete deterministic packet, not only the target actor.
- Review contact sheets at full resolution. Static tests cannot detect hair/face occlusion or identity drift.
- The valid smoke interfaces are `smoke:hmh:production-hero`, `smoke:hmh:production-hero:female`, `smoke:hmh:production-hero:lester` and `smoke:hmh:production-hero:lilly`. Do not invent actor-specific aliases.
- Serve from `apps/portal`, not `apps/portal/dist`.
- `npm run design:web3-live` is expected to report `PARTIAL 3/4`; do not misrepresent it as live settlement.
- `pnpm run build` is blocked by a parent user-level package-manager declaration; `npm run build` is the verified path.
- Preserve `SETTLEMENT_LIVE=false`.

## Production boundary

No push, merge, preview deployment, production deployment, asset upload, paid API call, wallet/signature request, transaction, contract action or settlement change occurred in Cycles 029 or 030.

Current production and rollback remain untouched. Any release, remote mutation or Web3 action requires explicit approval.
