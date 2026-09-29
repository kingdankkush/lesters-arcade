# Lester's Arcade 2.0 art direction

Status: **draft for the opening vertical slice, not approved production art**. September 29, 2026. Owner reference intake: 35 world images and 18 enemy/boss images. The proposed board selects 24 world images. The art bible and a target-quality patch in the real game must be reviewed together before production art begins.

## 1. Style statement and authority

**A painterly-realistic, lived-in frontier: substantial terrain, trees and worn materials frame clear routes and readable human combat.**

The owner's references lead composition and material treatment. Hades is the quality bar for deliberate composition, animation and combat readability. HMH leads the shared material and colour discipline. Chikun keeps its own character identity and obstacle clarity; STACKED keeps a legible board in front of its autonomous visualizer. Matching quality does not require identical game cameras or art techniques.

The September 29 handoff and current owner requests govern this draft. Preserve [reference character models](../hmh-reboot/REFERENCE-CHARACTER-MODELS.md), deterministic simulation, legacy Ranked verification and current release boundaries. Older pixel/isometric, sprite-only and machine-actor passages in `ART_BIBLE.md` are historical for this 2.0 proposal; they are not permission to resize actors or replace the active camera. This document becomes the production art contract only after owner approval of the bible and the playable slice.

An image supplies visual evidence, not a mechanic. A depicted cliff, shield, inflation phase, water crossing, forge hazard or rooftop does not create collision, cover, damage, traversal or AI. Those changes need their own tested versioned slice and verifier review.

## 2. Camera, human scale and texel density

Keep the active world-space projection and its input inverse. The model camera's **55° from vertical equals 35° above the ground**; do not interpret those as two different camera proposals. Ground-level, aerial and panoramic reference images guide mood and composition only. Character feet, prop bases, elevation and Pixi depth ordering share the authored world coordinates. Real-time actors must interleave correctly with props in front of and behind them.

The current guidance convention is **40 world units per metre** (`mission-guidance.mjs`). Use it for a visual calibration fixture: a 1 m ruler, a nominal 1.8 m human, door, fence, kerb and tree. This suggests a 72-unit visual human height; it does not override the approved hero silhouette, runtime framing or hitbox. Calibrate existing hero/prop rendering against that ruler before changing asset scale. Ordinary enemies remain comparable to humans; large humans and bosses may be larger without becoming robots or abstract proxies.

Proposed fixed authoring density: **128 texels per metre of physical surface, ±10%**, using the calibrated metre. This is a draft numerical target to prove in A1/A2, not an established memory result. Document UV surface area and actual density on model/texture receipts; measure sprite density from its physical footprint and camera bake. A material crossing from ground to wall must have the same apparent grain size. Unique face and signature-prop detail is composed within this density; no arbitrary asset-specific sharpening. Runtime mip selection and lower quality tiers reduce sampling/residency, while physical scale stays fixed.

Prove density at the actual desktop and phone gameplay zooms. A texture that looks good only enlarged in a sheet fails. Prefer shared tileable materials, masks and decals over unique giant canvases. Record physical extents, foot/base pivot, visual bounds, collision-authority ID, texel density, source checksum and measured decoded/GPU residency for every runtime asset. Polygon, bone, texture-edge and per-area residency caps will be fixed from the character/W0 measurements; draft numbers are not acceptance budgets.

## 3. Lighting and value hierarchy

Use one shared key from the **screen upper left**, neutral-warm daylight, provisionally 5,200 K. Record the world-space light vector once the pilot camera is calibrated; do not bake a different direction into each prop. Area atmosphere changes ambient fill and background colour, not the fundamental key direction or collision projection. Avoid hard per-area light changes at streaming boundaries.

Use soft contact shadows at every actor foot, tree root, fence post, stone base and stair landing. Broad canopy and building shadows establish mass; restrained ambient occlusion establishes joints. Wet materials change roughness and local value, without turning the entire ground into a mirror. Runtime characters and baked scenery must agree on shadow direction, softness and apparent light intensity.

