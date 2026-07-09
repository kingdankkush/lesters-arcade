# Lester's Arcade + Hard Money Heroes Release-Readiness Master Task List

Generated: 2026-07-09
Owner: Justin Pinter / Lester's Arcade
Primary target: `https://lestersarcade.io`
Runtime target: Canvas 2D isometric roguelite on the existing portal stack

## Release objective

Ship Lester's Arcade as a fast, trustworthy, polished game portal with Hard Money Heroes Level 1 as a complete, replayable flagship cabinet. Level 1 polish, gameplay feel, performance, and release safety take priority over Level 2, Level 3, and new cabinet expansion.

## Shipping rules

- Website, portal, game, docs, and art fixes may ship after local gates, independent review, and live verification.
- No contract deployment, address rotation, transaction, fund movement, or chain migration without a separate explicit deploy approval.
- Preserve deterministic simulation and seed `1337` visual evidence.
- Keep user-provided and untracked art staging intact unless it is explicitly approved for integration.
- Every gameplay card or setting must have a real runtime consumer and an end-to-end test.
- Tests that only confirm strings, selectors, files, or manifests do not count as human-feel or active-gameplay proof.

---

# P0: Release blockers

## Product and canon

- [ ] Declare Level 1 as the canonical open-ended score-survival mode.
- [ ] Generate run duration, map dimensions, boss schedule, ending rule, and mode copy from runtime constants.
- [ ] Remove obsolete 8-minute extraction and conflicting fixed-campaign claims.
- [ ] Define Release Candidate acceptance metrics and evidence levels.
- [ ] Freeze Level 2, Level 3, and new cabinet expansion until the Level 1 release gate passes.

## Production build and loading

- [x] Remove eager landing-page hero sprite prewarming.
- [x] Prewarm only the selected hero's opening idle, run, and shoot states.
- [ ] Ensure HMH code and art stay outside the landing-page static import closure.
- [ ] Lazy-load wallet and `ethers` code only when a wallet action is requested.
- [ ] Lazy-load HMH asset footprints and editor/audit data.
- [ ] Build a clean allowlisted production directory instead of publishing all of `apps/portal`.
- [ ] Exclude source sheets, still libraries, reference packs, contact sheets, audit data, editor files, and deprecated art from production.
- [ ] Add landing-shell, HMH-start, file-count, and deploy-size budgets.
- [ ] Convert high-request animation folders to runtime atlases or state sheets.
- [ ] Add a build failure when an asset exceeds the production policy.

## Active-gameplay verification

- [ ] Make visual regression click the READY overlay instead of hiding it.
- [ ] Assert gameplay time advances after READY.
- [ ] Capture deterministic moving-player gameplay.
- [ ] Capture an enemy attack telegraph and recovery.
- [ ] Capture player fire, projectile hit, grenade, and explosion states.
- [ ] Capture the first level-up draft.
- [ ] Capture a dense five-minute swarm.
- [ ] Capture boss phase and boss death.
- [ ] Capture game-over and retry.
- [ ] Capture desktop, portrait touch, and landscape touch layouts.
- [ ] Record p50, p95, and worst frame time, long tasks, object counts, and memory growth.

## Core gameplay verbs and upgrade truth

- [ ] Implement the Level 1 dash with collision-safe travel and short invulnerability.
- [ ] Add dash cooldown, distance, VFX, SFX, HUD, and deterministic replay behavior.
- [ ] Audit every upgrade stat from acquisition through simulation and HUD.
- [ ] Hide or remove cards with no measurable runtime effect.
- [ ] Add end-to-end coverage for each upgrade category.
- [ ] Add upgrade synergies for rapid fire, pierce, demolition, tank, critical, and economy builds.
- [ ] Guarantee at least one visible power moment or evolution in a healthy run.
- [ ] Balance rerolls and locked previews around useful choices rather than filler.

## Enemy AI and combat readability

