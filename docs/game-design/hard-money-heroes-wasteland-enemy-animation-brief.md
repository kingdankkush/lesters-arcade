# Hard Money Heroes — Crypto Wasteland Enemy Animation Brief

Date: 2026-06-19
Scope: Level 1 enemy sprite / animation production targets for the Crypto Wasteland opener.

## Global requirements

- Isometric readability first.
- Minimum **24-frame telegraph** on committed attacks; 26-30 for elites/snipers where possible.
- Locked anchor / footing across all frames.
- Separate hitbox, hurtbox, and collision footprint from sprite bounds.
- Required state families: idle, move, telegraph, attack, hit-react, death, optional elite / summon / reload / dive specials.
- Dust, shadow, and muzzle-flash overlays must never hide the threat silhouette.

## Roster

### Coyote Pack
- Role: melee pack animal
- Required reads: low stalking idle, split-flank run, feint-hop tell, lunge bite, skid recovery, death tumble
- Counterplay to preserve in frames: two-step fake before the real collapse

### Claim-Jumper
- Role: ranged human
- Required reads: shoulder-set idle, rifle raise, scope glint tell, recoil, reload, cover hop, death collapse
- Counterplay to preserve in frames: visible aim flash before shot release

### Wild Boar
- Role: charger animal
- Required reads: hoof scrape, head-down charge, impact skid, stun recoil, death slide
- Counterplay to preserve in frames: rooted anticipation before straight-line commitment

### Buzzard
- Role: flyer animal
- Required reads: bank left/right, circle hover, shadow-tightening dive tell, dive strike, pull-up recovery, feather burst death
- Counterplay to preserve in frames: ground-shadow indicator syncs with dive timing

### Rattlesnake
- Role: ambusher animal
- Required reads: half-buried idle, coil, tail-rattle tell, strike, recoil, death unwind
- Counterplay to preserve in frames: clear coil silhouette before strike burst

### Bandit Captain
- Role: elite human
- Required reads: command walk, banner plant tell, sidearm burst, dash, hit-stagger, death kneel
- Counterplay to preserve in frames: banner plant locks the captain in place long enough for punishment

### Scam-Cult Zealot
- Role: elite human
- Required reads: chant idle, aura raise, shotgun fan tell, blast recoil, retreat step, death flare
- Counterplay to preserve in frames: fan spread is readable from torso twist and lantern flare

### Cave FUD Goblin
- Role: contextual grunt
- Required reads: cave creep idle, torch toss tell, scramble run, hit yelp, death flop
- Counterplay to preserve in frames: throw arc begins with a bright torch-up silhouette

## Priority build order

1. Claim-Jumper
2. Coyote Pack
3. Wild Boar
4. Rattlesnake
5. Buzzard
6. Bandit Captain
7. Scam-Cult Zealot
8. Cave FUD Goblin variant pass

## Runtime verification

- Every enemy keeps a readable silhouette at 1x and cabinet viewing distance.
- Telegraphs remain legible under dust, muzzle flashes, and POI ambience.
- Death, hit, and attack states map cleanly into the existing canonical actor / combat bridge pipeline.