Hierarchy: hero and attack cue first, enemy silhouette and weapon second, route/objective third, environmental story fourth. Quiet fight floors use broad value shapes. Concentrate sharp highlights, small detail and layered shadows at perimeter clusters and landmarks. Do not drown playable surfaces in cinematic fog, darkness, bloom or light shafts. A quality reduction must preserve actor, cue, edge and interactable readability before decorative effects.

## 4. Palette and semantic colour

Global environment foundation: charcoal `#26322E`, warm stone `#8B887B`, timber `#6B5C48`, chalk `#D8D5C6`, silver `#B8C1BD` and restrained foliage `#65735A`. These swatches are proposed starting material colours, not flat fills or runtime shader constants.

**Enemy tells reserve red/orange. Pickups reserve gold/cyan. Interactive props share a neutral light rim plus a consistent icon or material mark.** Existing cue semantics remain authoritative. Decorative surfaces do not use those cue swatches, glows or animated pulses. The references' red barns, bright turquoise pools, orange furnaces and theatrical stripes need a quieter treatment: weathered brown timber, subdued green-grey water, dark forge metal and low-contrast stage cloth. Keep the reference's material identity without assigning its decorative emission to the game's danger/reward vocabulary. Any proposed exception is an owner art-direction decision before production.

| Area | Proposed environment palette | Material identity and value composition | Board anchors |
| --- | --- | --- | --- |
| MWEB Meadows | Sage `#78836B`, earth `#786750`, chalk `#D4D0BE` | Warm, welcoming grass and suburb; quiet roads, rooted trees and clustered garden wear | L01, L02 |
| Litecoin City | Slate `#4E5E62`, stone `#91948C`, silver `#B8C1BD` | Glass, concrete, civic metal and worn paving; strong kerbs and building silhouettes | L04, L05, L06 |
| Halving Farms | Olive `#85846A`, weathered barn `#665044`, soil `#625A47` | Crop-row rhythm, timber barns, silos and rutted access roads | L11, L12 |
| Silver Coast | Sand `#B8AC8F`, chalk `#D8D5C6`, water `#406764` | Stratified rock, worn piers, shallow-water depth and restrained luxury architecture | L07, L08 |
| Scrypt Bayou | Olive `#586451`, wet timber `#494D3F`, water `#344C48` | Cypress roots, boardwalk edge values, reeds and stilt structures; mist behind combat | L10, L14, L15 |
| Hashwood River | Pine `#445D4C`, river `#415D61`, rock `#77796D` | Distinct bridges, rocky banks, waterfall shelves and a theatrical clearing | L25, L26, L27 |
| Hollow Pines | Blue-grey `#4C5664`, violet-grey `#605D70`, ash `#8B8D88` | Dead-tree silhouettes and cemetery clusters; continuous visibility of routes and actors | L16, L17 |
| Ledger Ridge | Stone `#7E817A`, cool shadow `#515E66`, sparse pine `#58685D` | Rock strata, switchbacks and quarry structures; readable cliff faces and landings | L19, L20 |
| Fork Fortress | Iron `#424B4B`, masonry `#7B7C70`, worn cloth `#635F68` | Gatehouse, ramparts and courtyard; dark industrial equipment frames the keep | L22, L23, L24 |
| Rugpull Woods | Moss `#56634E`, wood `#635948`, canvas `#96917E` | Mixed trees, tracked dirt, shelters, palisades and clustered camp debris | L30; camp studies pending |

Colour is redundant with silhouette, icon, motion and value. Colour-blind modes must remap actual cue colours consistently, not just add a menu label. Review a greyscale capture, reduced-motion capture and low-quality capture beside the full-quality scene. Retain flash limits; atmosphere and damage reactions must not create uncontrolled full-screen flashes.

## 5. Shape language, materials and wear

Friendly places use sturdy, rounded masses, approachable doors and broad routes. Hostile compounds use tighter vertical silhouettes, angular bracing, asymmetry and reinforced gates. Brand geometry uses clean silver structure, with official marks only where permitted and sourced. Do not place decorative spikes across a route the collision model considers open.

Every landmark has one dominant silhouette, one recognisable material contrast and a readable approach. Use a shared material library: timber, stratified rock, masonry, concrete, iron/steel, cloth, foliage, soil and water. Each hard surface receives coherent edge wear, base grime and broad colour variation. Wear follows use: hand height at gates, wheel routes in mud, waterline staining at piers, moss on sheltered rock. Avoid uniformly scattering scratches or random dirt over every surface.

