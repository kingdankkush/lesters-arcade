# Hard Money Heroes Playtest Improvement Audit

Date: 2026-07-10
Scope: Level 1 gameplay, combat feel, actor art, animation, mobile controls, responsive behavior, game UI, loading flow, and Lester's Arcade website UI
Status: Evidence-backed improvement backlog. This is not an implementation completion report.

## Executive finding

The recent terrain, road, culling, grounding, and authored prop work moved Level 1 in the right direction. The next quality ceiling is no longer basic tile coverage. It is consistency between what the player sees and what the simulation believes.

The five highest-impact problems are:

1. Mobile gameplay does not own the viewport. The portal shell and HUD push the canvas below the fold, and rotating can leave the movement stick offscreen.
2. Enemy hit detection is not derived from the enemy body. The bullet radius currently becomes the fallback enemy target radius.
3. Enemy visual scale is nominally fixed at runtime, but source canvases and opaque silhouette bounds vary widely, so actors still appear at inconsistent sizes.
4. Level-up cards accept an immediate click with no input quarantine, allowing the shot that triggered the popup to become an accidental upgrade selection.
5. The runtime has a large amount of complete-on-paper art that is still proxy-derived, pivot-unstable, visually mismatched, or dependent on coded geometric effects.

The best sequence is to fix simulation and input truth first, then normalize actor art, then improve animation and weapon feel, then complete the larger UI and level-composition pass.

---

## Audit evidence

### Live desktop playtest

The current production build successfully renders the hero, authored terrain, roads, fog, opening props, VFX, and HUD. The opening scene decoded all 47 tested obstacles without missing assets. This confirms the new map direction is viable.

The remaining visual weaknesses are consistency and composition, not total asset absence:

- Actors do not share a reliable visible scale.
- Some enemies use proxies or inherited actors.
- Coded gradients, ellipses, triangles, bars, and diamond overlays compete with the newer pixel-art sheets.
- The game shell and text chrome still consume too much of the play area.
- Complete animation manifests do not guarantee smooth motion or stable pivots.

### Exact mobile browser emulation

A real browser run was emulated at 390x844 portrait, then rotated in the same session to 844x390 landscape.

#### Portrait result

- Viewport: 390x844
- Document height: 1,075 px
- Canvas: x 29, y 829, width 318, height 142
- Movement stick: y 688, visible
- Aim stick: y 688, visible
- Grenade button: y 642, visible

The canvas begins at y 829, leaving only about 15 px visible in the initial viewport. The player sees navigation, title, mode copy, a large stat grid, progression copy, and touch controls before seeing meaningful gameplay.

#### Landscape result after rotation

- Viewport: 844x390
- Document height: 1,149 px
- Canvas: y 692, completely offscreen
- Movement stick: y 688, completely offscreen
- Aim stick: y 234, visible
- Grenade button: y 188, visible
- Gameplay top bar and stat bar remain oversized and contribute to overflow

The orientation change updates some controls, but the existing floating movement-stick node retains its portrait coordinates. The game canvas also remains far below the viewport because gameplay is still laid out as a scrolling website page.

Evidence files from the audit run:

- `.tmp/mobile-audit/gameplay-portrait.png`
- `.tmp/mobile-audit/gameplay-landscape.png`

### Enemy hit detection

Relevant runtime path:

- `apps/portal/main.js:8529-8536`
- `apps/portal/src/world-obstacles.mjs:261-270`

`circleTargetHitAlongSegment()` resolves the target radius as:

```js
target.hitRadius ?? target.radius ?? defaultRadius
```

Level 1 enemy objects are not assigned a world-space `hitRadius` or `radius` during spawn. The caller supplies `bullet.hitRadius` as `defaultRadius`.

Current projectile radii include:

- Starter/default projectile: 0.36
- Auto Miner: 0.34
- Spread LTC: 0.38
- Scatter Shotgun: 0.46
- Hash Rail: 0.52

Result: an enemy's effective target circle changes based on which weapon is shooting it. The bullet radius substitutes for the enemy hurt radius instead of expanding it.

Enemy pathing and body separation also use hard-coded radii such as `0.4`, so mini-bosses, standard humanoids, and small creatures do not yet have a unified size and collision policy.

### Actor scale and sprite QA

Runtime rendering uses a fixed 88 px draw box for animated or wave enemies, but the source art is not normalized by visible silhouette bounds.

