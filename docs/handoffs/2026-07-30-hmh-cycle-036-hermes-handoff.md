# Hard Money Heroes Cycle 036 production handoff for Claude Fable / Opus 5

Date: 2026-07-30 PDT
Recipient: Claude Fable / Opus 5 agent
Continuation branch: `reboot/hmh-aaa-continuous`
Published branch head before this handoff update: `802e6cd18a537c72830224e0655617841241b548`
Cycle 036 runtime source: `15629ebac9e1004f2b41760aedd3e67cc406f5c3`
Cycle 036 exact commit patch SHA-256: `5fa3e71570a20d1ca5b4166df06c041e244e9a7315645ae74f797752686847d6`
Production: <https://lestersarcade.io>
Settlement: `SETTLEMENT_LIVE=false`

## 1. Production state verified on 2026-07-30

Cycles 029 through 036 were pushed to `origin/reboot/hmh-aaa-continuous`, built by the connected Vercel project, verified on the immutable preview, and explicitly promoted to production.

| Release fact | Verified value |
| --- | --- |
| Git branch head deployed | `802e6cd18a537c72830224e0655617841241b548` |
| Runtime implementation boundary | `15629ebac9e1004f2b41760aedd3e67cc406f5c3` |
| Production deployment ID | `dpl_5mUEBJ6dZYaW6PANwSc1SfBnJRWo` |
| Immutable production URL | <https://lesters-arcade-mt547dhef-justin-agent-projects.vercel.app> |
| Public alias | <https://lestersarcade.io> |
| Promoted preview deployment ID | `dpl_7SyumnAabS6mJ96mZBbbbKWNGUt2` |
| Immutable preview URL | <https://lesters-arcade-5pkpyw4y5-justin-agent-projects.vercel.app> |
| Immediate rollback deployment ID | `dpl_9UBxfiVGpqa1yHjZuAj25HrZ7zro` |
| Immediate rollback URL | <https://lesters-arcade-5aijy0d3f-justin-agent-projects.vercel.app> |
| Live HMH bundle SHA-256 | `3422d44cd0204e53cac53b352a59c199fe5feea3504536e9e523dd9539204295` |
| Live HMH stylesheet SHA-256 | `22b1cb9adf646425c46ff2e2bab9f97a72014b3ac614b5a30049c6fec45e3d73` |

The public alias resolves to the production deployment above and Vercel reports it `Ready`. The production HMH bundle and stylesheet matched the locally built candidate byte for byte. The live release-browser certification passed all five profiles, and the live combat smoke passed touch weapon swapping, reload visibility, deterministic combat, and game-over behavior.

Do not infer production from Git alone in a future cycle. Recheck the Git SHA, immutable Vercel deployment, custom-domain alias, exact served artifacts, and the actual public browser path.

## 2. What Cycle 036 added

Cycle 036 closed the first deterministic combat-readability slice after the character and enemy art wave.

- Mobile has a dedicated `SWAP` control, giving touch players visible access to retained weapons.
- The certified mobile control set is exactly `aim`, `move`, `pause`, `power`, and `weapon`.
- The compact HUD names the weapon, reports rounds/capacity, and shows deterministic `RELOAD`, `COOLING`, `SWITCH`, or `EMPTY` state.
- `getWeaponReadabilityStatus()` derives projection-only output from authoritative fixed-tick weapon state and does not mutate simulation.
- Browser evidence exercises real touch switching and observes a shotgun reload.
- Full-resolution portrait and landscape captures were corrected and verified for containment and readability.

Final Cycle 036 gates:

- focused contracts: `71/71`;
- release ledger: `1,799 total / 1,747 passing / 52 accepted legacy / 0 unexpected`;
- deterministic visual regression: `8/8`;
- browser certification: five profiles;
- mobile controls: four device profiles;
- desktop/mobile performance: `7 ms` p95 each;
- child bundle: `1,023,218 / 1,050,000` bytes;
- check, build, asset QA, security, third-party, Web3, strict repository health, CDN, and documentation gates: PASS.

## 3. Non-negotiable architecture and safety boundaries

Preserve all of these unless Justin gives explicit, separate authority to change them:

- fixed 60 Hz simulation with at most four catch-up steps;
- game alias `hmh`, game ID `lester-blaster`, profile `wo71`, save schema `2`, and bridge `hmh-bridge/v1`;
- bridge message cap of `65,536` bytes;
- same-seed deterministic simulation and replay integrity;
- Free Mode isolation from Ranked progress;
- parent authority for wallets, profiles, official sessions, persistence, leaderboards, analytics, achievements, score verification, and settlement;
- child authority only for gameplay input, movement, collision, elevation, combat, AI, spawning, progression, and projection;
- no wallet provider, signer, transaction, contract publication, official score write, or settlement decision inside the HMH child;
- `SETTLEMENT_LIVE=false`;
- no contract deployment, transaction, real-value economy, or settlement activation without a separate explicit HALT approval;
- human survivors and humanoid zombies only, never animal, vehicle, robot, mech, or abstract actor proxies;
- gameplay changes must not hide inside projection-only art, animation, VFX, audio, or quality-tier work;
- production and rollback remain unchanged until the exact next candidate is separately approved for promotion.

The hosted review batch `deleg_8558907c` is not approval. It timed out on one review, omitted exact verdicts on another, and violated read-only scope on the third. Always inspect the index and untracked files after delegated review.

## 4. Current implementation audit before the next cycle

This is the actual gap map as of the live Cycle 036 release. Do not restart from old June Canvas/isometric/procedural documents.

### Character and enemy presentation

- Four production heroes and six ordinary enemy roles ship through repository-owned JSON, Blender scenes/scripts, frame generation, atlases, metadata, and contact sheets.
- Cycle 035 upgraded the Liquidator Agent as a human tactical survivor and the Validator Cultist as a humanoid zombie.
- Enemy production states cover eight directions and six required states: `idle`, `run`, `tell`, `attack`, `hit`, and `death`.
- The selector already uses a generated rotating hero atlas, but it must be regenerated from every improved hero source so selection art never drifts from gameplay art.
- Current Blender reproducibility policy is Workbench Studio/material rendering, cavity disabled, a fresh process and cold scene per actor, exact artifact comparison, and fail-closed alpha-component validation.
- Shipped atlases must never be manually repainted. Fix source JSON/scripts/scenes and regenerate.

### Combat, weapons, and upgrades

- The runtime currently constructs all four retained weapon states at run start: pistol, shotgun, machine gun, and grenade launcher.
- The weapon state has magazine ammo, but the current integration does not provide the desired finite reserve-ammo economy for non-pistol pickups.
- Weapon-specific progression definitions exist for rate of fire, damage, and reload speed, but they are not integrated into the current run-level upgrade-choice flow.
- The current run upgrade flow offers three choices through `.slice(0, 3)`. Justin requires exactly two choices at every level-up.
- Current XP and score progression is driven by enemy defeats and threat cost. Litecoin pickup and combo contributions are not yet part of the canonical level-up model.
- The current ordinary-enemy hurtbox policy is radius multiplier `0.90`, minimum radius `10`, and half-length `8`. Justin wants enemies easier to hit, but that change must be measured and isolated from art scale.
- Existing pistol base values are damage `3`, rate `2.6/s`, reload `1.5 s`, and magazine `8`. Treat these as the current baseline, not protected balance targets.

### World and minimap

- Level 1 already has one authored world contract for districts, routes, collision, elevation, ramps, water, bridges, landmarks, reveal cells, hazards, and encounter ownership.
- The minimap draws district, route, water/bridge, boundary, landmark, and player geometry.
- Revealed cells currently add a light overlay, but the underlying map is still drawn globally. There is not yet a complete explored-versus-currently-visible fog model.
- Enemy locations are not currently represented on the minimap.
- World props and terrain are readable but still too flat and tile-like for the intended 2.5D production quality.

### Stats, profiles, and leaderboards

