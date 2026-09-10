# Level 1 world and simple controls return

Codex source lane, 2026-09-10. This is an incremental return over the captured mixed integration baseline. Hermes owns reconciliation, combined acceptance and publication. The delivery manifest and validation receipt identify the exact files; this document does not certify a deployment or replace the original work register.

## Player-facing behavior

Players move, aim and throw grenades. Mobile fires automatically at eligible targets; moving the AIM stick overrides automatic aiming, and releasing it restores automatic target selection on the next simulation tick. Desktop mouse and gamepad aiming also fire without a separate fire button. Pause opens the existing menu. Grenade is F (G alternate) on the default keyboard layout.

Nearby machinery begins operating when approached with clear line of sight at the same elevation. The player can keep moving while it finishes. There is no interact button, stand-still requirement, dash button, weapon-switch button, double-tap gesture or manual power-up activation. Existing upgrade choices remain in the upgrade menu. Native hero arm motion briefly reaches toward nearby machinery while the walking pose continues.

Automatic close combat uses the existing melee arc, wall/height checks and damage resolver. An empty swing does not consume its cooldown. Automatic dodge follows the current movement direction when a visible ordinary enemy's attack is imminent and the entire destination is safe. It requires movement; it never selects a different direction for the player. Water, drops, walls, boundaries and a path through the attacker disqualify it. Boss attacks and already travelling projectiles are outside the current automatic-dodge trigger. Existing distance, duration and cooldown values remain unchanged.

## World layout

Level bounds remain 12,000 by 4,800 units. Movement speed, player body radius, fixed 60 Hz simulation and four-step catch-up limit are unchanged. Five additional path circuits give the farmstead, quarry, woodland, mining yard and warehouse alternate approaches and exits. Six arena descriptors distinguish open spaces, cover pockets, narrow approaches and recovery areas. A short recovery interval follows a cleared fight once per arena; nearby pursuing threats cancel it and the boss clock continues.

The reservoir now has an eastern through-route and a western bank spur. The fuel yard, relay depot and mining enclosure all remain present. The original 24-unit art-clearance guard remains unchanged. The Hashwood thicket's native tree anchors are derived from its moved collision capsule, so its art moves with its blocker. The elevated timber footbridge and main bridge retain ramps and solid rails; water outside their decks blocks traversal. Visible perimeter barriers explain the physical world boundary.

| Site | World position | Automatic result |
| --- | --- | --- |
| Relay power | 340, 3540 | Power-up feedback, healing and farmstead gate |
| Ravine winch | 2990, 2810 | Opens the salvage court |
| Crossing pump | 5800, 4280 | Supplies and active pump feedback |
| Hashwood shrine | 7380, 3450 | Recovery and shrine feedback |
| Mining valve | 9210, 3030 | Telegraphs then releases a bounded steam hazard |
| Warehouse control | 10490, 3910 | Supplies and service-court gate |

Opening a gate removes the matching collider and refreshes only its local navigation cells. Reset closes the gates and restores navigation. Steam respects height and line of sight, attributes damage to the environment, and does not grant enemy kill credit.

## Secrets

Three new discoveries use actual collision, damage and collection paths:

| Secret | Position / elevation | Condition and reward |
| --- | --- | --- |
| Boarded supply chest | 370, 3270 / 0 | Open farmstead approach, destroy the 60-health crate through normal combat, then collect ammunition |
| Surveyor's ledge cache | 3150, 1460 / 64 | Reach the dry overlook at its real elevation; healing and surveyor lore |
| Warehouse logbook | 10530, 3760 / 0 | Reach the service court; environmental lore |

Each is collected once per run, requires same-height contact and clear line of sight, and resets with the run. The destructible chest is not an AI enemy and grants no enemy kill/XP credit. Discoveries display a short caption and remain readable in the pause field map.

The crate retains its physical collider while taking damage. A projectile's first cover contact becomes one crate damage intent. Melee and grenade line of sight may strike a destructible target's own matching collider; that collider continues to shield different targets behind it. The dedicated secret-combat regressions exercise these real geometry paths.

The field map displays the existing discovery state, routes, water, machinery and collected lore. It is constructed on pause and does not mutate simulation state. There is no gameplay fog of war.

## Presentation and performance

Native town, industrial, bridge and camp assets remain the approved delivered files. This return adds placement and runtime behavior; it does not claim new Tripo or Blender modelling. Existing source-model provenance and the prior immutable native packet remain prerequisites.

