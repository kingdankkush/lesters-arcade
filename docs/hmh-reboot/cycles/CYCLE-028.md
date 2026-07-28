# HMH AAA Continuous Improvement Cycle 028

Date: 2026-07-28 PDT
Status: `LOCAL CERTIFIED · RUNTIME/ART COMMIT PENDING · PRODUCTION UNTOUCHED`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `1cf081a6d902849b1802e7ecce289255b9b342fa` — Cycle 027 documentation closeout

## Bounded slice

Turn the user-supplied Lester/Lilly illustrated sheets and pixel/action sprites into a durable four-hero Blender model contract, then implement one complete reference-derived model slice: Lester.

This cycle does not implement Lilly, Lit Commando or Lit Valkyrie geometry and does not change enemy hitboxes. Their exact derived direction is now repository-owned for subsequent bounded cycles.

## Reference interpretation

- Illustrated sheets own facial identity, head/hair treatment, body type and premium material finish.
- Pixel/action sheets own combat clothing, equipment placement, weapon handling and gameplay-scale silhouette.
- Lester uses the illustrated spherical mascot identity with the pixel sheet's olive tactical, bandolier, cargo, glove, knee and boot language.
- Lilly is specified as a recognizable human woman with round glasses, long layered wavy teal hair and teal/gold combat gear.
- Lit Commando is specified as a visible-face male Rambo/army survivor rather than a helmeted armored mannequin.
- Lit Valkyrie is specified as a visible-face female commando with long platinum braid/ponytail rather than a short-haired armored mannequin.

Authoritative brief:

- `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`
- `apps/hmh-reboot/assets/source/blender/hmh-reference-character-models.json`

The external user-supplied binaries were analyzed but not copied into Git.

## RED

`tests/hmh-reboot-reference-character-models.test.mjs` initially failed because the reference model manifest did not exist.

The browser evidence rail also went RED because it still expected eight touch controls after Cycle 027 correctly established four child-owned controls.

The release gate then correctly exposed:

- stale selector atlas/provenance after hero pixels changed;
- a policy test hardcoded to Cycle 006/007 names rather than the current dated handoff pattern;
- Lester's detailed atlas exceeding the old 3 MiB per-hero byte ceiling by 81,890 bytes.

## GREEN implementation

### Four-character reference contract

Added a structured manifest covering:

- distinct human identity and anatomy for all four heroes;
- source-model height/proportion targets;
- hair requirements for Lilly and Lit Valkyrie;
- Rambo/army differentiation for Commando and Valkyrie;
- hero/enemy projection-scale parity;
- a deliberately separate planned enemy-hurtbox cycle.

Every production pilot now carries a `modelSpecId`, and the Blender scene fails closed on unknown reference identities or authority drift.

### Lester model rebuild

Added `reference-lester-combat-v1`, inspected as 48 authored reference parts:

- larger cobalt spherical mascot shell;
- sphere-conforming multi-part white `L` logo;
- separate eyes, pupils, brows and smile meshes;
- olive vest front/side panels and shoulder webbing;
- cross-body strap with eight brass rounds;
- utility belt, buckle and four pouches;
- tan cargo thighs and olive pockets;
- gloves, blue wrist wraps, knee guards and boot soles;
- blue scarf collar and two rear tails.

All parts use the existing 14-bone production rig and `weapon_socket`. Geometry remains projection-only.

### Derived animation assets

The pinned production pipeline rebuilt all four heroes because they share one scene:

- four actors;
- 648 frames per actor;
- 2,592 total frames;
- four 2048×2048 atlases;
- zero empty frames;
- 640 unique animated frames per actor;
- exact A/B decoded-pixel reproducibility: `0 / 0 / 0` for changed pixels, max channel delta and total channel delta.

Production hero atlas bytes: `11,124,674 / 12,582,912` aggregate.

Lester atlas: `3,227,618` bytes. The per-hero ceiling was measured and changed from 3 MiB to 3.25 MiB while the stricter 12 MiB four-hero aggregate cap remains unchanged. Lossless optimization was tested and did not reduce the file.