The sampled QA set currently reports 8 of 8 actors failing:

| Actor | Sampled frames | Canvas dimensions | Maximum pivot delta |
| --- | ---: | --- | ---: |
| Lester | 16 | 73x96 and 57x96 | 13.759 |
| Lilly | 16 | 71x96 and 54x96 | 19.5 |
| Lit Commando | 16 | 136x136 | 4.279 |
| Lit Valkyrie | 16 | 136x136 | 5.896 |
| FUD Goblin | 16 | 92x92 | 0 |
| Gas Fee Wisp | 16 | 93x88 and 74x88 | 10 |
| Claim Jumper | 16 | 188x188 | 14.305 |
| Gas Beast Tank | 16 | 93x88 and 74x88 | 10 |

A fixed runtime draw box cannot make a 188x188 source, a 92x92 source, and a 136x136 source appear equally sized unless the opaque body occupies the same proportional area and uses the same foot anchor. It currently does not.

The generated QA PNGs are also not useful visual actor contact sheets. They render as tiny status bars rather than readable animation comparisons. The QA pipeline needs a real body-bounds, pivot, and frame-sequence montage.

### Animation coverage versus animation quality

The roster report contains 38 actors. Thirty-four are complete against the current state matrix, and four are partial:

- `bitcoin-maximalist-riot-cop`
- `influencer-camera-drone`
- `nft-valet`
- `stablecoin-socialite`

However, manifest completeness does not prove:

- stable foot pivots
- consistent silhouette size
- unique adjacent frames
- readable anticipation, contact, and recovery poses
- correct state timing
- correct direction selection
- smooth transitions between states

The canonical actor pipeline resolves enemy direction as `south` in one path, while the animated-roster path computes player-facing direction. Because the canonical pipeline is preferred during rendering, some actors can ignore their available directional art.

The runtime already has 8-direction and multi-state coverage for many actors. The immediate fix is not to generate frames indiscriminately. First correct pivots, state routing, timing, alpha bounds, and directional selection. Then add only the missing key poses or in-betweens that improve readable motion.

### Level-up selection

Relevant code:

- `apps/portal/main.js:2399-2515`
- `apps/portal/styles.css:1005-1054`

Each upgrade card immediately binds:

```js
button.addEventListener('click', () => selectLevelUpUpgrade(card.id));
```

There is no opening timestamp, pointer-release gate, input flush, or click quarantine. If a level-up opens while the player is firing or touching the screen, the new card can appear under the active pointer and accept the next click.

There is also a responsive CSS mismatch:

- JavaScript creates `.upgrade-card-description`
- Mobile CSS hides `.upgrade-card-desc`

The intended mobile description rule therefore does not apply to the actual description element.

The mobile level-up overlay is always a single-column scrolling stack with an inline fixed layout. Landscape has enough horizontal room for two side-by-side cards, but the current layout still stacks them and limits the overlay to 48dvh.

### Movement and touch input

The game has acceleration and deceleration, which is a good base. The current virtual stick undermines it by converting a continuous thumb vector into digital keys:

```js
joystickToKeys(dx, dy)
```

The player therefore gets dead zone plus full-speed cardinal or diagonal movement, not analog speed. This contributes to abrupt movement and imprecise positioning on mobile.

Orientation handling calls `applyDeviceProfile()`, but `ensureTouchControls()` reuses an existing touch layer without rebuilding its layout or clearing inline floating origins. Active touch keys and pointers also need an explicit reset during resize, orientation change, visibility change, pause, and modal opening.

The device model derives `isTouch` from viewport class rather than actual touch capability. A small desktop window can therefore be classified as touch and receive mobile controls.

### Shooting and weapon feel

The game uses auto-fire, but desktop left click also calls `shoot()` manually. Manual shots do not reset the auto-fire cooldown. This creates two overlapping fire models and can cause cadence, ammo, and feedback to feel inconsistent.

Current weapon presentation already has useful ingredients:

- coded tracers
- muzzle flashes
- shell casings
- screen shake
- weapon SFX
- reload timing
- hit sparks

The weakness is coordination. Recoil, pose, muzzle, tracer, sound, hit confirmation, and target reaction need to share one shot event and one weapon-specific timing profile.

---

# Prioritized improvement backlog

## P0: Fix before the next large art expansion

### HMH-UX-01: Make mobile gameplay a viewport-owning application state

