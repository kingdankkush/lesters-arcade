# Lester's Arcade — Game Design Improvement Canon

Date: 2026-06-06

Purpose: synthesize the provided articles/resources into practical improvements for **Lester's Arcade** and its first playable cabinet, **Hard Money Heroes**.

## Source pass status

The article/resource set was reviewed in three groups:

1. Game design fundamentals, mechanics, core loops, retention, and ethical compulsion.
2. Pixel art, character animation, environment art, level design, and production tools.
3. Enemy AI, NPC behavior, 2D shooter implementation, and future automation/playtest workflows.

Notes:

- Most links were accessible enough to extract useful guidance.
- Medium, Quora, and forum-style sources should be treated as lower-authority / partial-extract inputs, useful for patterns but not gospel.
- The Reddit thread was not directly supported by the scraper in this pass.
- The GDevelop pixel-art resource was listed twice; it was treated as one source.

## One-sentence design thesis

**Lester's Arcade should feel like a fast, trustworthy retro arcade app: a clear wallet/profile portal, a cabinet-selection ritual, and a tight skill-based Hard Money Heroes score-attack loop built around readable pixel art, tactical enemy encounters, satisfying feedback, ethical exit ramps, and automated playtest/design iteration.**

---

# 1. Durable principles from the article set

## 1. Start with the core loop, not features

The most repeated lesson: if the repeated 10–30 second action chain is not fun, extra characters, lore, wallets, AI, bosses, and rewards will not fix it.

For Hard Money Heroes, the core gameplay loop should be:

1. Enter a staged combat pocket.
2. Read the enemy telegraph / terrain problem.
3. Move, crouch, jump, or take cover.
4. Shoot / melee / throw at the right moment.
5. Earn score, pickups, combo, or positional advantage.
6. Clear the wave / mini-boss.
7. Scroll unlocks and the next pocket begins.

For Lester's Arcade, the product loop should be:

1. Enter arcade.
2. Connect/select wallet profile.
3. Pick cabinet.
4. Choose Free Practice or Official Run.
5. Play.
6. Review run summary.
7. Return to arcade/profile/leaderboards.
8. Start another run or exit cleanly.

## 2. Meaningful constraints create better decisions

Good mechanics become interesting because the player has limited time, space, ammo, health, cover, movement options, or risk tolerance.

Recommended Hard Money Heroes constraints:

- 2–4 enemies on screen.
- Scroll-locked combat sections.
- Cover that can be destroyed or bypassed.
- Limited-ammo weapon pickups.
- Melee/throw windows that require commitment.
- Bosses with readable but escalating patterns.
- Score multipliers that reward risk without forcing reckless play.

## 3. Depth should come from interactions, not bloat

Avoid adding too many verbs. A few verbs that combine well create depth:

- Move.
- Jump.
- Crouch / cover.
- Shoot.
- Melee.
- Throw.
- Collect.
- Survive.

Better depth comes from how enemies, terrain, pickups, score, and timing interact with those verbs.

## 4. Readability beats detail

This applies to mechanics, UI, pixel art, enemy AI, animation, and sound.

At gameplay speed, the player should instantly understand:

- where Lester is;
- what can hurt him;
- where cover is;
- what enemy is about to attack;
- what pickup is valuable;
- whether the run is Free Practice or Official;
- what caused damage or death.

## 5. Feedback creates feel

Players should receive immediate visual/audio confirmation for almost everything:

- wallet connect;
- cabinet hover/select;
- mode selection;
- run start;
- shot fired;
- enemy hit;
- armor/cover deflection;
- pickup collected;
- combo increased/lost;
- boss phase shift;
- run submitted;
- return to arcade.

## 6. Pacing matters more than raw difficulty

Difficulty should rise through encounter composition, timing, and pressure, not cheap spikes or visual chaos.

Recommended pacing structure:

- intro enemy;
- enemy plus terrain feature;
- mixed enemy roles;
- mini-boss or elite;
- recovery/pickup beat;
- boss gate;
- run summary / exit ramp.

## 7. Addictive loops need ethical exit ramps

Because Lester's Arcade has wallet identity, paid mode, leaderboards, and future Web3 rails, the product must be extra careful not to feel manipulative.

Use:

