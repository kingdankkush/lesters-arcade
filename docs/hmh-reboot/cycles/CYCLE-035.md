# Cycle 035 — deterministic ranged/support enemy role art

Date: 2026-07-29 PDT
Branch: `reboot/hmh-aaa-continuous`
Status: certified local-only
Source: `0e4a0cc7dbe553196b64b5181ed5cd70d3c70e9f`
Exact commit patch SHA-256: `697b72230da401d5ef686cea3145fb643c9ea274ad7116377b9dbdc166aa698f`
Production: unchanged at `e8f7a73e8f23e055dd77300c2e5e7c59ec4c38e3`
Settlement: `SETTLEMENT_LIVE=false`

## Scope

Cycle 035 completes the bounded ordinary-enemy role-art wave by upgrading the Liquidator Agent and Validator Cultist through repository-owned Blender source. It also closes the cold-scene reproducibility gap discovered after Cycle 034.

This cycle is projection-only. It does not change body collision, Cycle 033 hurtboxes, Cycle 032 scales, damage, attack timing, projectiles, support targeting, AI, spawning, navigation, RNG, fixed-step simulation, replay, XP, progression, settlement, or parent authority.

## RED contracts

RED coverage was added before implementation in `tests/hmh-reboot-enemy-role-detail.test.mjs` for:

- versioned Liquidator Agent and Validator Cultist detail kits;
- explicit human/zombie identity forms;
- ranged burst and staff-channel animation profiles;
- fail-closed source handling and generated provenance;
- two independent scene builds before reproducibility comparison;
- per-actor Blender render processes;
- deterministic Workbench Studio/material rendering with cavity disabled;
- 2× source rendering with Lanczos downsampling;
- removal of disconnected alpha components below nine pixels.

The focused suite failed at each absent contract before the corresponding source implementation was added.

## Cold-scene determinism correction

Cycle 034's verifier rendered one rebuilt scene twice. A later independent rebuild exposed `93 / 1,368` drifting source-frame hashes.

Cycle 035 now:

1. rebuilds `hmh-enemy-roster.blend` independently before each pass;
2. launches a fresh Blender process per actor for both passes;
3. uses deterministic Blender Workbench Studio rendering with material colors and cavity disabled;
4. renders at 2× resolution and downsamples with repository-owned Lanczos normalization;
5. removes disconnected alpha components smaller than nine pixels after downsampling;
6. compares decoded source-frame RGBA hashes plus atlas PNG, JSON, contact-sheet, and aggregate metrics hashes;
7. preserves the first-pass raw/artifact snapshot on failure for diagnosis.

The complete regenerated roster passed the strengthened cold-scene gate with byte-identical generated artifacts: `reproducibleVerified=true`, `1,368` frames, and `0` duplicate decoded frames.

## Liquidator Agent

- Identity: visibly human survivor/operative.
- Detail kit: `liquidator-tactical-suppressor-v1`.
- Animation profile: `suppression-rifle-burst-v1`.
- Authored detail objects: `19`.
- Scene objects: `27 → 46`.
- Readability additions: visor, comm nodes, armor plates, shoulder guards, bracers, ammo pouches, knee guards, rifle receiver/stock/scope/muzzle/magazine.
- Motion: ranged anticipation and controlled rifle recoil instead of the generic shared attack swing.
- Atlas: `693,363 → 830,360` bytes, under the `2,097,152` per-atlas limit.

## Validator Cultist

- Identity corrected to a visibly humanoid zombie.
- Detail kit: `validator-undead-cultist-v1`.
- Animation profile: `validator-staff-channel-v1`.
- Authored detail objects: `24`.
- Scene objects: `29 → 53`.
- Readability additions: scalp wound, broken teeth, cheek wound, cowl/robe panels, shoulder sigils, wraps, talismans, knee wraps, staff bands and orb brackets.
- Motion: staff-channel anticipation and pulse release instead of the generic shared attack swing.
- Atlas: `699,997 → 872,976` bytes, under the `2,097,152` per-atlas limit.