**Problem**

Gameplay is rendered inside the normal scrolling portal layout. On the tested phone sizes the canvas is below the fold.

**Change**

- When `officialAppStep === 'gameplay'`, switch the page to a dedicated game-stage layout.
- Hide the global Lester's Arcade nav, jukebox, marketing copy, footer, ads, and nonessential gameplay headings.
- Lock body scrolling while active gameplay or a gameplay modal is open.
- Mount the canvas at `position: fixed` or in a full-viewport grid that respects safe-area insets.
- Put essential HUD elements over the canvas instead of above it in document flow.
- Treat portrait as a supported compact mode or a clear nonblocking transition state, not a long page with the game at the bottom.

**Acceptance criteria**

- No document scrolling during active gameplay.
- Canvas is visible immediately in portrait and landscape.
- Landscape canvas occupies at least 80 percent of the short viewport dimension after safe areas and essential HUD.
- Portal navigation never consumes gameplay height.
- Browser address-bar expansion and contraction do not move the canvas below the fold.

### HMH-UX-02: Rebuild and reset touch controls on orientation change

**Problem**

The movement stick can retain portrait inline coordinates and remain offscreen in landscape.

**Change**

- On orientation and relevant viewport changes, cancel all active pointers.
- Clear `deviceState.touchKeys` and remove movement keys from `combat.keys`.
- Clear inline `left`, `right`, `top`, and `bottom` from floating sticks.
- Recompute handedness and control cluster positions.
- Rebuild or fully reapply the touch layout when orientation changes.
- Use `visualViewport` resize and safe-area values in addition to `window.resize`.
- Pause the game briefly during reflow so movement cannot continue invisibly.

**Acceptance criteria**

- Both sticks and all action buttons are visible after rotating in either direction.
- No stuck movement, firing, grenade aim, or pointer capture.
- Rotation works while moving, while paused, during READY, and while the level-up modal is open.

### HMH-COMBAT-01: Introduce actor-derived world hurtboxes

**Problem**

The enemy target radius currently falls back to the projectile radius.

**Change**

- Add explicit world-space `bodyRadius` and `hurtRadius` to every spawned enemy.
- Define them from a canonical `sizeClass`, not from weapon type.
- Resolve projectile contact using `enemy.hurtRadius + projectile.hitRadius`.
- Keep body collision, hurtbox, and proximity/avoidance radii separate.
- Give bosses and large creatures multi-circle or capsule hurtboxes only where their silhouette requires it.
- Add a runtime debug overlay that displays the actual world hurtbox projected over the sprite.

**Acceptance criteria**

- Changing weapons does not change the apparent enemy body target size, except for the legitimate projectile-radius addition.
- Shots that visibly cross the torso register.
- Shots that visibly miss the sprite do not register.
- Head ornaments, weapons, capes, and transparent padding do not incorrectly enlarge the core hurtbox.
- Tests cover fast projectiles, diagonal paths, large enemies, small creatures, and frame-rate variation.

### HMH-ART-01: Establish canonical enemy size classes

**Problem**

All animated enemies use a nominal 88 px draw box, but visible body size varies because source canvases and alpha bounds are inconsistent.

**Change**

Add an explicit actor scale policy:

- `small`: rats, snakes, scorpions, small drones, and similarly intentional creatures
- `standard`: all regular humanoids and normal combat enemies
- `large`: armored bruisers, beasts, golems, vehicles, and deliberate elites
- `boss`: unique encounter silhouettes

For every class define:

- canonical source canvas
- target opaque-body height band
- target foot pivot
- shadow footprint
- body collision radius
- hurt radius
- nameplate offset
- health-bar width

Normal enemies should use `standard` by default. Exceptions must be declared in actor data and visually reviewed. Do not solve size differences with arbitrary runtime scaling. Author the silhouette at the correct relative size in the approved source sheet.

**Acceptance criteria**

- All standard enemies appear within the same visible height tolerance.
- Small and large exceptions are intentional, documented, and reflected in collision.
- No mix of 92, 136, and 188 source canvases can bypass alpha-bound validation.
- Enemy scale remains 100 percent in runtime after source normalization.
- Existing special draw-scale multipliers, including DAO Lobbyist, Influencer Camera Drone, and NFT Valet, are converted to approved size classes or rejected by the art gate.

### HMH-UX-03: Prevent accidental level-up selections

**Problem**

