# Lester's Arcade — Input, Art, and Autonomous Build Backlog

This is the working list of what Justin needs to decide or help create versus what Hermes can keep building locally for **Lester's Arcade** and the first playable cabinet, **Hard Money Heroes**.

## Decisions already confirmed

- First-game title: **Hard Money Heroes**.
- Parent portal remains: **Lester's Arcade**.
- Tone: goofy arcade plus gritty Metal Slug-style Web3 satire.
- Setting: **Litecoin City After Dark**.
- Main playable hero: **Lester**, with Rambo-like goofy/gritty commando energy.
- Future unlockable/alternate: **Lilly**, same moveset/hitbox/stats with different art.
- Violence/effects: sparks always on; blood/dismemberment off by default and toggleable before a run.
- Brand direction: subtle Litecoin references, broader crypto/Web3 satire, brand/legal sign-off before commercial logo/name-heavy/pay-to-play launch usage.
- Weapon naming: hybrid functional arcade names with crypto flavor.
- Economy: free = practice-only; paid = official state. Prototype paid entry target: **$0.25**.
- Leaderboards: daily, weekly, monthly, yearly, all-time.
- On-chain MVP scope: profiles, scores, achievements, payments, tournaments.

## Justin input still useful

### Character art

- Lester production silhouette and outfit: how close to the provided sprite references vs. a stronger Rambo/Metal Slug commando redesign?
- Lester proportions: chunky Neo-Geo/Metal Slug, smaller SNES mascot, or somewhere between?
- Lilly visual direction: matching Lester silhouette/hitbox but what personality/outfit?
- Whether any third hero beyond Lester/Lilly is wanted later. Max Mempool is parked as non-canon until approved.

### Levels/world

- First level art target to make production-quality first:
  1. Underchain District street/alley,
  2. Industrial Foundry,
  3. Tower lobby/elevator ascent,
  4. Mainnet Express train.
- Amount of rain/noir/cyberpunk grime vs. brighter arcade readability.

### Enemies/bosses

- Approve first production enemy batch: FUD Goblin, Gas Fee Wisp, Paper Hand.
- Approve first real demo boss: The Rug Pull Baron.
- Boss tone balance: meme/parody, serious monsters/mechs, or mixed.

### Brand/legal

- Who should review Litecoin-logo/name-heavy/Ł-heavy/pay-to-play usage before launch?
- Whether LitVM should stay mostly technical-panel copy or appear in player-facing arcade lore.

## First art assets to create/approve

### Generated prototype pass completed

A first AI-generated concept-art pack is now available under:

- Project assets: `apps/portal/assets/generated/`
- Repo manifest: `docs/game-design/hard-money-heroes-generated-art-pack.md`
- Command Center summary: `Lesters-Arcade-Hard-Money-Heroes-Generated-Art-Pack.md`

Best immediate-use drafts are the text-free Lester sprite sheet, Underchain District Level 1 background, first enemy wave, parent portal hero, cabinet key art, and boss roster. Weapon/pickup and achievement sheets need manual cleanup because generated image models can still introduce accidental text/letter-like marks.

### 1. Lester production sprite sheet

Needed frames:

- idle
- run cycle
- jump
- double jump
- shoot The Settler
- Litecoin Blade slash
- throw Crypto Bomb / Hard Fork
- hurt
- death/KO
- victory / hard-money-hero pose

Notes:

- Use local references: `C:/Users/just_/Downloads/Lester-Sprites-01.png` and `C:/Users/just_/Downloads/Lester-Sprites-02.png`.
- Keep a readable side-scroller silhouette.
- Silver/blue Litecoin accents should be subtle, not logo-wallpaper.

### 2. Level 1 background kit — The Slums

Production target:

- Underchain District street/alley background.
- Industrial Foundry second-half background.
- Parallax layers: skyline, mid-buildings/signage, foreground props, playable ground, FX overlays.
- Props: broken ticker signs, scam posters, cracked terminals, pipes, vents, crates, chain-link, foundry doors, molten silver/blue metal.

### 3. First enemy production sheet

Recommended first batch:

- FUD Goblin
- Gas Fee Wisp
- Paper Hand

Needed for each:

- silhouette
- idle/walk/fly pose
- attack tell
- attack frame
- hit frame
- sparks-only death burst
- optional-gore overlay frame if gore toggle is enabled

### 4. Weapon + pickup icon sheet

Needed icons/sprites:

- The Settler
- The Block Breaker
- The Hashstorm
- Litecoin Blade slash arc
- Crypto Bomb
- Hard Fork
- Cold Storage health pickup
- Cold Wallet Shield
- Hard Money Multiplier
- LTC Cache / silver-blue pickup burst

### 5. Hard Money Heroes cabinet/marketing art

Needed:

- cabinet marquee
- SNES-style cartridge label
- attract-mode splash/poster
- cabinet side art
- achievement badge style sample

## Current boss roster

1. The Rug Pull Baron
2. Mt. Goxzilla
3. The Whale
4. Sir FUD, the Bear King
5. The 51% Hydra
6. Tetherra, the Stable Queen
7. The Maximalist
8. Gas Titan / The Congestion
9. The Influencer / Mr. NGMI
10. The Quantum Hacker

## Hermes can keep building without more input

- Deeper combat sandbox collision/damage.
- Enemy hitboxes, projectiles, damage, and invulnerability frames.
- Pickup collision/inventory handling.
- Weapon cooldown/reload/ammo behavior.
- Boss health/phases and scroll locks.
- Parallax progression through The Slums → The Tower → The Getaway.
- Character/loadout/options panels.
- Placeholder sprite sheets, enemy sheets, pickup icons, parallax backgrounds, and badges.
- Tests, browser QA, console checks, and visual QA.