- The child currently finalizes a narrow result containing score, kills, elapsed time, health, and identity/evidence fields.
- Rich weapon, accuracy, combo, pickup, upgrade, damage, movement, and boss telemetry is not yet a canonical bounded run summary.
- The parent leaderboard engine can retain a generic `runStats` object, but current profile and leaderboard surfaces do not expose the requested depth.
- Cadence leaderboards currently rank a top ten by score for daily, weekly, monthly, yearly, and all-time buckets.
- Profile state is primarily local with optional chain parity. Do not describe it as a fully durable live backend or hardened on-chain profile system.

### Music, pause, wallet, and Web3

- The portal owns a full playlist model with queue, previous, next, play/pause, seek, mute, shuffle, and context-specific queues.
- The HMH child currently owns a separate single looping track with only enabled/disabled state. Opening the HMH pause path pauses that child music.
- The full portal player is not yet available inside the gameplay pause menu.
- Web3 live readiness is `PARTIAL`, with hardened on-chain registry/economy publication still blocked.
- Improve wallet UX and read-only/profile behavior, but never imply that local previews or legacy bytecode are live settlement.

### Release constraints

- The current HMH bundle has only `26,782` bytes of certified headroom.
- Prefer generated data, shared modules, lazy loading, compression, and asset pipelines over adding another parallel runtime.
- Any runtime, asset, routing, CSP, service-worker, or release-harness change creates a new candidate requiring fresh certification.

## 5. Product target

Hard Money Heroes should become a polished, deterministic top-down 2.5D roguelike run-and-gun that feels immediately readable on desktop, controller, and touch; supports late-run swarm clearing without trivializing early play; and gives every weapon, upgrade, enemy, boss, pickup, and map landmark a clear gameplay role.

Lester's Arcade should present HMH as the flagship playable cabinet while communicating the larger mission: one parent arcade identity, multiple deterministic child games, cross-game profiles, achievements, and leaderboards, with Web3 features added only where they improve player ownership or verified competition rather than obstruct play.

Guest Free Mode must remain fast and wallet-free. Wallet sign-in should add durable profile, Ranked eligibility, and future verified features, not become a homepage barrier.

## 6. Ordered improvement program

This is a standing multi-cycle brief. Take one bounded vertical slice at a time, write RED coverage first, measure the current baseline, implement the smallest coherent change, certify the actual browser path, and close each cycle with an exact-index review. Do not attempt this list in one giant patch.

### Priority A: character models and animation

Start here.

1. Audit every hero and enemy at full resolution across all directions and states. Record silhouette, facial/head readability, anatomy, hands, weapon grip, clothing layers, equipment identity, clipping, foot contact, pose arcs, state separation, and death-pose quality.
2. Select one hero plus one ordinary enemy as the first vertical slice. Improve only repository-owned source geometry, materials, rig/pose data, and animation profiles.
3. Make hero proportions and equipment more reference-faithful without changing gameplay bounds in the art cycle.
4. Keep ordinary enemies near human scale. Preserve ordinary enemy render scale `0.75` and boss scale `0.86` until a separately measured scale cycle proves a change is safe.
5. Improve locomotion animation with convincing weight shift, foot planting, stride timing, direction changes, aim offsets, weapon recoil, reload actions, hit reactions, knockback readability, and distinct death poses.
6. Improve enemy tells and attacks so the anticipation, active strike/shot, and recovery are visually distinct without changing simulation timing accidentally.
7. Regenerate gameplay atlases, selector atlases, metadata, source frames, contact sheets, and `.blend` files through the canonical pipeline.
8. Inspect every changed sheet across all required directions/states, run exact independent cold builds, and reject disconnected alpha fragments, duplicate frames, malformed limbs, clipping, identity loss, or reduced readability.
9. Update character select with continuously rotating turntables generated from the same approved model source, readable names/roles, starting-stat comparisons, starting weapon, unlock state, and accessible/mobile selection behavior.
10. Author and display distinct but balanced hero starting health, movement, defense, and combat traits. The pistol remains the universal starting/main weapon; do not grant permanent access to finite-ammo pickup weapons merely to differentiate heroes.
11. After one vertical slice passes, continue through the remaining heroes, ordinary enemy roles, and boss in small packets.

The first new cycle should be a character-quality vertical slice, not a broad combat rebalance.

### Priority B: movement feel and animation integration