Upgrade cards accept clicks immediately after appearing.

**Change**

- Pause gameplay and flush held mouse, pointer, touch, keyboard, and gamepad actions before presenting choices.
- Add a transparent input shield for 350 to 500 ms.
- Require all pointers/buttons that were down when the modal opened to be released before cards become selectable.
- Do not arm a card until a new pointer-down begins after the shield period.
- Position the modal away from the last crosshair or tap location when possible.
- Add desktop hotkeys `1` and `2` plus gamepad focus/confirm support.
- Use a real backdrop to make the state change clear.
- Correct `.upgrade-card-desc` to `.upgrade-card-description`.

**Responsive layout**

- Desktop: two choices side by side, large art/icon, concise effect, rank meter, and keyboard labels.
- Phone landscape: two compact side-by-side cards when width permits.
- Phone portrait: stacked cards with the primary effect always visible and no nested scroll when possible.
- Avoid placing selectable cards under the firing thumb or cursor origin.
- If the cards cannot fit without scrolling, use a full-height phone sheet with independently scrolling cards and a pinned reroll/action footer instead of a shallow 48dvh panel.

**Acceptance criteria**

- Holding fire through a level-up never selects a card.
- Clicking, tapping, or releasing at the popup location during the opening shield does nothing.
- Cards remain readable at 375x667, 390x844, 844x390, 768x1024, 1280x720, and 1440x900.

### HMH-ART-02: Block visible legacy or geometric fallback art in Level 1

**Problem**

The renderer still contains coded enemy rectangles, geometric telegraphs, radial ellipses, triangle tells, tinted diamond road overlays, and proxy art paths. Some are disabled in the curated path, but there is no single ship gate proving that visible fallback art is zero.

**Change**

- Add runtime counters for every fallback draw path.
- Fail Level 1 visual QA if `fallbackEnemyDrawCount`, `fallbackPropDrawCount`, or `missingSpriteCount` is nonzero.
- Replace visually prominent vector effects with approved pixel VFX sheets.
- Keep coded primitives only for tiny fast bullets, invisible collision, debug overlays, and subtle under-art masks.
- Replace visible tinted road diamonds and obvious procedural edge marks with authored tile variants, masks, decals, and transition sprites.
- Keep geometric debug hitboxes behind an explicit debug flag.

**Acceptance criteria**

- Production Level 1 reports zero visible enemy and prop fallback draws.
- No colored rectangle can substitute for an enemy.
- No proxy actor silently appears for a quarantined enemy.
- Coded shapes cannot visually dominate the new map and prop sheets.

---

## P1: Gameplay feel, animation, art, and level composition

### HMH-MOVE-01: Make movement continuous and collision-friendly

- Pass the normalized analog stick vector directly into movement integration.
- Preserve vector magnitude so light thumb movement produces slower movement.
- Tune dead zone, response curve, acceleration, and deceleration separately for touch and keyboard.
- Use collision sliding that removes blocked velocity along the collision normal instead of preserving pressure into a wall.
- Add a brief input buffer through small frame-time spikes.
- Test diagonal movement speed, shoreline sliding, corner traps, narrow prop gaps, and movement after releasing input.
- Add optional haptics for blocked movement or damage, not every step.

### HMH-ANIM-01: Fix animation state routing before generating more frames

- Make canonical actors use the actual 8-direction facing instead of forcing `south`.
- Drive hero shoot animation from `lastShotFrame`, not a global frame modulo.
- Drive movement animation from velocity or `_heroMoving`, not only held keys.
- Ensure touch auto-walk and deceleration use run/walk frames while the actor is actually moving.
- Synchronize enemy state with real spawn, tell, attack, recovery, hit, and death timers.
- Reset or intentionally preserve animation phase when changing states.
- Prevent idle fallback during attacks or movement.

### HMH-ANIM-02: Repair pivots and create purposeful animation frames

Do not add frames only to raise frame count.

For heroes and priority enemies:

1. Lock the foot pivot across every direction and state.
2. Normalize alpha bounds and body scale.
3. Remove duplicate or near-duplicate adjacent frames.
4. Build readable key poses for anticipation, contact, recoil, recovery, hurt, death, and level-up.
5. Add in-betweens only where they reduce visible stepping.
6. Use hold frames where weight or weapon recoil needs emphasis.
7. Keep movement cycles near a readable 10 to 14 fps unless a specific effect benefits from faster timing.
8. Use sub-frame interpolation for world position, not blurred sprite filtering.

