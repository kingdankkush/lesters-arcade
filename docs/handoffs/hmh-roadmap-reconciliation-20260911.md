# Roadmap reconciliation and agent-scope pass — 2026-09-11

This pass answers the owner's question about the 2026-09-11 comprehensive vision roadmap: which of its items already exist in the live source, which an implementation agent can close without owner decisions or outside services, and which need the owner, a physical device, a real wallet, or a paid service regardless of who does the work.

It was cut from `hermes/hmh-textured-rollout` at `b0ee9046` (the tip the roadmap names as the deployed combined release) on branch `fable/hmh-roadmap-pass-20260911`. The live site was read back before any work: `https://lestersarcade.io/dist/main.js` already carries the face-on hero portrait module, the Level 1 briefing panel is served at `/hmh-reboot/`, and the service worker namespace was `lesters-arcade-v34-hmh-world-polish`.

This document does not close any register item, does not claim AAA acceptance, and does not authorize purchases, wallet activity, contract deployment or financial activation.

## 1. Roadmap items that were already live before this pass

The roadmap was written from an older play session. These owner directions had already shipped in the `3e45dfa4` → `b0ee9046` lineage and were confirmed against the live bundle and source:

| Owner direction (roadmap §2) | Status | Where |
| --- | --- | --- |
| Torso turns modestly, never spins 360° from the legs | Implemented | `apps/hmh-reboot/src/production-hero-atlas.mjs` clamps torso/leg separation to one octant (45°) and snaps the body when aim swings further; `tests/hmh-native-hero-diagnostics.test.mjs` covers all 64 torso × leg pairs. |
| Slightly wider gameplay camera | Implemented | `resolveReadableGameplayZoom` in `apps/hmh-reboot/src/game-feel.mjs` moved from a 12% to a 10% body-height floor (about 17% wider) in `3e45dfa4`; `tests/hmh-reboot-game-feel.test.mjs` pins it. The encounter director frames spawns on a fixed 1440×900 logical rectangle, so zoom no longer affects spawning. |
| Face-on, close-up selection portraits with restrained rotation | Implemented | The select screen consumes `apps/portal/src/generated/hmh-hero-portraits.mjs` (bust framing, 84° pitch, idle pose, weapon hidden, ±24° sway) since `3e45dfa4`. The older 55° aim-pose turntable atlas still exists and is still gate-checked, but the select screen no longer shows it. |
| Boot intro plus a Level 1 loading/briefing screen | Implemented, extended here | Parent pre-game instructions (`#officialLevelIntro`) and the child loading panel (`#hmhStartup`) with route bar, insertion point, controls, weapon and power-up guidance, truthful progress bar and a basic-graphics fallback after 20 s. This pass adds per-insertion-point briefing lines (§3). |
| Four or five randomized valid spawns | Implemented, now proven | Five seeded entries in `apps/hmh-reboot/src/level-entry.mjs`. This pass adds clearance, route, district and director-opening proofs (§3). |
| Visible indicators on weapons and power-ups | Implemented | `apps/hmh-reboot/src/pickup-indicators.mjs`: ground ring, beam, arrow, sparks, per-family colour, reduced-motion path. |
| Particles, blood, gore, corpses | Implemented, polish open | `gore-presentation.mjs`, `corpse-presentation.mjs`, `weapon-vfx.mjs`, `combat-feedback.mjs`, `grenade-vfx.mjs`; capped and deterministic. Visual quality acceptance is an owner review, not a code gap. |
| Wallet, Ranked, profiles, leaderboards, LitVM | Source exists; live acceptance open | See §5. |

## 2. Section-by-section status

Statuses: **implemented** (source, tests and release evidence exist), **partial** (some of the section is delivered), **unverified** (exists but no current evidence of the specific claim), **proposed** (roadmap recommendation, no commitment), **owner-gated** (a decision or approval is required first), **external** (needs a device, wallet, service or person outside this environment).