1. Measure input-to-motion latency, acceleration, deceleration, diagonal normalization, turn response, aim/move independence, dash timing, collision response, ramp transitions, and camera follow on keyboard/mouse, controller, and touch.
2. Improve movement feel without breaking fixed-step determinism or changing replay semantics.
3. Match animation selection and playback to authoritative movement/action state. Animation remains projection-only.
4. Prevent foot sliding, direction flicker, animation popping, aim/body disagreement, and collision/art separation.
5. Keep reduced-motion behavior readable and preserve 60 FPS desktop, 30 FPS mobile, and 100+ enemy pressure targets.

### Priority C: combat instrumentation before balance

Build a deterministic benchmark before changing values.

For every weapon and representative enemy/boss target, record same-seed:

- close, mid, and long-range hit rate;
- trigger pulls, projectiles, pellets, and target contacts;
- raw and applied damage;
- critical hits and elemental/status procs;
- time to first hit and time to kill;
- magazine uptime, reload downtime, reserve ammo consumed, and empty time;
- heat/overheat where relevant;
- single-target DPS, sustained DPS, swarm clear time, overkill, and projectile pressure;
- pickups, swaps, time equipped, and kills by weapon;
- player damage taken and survival outcome during the test window.

Fail closed on non-finite output, order drift, replay drift, or different results for the same seed.

### Priority D: weapon ownership, pistol depth, and two new pickups

1. Make the pistol the always-owned, unlimited-reserve fallback weapon.
2. Make every other weapon a true pickup with finite reserve ammunition. Acquiring a pickup must grant the weapon and an authored ammo amount rather than merely switching to an already-owned infinite-reload weapon.
3. Preserve visible ammo, reload, empty, switching, and overheat state on desktop and mobile.
4. Give the pistol the deepest upgrade tree so it remains viable during late swarms:
   - rate of fire;
   - reload speed;
   - base and additive damage;
   - critical chance;
   - critical damage;
   - magazine size;
   - projectile speed/range;
   - penetration or ricochet;
   - elemental effects with deterministic proc rules;
   - crowd-control or multi-target capstones.
5. Avoid multiplicative runaway. Define caps, stacking order, proc ownership, and deterministic rounding in one authoritative module.
6. Expand each retained pickup weapon into a meaningful but narrower tree tied to its role.
7. Add two new finite-ammo pickups, subject to measured role validation:
   - **The Hash Rail**: a precision rail rifle with line penetration, high critical payoff, and scarce energy cells. Its tree should cover charge/cadence, penetration, critical behavior, and projectile width/range.
   - **The Lightning Ledger**: an arc weapon that chains across clustered enemies. Its tree should cover chain count, chain range, damage falloff, battery economy, and deterministic shock/status behavior.
8. Create all new weapon models, pickup models, VFX, audio, HUD labels, accessibility labels, acquisition state, finite ammo, and upgrade trees through repository-owned pipelines.
9. Balance weapon roles so pistol progression supports the entire run while scarce pickups create temporary tactical peaks rather than mandatory permanent superiority.

### Priority E: two-choice level-ups and progression balance

1. Change every level-up offer from exactly three options to exactly two deterministic options.
2. Preserve replay stability: the same seed, level, ranks, and selection sequence must produce the same ordered pair.
3. Integrate weapon-tree upgrades into the same authoritative run progression instead of keeping dormant parallel definitions.
4. Award level progress from a transparent combination of:
   - enemy kills weighted by enemy threat;
   - Litecoin token pickups;
   - combo milestones or bounded combo multipliers.
5. Do not let cosmetic pickup order, render culling, frame rate, or client wall-clock time affect XP.
6. Build long-run simulations across hero, weapon, and enemy combinations. Measure levels per minute, choices seen, dead offers, build diversity, damage growth, survivability, and time between upgrades.
7. Tune early onboarding, mid-run build identity, and late-run swarm viability separately. Avoid an early flood of upgrades or late progression drought.

### Priority F: enemy readability, hurtboxes, spawning, and bosses