- [ ] Add attack-token orchestration for melee, ranged, flyer, hazard, elite, and boss pressure.
- [ ] Cap simultaneous telegraph and active attack states by difficulty band.
- [ ] Keep non-token enemies flanking, repositioning, recovering, or threatening.
- [ ] Add clear attack anticipation, active, and recovery phases to every Level 1 family.
- [ ] Ensure attack telegraphs outrank decorative VFX.
- [ ] Validate enemy separation, steering, wall avoidance, and obstacle routing at swarm density.
- [ ] Validate bounded AI movement near water, walls, map edges, and authored gates.
- [ ] Prevent enemies from spawning inside the player, obstacles, water, or inaccessible terrain.

## Boss release gate

- [ ] Select one real signature Level 1 boss.
- [ ] Replace the final proxy boss with unique runtime art and behavior.
- [ ] Author true movement, attack tell, attack, hit, phase, and death states.
- [ ] Implement at least three readable baseline attacks and one signature super move.
- [ ] Add boss arena boundaries, add-spawn rules, music layer, health bar, and rewards.
- [ ] Add deterministic boss choreography tests and live browser captures.

## Art certification

- [ ] Add perceptual duplicate-frame thresholds per actor, state, and direction.
- [ ] Reject copied stills presented as native 8-direction animation coverage.
- [ ] Validate foot pivots, frame bounds, transparency, and runtime-scale silhouettes.
- [ ] Keep enemy runtime scale at 100 percent.
- [ ] Author separate small and large source sprites where size affects hit detection.
- [ ] Produce human-review contact sheets for promoted runtime actors.
- [ ] Record source, license, generation provenance, and approval state in manifests.

## Trust, ranked play, and security

- [x] Label synthetic leaderboard rows as House Scores, Demo, or AI.
- [x] Show only each wallet's best run per cadence so one player cannot occupy multiple leaderboard ranks.
- [ ] Separate Practice, Ranked Testnet Beta, Daily Seed, and House Score boards.
- [ ] Make ranked publishing an explicit player action after game over.
- [ ] Prevent surprise wallet prompts immediately after death.
- [ ] Bind ranked receipts to wallet, game, build, season, seed, input-log hash, assists, and session.
- [ ] Add verifier replay before official competitive acceptance.
- [ ] Preserve client plausibility checks as a signal, not final trust.
- [ ] Run source, dependency, CSP, sandbox, settlement, and contract static audits before each release.
- [ ] Add rate limits and schema validation to parent/child game messages.
- [ ] Keep contract deployment and on-chain writes approval-gated.

---

# P1: Fully playable Level 1

## First-run experience

- [ ] Deliver first movement, enemy, shot, pickup, grenade, and level-up inside 90 seconds.
- [ ] Teach through authored encounters instead of a text-heavy tutorial.
- [ ] Show one clear objective and one clear next landmark.
- [ ] Keep debug, seed, weather, detailed zone, and secondary metrics out of the default HUD.
- [ ] Offer tooltips and a replayable controls screen without blocking returning players.

## Hero identity

- [ ] Give Lit Commando a durable bruiser signature mechanic.
- [ ] Give Lit Valkyrie a mobility/critical signature mechanic.
- [ ] Give Lester a consistency/reroll signature mechanic.
- [ ] Give Lilly a precision/tactical signature mechanic.
- [ ] Add starting weapon/passive differences, not only stat multipliers.
- [ ] Balance every hero against the same deterministic encounter suite.
- [ ] Verify all hero animations at real gameplay scale and direction.

## Level design and authored traversal

- [ ] Establish the Level 1 landmark route: desert drop, Rugpull Gulch, forest/cave detour, crossroads, warehouse/gas station, oasis/mesa, city threshold, boss arena.
- [ ] Give every zone a unique silhouette landmark.
- [ ] Give every zone one combat geometry idea, enemy composition, interaction, reward, and exit sightline.
- [ ] Keep the spawn area clear and readable.
- [ ] Blend biome and district seams with authored transition bands.
- [ ] Remove checkerboard terrain, random prop scatter, and abrupt art-family transitions.
- [ ] Keep major roads and pathways continuously readable under props, enemies, and effects.
- [ ] Prevent props and decals from blocking required routes.
- [ ] Add route recovery when the player enters a non-critical dead end.
- [ ] Keep authored landmarks deterministic across the same seed.

