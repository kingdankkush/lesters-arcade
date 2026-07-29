# HMH AAA Continuous Improvement Cycle 030

Date: 2026-07-29 PDT
Status: `LOCAL CERTIFIED · RUNTIME/ART COMMIT PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `3784080bf0aa79cad7cbe1c7b13a9b6f9c094109` — verified Cycle 029 Lilly rebuild

## Bounded slice

Implement Lit Commando's reference-faithful `lit-commando-rambo-v1` Blender model without changing simulation, collision, damage, movement, AI, progression, replay, save, bridge, wallet, or settlement authority.

This cycle does not combine the Commando model with Lit Valkyrie, enemy hitboxes, global actor scale, world layout, weapon balance, progression, or portal redesign.

## RED

`tests/hmh-reboot-reference-character-models.test.mjs` was extended before implementation.

The new Cycle 030 contract required:

- `implementationStatus: cycle-030-implemented`;
- fail-closed `lit-commando-rambo-v1` detail kit;
- at least 50 declared authored parts;
- an explicit `add_lit_commando_reference_details()` builder;
- minimum-part enforcement.

Initial result:

- tests: `6`;
- passing: `5`;
- failing: `1`;
- failure: Lit Commando still reported `planned-bounded-model-cycle`.

## GREEN implementation

### Reference contract

Updated `apps/hmh-reboot/assets/source/blender/hmh-reference-character-models.json`:

- Lit Commando is now `cycle-030-implemented`;
- detail kit is `lit-commando-rambo-v1`;
- minimum authored reference parts is `58`;
- runtime authority remains `projection-only`;
- gameplay body remains `human-medium-collision-v1`.

### Model rebuild

Replaced the metallic helmet, visor, plated arms and spherical shoulder armor with a fail-closed human military-survivor kit containing `61` inspected authored parts.

The rebuilt model adds:

- visible square-jawed human male face with separate eyes, brows, nose, mouth, chin and scar;
- layered dark hair without a sealed helmet;
- red combat headband with side wraps, knot and two directional tails;
- bare muscular shoulders, upper arms and forearms bound to the existing arm bones;
- compact wrist wraps;
- olive sleeveless field-shirt panels, collar and hem;
- black-olive cross-body webbing;
- six brass ammunition blocks and dog tags;
- utility belt, buckle and four practical pouches;
- dark cargo thighs and cargo pockets;
- olive knee protection;
- heavy grounded boot soles;
- right-thigh knife sheath and steel handle.

Pinned Blender `5.1.2` source inspection reported:

- authored reference parts: `61`;
- armature bones: `14`;
- `weapon_socket`: present;
- external dependencies: `0`.

### Deterministic generated assets

The production-hero pipeline rebuilt its shared four-hero scene twice and regenerated all runtime atlases, metadata, contact sheets, metrics, and selector assets.

For every hero:

- frames: `648`;
- unique animated frames: `640`;
- empty frames: `0`;
- transparent-corner failures: `0`;
- decoded-pixel reproducibility: `0 / 0 / 0` changed visible pixels, max channel delta and total channel delta.

Lit Commando atlas:

- dimensions: `2048 × 2048`;
- bytes: `2,998,475`;
- SHA-256: `6fbdc9891da08ebbe1f86c4c00e059e28b8479abb23da758f72d18f39dfba806`.

Four-hero aggregate:

- bytes: `11,983,865 / 12,582,912`;
- remaining headroom: `599,047` bytes.

## Visual review

Full-resolution contact-sheet review covered all eight directions across idle/aim, six run frames, pistol fire, hurt, dash, melee, grenade and death samples.

Accepted findings:

- the character now reads as a human Rambo-style military survivor instead of a silver robot or armored mannequin;
- face, dark hair and red headband are visible in front and three-quarter views;
- both red tails create a strong direction cue in profile and rear views;
- enlarged bare arms create the required muscular silhouette without changing the gameplay body;
- olive shirt, ammunition, cargo gear, pouches and heavy boots remain readable at the target camera;
- pistol aim and fire remain clear of the headband and torso webbing;
- no blocker-level body, weapon, headband or gear clipping was found;
- no helmet, robot, mech, mascot sphere, glasses or teal-hair identity drift remains.

## Live verification

`npm run smoke:hmh:production-hero` passed:

- desktop and `390 × 844` mobile;
- exact actor: `lit-commando`;
- source: `production-blender-atlas-v1`;
- layers: shadow, lower body, torso/head and weapon;
- all six lower-body run frames observed;
- independent torso aim during south locomotion observed;
- all three pistol-fire frames observed;
- four canonical mobile controls;
- atlas JSON and PNG returned HTTP `200`;
- console/page/request errors: `0`.

## Certification

- Focused model/atlas/selector tests: `25/25`.
- Syntax: `332` JavaScript modules / `49` Python scripts.
- Release ledger: `1,779` total / `1,727` passing / `52` accepted legacy failures / `0` unexpected.
- Build: PASS.
- HMH bundle: `1,021,358 / 1,050,000` bytes.
- Production asset QA: PASS.
- Four-hero atlases: `11,983,865 / 12,582,912` bytes.
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

Implement Lit Valkyrie's `lit-valkyrie-rambo-v1` reference model:

- visible athletic feminine human face;
- long platinum braid and high ponytail with at least seven separated lock groups;
- olive fitted sleeveless tactical top;
- cross harness, fingerless gloves and thigh holster;
- charcoal cargo trousers, knee pads and combat boots;
- small mint/cyan identification accents;
- no sealed helmet, mech treatment, Lilly glasses or teal hair;
- preserve the shared rig, atlas layers, frame contracts and projection-only authority.

After Lit Valkyrie: measured actor-scale parity, then the separate enemy-hurtbox generosity cycle. Website and broader world/combat/progression work remain separately ranked so they do not contaminate the character-model candidate.