1. Increase ordinary-enemy projectile hurtboxes in a dedicated deterministic cycle so enemies are easier to hit.
2. Keep render scale, collision, vulnerable hurtbox, and melee contact bounds as separate measured concepts.
3. Test the new hurtbox policy across every enemy role, eight directions, ramps/elevation, close overlap, projectile radii, mobile aim, and dense swarms.
4. Rebalance enemy health, armor, speed, damage, telegraph time, recovery, role mix, spawn intervals, active caps, projectile caps, and attack tokens against the measured player power curve.
5. Preserve distinctive roles for rusher, flanker, suppressor, heavy, demolition, and support enemies.
6. Improve bosses through authored phases, readable counters, add pressure, arena use, and meaningful weapon/build checks rather than health inflation.
7. Validate early, mid, late, elite, and boss bands with same-seed survival, damage-taken, TTK, and frame-time reports.

### Priority G: controls, mobile controls, grenades, and power-ups

1. Audit the complete action map before adding buttons. Remove duplicate or hidden actions and prefer consistent context-sensitive behavior where it reduces burden without causing ambiguity.
2. Keep movement and aiming independent. Preserve desktop mouse aim, controller twin-stick behavior, and touch aim/fire clarity.
3. Evaluate auto-reload, pickup auto-collection, buffered swapping, held-fire behavior, aim assistance for touch/controller, and larger interactive zones through deterministic tests and usability evidence.
4. Keep all touch targets inside safe areas with no control/control, HUD/control, minimap/control, or browser-chrome overlap in portrait and landscape.
5. Improve grenade usability with an aim/landing preview, range clamp, blast preview, charge count, clear ready/empty feedback, and forgiving touch/controller activation.
6. Improve power-ups with unmistakable models, pickup feedback, duration/charge display, activation rules, stacking rules, expiration cues, and meaningful tactical roles.
7. Do not overload one mobile control with unrelated actions unless the interaction is visible, documented, and tested.

### Priority H: 3D world assets, terrain, map design, and minimap fog

1. Generate repository-owned 3D source models for buildings, trees, boulders, road furniture, fences, cover, bridges, ramps, shoreline pieces, landmarks, debris, and biome-specific props.
2. Use Blender source and deterministic rendering/atlas generation where that fits the current PixiJS 2.5D pipeline. Do not import an unrelated runtime or hand-paint shipped atlases.
3. Build modular kits with shared scale, pivots, grounding, collision proxies, LOD policy, material palette, provenance, and byte budgets.
4. Improve map composition with readable routes, loops, sightlines, cover, choke points, flanking space, weapon-role ranges, encounter arenas, recovery pockets, secrets, and memorable landmarks.
5. Make grass, dirt, street/road, ramps, rock, shoreline, shallow water, rivers, lakes, and bridges visually distinct at gameplay zoom.
6. Add deterministic transition masks, edge tiles, decals, shoulders, banks, blend zones, and prop dressing so ground types do not meet as hard flat rectangles.
7. Keep one authoritative world contract for visuals, collision, elevation, minimap, reveal, routes, hazards, landmarks, and encounters.
8. Implement two fog states:
   - `explored`: map geometry remains visible after the player has visited;
   - `currentlyVisible`: dynamic enemy and temporary-interest locations appear only while in current visibility.
9. When an area refogs, retain the revealed map but hide live enemy positions. Keep the player marker always accurate.
10. Show authored special-interest locations with explicit discovery and persistence rules. Never leak unseen enemies or undiscovered secrets.
11. Verify minimap/world alignment at edges, ramps, water, bridges, all districts, portrait, landscape, and browser resize.

### Priority I: comprehensive run statistics

Create a versioned, bounded, deterministic run-stat schema owned by the child simulation and verified by the parent. At minimum track:

- session/build/season/mode/seed/hero/difficulty identity;
- start/end tick, survival time, score, level, XP, Litecoin collected, and max combo;
- kills total, kills by enemy role, elite kills, boss kills, and kills by weapon/damage source;
- shots/triggers fired, projectiles and pellets emitted, shots/pellets hit, misses, accuracy definitions, critical hits, critical damage, elemental/status procs, damage dealt, overkill, and damage taken;
- weapon pickups, ammo pickups, swaps, reloads, empty-trigger attempts, overheats, time equipped, magazines spent, reserve ammo consumed, and per-weapon damage/kills/accuracy;
- melee attacks/hits/kills;
- grenades acquired/thrown/detonated/hits/kills and grenade damage;
- power-ups acquired/activated/expired, time active, and outcomes by power-up;
- upgrades offered, selected, skipped, and final ranks by branch/weapon;
- health pickups, healing, shields, revives/lives, deaths, dashes, distance traveled, district visits, POIs discovered, and fog cells explored;
- enemy waves/bands reached, boss phases reached, encounters cleared, and final defeat cause.