The current QA set has pivot deltas up to 19.5 px. Pivot stability should be corrected before judging whether more frames are necessary.

### HMH-ANIM-03: Upgrade the sprite QA pipeline

- Generate readable contact sheets for every actor, state, and direction.
- Overlay foot pivot, alpha bounds, body center, hurtbox, and frame index.
- Report duplicate-frame percentage and adjacent-frame pixel delta.
- Report visible body height and width, not only canvas dimensions.
- Add GIF or MP4 motion previews at actual runtime scale.
- Compare standard enemies on one lineup sheet.
- Fail standard enemies outside the approved visible-height band.
- Regenerate the roster and QA reports from the runtime manifest used by production.
- Add one deterministic end-to-end browser combat smoke that spawns an enemy, fires a real weapon, verifies hit registration, verifies animation and VFX state changes, and checks the browser console.

### HMH-GUN-01: Choose one coherent firing model

The code currently says auto-fire is the roguelike model, but desktop left click also manually fires.

Recommended default:

- Keep auto-fire for the survivor-style loop.
- Make mouse movement aim only.
- Remove redundant left-click firing, or make manual-fire mode an explicit setting that disables auto-fire.
- Reserve click/tap for an intentional active ability if the design needs one.

This reduces control ambiguity and also removes one source of level-up misclicks.

### HMH-GUN-02: Build one weapon-shot event pipeline

Every shot should emit one authoritative event containing:

- weapon id
- fire timestamp
- muzzle transform
- projectile or pellet definitions
- recoil impulse
- screen shake
- muzzle-flash animation
- casing event
- sound cue
- camera response
- hit-confirm eligibility

Then tune by weapon:

- Pistol: crisp report, small recoil, readable single tracer, distinct impact.
- Shotgun: strong cone, multi-impact burst, larger recoil, short recovery.
- Auto Miner: low individual recoil, cadence rhythm, controlled tracer density.
- Hash Rail: charge/read cue, bright core, strong impact freeze, clean long trail.
- Spread LTC: clear fan geometry without screen clutter.

### HMH-GUN-03: Improve hit confirmation and enemy reaction

- Add a small reticle or crosshair response on confirmed hit.
- Use short weapon-appropriate hit stop, with strict caps during swarms.
- Apply directional enemy flinch and knockback without breaking pathing.
- Differentiate flesh, armor, shield, destructible prop, and terrain impacts.
- Use pixel sparks and debris sheets for major impacts.
- Add a restrained damage number mode or keep numbers off by default if visual reactions communicate enough.
- Ensure death begins from the hit direction and transitions cleanly into the death sprite.

### HMH-LEVEL-01: Continue the authored Level 1 composition pass

The tiles and prop sheets are now good enough to support a stronger authored map. The next pass should focus on encounter grammar:

- Establish a clear critical path through road shape, light, landmark placement, and enemy pressure.
- Build authored combat rooms, approach lanes, recovery pockets, ambush corners, and scenic pauses.
- Use repeated prop families as neighborhoods rather than isolated random objects.
- Reduce prop noise near the player spawn and early aiming lanes.
- Place cover and collision objects to create deliberate routes, not accidental snag points.
- Use larger 2x2 building sprites less frequently, per the established art preference.
- Keep trees static when that improves readability and performance.
- Add distinctive silhouettes for each district transition.
- Use edge and decal sets to remove obvious tile seams without scattering random details.
- Validate every authored encounter at gameplay zoom, not only in an art sheet.
- Replace the remaining small-card landmarks `ghost-boarded-storefront`, `ghost-saloon-front`, `industrial-warehouse-facade`, and `landmark-gas-station` with larger authored composite buildings.
- Use `wo102-megaprop/noodle-bar-storefront` and `wo102-megaprop/forest-rock-outcrop` as the scale, silhouette, collision, and scene-integration standard for new landmark art.
- Split generated mini-scenes into atomic buildings, wall segments, crates, pumps, signs, and barriers when a composite output cannot support collision or authored placement cleanly.

### HMH-ART-03: Replace proxy and incomplete actors

Highest-priority incomplete roster actors:

- Bitcoin Maximalist Riot Cop
- Influencer Camera Drone
- NFT Valet
- Stablecoin Socialite

Level 1 proxy mappings that need unique art review:

- Cave FUD Goblin currently maps to Trench Degen
- Claim-Jumper Sheriff currently maps to Claim Jumper
- Gas Beast currently maps to Gas Beast Tank
- Bandit Captain and Ridge Raider currently map to Evil Banker Ranged

Art-repair fallbacks that should become bespoke production actors:

- Crypto Bro Rusher currently maps through FUD Goblin art
- Evil Banker Ranged currently maps through Gas Fee Wisp art
- Gas Beast Tank currently maps through Wild Boar art
- Liquidation Cascade Golem currently maps through Wild Boar art
- Warren Spear Rider currently maps through Coyote Pack Runner art

These replacements should use eight directions and real idle, walk/run, attack-tell, attack, hit, death, and spawn-in states. Do not create long duplicate sequences merely to satisfy a frame-count target.

Quarantined or scope-sensitive actors must never silently use a visually unrelated substitute. Gas Fee Wisp is explicitly marked as needing bespoke wisp art rather than a Gas Beast proxy.

### HMH-ART-04: Complete pickup, VFX, and UI icon sheets

The current generated redo queue contains 55 items, including 19 P0 items.

Priority gameplay art:

- Cold Storage health pickup
- Crypto Bomb Cache
- Block Breaker Shells
- Hashstorm Drum
- Spread LTC Chip
- 2x Hard Money Multiplier
- Cold Wallet Shield
- Ammo Cache
- LTC Cache
- Magnet Wallet Surge
- Pixel-art muzzle flashes by weapon
- Metal and flesh hit sparks
- Shell casings
- Grenade explosion ring
- Death dust and gore bursts
- Level-up burst
- Pickup rarity beams
- UI confirm spark

Replace emoji and generic CSS glyphs such as the grenade emoji, info glyph, and reroll symbol with a consistent approved pixel icon atlas or accessible SVG where pixel art is inappropriate.

---

## P1: Game UI and UX redesign

### HMH-UI-01: Reduce the in-game HUD to essential decisions

Always visible:

- HP
- ammo and reload state
- grenades
- XP and level progress
- current objective or directional objective marker
- elapsed time only if it matters to the run

Move to pause/details or a collapsible secondary panel:

- seed
- kills
- rank
- score breakdown
- stage/debug labels
- weather and time-of-day text
- zone ids
- verbose POI strings
- control instructions after onboarding

Use icons plus short values instead of full sentence labels. Keep debug instrumentation out of the normal player HUD.

### HMH-UI-02: Redesign the level-up choice experience

Visual structure:

- Strong `LEVEL UP` title and one short instruction
- Two clear cards with distinct category color, icon, name, effect, and rank change
- One line for what changes now
- Compact progress pips
- Reroll as a secondary action
- Optional compare detail on focus or long press

Interaction structure:

- Input shield on open
- Keyboard and controller focus
- Clear selected, hover, disabled, and pressed states
- Confirmation sound and pixel burst
- No card under the active firing pointer
- No nested scrolling in common landscape sizes

### HMH-UI-03: Simplify loading, READY, pause, and game-over screens

Loading:

- One strong key-art frame
- Game and level title
- Progress bar
- One rotating useful tip
- No verbose asset-decoding text in player mode

READY:

- Short objective
- Three essential controls maximum
- Start automatically after a short countdown on repeat runs, or allow tap to start
- Do not stack READY on top of portal navigation and a full stat dashboard

Pause:

- Resume first
- Settings, controls, restart, and exit in a clear hierarchy
- Keep run stats compact

Game over:

- Score, time, kills, level reached, and one or two meaningful highlights
- Restart and return actions above secondary Web3 settlement detail
- Keep transaction/debug copy out of the emotional result moment

### HMH-UI-04: Establish a tighter visual system

Typography:

- One display pixel face for titles and high-value labels
- One readable condensed sans-serif for body and controls
- One numeric mono face for stats
- Avoid using heavy all-caps styling for every text element

Color:

- Dark neutral background
- Litecoin cyan/blue as primary identity
- Warm yellow for reward and progression
- Green for success and health recovery
- Red or magenta for danger and damage
- Purple reserved for rare or special systems
- Stop using every neon color at equal visual priority

Icons and chrome:

- Use one pixel icon grid and stroke weight
- Use borders, shadows, and glow sparingly
- Reserve animation and bloom for state changes and important rewards
- Keep cards and buttons on a consistent spacing and radius scale