| Roadmap section | Status | Evidence and remaining boundary |
| --- | --- | --- |
| §4 Restart and reconciliation | implemented by this document | Live branch, deployed commit, latest handoff and register located; roadmap compared item by item. |
| §5 Playable heroes | partial | Four native heroes, nine clips each, 648 frames, 8 directions, four-layer split, 384 px portraits; `scripts/hmh-native-hero-diagnostics.mjs`. Skinning, waist-seam, foot-planting and likeness polish remain visual acceptance items for the owner and a Blender pass. |
| §6 Animation and movement | partial | Torso clamp and independent leg/torso direction are live; enemy pose refresh on state change; interruptible actions. Extra idle personality, turn-in-place and follow-through are proposed and unbuilt. |
| §7 Camera, selection, boot, loading | implemented, extended here | Wider camera, bust portraits, briefing panel already live; this pass adds per-entry objective, watch-for, nearby supply and a seeded field tip (§3). |
| §8 Enemies | partial | Six archetypes with roles, tells, counterplay copy and six visual states (`enemy-archetypes.mjs`), navgrid and flow-field pursuit, native Bagholder. Reference sheets for the remaining roles are **owner-gated** (register `E-2`). |
| §9 Liquidator boss | implemented, balance open | Three phases, eight attacks, authored plan and endless loop in `liquidator-boss.mjs`; multi-build balance and cinematic pacing are measurement items. |
| §10 Weapons, combat, effects, gore | partial | Eight weapon definitions with per-weapon VFX/SFX; native held/world models for every weapon remain open (register `H-7`/`R-4`), and the Tripo prop wave is **owner-gated** (`R-2`). |
| §11 Sound design | partial, expansion owner-gated | 85 audio files; 37 synthesised in-repo weapon cues with per-cue provenance and sha256 in `apps/portal/assets/audio/sfx/hmh-weapon-sfx-manifest.json`; category mix caps in `hmh-audio-system.mjs`. The Doom/Duke weight upgrade is subjective and the expansion scope is register `S-1` (**owner-gated**); an agent can only change measurable properties (transient, low-end energy, tail) and cannot listen. |
| §12 Level 1 world | partial | Six districts, ten points of interest, six machinery sites, three discoveries, five alternate routes, campfire embers, field map. Canopy composition, yard repetition and seams remain visual polish; haze density is **owner-gated** (`B-11`). Spawn-point verification is closed by this pass. |
| §13 Exploration and interactivity | implemented | Automatic machinery, gates, secret seal, ledge and lore rewards; controls unchanged. |
| §14 Pickups and power-ups | implemented | Ten authored point-of-interest collectibles plus scheduled drops; indicators live. |
| §15 Balance, progression, achievements | partial, measurement | Upgrade catalog, XP, combo milestones, daily/weekly Free challenges with seed sharing, achievement progress and dates. Numbers need playtest measurement, which is **external** (owner playtests, register `owner-playtests`). |
| §16 Performance and QA | partial | Bundle budget gate (initial JS 1,029,429 B of 1,048,576 B after this pass), load-speed report, retirement-gated test suite, thirty-odd Playwright smokes. Real-phone testing is **external**. |
| §17 Profiles and durable sessions | partial | Local profile history, provenance filtering, submitted-session ledger; durable server-side Ranked history is a separate unfinished system. |
| §18 Wallet and LitVM Testnet | source exists, **external** | Provider selection, chain re-check before broadcast, six deployed addresses, ABI alignment test. Real MetaMask/Rabby exercise needs a human with a wallet. |
| §19 Ranked entry through settlement | **owner-gated and external** | Runtime charges no entry fee (`DEFAULT_ENTRY_FEE_MICRO_USDC = 0`, "Ranked is free on testnet") while `ArcadePaymentRouter.sol` and `SessionLedger.sol` require a non-zero fee. The roadmap's 0.1 zkLTC requirement is therefore a live contradiction that only the owner can resolve; no fee was selected here. |
| §20 Leaderboards and achievement NFTs | partial, **external** | Provenance filtering and cadence boards exist; on-chain minting readback needs a real wallet and the mint authority decision. |
| §21 Contracts and Mainnet | **owner-gated** | Untouched. `SETTLEMENT_LIVE=false`. |
| §22 Lester's Arcade | partial | Ad-strip containment and narrow-screen work are deployed; trust pages (`L-9`), banner cabinets (`L-4`) and seeded house scores (`L-2`) are **owner-gated**. |

## 3. Work completed in this pass

All of it is projection-only or test-only. Nothing touches the fixed-step simulation, RNG streams, collision, replay, bridge contract, profiles, wallets or contracts.

### 3.1 Insertion-point briefing on the Level 1 loading panel

- New `apps/hmh-reboot/src/level-briefing.mjs`: per-entry **objective**, **watch for** and **nearby supply** copy, plus six rotating field tips chosen by a separate FNV-1a hash of the session seed (same form as `selectLevelEntry`, its own label, no combat RNG consumed). Later levels supply their own table under their own `levelId`.
- `apps/portal/hmh-reboot/index.html` gains a four-slot `<dl class="hmh-startup-brief">` under the insertion point with truthful default copy; `styles.css` lays it out in two columns on desktop, one on phones, and tightens it on short viewports.
- `main.mjs` fills the slots at session start right after the insertion-point label, using the session seed. Evidence-safe tour spawns have no entry id and keep the static copy.
- Every line of copy is proven against the authored world in `tests/hmh-level-briefing.test.mjs`: each cited arena, point of interest and machinery site must exist, sit within 1,500 units of the entry, lie on the stated compass bearing (8-way, screen space), and named weapon caches must resolve to the shipped collectible asset and weapon display name. Hazard props that are art-only in the current runtime are deliberately not described as gameplay.
- Bundle cost: initial child JS rose from 893,571 B to 897,379 B; 18.7 KB headroom remains under the 1 MB aggregate cap.

### 3.2 Spawn-point safety proofs

`tests/hmh-level-entry.test.mjs` now proves, for each of the five insertion points:

- clearance of more than 48 units (player radius + the director's margin) from every collision blocker, machinery body and the secret seal, including polygon blockers;
- at least 200 units from every landmark anchor and 120 from every set piece (the relay tower is authored 150 north of the relay start on purpose);
- position on the main route within its 192-unit clearance, inside a district that keeps two route-valid spawn points;
- the encounter director can open a fight from that start under its real rules (`validateEncounterSpawn` with the fixed logical camera): no district spawn is on camera or inside the 560-unit protected radius, and the nearest allowed opening spawn is comparable across entries. Measured: relay 1,970, ravine 1,404, hashwood 1,412, mining 1,201, yard 1,304 units. The relay tutorial approach is the long end; this is recorded as a fact for the owner's balance pass, not asserted as a defect.

### 3.3 Release plumbing

- Portal cache token `hmh-briefing-20260911` and service-worker namespace `lesters-arcade-v35-hmh-briefing` across the 21 pinned locations (index, `sw.js`, README marker, smokes and tests), because the precached `/hmh-reboot/index.html` and `styles.css` changed.
- Browser evidence for the briefing panel was captured through the ordinary portal flow (guest → cabinet → Free → hero → begin) on a local static build rather than by injecting copy: all five entries were observed across eight sessions with zero page or console errors (`docs/qa/hmh-roadmap-briefing-evidence-20260911.json`).
- Release: source `cad94e7d`, Preview `dpl_F5Hytj9fjABnmDVDmVBNwhGeFusU`, promoted production `dpl_E6U69q1pgn6LTw5LGdtgayXMJhyg`, rollback `dpl_3PQPwrqBQaS6sAChSpZ9uca9wXoN` (`b0ee9046`). Local, Preview and production builds each passed the unchanged gate (3,389 tests, 51 documented exceptions); the six mutable entry files read back from `https://lestersarcade.io` match the local build byte for byte. Receipt: `docs/qa/hmh-roadmap-pass-release-20260911.json`.
- Two findings recorded, not fixed as gameplay: the desktop portal end-to-end smoke's `pause-resume` and `mid-run-restart` flows fail identically on the untouched base commit on this machine (pre-existing, zero console errors); and `scripts/smoke-portal-flow.mjs` probed PNG hero atlases that no longer exist, so it always failed against production. The probe now checks the four shipped 2048×2048 WebP atlases and the flow smoke passes against production.

## 4. What an implementation agent can still take on without owner input

Ordered by the roadmap's own priority, limited to items that are code, Blender, or test work with existing tooling on this machine (Blender 5.1.2 at `D:/Apps/Blender`, Node 24, Python 3.14 with Pillow 12, Playwright Chromium, Foundry):

1. Hero polish that is measurable: foot-skate metrics per clip, waist-seam pixel checks, portrait exposure pass (register `B-5` remaining exposure work), an idle "personality" clip per hero through the existing exporter.
2. Enemy readability: tell-to-hit timing measured at gameplay zoom in the browser, stagger and armor-break feedback, crowd spacing tuning in `enemy-navgrid.mjs`, all inside deterministic tests.
3. Weapon feel: reload presentation for weapons that already reload, impact differentiation by surface (five surfaces exist in `weapon-vfx.mjs`), recoil and shake intensity setting.
4. Runtime hazards: the authored rockfall, spore bed, conveyor and liquidation grid are art-only today; promoting them to simulated hazards with warnings is contained gameplay work behind a measured cycle.
5. Audio that can be measured: transient, low-end and tail shaping in `scripts/build-hmh-weapon-sfx.py` with loudness and crest-factor targets, category loudness report, voice-count caps. Listening acceptance stays with the owner.
6. Level composition: canopy clustering, seam and repetition fixes in the terrain and prop pipelines, plus a landmark-per-district silhouette pass; each is verifiable by the existing seamless/reproducible tile gates and browser scenes.
7. Performance: cold/warm start, decode spikes and long-run memory measured on desktop Chromium; phone numbers remain external.
8. Ranked data contracts: durable, paginated session history schema and pending/failed/rejected states, written against the parent authority without any chain activity.
9. Portal: narrow-screen readability sweeps and truthful cabinet status remain ordinary front-end work.

## 5. What needs the owner or something outside this environment

- **Decisions (register ids):** atlas format and per-hero cap (`H-0`, recorded complete), enemy reference sheets (`E-2`), Tripo organics wave (`R-2`), town district (`W-9`), audio expansion scope (`S-1`), haze density (`B-11`), seeded house scores (`L-2`), banner cabinets (`L-4`), trust pages (`L-9`), legacy asset triage (`N-2`), repository size limit (`B-9`).
- **Financial and chain:** the 0.1 zkLTC entry cost versus the free-Ranked runtime, platform fee, mint and admin authority, Mainnet epoch reset, any contract deployment or settlement activation.
- **External services and money:** ChatGPT sheets, Tripo generation, PixelLab (its MCP endpoint is currently unreachable), licensed audio.
- **People and devices:** real MetaMask/Rabby wallets, physical phones, headphone/speaker listening, the five desktop and five mobile first-time playtests, and every visual acceptance judgement against the owner's Hades bar.

## 6. Non-claims

No full-group acceptance, AAA milestone, device certification, wallet compatibility or competitive readiness is claimed. The 99-entry status register and the retained backlog are unchanged; this pass adds evidence for §7 and §12 checklist rows only.