Build detail in three scales: large masses visible across a screen; medium material seams and root/stone clusters at gameplay zoom; small weathering that survives sampling without shimmer. Simplify tiny chains, paper strips, gear teeth, grass blades and cloth frays at distance. Character LOD preserves face/body identity, weapon and signature prop; it never changes AI or collision. Animation LOD has stable transitions and never draws randomness from simulation streams.

Humanoid actors follow the existing character brief. All 18 supplied enemy/boss references read as humans or zombies with equipment. The nine proposed pair mappings are Rug Puller, Pump-and-Dump Bloater, Tollkeeper, HODL Revenant, Money Printer, Oracle Marksman, 51% Foreman, Rug Pull Baron and Lockkeeper. Mappings remain tentative until the owner confirms them. Machinery is worn or carried equipment. Costume sheets do not specify mechanics, rig readiness or performance.

## 6. Ground, water and foliage

Ground is a layered surface: broad terrain colour, softly blended material masks, local wear, then sparse authored decals. Blend grass into dirt, gravel into road, soil into mud and stone into shore. Rotate/variant texture instances using stateless presentation seeds. Do not create tile seams or obvious repeated landmarks at any supported zoom. Ground detail must not resemble bullets, loot or warning marks.

Roads have shoulders, drainage, kerbs or wheel ruts appropriate to use. Intersections reveal where the player can go; signs reinforce destinations. Water uses bank occlusion, depth, subdued reflections and restrained foam/caustics. Show the difference between a bank, boardwalk, bridge and blocked deep water. Visual ripples never alter navigation or slow an actor. Interpolation, wind, fog, water and vegetation remain presentation only.

Trees come from reusable modelled species baked to sprites with a consistent camera/light/pivot. Start with broad meadow oak, pine, dead pine and bayou cypress studies from the board. Each species needs distinct silhouette variants, root grounding, canopy mass and understory groups. Avoid a row of identical crowns. Sway is restrained and stable; grass and canopy motion cannot hide projectiles or alter collision. Reduced motion suppresses secondary sway. Occluding canopies must use the existing readability policy and depth contract, never conceal a hero just to match a reference composition.

## 7. Readable surfaces and interactions

| Meaning | Visual rule and slice example | Authority constraint |
| --- | --- | --- |
| Walkable | Continuous quieter floor, visible road/boardwalk edge and a body-width route, e.g. L02/L10 | Never paint a path through an authored blocker |
| Blocked | Grounded base and substantial vertical mass, e.g. house wall or stratified cliff in L07/L19 | Match collider footprint and safe movement boundary |
| Tall cover | Continuous tall vertical face, clear toe line and an unobscured approach side | Visual metadata alone does not enable cover or mitigation |
| Short cover | Lower horizontal top, legible knee-height silhouette and clear approach edge | Enter/peek/exit rules belong to the cover slice |
| Climbable | Authored ladder or handhold strip, consistent neutral mark and readable landing | Keep disabled until traversal rules and verifier version exist |
| Drop-down | Visible upper lip, lower landing and authored directional marker | Image elevation is not a traversable edge |
| Interactive | Consistent neutral rim, small repeated symbol and positive state change | Read authoritative objective state; no invented progress |
| Destructible | Clear structural break/joint and a distinct post-event silhouette | Never infer damageability from a cracked texture |

A2 must show walkable and blocked surfaces in the actual game. Cover, climb, drop and destructibility examples can be labelled static studies until their gameplay slices are ready. Do not imply functional interactions in a screenshot. Exact player silhouettes, contrast and edge margins must be checked at full phone framing.

## 8. Density and performance contract

Density is authored in clusters, not uniform noise. Count logical prop instances per **1,000 × 1,000 world-unit audit cell**; count foliage clumps separately from their component leaves, and separate collidable objects from decorative instances. Proposed starting ranges below are layout/visual targets to measure, not proven GPU budgets.

