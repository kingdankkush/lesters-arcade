# HMH AAA Continuous Improvement Cycle 029

Date: 2026-07-29 PDT
Status: `LOCAL CERTIFIED · RUNTIME/ART COMMIT PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `d5bfd9175f936c5708d46c05f3aeaa88bde768a6` — Cycle 028 documentation closeout

## Bounded slice

Implement Lilly's reference-faithful `lilly-reference-combat-v1` Blender model without changing simulation, collision, damage, movement, AI, progression, replay, save, bridge, wallet, or settlement authority.

This cycle does not combine the Lilly model with Lit Commando, Lit Valkyrie, enemy hitboxes, global actor scale, world layout, weapon balance, progression, or portal redesign. Those remain separate measured cycles.

## RED

`tests/hmh-reboot-reference-character-models.test.mjs` was extended before implementation.

The new Cycle 029 contract required:

- `implementationStatus: cycle-029-implemented`;
- fail-closed `reference-lilly-combat-v1` detail kit;
- at least 45 declared authored parts;
- the existing minimum of nine rigged hair locks;
- an explicit `add_lilly_reference_details()` builder;
- minimum-part and minimum-lock enforcement.

Initial result:

- tests: `5`;
- passing: `4`;
- failing: `1`;
- failure: Lilly still reported `planned-next-bounded-model-cycle`.

## GREEN implementation

### Reference contract

Updated `apps/hmh-reboot/assets/source/blender/hmh-reference-character-models.json`:

- Lilly is now `cycle-029-implemented`;
- detail kit is `reference-lilly-combat-v1`;
- minimum authored reference parts is `52`;
- long layered wavy teal hair still requires at least nine rigged locks;
- runtime authority remains `projection-only`;
- gameplay body remains `human-medium-collision-v1`.

### Model rebuild

Replaced the generic five-block Lilly hair/temple treatment with a fail-closed reference kit containing `58` inspected authored parts and `12` separated hair-lock groups.

The rebuilt model adds:

- recognizable feminine face with separate eye whites, teal-green pupils, brows, nose and lips;
- round gold-rimmed glasses with teal lenses and a bridge;
- twelve separated crown, side and back hair masses reaching the mid-back silhouette;
- black/teal cropped tactical jacket panels;
- teal lapels and gold piping around the jacket, collar and shoulders;
- teal shoulder patch with a gold `L` mark;
- fingerless tactical glove overlays;
- teal cargo thighs and dark cargo pouches;
- dark knee guards;
- gold-edged grounded combat-boot soles;
- utility belt, four pouches and a gold buckle with a teal `L` mark.

Pinned Blender `5.1.2` source inspection reported:

- authored reference parts: `58`;
- rigged hair locks: `12`;
- armature bones: `14`;
- `weapon_socket`: present;
- external dependencies: `0`.

### Deterministic generated assets

The production-hero pipeline rebuilt its shared four-hero scene twice and regenerated:

- four hero atlases;
- four metadata families;
- four contact sheets;
- four metrics reports;
- the four-hero selector atlas, provenance and browser module.

For every hero:

- frames: `648`;
- unique animated frames: `640`;
- empty frames: `0`;
- transparent-corner failures: `0`;
- decoded-pixel reproducibility: `0 / 0 / 0` changed visible pixels, max channel delta and total channel delta.

Lilly atlas:

- dimensions: `2048 × 2048`;
- bytes: `3,076,548`;
- SHA-256: `34774dc4fa55a549b23adfc15c13104e357a960f3255417b84b816e5e80b6eb3`.

Four-hero aggregate:

- bytes: `11,653,477 / 12,582,912`;
- remaining headroom: `929,435` bytes.

## Visual review

### Native contact sheet

Full-resolution review covered south, south-east, east, north-east, north, north-west, west and south-west across idle/aim, all six run frames, pistol fire, hurt, dash, melee, grenade and death samples.

Accepted findings:

- Lilly now reads as a distinct human woman rather than a blank armored mannequin;
- teal eyes and round glasses are visible in front and three-quarter views;
- separated hair masses create a materially longer, fuller silhouette in side and rear views;
- hair remains clear enough of the front weapon line and shoulders to preserve combat readability;
- teal cargo legs, knee protection, gold piping and boot edges survive the target camera;
- no blocker-level body, weapon, hair or glasses clipping was found;
- no robot, mech, abstract, animal or vehicle proxy is present.

The current fixed rig keeps hair attached to the head. Secondary hair motion remains a later projection-only animation cycle.

### Live desktop/mobile

`npm run smoke:hmh:production-hero:lilly` passed:

- desktop and `390 × 844` mobile;
- exact actor: `lilly`;
- source: `production-blender-atlas-v1`;
- layers: shadow, lower body, torso/head and weapon;
- all six lower-body run frames observed;
- independent east torso aim during south locomotion observed;
- all three pistol-fire frames observed;
- four canonical mobile controls;
- atlas JSON and PNG returned HTTP `200`;
- console/page/request errors: `0`.

## Certification

- Focused model/atlas/selector tests: `24/24`.
- Syntax: `332` JavaScript modules / `49` Python scripts.
- Release ledger: `1,778` total / `1,726` passing / `52` accepted legacy failures / `0` unexpected.
- Build: PASS.
- HMH bundle: `1,021,358 / 1,050,000` bytes.
- Production asset QA: PASS.
- Four-hero atlases: `11,653,477 / 12,582,912` bytes.
- Visual regression: `8/8` unchanged; maximum mean delta `0.059`.
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

Implement Lit Commando's `lit-commando-rambo-v1` reference model:

- visible human male face and square jaw;
- dark hair and red combat headband with two tails;
- olive sleeveless combat shirt and bare muscular arms;
- cross-body webbing/ammunition, utility belt and practical pouches;
- dark cargo trousers, knife sheath and heavy boots;
- no sealed helmet, mascot sphere, glasses, teal hair, robot or mech treatment;
- preserve the shared rig, atlas layers, frame contracts and projection-only authority.

After Lit Commando: Lit Valkyrie, measured actor-scale parity, then the separate enemy-hurtbox generosity cycle. Website and broader world/combat/progression work remain separately ranked so they do not contaminate the character-model candidate.
