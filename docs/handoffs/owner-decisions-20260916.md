# Owner decisions — 2026-09-16 (question round)

Answers Justin gave to the thirty-question round after the 1.6.0 release. They
override the master list (`LESTERS-ARCADE-MASTER-REMAINING-WORK-2026-09-16.md`)
wherever the two disagree. Items marked **owner** cannot be done from the build
machine.

## Platform / Web3

- Key custody: whatever is recommended for ease of use, security and Web3
  integration. Implemented as: relayer-settled scores (`/api/settle`), SIWE
  session tokens (`/api/session`), hosted profiles on Neon (`/api/profile`).
- Contract audit: none has been done; "Jack's audit" is unknown to the owner.
  The security baseline forge suite exists but has not been run (no foundry
  here). An external audit before mainnet is still recommended.
- Fee split: every game sends 15% to the Lester's Arcade treasury wallet and
  85% to the game developer. Until Louie sends the Chikun wallet, **all**
  recipients are the owner's LitVM wallet `0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26`.
- Entry price: a flat 0.1 zkLTC (easy to adjust) **plus** the actual settlement
  gas, collected as a separate reserve at entry (`ArcadeRankedEntry.quoteEntry`).
- Testnet leaderboards run on testnet and are wiped clean at mainnet. Per-game
  wipes may happen as games evolve; the only planned reset is mainnet.
- Hosted database is acceptable (Neon over Vercel).
- Achievements: one soulbound collection per game, evolving until mainnet, then
  wiped. Art: per-game themed, highly detailed illustrations, tiered
  bronze / silver / gold / platinum by difficulty. **Owner** supplies art.
- Free Mode is always free and never touches Web3.
- Global leaderboards page: better navigation, filtering / sorting / search,
  per-game designed button banners, intuitive.

## Hard Money Heroes

- Priority order: (1) finish all weapon models and animations, keep upgrading
  3D models and adding contextual animations (combat, movement, traversal) for
  every hero, enemy and boss; (2) level design and props: towns, forests with
  more tree variety composed into scenes, water (rivers, lakes), bridges,
  walls / fences / barriers, mountains, boulders, homes and neighbourhoods,
  farms, flowers, bushes; roads and pathing that make sense; (3) Level 2 later.
- Interactive areas must make sense: unlock a gate to free a prisoner, unlock a
  gate to reach a weapon or power-up, start a boss fight that pays out a reward,
  open large gates into blocked areas. Interactions are contextual (controls are
  limited) but heroes still get animations for pressing buttons, lifting
  switches, and similar.
- Railgun: damage falls off along the lane; a target at maximum range takes
  about 35% of the muzzle damage.
- Gamepad weapon wheel: right-bumper cycle plus whatever is recommended
  (decision: keep bumper cycle; a stick-driven radial is optional later).
- Camera: keep the recommended default; on desktop, mouse wheel zooms in up to
  10% and out up to 30% from the default.
- Phones prioritise frame rate over resolution. Desktop may spend more on
  resolution, textures and features.
- Enemy roles: continue the ChatGPT Image → Tripo → Blender pipeline for every
  model; polish, optimise and animate all sensible actions.
- "Liquidator phases": there are no phases yet; Level 1 is explore, fight and
  survive with rising difficulty. Treat boss rewards as first-clear vault
  rewards.
- Gore default: physics-driven blood splats from gunfire impacts; dismemberment
  from certain weapons and environmental hazards.
- Silver Litecoin coins count toward the game score. Improve the coin drop
  model and animation.
- Weapon feel reference: a mix of DOOM, Metal Slug and Deep Rock Galactic:
  Survivor.
- **New:** a brief bold pickup / action banner on screen whenever the player
  picks up a weapon, ammo, grenades or a power-up, or completes a world
  interaction (gate unlocked, etc.). Not distracting; fades quickly.

## Chikun's Escape

- Character: fine-tune the 3D model to the original character sheet. Sheet
  reference (owner attachment 2026-09-16): white-feathered chicken with a
  spiky crimson mohawk crest, large glowing mint-green eyes with dark pupils,
  small orange beak, black high-collared trench coat with red lining and
  lapels, black shirt, black trousers, black boots; six expressions (stern,
  shouting, side-eye, surprised, gritted teeth, smug). Front, side and back
  turnarounds.
- Poses to add or polish: idle, walk, run, jump, superman flight, flying up,
  flying down, steep up, steep down, landing, and hits against each obstacle
  family (trees, storm cloud, drone, pipes, and so on).
- Rig: whatever is recommended, as long as the final model matches the sheet.
- Region order: **Farmland** first (barns, fences, cows, goats, wheat hills,
  tulips, sunflower and lavender fields, tractors) → forest (oak, willow,
  cherry blossom; creeks, rivers, waterfalls, bridges, boulders) → a few town
  buildings → city → industrial → suburbs / neighbourhoods → coast → loops
  seamlessly back to farmland at the current speed and score.
- Daily challenge: tease only, on the Free and Ranked screens; Ranked teases a
  reward soon for high scores. Future Chikun memecoin rewards: first to a set
  Ranked score, highest Ranked score of the week / month / year.
- Creator rights / wallet: developer payouts will go to Louie later; testnet
  uses the owner's wallets.

## STACKED

- Visualizer: "cool animations that animate and transition to the music";
  owner reference videos (YouTube ids geGPkZD_zY4, QeZne1wVyl0, 7kfjAUaKcnk,
  s8XIgR5OGJc, 41ujnXSBUI0, OikOgyDeOQw).
- Music reactivity may drive the board frame and piece glow (colours, particle
  effects), not only the background.
- Full menu redesign with bespoke artwork, clean and easy to navigate.
- Local two-player and online versus stay on the roadmap after the core game.
- Crypto-flavoured names ("Halving" for a four-line clear) only where they fit.