Accessibility:

- 4.5:1 contrast for body text
- visible keyboard focus
- reduced-motion and reduced-flash behavior
- colorblind labels that do not depend only on color
- 44x44 minimum touch targets
- no required hover-only information

---

## P2: Lester's Arcade website UI redesign

### WEB-UI-01: Make the primary journey obvious

The site should prioritize:

1. Play a game
2. Continue a recent game
3. Browse available cabinets
4. View profile or scores

The jukebox, ad inventory, wallet/testnet messaging, and promotional copy should not have more visual weight than Play.

### WEB-UI-02: Separate portal mode from game mode

Portal mode can show:

- navigation
- featured cabinet
- game grid
- account state
- music player
- ad inventory
- announcements

Game mode should show:

- the game
- essential HUD
- pause/settings access
- minimal account or run status only when needed

Do not keep the entire website shell visible during active gameplay.

### WEB-UI-03: Improve responsive navigation and content density

- Use compact bottom or drawer navigation on narrow portrait screens.
- Collapse the jukebox to one small now-playing button.
- Keep ad units out of short landscape viewports.
- Make game cards and the Play CTA visible above the fold.
- Prevent marketing copy and decorative art from pushing the game list out of view.
- Test text wrapping and zoom at 200 percent.
- Avoid exposed raw email as a dominant production CTA. Use a contact action or form.

### WEB-UI-04: Unify website and game design tokens

Create shared tokens for:

- background and surface colors
- primary, reward, danger, success, and rare colors
- typography roles
- spacing
- corner radius
- borders and shadows
- focus rings
- icon sizes
- transition durations

The portal and game should feel related without forcing the full neon arcade shell into the gameplay viewport.

---

# Recommended implementation sequence

## Sprint 1: Simulation and mobile correctness

1. Actor-derived enemy hurt radii and projectile-radius addition
2. Standard enemy size-class contract
3. Dedicated full-viewport mobile game stage
4. Orientation reset and touch-control rebuild
5. Level-up input quarantine
6. Automated viewport and hitbox tests

## Sprint 2: Actor normalization and animation truth

1. Normalize foot pivots and opaque bounds
2. Fix canonical directional frame routing
3. Fix state transitions and velocity-driven movement animation
4. Build real animation contact sheets and duplicate-frame checks
5. Replace Level 1 actor proxies in player-visible order

## Sprint 3: Combat feel and art replacement

1. Choose one firing model
2. Centralize weapon shot events
3. Tune muzzle, tracer, recoil, audio, hit stop, and enemy response
4. Replace visible geometric enemy/prop/VFX fallbacks
5. Complete priority pickup and weapon VFX sheets

## Sprint 4: Level and game UI pass

1. Authored encounter and route composition
2. Compact HUD
3. Responsive level-up screen
4. Loading, READY, pause, and game-over redesign
5. Typography, color, icon, and accessibility system

## Sprint 5: Portal UI pass

1. Separate portal and game modes
2. Improve navigation and game discovery
3. Collapse secondary music/ad features on mobile
4. Apply shared design tokens
5. Run complete device and accessibility validation

---

# Required playtest matrix

## Viewports

- 375x667 portrait and 667x375 landscape
- 390x844 portrait and 844x390 landscape
- 412x915 portrait and 915x412 landscape
- 768x1024 tablet portrait and 1024x768 landscape
- 1280x720 desktop
- 1440x900 desktop
- fullscreen desktop

## State transitions

Test each relevant viewport while:

- loading
- at READY
- moving
- aiming and firing
- holding the movement stick
- holding the aim stick
- aiming a grenade
- taking damage
- leveling up
- paused
- game over
- entering and leaving fullscreen
- rotating portrait to landscape and back
- backgrounding and restoring the browser

## Release gates

- No document scroll during gameplay
- No offscreen canvas or touch controls
- No stuck keys or pointer captures
- No accidental level-up selection
- Zero visible legacy enemy or prop fallbacks in Level 1
- Standard enemies pass visible-scale tolerance
- Hurtboxes visually match actors in every direction
- All sampled actor pivots pass the agreed threshold
- No console errors
- No missing or undecoded production assets
- Stable gameplay at target frame budget on desktop and mobile
- One deterministic browser combat smoke proves spawn, aim, shot, hit, reaction, death or survival state, and VFX together.