- clear short runs;
- visible progress;
- skill medals;
- end-of-run summaries;
- optional official mode;
- honest paid/free separation;
- no penalty for leaving Free Practice;
- no forced streaks;
- no hidden “you lose everything if you exit” pressure.

## 8. Enemy AI should create feelings, not just intelligence

Good arcade AI is not “smartest possible AI.” It is readable, fair, surprising enough, and fun to master.

Enemy AI should create:

- tension;
- pride after mastery;
- clear cause/effect;
- readable telegraphs;
- strong enemy roles;
- learnable boss patterns.

## 9. Pixel art must be tested in-engine

A sprite that looks great in isolation can fail at gameplay zoom. Every character, enemy, pickup, tile, and effect should be tested inside the real game camera and HUD.

## 10. Automate improvement loops early

The best future workflow is not “manually remember all the design rules.” It is:

- codify design canon;
- make sprite/level/enemy manifests;
- run tests and visual checks;
- log playtest telemetry;
- review weekly;
- turn findings into backlog items.

---

# 2. Lester's Arcade experience improvements

## A. First entry / attract screen

Goal: make the first 5 seconds feel like walking up to a real Web3 arcade cabinet wall.

Recommended entry screen:

- full-screen retro arcade attract mode;
- Lester's Arcade logo / cabinet room scene;
- pulsing “Press Start / Connect Wallet” prompt;
- visible but compact explanation: “Free Practice or Official Ranked Runs”; 
- sound toggle / click-to-enable audio;
- clear safety copy: “Free Practice never posts to leaderboards.”

Avoid:

- technical dashboard panels on the default screen;
- long Web3 explanations before the player understands the fun;
- making wallet connection feel like the only possible path if local demo/free preview is intended.

## B. Wallet/profile step

The wallet should feel like an arcade player card, not just a dApp button.

Recommended elements:

- wallet short address;
- username;
- 150x150 avatar;
- current title/rank;
- best score per cabinet;
- achievements count;
- clear network/status chip;
- sign out/switch wallet in Settings.

Important trust rule:

- The connected wallet owns official profile, achievements, scores, and paid run submissions.
- Free/local practice remains local and should not mutate official state.

## C. Cabinet selection

Make this the emotional center of Lester's Arcade.

Recommended cabinet card for Hard Money Heroes:

- animated cabinet art / CRT preview;
- title: Hard Money Heroes;
- one-line fantasy: “Goofy gritty Web3 run-and-gun through Litecoin City After Dark.”;
- current best score;
- recent medal;
- Free Practice button;
- Official Run button;
- controls preview;
- “Run length: ~5 min average / 15–20 min master run.”

Future cabinet cards should reuse the same structure so the arcade scales cleanly.

## D. Mode select

Mode select should be impossible to misunderstand.

Free Practice:

- no cost;
- no leaderboard;
- no official achievements/progress;
- fast restart;
- good for learning controls and bosses.

Official Run:

- explicit paid/testnet/credit confirmation;
- leaderboard eligible;
- achievements eligible;
- run summary submitted only at game over;
- shows current cadence board: daily/weekly/monthly/yearly/all-time.

## E. Game launch / pre-run setup

Before gameplay, show a 3–5 second “mission card”:

- stage name;
- selected mode;
- current weapon loadout;
- controls reminder;
- optional gore/sparks setting;
- audio enabled/disabled;
- “Esc/Pause returns to run menu.”

## F. During gameplay

HUD must prioritize:

- health/lives;
- weapon/ammo;
- score;
- combo/multiplier;
- mode badge: PRACTICE or OFFICIAL;
- boss/section progress;
- pause/exit hint.

Avoid:

- overloading the HUD with wallet/network details during combat;
- decorative UI that obscures enemies/projectiles;
- tiny text that only works on desktop zoom.

## G. Pause / exit

Every run needs an ethical exit ramp.

Pause menu options:

- Resume;
- Restart Practice;
- Controls;
- Audio;
- Exit to Cabinet;
- Exit to Arcade.

Official mode exit copy should be honest:

- “Leaving ends this official run. No leaderboard score will be submitted unless the run reaches Game Over / Run Complete summary.”

## H. Game over / run complete

The end screen is one of the most important addictive-but-ethical loops.

Show:

- score;
- time survived;
- stage reached;
- enemies defeated;
- bosses defeated;
- damage taken;
- best combo;
- medals earned;
- personal best comparison;
- leaderboard placement if Official;
- “Try again,” “Return to Cabinet,” “View Leaderboard,” “Back to Arcade.”

For Free Practice, say:

- “Practice run complete — not submitted.”

For Official, say:

- “Official run submitted to [cadence] leaderboard” only after the real submission path succeeds.

---

# 3. Hard Money Heroes core gameplay improvements

## A. Core combat loop

The combat should be readable as:

**Threat appears → player chooses position → enemy telegraphs → player commits action → score/feedback → scroll unlock.**

Implementation rule:

- Every enemy attack should have a tell.
- Every player hit should feel explainable.
- Every cleared pocket should feel like progress.

## B. Scoring model

Use skill-based scoring, not just survival time.

Recommended layers:

- Base enemy kill points.
- Combo/chain multiplier.
- Boss phase clear bonus.
- No-damage section bonus.
- Speed clear bonus.
- Risk bonus for close-range/melee/low-health clears.
- Pickup collection bonus.
- Official mode leaderboard submission only at run end.

Avoid runaway scoring:

- decay combo over time;
- cap or reset multipliers between sections/bosses;
- reward clean clears more than farming weak enemies;
- make boss time bonuses matter.

## C. Rewards and progression

Prefer arcade-style rewards:

- medals;
- cabinet mastery rank;
- profile titles;
- badge art;
- alternate cabinet skins;
- Lester/Lilly cosmetic unlocks;
- music/CRT filter unlocks;
- challenge medals.

Avoid turning the game into chores:

- no daily streak pressure as a core loop;
- no confusing currencies;
- no pay-to-progress power advantage for official score competition.

## D. Weapons

Current canon weapons are strong. Make each one mechanically distinct:

- The Settler: infinite reliable sidearm, low-to-medium damage.
- Block Breaker: shotgun spread, strong close-range, limited ammo.
- Hashstorm: automatic weapon, crowd-control but lower accuracy / ammo-limited.
- Litecoin Blade: high-risk melee, cancels some enemy states or earns risk bonus.
- Crypto Bombs: area clear / destructible prop trigger.
- Hard Forks: precision thrown axe, high skill shot, bonus on elite weak points.

Add weapon UI feedback:

- pickup name bark;
- icon swap;
- ammo count;
- temporary glow;
- unique impact sound/VFX.

## E. Pickups

Pickups should support tactical decisions:

- Cold Storage: health.
- Cold Wallet Shield: short armor.
- Crypto Bomb Cache: throwable refill.
- Hard Money Multiplier: timed score multiplier.
- LTC Cache: small score burst / shiny visual reward.

Place pickups where collecting them creates risk, not random freebies.

---

# 4. Enemy design and AI

## A. Design from player feeling first

Each enemy should have a purpose and emotional role.

Recommended archetypes:

1. Grunt / FUD Goblin
   - teaches basic shooting;
   - slow telegraphed attack;
   - low health.

2. Rusher / Paper Hand or Rug Rat
   - punishes standing still;
   - clear charge windup;
   - weak if shot early.

3. Suppressor / Gas Fee Wisp
   - controls lanes;
   - slow projectiles or area denial;
   - forces crouch/cover.

4. Flying / Sybil Drone
   - tests vertical aim/positioning;
   - low health;
   - movement pattern should be readable.

5. Turret / Honeypot Turret
   - creates cover puzzle;
   - obvious charging tell;
   - can be disabled or flanked.

6. Grenadier / Phishing Angler
   - forces movement out of cover;
   - lobs delayed projectile;
   - strong audio cue.

7. Elite / MEV Reaper
   - combines two patterns;
   - appears before bosses;
   - has one obvious weakness.

8. Heavy / Liquidation Cascade Golem
   - slow mini-boss body;
   - destructible armor/weak point;
   - screen-control threat.

## B. AI architecture

Use a layered architecture:

- Level Director: chooses encounter pressure, spawn waves, scroll lock, and boss triggers.
- Enemy Brain: finite state machine / small behavior tree.
- Combat System: handles damage, hitboxes, cooldowns, projectiles.
- Animation System: shows state and telegraph.
- Audio/VFX System: reinforces state changes.

Recommended enemy states:

- Spawn / Enter;
- Idle / Patrol;
- Alert;
- Advance;
- Take Cover;
- Telegraph;
- Attack;
- Recover;
- Retreat / Reposition;
- Stunned / Hit;
- Dead.

Every state needs:

- entry condition;
- exit condition;
- animation;
- sound/VFX cue;
- tuning values;
- test case.

## C. Perception tiers

Use simple readable awareness instead of instant perfect AI.

Green:

- enemy notices movement;
- looks/turns;
- no immediate damage.

Yellow:

- enemy enters aim/approach;
- starts attack tell.

Red:

- enemy attacks or charges;
- player has had time to read the threat.

## D. Bosses

Bosses should be 3-phase pattern fights, not HP sponges.

Phase 1:

- teaches core attack pattern;
- slow, obvious, readable.

Phase 2:

- adds one mechanic or arena change;
- may add limited minions or cover destruction.

Phase 3:

- faster/desperation version;
- still readable;
- strong finishing VFX/audio.

Boss QA question:

- “Could the player explain why they died and what they should do next time?”

---

# 5. Level and environment design

## A. Encounter section model

Use a reusable section structure:

1. Setup: show terrain/hazard.
2. Teach: one basic enemy interaction.
3. Mix: add a second enemy role.
4. Pressure: 2–4 enemies plus cover/destructible.
5. Reward: pickup/score beat.
6. Gate: mini-boss/boss or scroll unlock.

## B. Stage visual grammar

### Stage 1 — The Slums / Foundry

Purpose:

- teach fundamentals;
- gritty, messy, lower-city intro;
- industrial hazards and cover.

Art motifs:

- pipes;
- grates;
- steam;
- broken signs;
- scrap barricades;
- furnace glow;
- neon reflections;
- subtle blue/silver LitVM/Litecoin accents.

Gameplay features:

- low cover;
- explosive barrels/crates;
- basic platform ledges;
- first mini-boss gate;
- first boss: Rug Pull Baron or similar.

### Stage 2 — The Tower / Financial District

Purpose:

- escalation;
- verticality;
- cleaner corporate oppression.

Art motifs:

- glass;
- chrome;
- security barriers;
- elevator shafts;
- trading terminals;
- vault doors;
- rain/rooftop lighting.

Gameplay features:

- elevators;
- drone enemies;
- vertical lanes;
- shielded/security enemies;
- rooftop boss arena.

### Stage 3 — The Getaway / Mainnet Express

Purpose:

- kinetic finale;
- speed, timing, mastery pressure.

Art motifs:

- train roof/interior;
- tunnel lights;
- sparks;
- city streaks;
- rails;
- bridge finale.

Gameplay features:

- moving hazards;
- low-clearance crouch moments;
- jumping gaps;
- speed parallax;
- final boss/escape sequence.

## C. Layering rules

- Foreground: decorative only; never hides player/enemies/projectiles.
- Main gameplay layer: clear collision surfaces and platforms.
- Close background: world detail.
- Far background: mood/parallax.

## D. Tile and environment foundations

Recommended baseline:

- 16x16 tiles for main collision kit;
- 32x32 macro tiles for larger structures;
- reusable props: crates, barrels, barricades, signs, pipes, terminals;
- destructible variants for props;
- parallax bands for skyline/smoke/machinery/train speed.

---

# 6. Pixel art, character design, and animation foundations

## A. Pixel-art bible

Lock these decisions early:

- perspective: side-view;
- camera scale;
- base sprite sizes;
- outline style;
- palette limits;
- hitbox language;
- animation frame rates;
- export naming convention;
- no anti-aliased scaling in runtime;
- palette and transparency validation.

## B. Suggested sprite sizes

Practical targets:

- Lester: 32x48 or 32x56 base sprite.
- Lilly: same hitbox/stat silhouette, distinct cosmetic read.
- Small enemy: 24x24 to 32x32.
- Medium enemy: 32x40.
- Elite/heavy: 48x48+.
- Boss: larger multi-part or 64x64+ depending on camera.
- Tiles: 16x16 primary, 32x32 macro.

## C. Palette

Start with a controlled 16–32 color core palette:

- dark outline/shadow neutrals;
- Lester skin/face tones;
- blue/silver accent ramp;
- warm hit/VFX colors;
- environment biome ramps;
- enemy faction colors.

Rule:

- Lester's face and silhouette must pop against every biome.

## D. Lester character design

Lester must read as:

- chunky side-scroller hero;
- stubborn/brave/slightly ridiculous;
- Rambo-like without becoming generic;
- blue/silver arcade accents;
- consistent face/head/proportions across every pose.

Avoid:

- over-detailed gear that muddies at gameplay scale;
- changing head shape between frames;
- weapons covering the face too often;
- too many tiny logo details.

## E. Animation states and target frame counts

Suggested production targets:

- Idle: 4–6 frames.
- Run: 4–6 frames.
- Crouch: 1–2 frames.
- Jump: 2–4 frames.
- Fall: 2–3 frames.
- Shoot: 2–4 frames.
- Melee: 3–5 frames.
- Throw: 3–4 frames.
- Hurt: 1–2 frames.
- Death: 4–8 frames.
- Victory: 4–6 frames.

Animation rule:

- Block key poses first, test in game, then polish pixels.

## F. Enemy animation states

Each enemy should have:

- idle;
- walk/fly;
- attack tell;
- attack;
- counter/recover;
- hit;
- death;
- optional gore overlay.

Telegraph must be visually distinct from idle. Use pose, flash, charge effect, sound, or windup animation.

## G. VFX style

Default visual feedback should be sparks-first, consistent with existing canon:

- muzzle flashes;
- shell casings;
- sparks;
- smoke;
- shield glints;
- cover chips;
- explosion rings;
- boss phase bursts;
- optional gore overlay only if toggled pre-run.

---

# 7. Sound and music foundations

## A. Audio hierarchy

Sound should tell the player what matters without clutter.

Priority 1 — gameplay-critical:

- player hit;
- enemy attack tell;
- enemy projectile;
- low health;
- pickup;
- boss phase;
- combo break.

Priority 2 — feedback/reward:

- enemy hit;
- weapon fire;
- melee slash;
- explosions;
- score tick;
- achievement unlock;
- leaderboard submit.

Priority 3 — ambience/brand:

- arcade room hum;
- CRT buzz;
- coin slot;
- crowd/arcade bed;
- city/foundry/train ambience.

## B. Music direction

Keep current canon:

- synthwave brand spine;
- darksynth/arcade-techno combat;
- heavier industrial boss music;
- menu/attract music that starts only after browser-allowed user interaction.

## C. Voice barks

Use sparingly for high-value events:

- “THE SETTLER!”
- “BLOCK BREAKER!”
- “HASHSTORM!”
- “MISSION COMPLETE!”
- “HARD MONEY HERO!”

Avoid too many repeated barks during core combat.

## D. Mix rules

- Player damage and enemy telegraph sounds must cut through music.
- Pickup/score sounds should be satisfying but shorter.
- Boss phase transitions can briefly duck music or add a sting.
- Settings need music/SFX sliders and mute.

---

# 8. Functionality foundations

## A. Required platform states

The app should model these distinctly:

- no wallet / guest;
- wallet connected;
- wrong network;
- correct network;
- Free Practice selected;
- Official Run armed but not started;
- Official Run active;
- Official Run complete/submitting/submitted/failed;
- returned to arcade.

## B. Child-game to parent sync

Only Official Run should submit a run summary to the parent portal.

Run summary payload should include:

- game ID;
- mode;
- wallet address;
- username/avatar reference;
- score;
- time survived;
- stage reached;
- bosses defeated;
- enemies defeated by type;
- damage taken;
- combo stats;
- achievement flags;
- cadence/season context;
- chain/network context;
- verifier/anti-cheat placeholder.

Free Practice should produce a local summary only.

## C. Accessibility and comfort

Add:

- remappable controls later;
- readable controls screen now;
- colorblind-safe pickup/attack cues;
- reduced flash/shake setting;
- gore toggle before run;
- pause at any time;
- clear exit path.

## D. Performance rules

Pixel art/gameplay should remain crisp and responsive:

- deterministic sprite manifests;
- preloaded critical assets;
- no layout-heavy dashboard during gameplay;
- Canvas/Phaser-ready loop architecture;
- capped particles;
- sprite sheet validation;
- console-error checks before demos.

---

# 9. Workflow automation to introduce

## A. Design canon as data

Keep core design in structured files, not scattered copy.

Recommended canonical data modules/files:

- arcade identity;
- cabinet registry;
- weapons;
- pickups;
- enemy archetypes;
- boss roster;
- levels/sections;
- scoring rules;
- achievements;
- audio events;
- UI copy for mode separation.

Benefits:

- tests can verify canon;
- UI can render from one source;
- docs can be generated;
- future AI agents can modify safely.

## B. Asset manifest pipeline

For every asset batch:

1. Copy accepted source files into repo.
2. Slice/clean into runtime PNGs.
3. Emit manifest JSON.
4. Generate contact sheet/GIF preview.
5. Validate dimensions, alpha, naming, and frame counts.
6. Browser-smoke actual runtime sprite usage.

Recommended manifest fields:

- source path;
- runtime path;
- entity ID;
- animation state;
- frame index;
- width/height;
- anchor point;
- hitbox/hurtbox;
- loop flag;
- fps.

## C. Aseprite/LibreSprite export automation

If Aseprite is used, standardize:

- layer names;
- tags per animation;
- CLI export to sprite sheet + JSON;
- versioned source `.aseprite` files;
- generated PNGs ignored/regenerated where appropriate.

## D. Enemy behavior preview harness

Build a local debug scene that can spawn one enemy at a time and show:

- current state;
- detection range;
- attack range;
- cooldowns;
- hitboxes/hurtboxes;
- telegraph duration;
- transition log.

This will speed up AI tuning dramatically.

## E. Encounter simulator

Create a small simulator/test harness that runs encounter data without full manual play:

- max concurrent enemy count;
- average time to clear;
- spawn intervals;
- boss phase timing;
- pickup availability;
- player damage assumptions;
- scroll-lock release conditions.

Use it to catch impossible or boring encounters before manual playtests.

## F. Telemetry for playtests

Log local playtest data:

- time to first hit;
- deaths by enemy type;
- damage by source;
- average enemies on screen;
- section clear time;
- pickup usage;
- crouch/cover usage;
- boss phase deaths;
- combo length;
- exit/restart behavior.

Then use weekly review to tune.

## G. Automated QA gates

Before demos or deployment:

- unit tests for canon/free-vs-paid state;
- asset manifest validation;
- sprite dimension/alpha checks;
- no missing image/audio paths;
- browser smoke: entry → wallet/mock → cabinet → free run → pause/exit → return;
- browser smoke: official simulated run → game over → summary → submit path;
- console error check;
- screenshot/visual QA for first screen and gameplay.

## H. Design backlog generator

After every playtest or article/resource pass, convert findings into tasks:

- problem observed;
- source/evidence;
- proposed change;
- affected system;
- acceptance test;
- priority;
- owner/status.

This prevents inspiration from staying as loose notes.

## I. Safe AI-assisted workflows

AI can help with:

- design prompts;
- enemy variant brainstorming;
- level beat drafts;
- placeholder art concepts;
- audio event lists;
- QA checklist generation;
- telemetry summaries.

Do not use AI as the final authority for production assets without:

- source/licensing checks;
- manual cleanup;
- in-game readability testing;
- deterministic manifests.

---

# 10. Priority roadmap

## Immediate, highest-value next pass

1. Convert default portal to true full-screen arcade shell.
2. Move debug/codex/network/gallery panels behind menus/dev mode.
3. Make Free Practice vs Official Run impossible to confuse.
4. Add run summary screen and return-to-arcade flow.
5. Implement/strengthen level director for staged combat pockets.
6. Add enemy FSM with clear telegraphs.
7. Add 5 enemy archetype specs and one fully implemented archetype.
8. Add crouch/cover as a real mechanical hurtbox change.
9. Add destructible props with clear VFX/SFX.
10. Define scoring model with combo/risk/clear bonuses.
11. Create pixel-art bible and sprite manifest standards.
12. Integrate a first production-quality Lester animation subset: idle/run/shoot/hurt.
13. Add one slums/foundry tileset slice with clear parallax layering.
14. Add audio manager with click-to-enable, music/SFX sliders, and first SFX set.
15. Add browser smoke tests for entry → play → pause/exit → return.

## Next layer

1. Add boss phase framework.
2. Implement first mini-boss.
3. Add pickup placement/risk rules.
4. Add official run summary payload model.
5. Add profile medals/cabinet mastery.
6. Add telemetry logging for local playtests.
7. Add encounter tuning dashboard/harness.
8. Add screenshot visual QA for homepage, cabinet select, gameplay, run summary.