## Boundaries, walls, hitboxes, and hit detection

- [ ] Validate player collision against every wall, fence, building, prop, and world edge.
- [ ] Validate enemy collision and route recovery against the same obstacle set.
- [ ] Match visible sprite feet and body mass to runtime hurtboxes.
- [ ] Use separate boss hurtboxes by phase where needed.
- [ ] Validate swept projectile collision at maximum projectile speed.
- [ ] Prevent bullets from tunneling through thin walls or enemies.
- [ ] Add wall impact feedback and projectile termination policy.
- [ ] Validate melee, contact, AoE, grenade, and chain-detonation hit detection.
- [ ] Add debug overlays for collision, hurtbox, navigation, and boundary audits.
- [ ] Add deterministic regression cases for corners, narrow passages, and overlapping enemies.

## Water and pathway behavior

- [ ] Classify water tiles as blocked, shallow, deep, current, or decorative.
- [ ] Apply clear movement and visual rules for each water type.
- [ ] Add shoreline foam, edge breakup, reflection/ripple, and impact effects within performance budgets.
- [ ] Prevent player and enemy spawns in blocked water.
- [ ] Prevent pathfinding from routing through blocked water.
- [ ] Give shallow crossings authored entry/exit points.
- [ ] Add deterministic water collision tests near bridges, banks, fords, and corners.
- [ ] Add projectile and grenade behavior rules for water surfaces.

## Enemies

- [ ] Lock a smaller certified Level 1 roster before adding more names.
- [ ] Maintain distinct chaser, flanker, ranged, tank, ambusher, pack, flyer, and hazard-controller jobs.
- [ ] Give every family a readable entry, tell, counterplay, hit, and death.
- [ ] Add composition rules that teach one family before combining it with others.
- [ ] Use elite affixes that alter counterplay without obscuring silhouettes.
- [ ] Keep late-run difficulty composition-driven instead of pure body count.
- [ ] Add spawn director telemetry for family count, active tokens, pressure, and fairness.

## Weapons, skills, leveling, and economy

- [ ] Verify damage, fire rate, reload, magazine, bullet speed, pierce, spread, critical, armor, health, pickup, luck, grenade, dash, regeneration, combo, score, revive, and evolution effects.
- [ ] Define six strong build archetypes with readable card iconography.
- [ ] Add level-up choice weighting that supports the player's current build.
- [ ] Prevent dead offers, impossible prerequisites, and redundant maxed choices.
- [ ] Tune XP so one enemy pack cannot chain several menus.
- [ ] Tune post-cap XP conversion and score reward.
- [ ] Add build-history data to run summaries.
- [ ] Add one-click same-seed and new-seed retry.

## Combat feel, audio, and VFX

- [ ] Establish visual priority: player, hostile tells/projectiles, elites/bosses, pickups, collision, damage, decoration.
- [ ] Add recoil, muzzle flash, bullet trails, hit sparks, impact pause, damage numbers, and death feedback without obscuring tells.
- [ ] Add sample-backed grenade explosion, enemy death, XP, level-up, elite, boss phase, boss death, shield break, and low-health cues.
- [ ] Add audio ducking for player damage and boss warnings.
- [ ] Add family caps and distance attenuation for swarm audio.
- [ ] Add automatic VFX quality tiers based on frame time.
- [ ] Verify reduce-motion, flash, shake, gore, music, SFX, and contrast settings.

## Controls and devices

- [ ] Implement real Gamepad API input with left-stick move and right-stick aim.
- [ ] Add dead zones, button mapping, aim assist, vibration toggle, and reconnect handling.
- [ ] Implement complete key rebinding with conflict detection.
- [ ] Verify mouse aim and auto-fire behavior across canvas scaling modes.
- [ ] Verify touch movement, aim, grenade, power, pause, and level-up controls with real pointer events.
- [ ] Test actual Android portrait/landscape and iOS portrait/landscape devices.