| Area type | Large/medium prop instances per audit cell | Foliage/decal clusters per audit cell | Quiet share of the walkable combat floor |
| --- | --- | --- | --- |
| Meadow / farm | 4–10 | 8–18 | At least 70% |
| Urban street / coastal homes | 10–20 | 6–14 | At least 65% |
| Forest / swamp | 8–16 | 12–24 | At least 65% |
| Camp / fort perimeter | 12–24 | 8–16 | At least 60% |
| Boss court | 6–12, concentrated at the edge | 4–10, mostly perimeter | At least 75% |

Quiet means a broad material/value treatment without bright animated detail or dense small props; it does not remove collision or lower encounter density. Track visible instances, draw calls, active animation counts, effect counts and decoded/GPU bytes in addition to these editorial counts. The lowest passing physical-phone limits override decorative ambitions. Change density targets transparently from measured A2/W0 evidence rather than silently lowering the bar.

Hard release limits remain: HMH initial entry + vendor + static shared JavaScript **1,048,576 B**; STACKED initial JavaScript **607,000 B**. Lazy-load new systems. Required actual-game phone scenarios are 60 enemies + boss + 20 effects + Full gore + four grenades, busiest boss + 20 adds, area streaming and a 30-minute flat-memory run. Heavy wave must reach 30 fps with no frame above 50 ms; streaming stalls stay below 100 ms on phone / 50 ms desktop. Desktop target is 60 fps. Named acceptance device: **iPhone XS Max, Chrome**; iOS version pending. Desktop phone framing is a proxy only.

## 9. Proposed reference board

The local review board contains reduced self-contained previews, observations and source hashes. It is a draft curation, not gameplay evidence. Original images stay in the supplied asset folders; they are neither runtime textures nor public repository assets. [REFERENCE-INDEX-2.0.json](REFERENCE-INDEX-2.0.json) records all 53 sources, checksums, dimensions, tentative mappings and the 24 selected world IDs.

Selected world board: **L01, L02, L04, L05, L06, L07, L08, L10, L11, L12, L14, L15, L16, L17, L19, L20, L22, L23, L24, L25, L26, L27, L30, L35**. Other world images remain in the archive for mood, road transitions and composition. L35 is an overview study, not approved map topology. Rugpull Woods camp detail needs a dedicated accepted study; do not fill that gap with unreviewed production art.

The local owner deliverable is `hmh-2.0-reference-board.html` in this chat's outputs. The board includes character design/sheet pairs E01–E18 as a separate collection. Dedicated sheets for the existing six enemies and Liquidator are not in the newly supplied folder; reuse their existing approved references and models first. New generation awaits casting-board and credit review.

## 10. Target slice and asset review

Build **one Meadows roadside clearing meeting a small neighborhood edge**, anchored by L01/L02: a grounded oak, layered grass/dirt/gravel transition, worn street/kerb, fence or house edge, restrained household prop cluster and an open combat lane. Use existing legal geometry and actors. The patch is for final-quality presentation; no new collision, AI, encounter, objective or traversal rules ride with it. It remains behind a default-off presentation switch until reviewed.

Acceptance requires the actual running game, full-resolution desktop and phone-framed screenshots, motion capture, `visual:reboot` comparison metrics, actor/prop occlusion, input alignment, palette and density inspection, actual bundle bytes and measured texture residency. Compare terrain grain, tree roots, contact shadows, actor scale, direction and weapon readability at gameplay zoom. Repeat in reduced motion and lower quality. A still reference composite cannot pass this gate. Physical phone performance is reported separately.

Submit the **bible and playable patch together** for owner sign-off. Then every asset review includes: source/canon match; calibrated footprint, pivot and density; silhouette/material quality beside the accepted slice; full-resolution desktop and phone framing; collision-to-art agreement; runtime bytes/residency; animation/depth/disposal evidence where applicable. Below-bar assets are fixed or cut. Bulk editable sources remain in the asset vault; only optimized runtime assets enter Git LFS after review. No unverified deletion or migration of sources.

Open approval fields: board selection; style and area palettes; ruler/density calibration; shared light vector; measured density/memory limits; final target slice; tentative enemy/boss mapping. Draft defaults do not replace these checkpoints. [Program progress](../2.0/PROGRESS.md) records completed slices, failures, evidence and decisions. The owner now requests **one combined final release**; no interim publication is planned.