Foreground trees and buildings fade when covering the player or nearby threats. Bridge decks stay opaque. Organic props have subtle motion that stops under reduced motion. Enemy animation budgets reuse poses while retaining visible enemy bodies. Terrain and bridge footsteps vary the playback of existing licensed cues; device listening acceptance remains separate.

Native campfire rings receive a warm ground glow and rising embers. At most four visible fires and twelve embers are produced, with embers sharing the existing world-life particle allowance with machinery/steam. Reduced motion retains a static glow and removes moving embers. Zero particle allowance removes embers. These effects are projection-only.

A static spatial index reduces repeated prop projection work. It changes candidate lookup only: camera jumps, zoom, shake, height, visible ordering and add/remove invalidation are covered. The CPU-only fixture uses the actual prop renderer with a lightweight display implementation; its timing is not a whole-game FPS or GPU-memory result. Fog and AI culling were not introduced.

Hermes's `hmh-reboot/world-art` build entry is the retained factoring seam. Every transitive static chunk still counts against the original 1,048,576-byte initial aggregate cap, and the entry cap remains 480,000 bytes. The superseded Codex alternative entry is not part of the return.

The final build initially exceeded the aggregate limit by 3,746 bytes. The optional mannequin preview now loads only when its existing pipeline-preview switch is selected, and the field map loads on first pause. These are conditional features; the game does not defer required gameplay code to evade accounting. A map-load failure leaves the pause/resume controls usable. The measured repaired build is 472,112 bytes for the entry and 1,047,441 bytes including the vendor and all static shared chunks, leaving 1,135 bytes of aggregate headroom.

## Burner causality

The existing lower-level Burner and combat resolver corrections are inherited Hermes work. This return carries real aim provenance and current target eligibility through the main runtime, weapon wrapper, channel refresh, damage intents and defeat spread. Automatic contact filters ineligible ambient actors before applying a burn. A manually initiated burn retains its causal origin across automatic refresh. The actual aim resolver now returns the automatic/manual flag used by the runtime.

Current published ordinary enemies are hostile. This return does not import the withheld historical ambient spawning/pacing/balance system. Its eligibility seam supports explicitly ambient actors without pretending that larger system is integrated.

## Ownership and integration

The source return is scoped to HMH world, controls, automatic actions, related rendering and dedicated tests. Parent profile/history, achievements and Ranked preflight are authenticated prerequisites, not Codex-authored changes. Settlement remains disabled. Chikun and paused STACKED work are untouched by this delta.

The package includes before/after images, hashes and a commit for this incremental change. Apply only after checking the matching captured prerequisites. Three-way reconcile shared `main.mjs`, `authored-prop-atlas.mjs`, action-map/cockpit and syntax registrations if Hermes has newer edits. Regenerate derived inventory and decals from the final integrated topology. Do not replay the older cumulative 32-file native packet over newer changes or replace either mixed working tree/index wholesale.

## Validation boundary

Focused tests cover paths, all three enclosure clearances, water/bridge traversal, directed elevation return paths, gate reset/navigation, secrets, effects budgets, aim release, removed gestures, rebinding/settings consumers, melee/dodge eligibility and Burner replay partitions. The movement report measures the canonical simulation module: first movement on tick one, full speed in five ticks, stopping in four and reversal through zero in three. Browser event-to-first-observed-render timing is separate from physical input/display latency.

The final handoff's validation receipt supplies the gate and Chromium results. Source syntax passes 481 JavaScript modules and 81 Python scripts. The full retirement-gated suite was interrupted without a completion result, including the latest `fourteen-final-17` attempt; a combined-candidate full run remains required. Historical logs, failed attempts and interrupted runs are retained as such.

Twelve visual scenes completed with no scene assertion errors, but all differ from inherited baselines. The reviewed images show readable actors and contained controls; dense hedge bands, repetitive purple yard tiles, road/ground seams, coarse container/fence composition and incomplete native enemy coverage remain visible. Baselines were not accepted. The R-3, W-17 and W-18 implementation slices must not be represented as whole-register AAA art closure. G-7 likewise covers runtime eligibility/causality, not the historical ambient spawning program.

Hermes records the owner's permission to publish a verified combined website/game update while retaining human playtests and unfinished AAA art as open work. That permission does not complete those tasks or replace integrated machine, browser, Preview, rollback and hosted-byte checks. Independent integration review, physical-device measurements, five first-time desktop and five first-time mobile playtests remain separate acceptance debt. No source-only result is represented as AAA acceptance or live publication.