---

# P1: Lester's Arcade portal and platform

## Landing and cabinet UX

- [ ] Make Hard Money Heroes the dominant playable call to action.
- [ ] Reduce two empty ad placements to one sponsor rail until inventory is sold.
- [ ] Replace unused ad space with gameplay, challenge, score, or update content.
- [ ] Normalize cabinet lighting, scale, framing, and status labels.
- [ ] Clearly mark Playable, Private Test, In Production, and Concept cabinets.
- [ ] Remove internal prototype and developer-backstage copy from production.
- [ ] Preserve the retro CRT/neon visual language while reducing clutter.

## Guest, wallet, and mode trust

- [x] Show Guest Practice Profile for guest sessions.
- [x] Show Wallet Profile Connected only after a real wallet connection.
- [ ] Show clear wrong-network and LitVM-ready states.
- [ ] Explain exactly what Free saves locally and what Ranked publishes.
- [ ] Keep wallet connection optional until the player requests Ranked.
- [ ] Add actionable wallet rejection, wrong-network, RPC, and settlement recovery copy.

## Profiles, sessions, stats, and leaderboards

- [ ] Store and present personal best history.
- [ ] Record hero, weapon, build, kills per minute, bosses, zone, seed, build hash, assists, and integrity verdict.
- [ ] Add explorer links for published runs.
- [ ] Add shareable run cards and Play This Seed links.
- [ ] Add profile privacy, export, and delete controls.
- [ ] Add pending-session and pending-settlement recovery.
- [ ] Add season-aware leaderboard filters and pagination.
- [ ] Add anomaly flags and moderation review state.
- [ ] Add cross-device profile persistence after signed wallet authentication.

## Analytics and operations

- [ ] Add privacy-safe funnel events from landing through retry and settlement.
- [ ] Add run-start, first-kill, first-level-up, first-death, run-end, and retry events.
- [ ] Add wallet attempt, success, rejection, wrong-network, publish attempt, and publish result events.
- [ ] Keep raw wallet addresses and private data out of analytics.
- [ ] Add production error reporting with build and session identifiers.
- [ ] Add operational dashboards for run success, load failure, settlement failure, and browser/device mix.

## Accessibility and SEO

- [ ] Verify keyboard-only navigation and visible focus on every portal screen.
- [ ] Add semantic alternatives for important canvas-only state.
- [ ] Verify reduced motion, high contrast, zoom, screen reader, and touch target behavior.
- [ ] Add accurate canonical, Open Graph, Twitter, sitemap, robots, and structured data.
- [ ] Add game-specific share imagery and descriptions.
- [ ] Audit heading structure, labels, live regions, and contrast.

---

# P2: Runtime and repository optimization

## Render loop

- [ ] Cache background gradients by canvas size and environment state.
- [ ] Render terrain into reusable offscreen chunks.
- [ ] Rebuild visible-tile lists only when the camera crosses tile boundaries.
- [ ] Pool render entries instead of allocating closures and objects every frame.
- [ ] Add spatial buckets for obstacles, lights, pickups, enemies, and projectiles.
- [ ] Replace full enemy-distance sorting with bounded nearest selection.
- [ ] Cache lighting masks and update only moving lights.
- [ ] Update DOM HUD and FPS text at 4 to 10 Hz instead of 60 Hz.
- [ ] Stop requestAnimationFrame when gameplay is hidden or inactive.
- [ ] Cap effective DPR by device performance tier.
- [ ] Add low, medium, high, and auto quality profiles.

## Assets and repository health

- [ ] Move recoverable raw generated output into the external asset vault.
- [ ] Preserve runtime atlases, manifests, QA sheets, and licensed source references in the repo.
- [ ] Deduplicate exact binary assets through manifest aliases or atlases.
- [ ] Add duplicate-content and duplicate-frame reports to CI.
- [ ] Prune obsolete generated packs only after verified runtime reference scans.
- [ ] Run Git maintenance after asset cleanup.
- [ ] Keep history rewrite as a separate explicit approval gate.

