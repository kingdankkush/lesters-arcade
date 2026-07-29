# HMH AAA Continuous Improvement Cycle 031

Date: 2026-07-29 PDT
Status: `LOCAL CERTIFIED · RUNTIME/ART COMMIT PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `68e73379106c6bf97ef50510c15a26312699db8b` — certified Cycle 030 handoff

## Bounded slice

Implement Lit Valkyrie's reference-faithful `lit-valkyrie-rambo-v1` Blender model without changing simulation, collision, damage, movement, AI, progression, replay, save, bridge, wallet, or settlement authority.

This cycle does not combine the Valkyrie model with actor-scale changes, enemy hurtboxes, world layout, weapon balance, progression, or portal redesign.

## RED

`tests/hmh-reboot-reference-character-models.test.mjs` was extended before implementation.

The Cycle 031 contract requires:

- `implementationStatus: cycle-031-implemented`;
- fail-closed `lit-valkyrie-rambo-v1` detail kit;
- at least `55` declared authored parts;
- at least `7` separately named hair-lock groups;
- an explicit `add_lit_valkyrie_reference_details()` builder;
- authored-part and hair-lock minimum enforcement.

Initial result:

- tests: `7`;
- passing: `6`;
- failing: `1`;
- failure: Lit Valkyrie still reported `planned-bounded-model-cycle`.

## GREEN implementation

### Reference contract

Updated `apps/hmh-reboot/assets/source/blender/hmh-reference-character-models.json`:

- Lit Valkyrie is now `cycle-031-implemented`;
- detail kit is `lit-valkyrie-rambo-v1`;
- minimum authored reference parts is `60`;
- minimum rigged hair locks remains `7`;
- runtime authority remains `projection-only`;
- gameplay body remains `human-medium-collision-v1`.

### Model rebuild

Replaced the short-haired armored mannequin treatment with a fail-closed athletic human field-commando kit containing `63` inspected authored parts.

The rebuilt model adds:

- visible human feminine face with separate eye whites, mint irises, pupils, brows, nose, mouth and restrained cheek marks;
- platinum crown, swept fringe, high ponytail root and tie;
- nine separately named, tapered platinum braid groups reaching the lower shoulder blades;
- bare athletic shoulders, upper arms and forearms bound to the existing arm bones;
- compact fingerless gloves and wrist identification accents;
- fitted olive sleeveless shirt with side panels, collar and hem;
- compact crossed black-olive harness, buckle and mint badge;
- charcoal cargo thighs and side pockets;
- utility belt, buckle and two compact pouches;
- olive knee protection and grounded combat-boot soles;
- right-thigh holster, two straps and visible steel grip.

Pinned Blender `5.1.2` source inspection reported:

- authored reference parts: `63`;
- separately named hair locks: `9`;
- armature bones: `14`;
- `weapon_socket`: present;
- external Blender libraries: `0`.

### Deterministic generated assets

The production-hero pipeline rebuilt its shared four-hero scene twice and regenerated all runtime atlases, metadata, contact sheets, metrics and selector assets.

For Lit Valkyrie:

- frames: `648`;
- unique animated frames: `640`;
- empty frames: `0`;
- transparent-corner failures: `0`;
- decoded-pixel reproducibility: `0 / 0 / 0` changed visible pixels, maximum channel delta and total channel delta;
- atlas dimensions: `2048 × 2048`;
- atlas bytes: `2,917,618`;
- atlas SHA-256: `23a8a8f6de7c16f2257e6fac302f21d0341afad013742a4da0bdde80c77d483e`;
- contact-sheet SHA-256: `e1373cbcda9312b7e9c208515e9be6e6a49096570c4d43197950585084ca12cd`;
- source `.blend` SHA-256: `4c5d7204af743a7d5ece6da5f718bd439e1bdcc214de3c30dceeeb02309e113b`.

Four-hero aggregate:

- bytes: `12,220,253 / 12,582,912`;
- remaining headroom: `362,659` bytes.

## Visual review

Full-resolution contact-sheet review covered all eight directions across idle/aim, six run frames, pistol fire, hurt, dash, melee, grenade and death samples.

Accepted findings:

- the character now reads as a stylized human female field commando rather than a teal armored mannequin;
- the visible face, pale crown and long single segmented braid establish a distinct head silhouette in front, profile, three-quarter and rear views;
- nine shrinking braid groups remain connected to the high ponytail and clear the weapon line across sampled actions;
- bare arms, compact olive top and cross harness replace broad robotic armor;
- the holster, cargo trousers, knee protection and boots remain legible at the target camera;
- mint accents identify the character without recreating Lilly's teal hair or glasses;
- pistol aim/fire, dash, melee, grenade and death samples retain readable anticipation and recovery silhouettes;
- no blocker-level detached hair, body/weapon clipping, broken anatomy or identity drift was found;
- no sealed helmet, robot, mech, mascot sphere, glasses or teal-hair treatment remains.

## Live verification

`npm run smoke:hmh:production-hero:female` passed:

- desktop and `390 × 844` mobile;
- exact actor: `lit-valkyrie`;
- source: `production-blender-atlas-v1`;
- layers: shadow, lower body, torso/head and weapon;
- all six lower-body run frames observed;
- independent torso aim during locomotion observed;
- all three pistol-fire frames observed;
- four canonical mobile controls;
- atlas JSON and PNG returned HTTP `200`;
- console/page/request errors: `0`.

## Certification

- Focused model/atlas/selector tests: `26/26`.
- Syntax: `332` JavaScript modules / `49` Python scripts.
- Release ledger: `1,780` total / `1,728` passing / `52` accepted legacy failures / `0` unexpected.
- Build: PASS.
- HMH bundle: `1,021,358 / 1,050,000` bytes.
- Production asset QA: PASS.
- Four-hero atlases: `12,220,253 / 12,582,912` bytes.
- Selector atlas: `361,147 / 524,288` bytes.
- Visual regression: `8/8` unchanged; maximum mean delta `0.035`.
- Performance: desktop p95 `7 ms`; mobile p95 `7 ms`.
- Five-profile Chrome matrix: PASS.
- Combat desktop/mobile/bridge: PASS.
- Cockpit desktop/tablet/mobile/landscape: PASS.
- Portal E2E implemented flows: PASS.
- Four-device mobile controls: PASS.
- Network audit: four scenarios; zero HTTP, request, console or page failures.
- Security: `5/5`; findings `0`.
- Third-party sandbox: `3/3` PASS.
- Web3 settlement audit: `9/9` PASS.
- Web3 live readiness: honestly `PARTIAL 3/4`.
- Strict repository health: PASS.
- CDN gate: PASS; no destructive action.
- Documentation links: PASS.
- `git diff --check`: PASS.

## Authority and release boundary

- PixiJS remains `8.19.0`.
- Fixed `60 Hz` simulation and maximum four catch-up steps remain unchanged.
- Parent/child, Free/Ranked, save, replay, bridge and settlement authority remain unchanged.
- `SETTLEMENT_LIVE=false`.
- No preview or production deployment occurred.
- No push, wallet/signature request, transaction, contract action or settlement change occurred.

## Next bounded slice

Measure ordinary hero/enemy visual-scale parity before changing any gameplay body:

- inventory current hero, ordinary-enemy and boss source heights, runtime atlas scales and observed screen-space bounds;
- define acceptable ordinary human/zombie parity bands at the desktop and mobile gameplay cameras;
- keep collision, hurt capsules, route spacing, AI and deterministic simulation unchanged;
- change projection scale only if measurements prove a visual mismatch;
- certify all actor directions/states, browser profiles, performance and exact-index authority independently.

After scale parity, run the separate deterministic enemy-hurt-capsule generosity cycle with seeded hit-rate and schedule-equivalence evidence. Enemy-family quality, animation readability, authored world, combat balance and progression cycles remain separately ranked.