## Later / expansion

1. Lilly as alternate hero with shared hitbox/stats.
2. More cabinets in Lester's Arcade.
3. Seasonal leaderboard cadences.
4. Tournament modes.
5. Replay/ghost data.
6. Anti-cheat/verifier design.
7. Real chain/payments only after product and trust flow are stable.

---

# 11. Foundational idea checklist

## Art

- Consistent side-view pixel-art bible.
- Limited palette with blue/silver brand accents.
- Strong silhouettes over detail.
- In-engine readability checks.
- Separate foreground, gameplay, background, parallax layers.
- Use cabinet art as part of the product identity.

## Animation

- Key poses first, polish later.
- Every attack needs anticipation/impact/recovery.
- Every enemy needs an attack tell.
- Lester needs consistent head/face/proportions across states.
- Use contact sheets/GIFs for review.
- Validate frame counts and timing with manifests.

## Sound

- Audio communicates state, threat, reward, and identity.
- Enemy telegraphs and player damage must be unmistakable.
- Music sets vibe but should not bury gameplay cues.
- Add music/SFX sliders.
- Use click-to-enable audio for browser compatibility.

## Functionality

- Parent arcade and child game stay separate.
- Wallet profile owns official identity/progress.
- Free Practice never mutates official state.
- Official mode submits only at run end.
- Every run has pause/exit/return paths.
- Debug content is hidden from default product experience.
- Browser smoke tests verify real flows.

## Game design

- One clear core loop.
- Short readable combat pockets.
- Meaningful constraints.
- Score rewards skill expression.
- Bosses test learned rules.
- Rewards feel like arcade mastery, not chores.
- Ethical retention with clear exit ramps.

---

# 12. Article/resource appendix by category

## Game design / mechanics / loops

Key extracted value:

- Good design is clear goals, meaningful choices, feedback, balance, progression, and replayability.
- Mechanics are not isolated features; they are rule-based systems that create player experience.
- Core loops should be short, understandable, and rewarding.
- Addictive loops usually combine clear goals, immediate feedback, progression, reward anticipation, and mastery.
- Ethical design requires exit ramps and no coercive streak/loss pressure.
- Simple games can be deep when mechanics interact.

Primary application:

- Keep Hard Money Heroes as a tight score-attack loop; let depth come from encounter composition, scoring, boss patterns, and weapon/pickup tradeoffs.

## Pixel art / animation / environment / level design

Key extracted value:

- Start with constraints: size, palette, perspective, camera, outline style.
- Readability beats detail.
- Animate from key poses and silhouette first.
- Test sprites at final in-game scale.
- Use layered environments: foreground / gameplay / background / parallax.
- Aseprite is the strongest practical tool recommendation.

Primary application:

- Build a Lester/Enemy/Environment art bible and manifest pipeline before producing large batches of final assets.

## Enemy AI / NPCs / 2D shooter implementation

Key extracted value:

- Design AI by intended player feeling.
- Use FSMs/flowcharts for readable arcade enemies; behavior-tree priorities for richer decisions.
- Keep reactions non-blocking and performance-conscious.
- Use reusable entity, projectile, collision, spawn, camera, HUD, and audio systems.
- Playtest based on observed behavior, not assumptions.

Primary application:

- Build a Level Director plus enemy FSMs with perception tiers, telegraphs, and tuning dashboards.

---

# 13. Practical acceptance tests for future work

A Lester's Arcade improvement should not be considered done until these are true:

- Opening the app shows a full-screen arcade experience, not a technical dashboard.
- Wallet/profile state is visible and understandable.
- Free Practice and Official Run are visually and functionally separate.
- The player can enter Hard Money Heroes, play, pause, exit, and return to the arcade.
- Free Practice creates no official leaderboard/progress mutation.
- Official simulated run creates a run summary only at game over.
- Enemy attacks have readable telegraphs.
- No section exceeds the enemy cap unless intentionally tested.
- Lester and enemies are readable at gameplay zoom.
- The first-screen, cabinet-select, gameplay, and summary screens pass visual QA.
- Browser console has no critical errors.
- Tests pass after the final change, not only before it.