Define accuracy carefully. Trigger accuracy and pellet/projectile accuracy must be separate so a shotgun cannot produce misleading percentages. Keep counters integer and bounded. Do not stream an unbounded event log across the `65,536`-byte bridge; send rate-limited summaries and one final canonical snapshot with replay/evidence bindings.

Profiles should show per-game:

- recent run history;
- personal bests;
- lifetime aggregates;
- per-hero and per-weapon breakdowns;
- build history and favorite upgrades;
- achievements and badge progress;
- Ranked versus Free separation.

Leaderboard rows should show exactly five primary gameplay stats in addition to identity/rank: **score, kills, survival time, max combo, and accuracy**. Keep deeper statistics in the profile or run-detail view. Preserve cadence tabs and verified/trust state.

### Priority J: profile, leaderboard, achievements, game select, and homepage UI

1. Redesign Profiles as a player command center with strong hierarchy: identity/hero, current season, personal bests, five key metrics, recent runs, weapon mastery, achievements, and game-by-game tabs.
2. Redesign Leaderboards for fast scanning with cadence filters, clear current-player placement, verification state, the five primary stats, and accessible mobile tables/cards.
3. Redesign achievement badges as a coherent collectible system with category, tier, progress, locked/unlocked states, rarity, short requirement copy, and the established neon-noir Litecoin palette.
4. Upgrade the game-select screen so HMH is unmistakably playable and Chikun remains clearly Coming Soon. Use current gameplay art, concise cabinet value propositions, control/mode fit, and one obvious primary action.
5. Rework the homepage around a gameplay-first promise rather than technical infrastructure:
   - hero gameplay/key art and `Play Free` above the fold;
   - a short explanation of HMH's combat/build loop;
   - visible profiles, achievements, and competition value;
   - the larger multi-cabinet Lester's Arcade vision;
   - wallet/Web3 explanation after player value, not before it;
   - transparent labels for local, testnet, Coming Soon, and live features.
6. Preserve the art bible: late-1980s/early-1990s arcade chrome, Litecoin blue/silver/brass, CRT glow, and satirical fiat-corruption accents, without sacrificing readability.

### Priority K: shared gameplay music player

1. Use the portal playlist and one shared transport instead of maintaining a separate one-track HMH music island.
2. Music must play during gameplay when enabled.
3. Add the full player to the in-game pause menu: current track, play/pause, previous, next, seek/progress, mute/volume, shuffle if retained, and queue access.
4. Decouple simulation pause and combat SFX pause from music transport so the player can browse or change songs while the game is paused.
5. Preserve the current song and position across portal-to-HMH transitions where browser policy allows.
6. Handle autoplay rejection, tab visibility, page navigation, reduced-data preferences, missing media, and mobile touch access without blocking gameplay.
7. Keep all official playlist metadata and asset paths parent-owned; the sandboxed child may request transport intents but must not acquire wallet or persistence authority.

### Priority L: wallet sign-in and Web3 UX

1. Make guest play immediate. Present wallet connection as `Save profile / Play Ranked`, not as a mandatory game gate.
2. Design explicit states for disconnected, connecting, connected, wrong network, unsupported wallet, rejected request, read-only profile, testnet Ranked, and unavailable settlement.
3. Keep signing actions contextual and explain exactly what is being signed, whether gas is involved, and whether the action is local, testnet, or live.
4. Reconcile local profile, optional chain profile, canonical session, verifier evidence, score submission, and leaderboard ingestion before marketing official persistence.
5. Harden anti-cheat and deterministic replay verification before real prizes.
6. Resolve the blocked registry/economy gate, legal/brand/economy approval, production contracts, trusted verifier, and score/profile readback before enabling real-value functionality.
7. Do not deploy contracts or enable settlement under this handoff.