## Structural and visual verification

- Shared rig remains `13` bones.
- Ordinary visual scale remains `0.75`; boss scale remains `0.86`.
- Ordinary vulnerable profile remains `cycle-033-forgiving-ordinary-enemy-hurtbox-v1` (`0.90`, minimum radius `10`, half-length `8`).
- Full eight-direction sheets covered idle, run, tell, attack, hit, and death.
- Liquidator Agent alpha audit: `152` frames, minimum connected component `14` pixels, `0` components below nine pixels.
- Validator Cultist alpha audit: `152` frames, minimum connected component `10` pixels, `0` components below nine pixels.
- Desktop and mobile roster-preview smoke loaded all six ordinary enemy atlases with no browser errors, overflow, clipping, or fallback art.
- Visual regression: `8 / 8` scenes unchanged; no baseline acceptance required.

Ignored review evidence:

- `.tmp/art-review/cycle-035-liquidator-agent-all-directions-final.png`
- `.tmp/art-review/cycle-035-validator-cultist-all-directions-final.png`
- `.hermes/evidence/hmh-cycle-034-enemy-detail-desktop.png`
- `.hermes/evidence/hmh-cycle-034-enemy-detail-mobile.png`

The browser smoke currently writes the historical Cycle 034 evidence filenames; the images were regenerated from the Cycle 035 candidate.

## Budgets

| Metric | Cycle 034 | Cycle 035 | Limit |
| --- | ---: | ---: | ---: |
| Total roster atlases | 6,781,314 bytes | 7,254,726 bytes | 10,485,760 bytes |
| Liquidator Agent atlas | 693,363 bytes | 830,360 bytes | 2,097,152 bytes |
| Validator Cultist atlas | 699,997 bytes | 872,976 bytes | 2,097,152 bytes |
| HMH game bundle | 1,021,923 bytes | 1,021,923 bytes | 1,050,000 bytes |

## Certification gates

- Cold-scene roster generation: PASS; `7` actors, `1,368` frames, `0` duplicates, byte-identical complete generated artifacts.
- Focused role, atlas, hurtbox, combat, simulation, archetype, and production-art tests: `59 / 59`.
- Release ledger: `1,794 total / 1,742 passing / 52 accepted legacy / 0 unexpected`.
- Raw `npm test`: expected non-release failure from checkout-excluded historical generated art; classified by the passing release-retirement ledger above.
- Syntax: `334` JavaScript modules and `49` Python scripts.
- Production asset QA: PASS.
- Build: PASS.
- Visual regression: `8 / 8` unchanged.
- Enemy-detail desktop/mobile smoke: PASS; six ordinary families loaded, zero errors.
- Five-profile browser certification: PASS.
- Mobile controls: `4 / 4` devices.
- Performance: desktop/mobile p95 `7 ms`; bundle `1,021,923 / 1,050,000` bytes.
- Network/console/page errors: `0` in browser certification and smoke gates.
- Security audit: `5 / 5`, zero findings.
- Third-party sandbox security: `3 / 3`.
- Web3 audit: `9 / 9`; real settlement remains intentionally disabled and unproven.
- Strict repository health, CDN, docs links, build, and diff gates: PASS.

## Production and authority boundary

Cycle 035 is local-only. It does not push, create or promote a preview, deploy production, change rollback, request wallets or signatures, send transactions, enable settlement, or alter parent authority. Production remains the Cycle 032/Vercel-fix release.

## Next bounded slice

Begin Cycle 036 with a read-only measurement of weapon DPS/TTK, movement/combat feel, and ordinary-enemy counterplay under the current authored levels. Select one deterministic gameplay adjustment only after seed-replayed measurements identify the earliest material weakness. Keep art, hitboxes, combat timing, AI, and progression changes isolated into separate RED/GREEN cycles.
