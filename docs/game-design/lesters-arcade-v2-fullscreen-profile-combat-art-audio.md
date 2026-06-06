# Lester's Arcade V2 — Full-Screen App, Wallet Profile, Tactical Combat, Art, and Audio

This is the next product direction Justin approved after the first Vercel/GitHub-ready prototype became technically playable.

## Product goal

Lester's Arcade should feel like a **full-screen arcade app**, not a scrolling technical dashboard.

Default player flow:

1. Open Lester's Arcade.
2. Connect wallet.
3. Wallet becomes the profile/account key.
4. Select an arcade cabinet.
5. Play, view profile, view leaderboards, or adjust settings from menu navigation.

Most current prototype panels should move behind menus or developer/debug modes:

- network rails
- build stack/codex panels
- generated gallery
- test buttons
- long explanatory sections

## Wallet profile rules

- The connected wallet is the locked account identity.
- A user can sign out and sign in with another wallet, but progress/high scores/achievements follow the wallet.
- The wallet owns/tracks:
  - high scores
  - achievements
  - paid run submissions
  - profile settings
  - avatar upload
  - username
  - leaderboard placement
- Users can set a custom username for leaderboard display.
- Users can upload/select a square **150x150 px avatar**.
- Leaderboards show username + wallet + avatar.

## Navigation model

Main full-screen navigation should include:

- **Cabinets** — select Hard Money Heroes or future games.
- **Profile** — username/avatar/wallet/progress/achievements/high scores.
- **Leaderboards** — global boards and current user placement.
- **Settings** — controls, audio, accessibility, wallet/network, sign out.

## Leaderboards

Cadences:

- daily
- weekly
- monthly
- yearly
- all-time

Leaderboard UX should show:

- global top scores
- the connected user's placement on each board
- the user's best score per cadence
- username
- wallet address
- avatar

Official paid-run submission happens on the game-over screen, not continuously during free/local sandbox play.

On-chain submission payload should include at least:

- game ID
- score
- username
- wallet address
- avatar URI/reference
- cadence/season context
- chain ID
- run receipt / anti-cheat verifier data later

## Controls

Requested baseline controls:

- **WASD / Arrow keys** — movement
- **Control / S / ArrowDown** — crouch
- **Space** — jump
- **E** — melee
- **F** — grenade / throwing axe
- **Left mouse click** — shoot
- **Right mouse click** — melee
- **R** — reload/debug reload for finite-ammo pickups

## Tactical combat pacing

The current levels move too quickly. Direction is a slower, tactical, staged side-scroller:

1. Area loads.
2. Player clears 2–3 enemies.
3. Scroll advances to the next staged section.
4. Player clears 3–4 enemies.
5. Next section includes 2–3 enemies plus a mini-boss.
6. Continue staged escalation until roughly section/stage 8 or 9, then main boss.

Gameplay should emphasize:

- cover/crouching behind props
- jumping onto elevated platforms
- timing jumps over holes/gaps
- timing melee windows
- slower enemy fire rates
- slower enemy movement
- enemies telegraphing attacks clearly
- up to about 4 enemies on screen at once
- enemy melee counters delayed ~1–2 seconds after player melee opportunity
- explosive/destructible props that can damage enemies
- scroll locks that release only after staged enemies/mini-boss/boss are cleared

## Art direction

The current art is prototype-only. Production character art must be redone.

Tracked local reference assets now in repo:

- `apps/portal/assets/reference/lilly-reference-teal-sprite-sheet.png` — 1448x1086
- `apps/portal/assets/reference/lester-sprites-sheet-01.png` — 1448x1086
- `apps/portal/assets/reference/lester-sprites-sheet-02.png` — 1448x1086

Lester production requirements:

- must read as Lester, not generic commando
- keep consistent head/face/proportion language across frames
- chunky readable side-scroller silhouette
- blue/silver/Litecoin arcade accents without overusing logos
- production animations need idle, run, crouch, jump, fall, shoot, melee, throw, hurt, death, victory

Lilly:

- should become a future alternate playable hero or unlockable
- should share gameplay hitbox/stats unless we intentionally design variants later
- needs matching action states if added as playable

Enemies:

Each enemy needs richer sprites:

- idle
- walk/fly
- attack tell
- attack
- melee counter
- hit
- death
- optional gore overlay

## Sprite creation workflow candidates

Preferred practical workflow:

1. Use the reference images to define final silhouettes and palettes.
2. Slice/clean in Aseprite, LibreSprite, or scripted PIL where possible.
3. Use AI-generated sprite concepts only as reference or draft material.
4. Manually clean final sprite sheets for consistency, transparency, readability, and animation timing.
5. Validate all game-ready PNGs with scripts/tests before deploying.

Avoid feeding third-party licensed sound/art libraries into AI training workflows unless the license explicitly allows it.

## Audio direction

Local prototype music found and copied into repo:

- `apps/portal/assets/audio/music/lester-and-lilly-rap-getting-lit.mp3`

Use it for prototype menu/attract/gameplay music after user interaction. Browser builds must not autoplay audio before click/interaction.

Needed sound categories:

- menu/login/cabinet navigation sounds
- wallet connect sound
- jump/land
- gun fire
- melee slash
- grenade/throwing axe
- explosion
- enemy barks
- player damage
- enemy damage
- pickup
- game over
- leaderboard submit/sync
- ambient arcade/level loops

Candidate free/usable libraries:

- **Kenney Audio** — many CC0 game audio packs; best first source for prototype UI, impact, sci-fi, RPG, casino/arcade SFX.
- **Mixkit Game SFX** — free SFX under Mixkit's license; useful for quick arcade notification/game sounds.
- **Sonniss GameAudioGDC** — royalty-free media-production archive, strong for production ambience/weapons/creatures; license prohibits AI/ML training, so use only as game media assets.

## Immediate implementation priorities

1. Convert current page into full-screen app shell with hidden debug/developer panels.
2. Build profile modal/page with username + 150x150 avatar upload tied to wallet.
3. Build leaderboard nav with daily/weekly/monthly/yearly/all-time tabs and player placement.
4. Stage combat into gated sections with slower scroll and enemy pacing.
5. Add crouch/cover/platforming/destructible props.
6. Replace current Lester art with production-style reference-based sprite sheet.
7. Add prototype audio manager with music/SFX sliders and click-to-enable audio.