The deterministic selector builder regenerated its PNG, JSON provenance and browser module from the new hero pixels.

### Browser rail repairs

- Production-hero mobile smoke now requires four child-owned touch controls, not the obsolete eight-control layout.
- The old Cycle 007 repository-policy assertion now requires a dated current HMH cycle handoff instead of hardcoded old cycle numbers.

## Visual findings

### Contact-sheet review

Accepted after one iteration:

- initial detailed face meshes peeked over the north/back head silhouette;
- logo, eyes, brows and smile were conformed closer to the sphere;
- final south/east/north/west review found no blocker-level clipping or framing regression;
- Lester's blue/olive/tan combat silhouette and equipment separation are materially clearer than the baseline.

### Live desktop/mobile review

- exact actor: `lester-original`;
- source: `production-blender-atlas-v1`;
- layers: shadow, lower-body, torso-head and weapon;
- full six-frame lower-body run cycle observed;
- independent torso direction preserved;
- pistol-fire torso and weapon clips observed;
- desktop and 390×844 mobile: one canvas, correct grounding, clean weapon attachment, no overflow or failed requests;
- mobile touch controls: four.

Facial micro-detail is limited by the current wide camera and `0.58` hero projection scale. A later measured actor-scale/readability cycle should evaluate hero/enemy screen size together; this cycle does not silently alter global scale.

## Hitbox direction, not implementation

Current regular-enemy projectile hurt capsule:

- radius `max(8, enemy.radius × 0.72)`;
- axis half-length `8`.

Planned separate deterministic cycle:

- radius `max(10, enemy.radius × 0.90)`;
- axis half-length `10`;
- physical collision bodies unchanged;
- seeded hit-rate measurement plus 60/30/20 and replay verification required.

No collision, hurtbox, movement, AI, health, damage, spawn, RNG, progression, replay, save or bridge authority changed in Cycle 028.

## Certification

- Focused reference/hero tests: `13/13`.
- Syntax: `332` JavaScript modules / `49` Python scripts.
- Release ledger: `1,777` total / `1,725` passing / `52` accepted legacy failures / `0` unexpected.
- Build: PASS.
- Visual regression: `8/8` unchanged; max mean delta `0.061`.
- Lester desktop/mobile production-hero smoke: PASS.
- Performance: desktop p95 `7 ms`; mobile p95 `7 ms`.
- Bundle: `1,021,358 / 1,050,000` bytes.
- Five-profile candidate browser matrix: PASS.
- Combat desktop/mobile/bridge: PASS.
- Cockpit, portal E2E and four-device mobile controls: PASS.
- Network: four scenarios; zero HTTP/request/console/page failures.
- Security: `5/5`, zero findings.
- Third-party security: PASS.
- Web3 settlement audit: `9/9` PASS.
- Web3 live readiness: honestly `PARTIAL 3/4`.
- Production asset QA: PASS.
- Strict repository health: PASS.
- CDN gate: PASS; no destructive action.
- Documentation links: PASS.
- `git diff --check`: PASS.

## Authority and release boundary

- PixiJS remains `8.19.0`.
- Fixed 60 Hz simulation and maximum four catch-up steps remain unchanged.
- Parent/child, Free/Ranked, save, replay, bridge and settlement authority remain unchanged.
- `SETTLEMENT_LIVE=false`.
- No preview or production deployment occurred.
- No wallet/signature request, transaction, contract action or settlement change occurred.

## Next bounded slice

Implement Lilly's `lilly-reference-combat-v1` model:

- recognizable face and teal-lens round glasses;
- at least nine separated wavy teal hair groups;
- black/teal cropped tactical jacket with gold piping;
- teal cargo trousers, knee pads, pouches and black/gold boots;
- preserve current rig, atlas layers, clip counts and gameplay authority.

After Lilly: Lit Commando, Lit Valkyrie, then the separately measured enemy-hurtbox cycle.