## PWA and caching

- [ ] Generate service-worker cache keys from the production asset manifest.
- [ ] Use content-hashed runtime asset URLs.
- [ ] Show Update Available when a waiting worker exists.
- [ ] Verify old art cannot survive a new release at the same logical key.
- [ ] Add offline behavior for the portal shell and already-downloaded Free mode.
- [ ] Keep wallet/RPC/leaderboard calls network-first and failure-safe.

## CI and certification

- [ ] Add GitHub Actions for tests, syntax, contracts, production build, and dependency audit.
- [ ] Add bundle, asset, duplicate-frame, cache, browser, visual, and performance gates.
- [ ] Add nightly deterministic gameplay and security sweeps.
- [ ] Label evidence as source, unit, browser, visual, human, real-device, or production verified.
- [ ] Prevent reports from claiming Gaps: None when required evidence is missing.
- [ ] Generate status docs from runtime constants with build hash and generated date.

---

# P3: Platform expansion after Level 1 release

- [ ] Move every cabinet behind a sandboxed iframe or isolated origin.
- [ ] Make the parent own wallet, identity, profile, and settlement permissions.
- [ ] Validate child intents through a versioned SDK schema.
- [ ] Add an external developer test harness and security checklist.
- [ ] Publish cabinet integration documentation and terms.
- [ ] Integrate Chikun only after the sandbox is proven by HMH.
- [ ] Activate Level 2 only after Level 1 release metrics and performance pass.
- [ ] Add daily seeds, weekly challenges, ghost/replay sharing, and tournaments after ranked verification is trusted.
- [ ] Finalize code, art, music, generated-asset, brand, and contributor licensing.

---

# Release metrics

- [ ] Landing page requests zero HMH sprite frames before cabinet selection.
- [ ] Landing shell reaches interactive state without loading wallet or HMH gameplay chunks.
- [ ] First-time guest reaches active gameplay in 20 seconds or less on a normal broadband desktop.
- [ ] Retry returns to active gameplay in three seconds or less after assets are warm.
- [ ] Desktop target p95 frame time stays at or below 16.7 ms in the certified encounter suite.
- [ ] Lower-tier quality target p95 frame time stays at or below 33.3 ms.
- [ ] No required runtime asset 404s, uncaught console errors, or broken image decodes.
- [ ] No upgrade card is offered without a verified runtime effect.
- [ ] No official leaderboard row lacks provenance and integrity state.
- [ ] No automatic wallet transaction prompt occurs without the player's explicit publish action.
- [ ] Five new-player playtests complete movement, first kill, first upgrade, and retry without coaching.
- [ ] Level 1 passes visual, human-feel, real-device, performance, security, and production evidence gates.

---

# Initial implementation waves

## Wave 1: Release foundation

- [x] Selective hero prewarm
- [x] Active-gameplay visual regression
- [x] Guest/profile trust copy
- [x] House Score provenance and one-best-run leaderboard ranking
- [ ] Service-worker cache hashing
- [ ] Current runtime/status documentation
- [ ] Full local gate, independent review, push, and live verification

## Wave 2: Gameplay truth

- [ ] Dash
- [ ] Upgrade runtime audit and repair
- [ ] Attack-token AI
- [ ] Hitbox/collision/wall/water/pathway regression suite
- [ ] HUD simplification and onboarding

## Wave 3: Flagship content

- [ ] Certified Level 1 enemy roster
- [ ] Signature boss
- [ ] Authored route and zone polish
- [ ] Combat audio/VFX polish
- [ ] Hero mechanical identities
- [ ] Free retention and run recap

## Wave 4: Platform and optimization

- [ ] Clean production output
- [ ] True HMH/wallet lazy boundaries
- [ ] Asset atlases and vault cleanup
- [ ] Ranked verifier and profile persistence
- [ ] CI, PWA hashing, accessibility, real-device, and final release certification