## 7. Ship and market audit

The project has a strong technical foundation but should not market infrastructure ahead of the playable experience. The highest-leverage release strategy is:

1. **Polish one flagship loop.** Make the first 10 minutes of HMH visually impressive, easy to control, tactically readable, and replayable before expanding public cabinet count.
2. **Remove onboarding friction.** A new visitor should understand the game and reach Free play in under 45 seconds without a wallet.
3. **Make the promise concrete.** Lead with `survive swarms, build an overpowered hero, and compete`, then explain Litecoin/LitVM identity and verification.
4. **Prove balance.** Publish internal benchmark dashboards for progression cadence, weapon pick/kill share, TTK, survival curves, control method, and failure causes. Never balance from one successful run.
5. **Instrument the funnel.** Measure homepage-to-play, mode selection, character choice, run start, one-minute survival, first upgrade, first pickup, death, replay, profile visit, wallet connect, and Ranked submit. Keep analytics parent-owned and privacy-conscious.
6. **Create market-ready evidence.** Capture a short trailer, 10-20 second combat clips, hero/enemy turntables, weapon/power-up clips, map flyovers, mobile gameplay, screenshots, press kit, logo pack, concise fact sheet, and truthful feature matrix.
7. **Build community hooks.** Use daily/weekly challenges, seed sharing, build screenshots, achievement showcases, and verified leaderboard moments before adding speculative token incentives.
8. **Strengthen trust.** Publish privacy/terms, support/contact, accessibility notes, testnet disclaimers, wallet/signature explanations, content provenance, and a clear `no real settlement yet` status.
9. **Protect performance.** Maintain bundle, memory, frame-time, load-time, asset provenance, CDN, security, console/network, desktop/mobile, and rollback gates for every release.
10. **Keep documentation truthful.** Several broad repository docs still describe older production cycles. Update public-facing production/version claims in a bounded docs cycle after the runtime roadmap begins; never let stale docs become release evidence.

Recommended launch gates before paid marketing:

- first-session desktop/mobile usability review with real players;
- measured weapon/progression/enemy balance across short, medium, and long runs;
- no blocker in character animation, collision/art alignment, terrain readability, or minimap truth;
- complete stat schema and profile/run-detail visibility;
- stable guest, wallet, Free, and Ranked journeys;
- zero unexpected release-test failures and zero browser console/network failures;
- documented rollback and incident process;
- truthful feature, testnet, privacy, terms, and support copy;
- campaign landing page, trailer, screenshots, press kit, analytics funnel, and post-launch feedback loop.

## 8. Required cycle discipline

For every bounded slice:

1. Re-read this handoff, the current cycle ledger, `REFERENCE-CHARACTER-MODELS.md`, and the latest certification.
2. Verify branch, working tree, remote, current production, and rollback before editing.
3. Audit current source, tests, generated artifacts, runtime behavior, and performance.
4. Write RED behavioral coverage first.
5. Implement the smallest deterministic coherent change.
6. Run focused GREEN tests, full check/release/build, exact visual regression, browser certification, mobile controls, performance, asset QA, security, Web3, repository health, CDN, and docs links as applicable.
7. For render work, inspect full-resolution desktop and mobile evidence plus machine metrics. Never accept screenshots alone.
8. Stage only the intended packet, compute `git diff --cached --binary | sha256sum`, and obtain exact-index blocker review.
9. Recheck for unstaged and untracked files after review.
10. Commit implementation and closeout documentation separately.
11. Do not push, promote, deploy, or change settlement unless Justin explicitly approves that exact action/candidate.

Core commands:

```bash
npm run check
npm run test:release
npm run build
npm run visual:reboot
npm run certify:hmh:browser
npm run smoke:hmh:mobile-controls
npm run smoke:hmh:performance
npm run assets:qa:hmh-reboot
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
```

Serve local browser evidence from `apps/portal` at `http://127.0.0.1:8791/`, never from `apps/portal/dist`. Confirm port ownership and stop the server afterward.