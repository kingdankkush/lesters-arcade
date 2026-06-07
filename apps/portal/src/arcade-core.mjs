import { HMH_HD_SPRITE_ATLAS_MANIFEST } from '../assets/generated/hmh-hd-sprite-atlas.mjs';
import { HMH_ENVIRONMENT_ASSET_MANIFEST } from '../assets/hard-money-heroes/environment/hmh-environment-manifest.mjs';
import { HMH_CABINET_SPRITE_MANIFEST } from '../assets/hard-money-heroes/cabinet/hmh-cabinet-sprite-manifest.mjs';
import { LESTER_ARCADE_PLAYLIST_MANIFEST } from './arcade-playlist-manifest.mjs';

export const HARD_MONEY_HEROES_ENVIRONMENT_MANIFEST = HMH_ENVIRONMENT_ASSET_MANIFEST;

export const DEFAULT_ENTRY_FEE_MICRO_USDC = 250_000;

export const DEFAULT_REVENUE_SPLIT_BPS = Object.freeze({
  infrastructure: 4000,
  developer: 3500,
  tournament: 1500,
  community: 1000,
});

export const HARD_MONEY_HEROES_CANON = Object.freeze({
  title: 'Hard Money Heroes',
  workingTitle: true,
  parentArcade: "Lester's Arcade",
  tone: 'goofy arcade mix with gritty Metal Slug-style satire',
  references: Object.freeze(['Metal Slug arena-as-mechanic', 'crypto/Web3 culture satire', 'Litecoin sound-money contrast']),
  litecoinReferenceLevel: 'subtle: silver/blue palette, functional Ł motifs, no logo wallpaper, villains represent broader scam culture',
  gore: Object.freeze({
    defaultMode: 'sparks-only',
    alwaysOnEffects: Object.freeze(['silver impact sparks', 'muzzle flashes', 'shell casings', 'enemy-specific pop/explosion effects']),
    optionalEffects: Object.freeze(['stylized pixel blood splatter', 'enemy dismemberment chunks', 'boss gore bursts']),
    toggleBeforeRun: true,
    rule: 'Blood/gore must be explicitly enabled before beginning a game; spark effects always remain on for readability.',
  }),
  world: Object.freeze({
    name: 'Litecoin City After Dark',
    pitch: 'A neon-drenched cyberpunk metropolis built on the bones of a failed financial system.',
    atmosphere: 'perpetual night, rain-slicked streets, holographic ticker tape, glass towers pulsing with market data',
    colorLanguage: Object.freeze({
      hero: 'clean Litecoin silver/blue glow for sound money, trust, Lester, shields, and weapon accents',
      corruption: 'sickly red-orange speculation neon for scams, FUD, bad actors, hazards, and enemy tells',
    }),
    campaignRhythm: 'Level 1 moves outward across the ground, Level 2 climbs vertically, Level 3 hurls forward at train speed.',
  }),
  characters: Object.freeze([
    Object.freeze({ id: 'lester', title: 'Lester', playable: true, personality: 'Rambo-like arcade commando: stubborn, brave, over-the-top, one-liners implied, walks against the panic.', role: 'main playable hero' }),
    Object.freeze({ id: 'lilly', title: 'Lilly', playable: 'unlockable-later', personality: 'same moveset as Lester with different art/sprites once designed.', role: 'future unlockable character' }),
  ]),
  levels: Object.freeze([
    Object.freeze({
      id: 'the-slums',
      title: 'Level 1 — The Slums',
      route: 'Underchain District → Industrial Foundry',
      boss: 'The Rug Pull Baron',
      visualShift: 'claustrophobic neon alleys and rugged-wallet kiosks open into amber steel counterfeit-mint furnaces and smelt-pits',
      enemyTeaching: Object.freeze(['FUD Goblins', 'Paper Hands', 'Rug Rats', 'Honeypot Turrets', 'Gas Fee Wisps', 'Slippage Skaters']),
    }),
    Object.freeze({
      id: 'the-tower',
      title: 'Level 2 — The Tower',
      route: 'Financial District → Vertical Skyscraper Ascent',
      boss: 'The Influencer (Mr. NGMI)',
      visualShift: 'corporate chrome plaza to marble lobby to trading floor, server farm, VIP lounge, and rain-soaked penthouse',
      enemyTeaching: Object.freeze(['Bot Swarm (Sybil Drones)', 'Phishing Anglers', 'MEV Reapers', 'Honeypot Turrets']),
    }),
    Object.freeze({
      id: 'the-getaway',
      title: 'Level 3 — The Getaway',
      route: 'Bullet Train Interior → Rooftop Finale',
      boss: 'The Quantum Hacker',
      visualShift: 'luxury car, vault car, engine machinery, flooded sparking car, then roof finale through smeared neon rain',
      enemyTeaching: Object.freeze(['Slippage Skaters', 'Paper Hands', 'Honeypot Turrets', 'MEV Reapers', 'Liquidation Cascade Golems', 'Gas Fee Wisps', 'Bot Swarms']),
    }),
  ]),
  economy: Object.freeze({
    paidEntryUsd: 0.25,
    acceptedPayments: Object.freeze(['USDC', 'ETH', 'LTC']),
    configurableFuture: true,
    paidModeTracks: Object.freeze(['profile progress', 'achievements', 'official high scores', 'transactions', 'tournaments']),
    freeModeTracks: Object.freeze([]),
    freeModeRule: 'Free mode is no-cost practice and does not track progress, achievements, high scores, or transactions.',
  }),
  leaderboards: Object.freeze({
    paidOnly: true,
    cadences: Object.freeze(['daily', 'weekly', 'monthly', 'yearly', 'all-time']),
  }),
  web3: Object.freeze({
    dappitTiming: 'later-after-playable-prototype',
    onchainMvp: Object.freeze(['profiles', 'scores', 'achievements', 'payments', 'tournaments']),
    litvmPlacement: 'infrastructure and proof-of-substance screens, not character/story fantasy',
  }),
  audio: Object.freeze({
    genreSpine: 'synthwave pushed into arcade-techno / darksynth for combat',
    combat: 'harder, faster darksynth / arcade-techno',
    boss: 'peak intensity, biggest arrangements',
    voiceBarks: Object.freeze(['BLOCK BREAKER!', 'MISSION COMPLETE!', 'HARD MONEY!']),
    signatureMotif: 'short 3-5 note Litecoin motif in menu, level-clear sting, and final boss track',
  }),
  brand: Object.freeze({
    palette: Object.freeze(['Litecoin Blue #345DCC', 'White #FFFFFF', 'Navy', 'Silver', 'speculation red-orange for corruption']),
    logoUsage: 'accent only; use Ł as functional motif in sparks, pickups, shield, blade etching, and muzzle flashes',
    villainRule: 'villains are never branded with real Litecoin marks',
    litvmPlacement: 'prominent in plumbing, quiet in story',
    legalFlag: 'before launch, get explicit written brand sign-off for Litecoin name/logo/Ł usage, Litecoin City, Lester mascot, and pay-to-play monetization',
  }),
  spriteReferences: Object.freeze([
    Object.freeze({ file: './assets/hard-money-heroes/reference/Lester/Lester-Sprites-01.png', purpose: 'repo-local Lester reference for future production sprite pass' }),
    Object.freeze({ file: './assets/hard-money-heroes/reference/Lester/Lester-Sprites-02.png', purpose: 'repo-local Lester reference for future production sprite pass' }),
  ]),
});

export const LITVM_LITEFORGE_NETWORK = Object.freeze({
  name: 'LitVM LiteForge',
  status: 'public-testnet',
  chainId: 4441,
  chainIdHex: '0x1159',
  nativeCurrency: Object.freeze({
    name: 'zkLTC',
    symbol: 'zkLTC',
    decimals: 18,
  }),
  rpcUrls: Object.freeze({
    http: 'https://liteforge.rpc.caldera.xyz/http',
    websocket: 'wss://liteforge.rpc.caldera.xyz/ws',
  }),
  explorerUrl: 'https://liteforge.explorer.caldera.xyz',
  faucetUrl: 'https://liteforge.hub.caldera.xyz',
  portalUrl: 'https://testnet.litvm.com',
  safetyNotes: Object.freeze([
    'LiteForge is a public testnet; zkLTC has no real value.',
    'Use a fresh EVM wallet for ecosystem app testing.',
    'Verify the wallet is on Chain ID 4441 before live testnet transactions.',
  ]),
});

export const LESTER_ARCADE_BUILD_STACK = Object.freeze({
  currentPrototype: Object.freeze({
    engine: 'web-canvas',
    framework: 'vanilla-html-css-js',
    reason: 'fastest browser-first dApp prototype with direct wallet UI, Canvas gameplay, and Node test coverage',
  }),
  recommendedPortal: Object.freeze({
    current: 'static HTML/CSS/JS prototype',
    next: 'Vite or Next.js arcade portal with wallet adapter and API-backed score verifier',
  }),
  recommendedGameEngine: Object.freeze({
    primary: 'phaser-or-custom-canvas',
    optional: Object.freeze(['godot-html5-export', 'unity-webgl-export']),
    note: 'Godot/GDevelop-style engines can work for game feel, but browser-native Phaser/custom Canvas keeps Web3 wallet and hackathon dApp integration simpler for the first playable.',
  }),
  web3: Object.freeze({
    targetNetwork: LITVM_LITEFORGE_NETWORK.name,
    chainId: LITVM_LITEFORGE_NETWORK.chainId,
    nativeGasToken: LITVM_LITEFORGE_NETWORK.nativeCurrency.symbol,
    smartContractAssistants: Object.freeze(['dappit.io']),
    chainRole: 'contracts own profiles, paid-session receipts, score claims, achievements, game registry, and tournament pools; gameplay remains off-chain until verifier rules are ready',
  }),
});

export const LESTER_ARCADE_WALLET_RAILS = Object.freeze({
  targetNetwork: LITVM_LITEFORGE_NETWORK.name,
  targetChainId: LITVM_LITEFORGE_NETWORK.chainId,
  targetChainIdHex: LITVM_LITEFORGE_NETWORK.chainIdHex,
  nativeGasToken: LITVM_LITEFORGE_NETWORK.nativeCurrency.symbol,
  network: LITVM_LITEFORGE_NETWORK,
  parentSystem: "Lester's Arcade",
  activeChildGame: 'Hard Money Heroes',
  connectors: Object.freeze([
    Object.freeze({
      id: 'injected-evm',
      label: 'Browser EVM wallet',
      role: 'preferred real-wallet connector for LitVM-compatible accounts',
      safeForPrototype: true,
    }),
    Object.freeze({
      id: 'mock-wallet',
      label: 'Mock local wallet',
      role: 'offline QA fallback when MetaMask/Rabby/etc. are unavailable',
      safeForPrototype: true,
    }),
  ]),
  permissions: Object.freeze({
    readScopes: Object.freeze(['wallet address', 'chain id', 'parent arcade profile', 'child game progress']),
    writeScopes: Object.freeze(['paid sessions', 'profile progress', 'achievements', 'official scores', 'transaction receipts']),
    freeModeRule: 'free practice never writes progress, achievements, scores, or transactions to the parent account',
    paidModeRule: 'official paid runs create a parent-sync packet for progress, achievements, leaderboard, and receipt state',
  }),
  verifier: Object.freeze({
    currentStatus: 'prototype-local-unverified',
    nextStep: 'replace simulated transaction hashes with LitVM receipts and verifier-signed score summaries',
  }),
});

export const LESTER_ARCADE_BRAND_SYSTEM = Object.freeze({
  name: "Lester's Arcade",
  tagline: 'LitVM retro arcade OS for wallet-owned players and cabinet dapps.',
  wordmark: 'LESTER\'S ARCADE',
  logoLockup: 'coin-orb + CRT wordmark + cabinet marquee',
  typography: Object.freeze({
    display: 'chunky arcade marquee / pixel display',
    interface: 'Trebuchet MS + Lucida Console fallback for local prototype',
    rule: 'short uppercase labels, friendly beginner-readable body copy',
  }),
  palette: Object.freeze([
    Object.freeze({ token: '--bg', name: 'Deep CRT Black', hex: '#070512', usage: 'page background, cabinet shadows' }),
    Object.freeze({ token: '--panel', name: 'Midnight Purple Glass', hex: '#120b2c', usage: 'main panels and cards' }),
    Object.freeze({ token: '--neon-cyan', name: 'Lite Beam Cyan', hex: '#19f7ff', usage: 'focus rings, links, guide rails' }),
    Object.freeze({ token: '--neon-yellow', name: 'Coin Slot Yellow', hex: '#ffe84d', usage: 'primary highlights, score labels, warnings' }),
    Object.freeze({ token: '--neon-green', name: 'Power-Up Green', hex: '#45ff8a', usage: 'success, connected wallet, health pickups' }),
    Object.freeze({ token: '--neon-pink', name: 'Boss Alert Pink', hex: '#ff3df2', usage: 'marquee glow, rare pickups, boss energy' }),
    Object.freeze({ token: '--neon-red', name: 'Damage Red', hex: '#ff476f', usage: 'damage, danger, hit flashes' }),
    Object.freeze({ token: '--ltc-silver', name: 'Litecoin Silver', hex: '#c8d3e8', usage: 'coins, knives, rails, icon strokes' }),
  ]),
  patterns: Object.freeze([
    Object.freeze({ id: 'crt-scanlines', label: 'CRT scanlines', css: 'repeating-linear-gradient(to bottom, rgba(255,255,255,.03) 0 1px, transparent 1px 4px)', usage: 'global overlay' }),
    Object.freeze({ id: 'cabinet-grid', label: 'Cabinet floor grid', css: 'repeating-linear-gradient(90deg, rgba(255,255,255,.05) 0 1px, transparent 1px 80px)', usage: 'arcade stage floors' }),
    Object.freeze({ id: 'coin-halftone', label: 'Coin halftone glow', css: 'radial-gradient(circle, rgba(255,232,77,.18), transparent 68%)', usage: 'brand cards and pickups' }),
    Object.freeze({ id: 'boss-warning-stripe', label: 'Boss warning stripe', css: 'repeating-linear-gradient(45deg, rgba(255,71,111,.3) 0 10px, transparent 10px 20px)', usage: 'scroll-lock and boss panels' }),
  ]),
  icons: Object.freeze([
    Object.freeze({ id: 'wallet', symbol: '▣', label: 'Wallet / parent account', usage: 'login, profile, synced account state' }),
    Object.freeze({ id: 'cabinet', symbol: '▥', label: 'Cabinet dApp', usage: 'game-selection and child machines' }),
    Object.freeze({ id: 'coin', symbol: '◉', label: 'Paid credit', usage: 'official paid session and score eligibility' }),
    Object.freeze({ id: 'trophy', symbol: '★', label: 'Official leaderboard', usage: 'paid high-score tracking' }),
    Object.freeze({ id: 'guide', symbol: '?', label: 'Guide / tooltip', usage: 'beginner help and hover hints' }),
    Object.freeze({ id: 'weapon', symbol: '⌁', label: 'Weapon / pickup', usage: 'loadouts, power-ups, combat cards' }),
    Object.freeze({ id: 'boss', symbol: '⚠', label: 'Boss / danger', usage: 'scroll locks, boss phases, hazard warnings' }),
  ]),
  qualityRules: Object.freeze([
    'All prototype panels should explain what to do next in one sentence or less.',
    'Every major control must show keyboard, button, and tooltip copy.',
    'Canvas/gameplay should target 60fps with pixel-snapped sprites and readable attack tells.',
    'Official Web3 actions must be labeled as simulated until live wallet/LitVM integration is approved.',
    'Bright neon accents should carry meaning: green success, yellow score, cyan guidance, red danger, pink boss/rare energy.',
  ]),
});

export const LESTER_ARCADE_UI_QUALITY_SYSTEM = Object.freeze({
  quickStart: Object.freeze([
    Object.freeze({ id: 'connect', title: 'Connect Wallet', copy: 'Create the parent arcade account. MetaMask/Rabby is preferred; mock wallet remains an offline QA fallback.', icon: 'wallet' }),
    Object.freeze({ id: 'choose-cabinet', title: 'Choose Cabinet', copy: 'Pick Hard Money Heroes from the cabinet row or SNES cartridge shelf.', icon: 'cabinet' }),
    Object.freeze({ id: 'choose-mode', title: 'Pick Free or Paid', copy: 'Free is practice-only with no parent tracking; paid is the simulated official leaderboard path.', icon: 'coin' }),
    Object.freeze({ id: 'start-combat', title: 'Start Combat', copy: 'Launch the 60fps Canvas test and practice movement, shooting, Litecoin Blade attacks, throwables, and pickups.', icon: 'weapon' }),
    Object.freeze({ id: 'survive-score', title: 'Survive + Score', copy: 'Survival time, kills, combos, bosses, power-ups, and rare weapons all feed score.', icon: 'trophy' }),
    Object.freeze({ id: 'sync-results', title: 'Sync Run', copy: 'Complete a prototype run to update parent progress, achievements, transactions, and official scores.', icon: 'trophy' }),
  ]),
  instructions: Object.freeze([
    Object.freeze({ title: 'Survive as long as possible', body: 'Level 1 and 2 introduce mechanics; Level 3 becomes an infinite escalation run.' }),
    Object.freeze({ title: 'Keep the combo alive', body: 'Damage chains and kills without taking damage grow your score faster.' }),
    Object.freeze({ title: 'Use the blade up close', body: 'The Litecoin Blade is Lester\'s signature high-risk melee move: one-shot basic grunts, save ammo, and pop Ł sparks.' }),
    Object.freeze({ title: 'Save rare weapons for bosses', body: 'The Hashstorm suppresses waves; rare charged weapons are intended for armor, boss phases, and clutch survival moments.' }),
    Object.freeze({ title: 'Watch for arena locks', body: 'Mini-boss and boss rooms pause forward progression until the threat is defeated; use cover and vertical space before pushing right again.' }),
  ]),
  tooltips: Object.freeze([
    Object.freeze({ anchor: 'connectWalletButton', title: 'Wallet login', copy: 'Tries MetaMask/Rabby first, requests LitVM LiteForge if needed, then falls back to a local mock wallet. No funds or live game transaction.' }),
    Object.freeze({ anchor: 'freePlayButton', title: 'Free play', copy: 'Practice for free with no official tracking: no progress, achievements, high scores, or transactions.' }),
    Object.freeze({ anchor: 'paidPlayButton', title: 'Official credit', copy: 'Simulates a $0.25 paid run in USDC/ETH/LTC rails that can sync official leaderboard, achievements, and transaction state.' }),
    Object.freeze({ anchor: 'simulateRunButton', title: 'Sync prototype result', copy: 'Completes a generated run summary and writes progress back to the parent account model.' }),
    Object.freeze({ anchor: 'startCombatButton', title: 'Start 60fps combat', copy: 'Starts the Canvas test loop. Target: 60fps, smooth controls, pixel-snapped sprites.' }),
    Object.freeze({ anchor: 'jumpButton', title: 'Jump / double jump', copy: 'Keyboard: Space. Use double jump to reach vertical platforms and dodge boss sweeps.' }),
    Object.freeze({ anchor: 'shootButton', title: 'Shoot', copy: 'Mouse: Left Click. Fire your current gun; pickups can swap blaster, shotgun, auto, rail, or rare super weapon.' }),
    Object.freeze({ anchor: 'meleeButton', title: 'Litecoin Blade', copy: 'Keyboard: E or Mouse: Right Click. Signature close-range slash with silver arc, Ł sparks, and optional gore if enabled before the run.' }),
    Object.freeze({ anchor: 'grenadeButton', title: 'Throwable', copy: 'Keyboard: F. Use Crypto Bombs or Hard Fork throwing axes once the full loadout is built.' }),
    Object.freeze({ anchor: 'powerUpButton', title: 'Drop power-up', copy: 'Prototype helper for testing health, shield, ammo, +1up, score multiplier, and weapon pickups.' }),
    Object.freeze({ anchor: 'combatCanvas', title: 'Gameplay viewport', copy: 'Left-to-right parallax side scroller with mini-boss scroll locks and infinite level-three escalation.' }),
    Object.freeze({ anchor: 'leaderboardPanel', title: 'Official board', copy: 'Only paid prototype runs are eligible for official leaderboard state.' }),
  ]),
  controls: Object.freeze({
    keyboard: Object.freeze([
      Object.freeze({ action: 'Move Left', key: 'A / ArrowLeft', tip: 'Tap or hold to dodge while the camera scrolls right.' }),
      Object.freeze({ action: 'Move Right', key: 'D / ArrowRight', tip: 'Advance toward pickups and boss arenas.' }),
      Object.freeze({ action: 'Crouch', key: 'Control / S / ArrowDown', tip: 'Duck behind cover and lower your hitbox under slower enemy fire.' }),
      Object.freeze({ action: 'Jump', key: 'Space', tip: 'Press twice for double jump and vertical lanes.' }),
      Object.freeze({ action: 'Shoot', key: 'Left Click', tip: 'Core ranged attack; maintain fire for combos.' }),
      Object.freeze({ action: 'Blade', key: 'E / Right Click', tip: 'Fast close-range Litecoin Blade melee for ammo conservation.' }),
      Object.freeze({ action: 'Throwable', key: 'F', tip: 'Crypto Bomb area burst or Hard Fork throwing axe for swarms and boss phases.' }),
      Object.freeze({ action: 'Reload', key: 'R', tip: 'Reload limited-ammo pickups.' }),
    ]),
    gamepad: Object.freeze([
      Object.freeze({ action: 'Move', key: 'D-pad / Left Stick', tip: 'Arcade baseline movement.' }),
      Object.freeze({ action: 'Jump', key: 'A', tip: 'Jump and double jump.' }),
      Object.freeze({ action: 'Shoot', key: 'X / RT', tip: 'Primary fire.' }),
      Object.freeze({ action: 'Knife', key: 'B', tip: 'Melee slash.' }),
      Object.freeze({ action: 'Grenade', key: 'Y / LB', tip: 'Throw grenade.' }),
    ]),
  }),
  qualityChecklist: Object.freeze([
    Object.freeze({ id: 'visual-hierarchy', label: 'Clear portal → cabinet → game hierarchy', status: 'prototype-pass' }),
    Object.freeze({ id: 'tooltips', label: 'Tooltips on primary controls and official Web3 actions', status: 'prototype-pass' }),
    Object.freeze({ id: 'keyboard-guide', label: 'Keyboard and gamepad guide model present', status: 'prototype-pass' }),
    Object.freeze({ id: 'brand-tokens', label: 'Shared palette, icons, and pattern language documented', status: 'prototype-pass' }),
    Object.freeze({ id: 'canvas-feel', label: '60fps target and readable combat HUD surfaced', status: 'prototype-pass' }),
    Object.freeze({ id: 'production-art', label: 'Final production sprite sheets and animation timing', status: 'needs-production-pass' }),
    Object.freeze({ id: 'real-wallet-tooltips', label: 'Live wallet/dappit/LitVM tooltip copy after integration', status: 'needs-production-pass' }),
  ]),
});

export const LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP = Object.freeze({
  name: "Lester's Arcade public player loop",
  playerPromise: 'A player should understand the wallet/profile gate, pick Hard Money Heroes, watch or skip the intro splash, choose Free or Ranked, and begin Level 1 in under 45 seconds.',
  stageOrder: Object.freeze([
    'wallet-splash',
    'arcade-entry',
    'cabinet-select',
    'game-intro-splash',
    'mode-select',
    'level-intro',
    'gameplay',
    'game-over-summary',
    'return-to-arcade',
  ]),
  modeBoundaries: Object.freeze({
    free: Object.freeze({
      label: 'Free Practice',
      tracks: false,
      writes: Object.freeze([]),
      replayCost: 'free',
      copy: 'Local-only practice; never writes progress, achievements, official scores, or transaction receipts.',
    }),
    ranked: Object.freeze({
      label: 'Ranked Testnet',
      tracks: true,
      writes: Object.freeze(['profile progress', 'achievements', 'official scores', 'transaction receipts']),
      replayCost: 'new testnet credit',
      submissionTrigger: 'explicit-game-over-submit',
      copy: 'Official state is deferred until the player presses Submit Official Score on the game-over screen.',
    }),
  }),
  exitRamps: Object.freeze([
    Object.freeze({ id: 'pause-menu', label: 'Pause Menu', target: 'gameplay', copy: 'Resume, restart, audio, character swap, viewport, game menu, and exit actions remain one click away.' }),
    Object.freeze({ id: 'game-menu', label: 'Return to Game Menu', target: 'mode-select', copy: 'Leave the current attempt and re-pick Free or Ranked before starting again.' }),
    Object.freeze({ id: 'return-to-arcade', label: 'Exit to Lester’s Arcade', target: 'cabinet-select', copy: 'No hidden paid-run sync occurs when a player exits back to Lester’s Arcade.' }),
  ]),
  firstImpressionChecklist: Object.freeze([
    'One obvious primary action per step.',
    'Free and Ranked copy must be short, visual, and impossible to confuse.',
    'Game-over screen shows score, time, kills, bosses, replay cost, submit state, and arcade exit.',
    'The public route hides developer/codex/debug panels behind an explicit backstage toggle.',
  ]),
});

export const LESTER_BLASTER_ENEMY_AI_STATE_MACHINE = Object.freeze({
  requiredStates: Object.freeze(['spawn', 'seek', 'telegraph', 'attack', 'recover', 'reposition', 'defeated']),
  globalFairness: Object.freeze({
    maxActiveAttackers: 2,
    minTelegraphFrames: 24,
    recoveryFramesAfterAttack: 20,
    readableTellRule: 'Every damaging action must spend telegraph frames on-screen before collision or projectile release.',
    roleCapRule: 'Prefer fewer active attackers with stronger tells; staged rooms should not dogpile more than two simultaneous attacks.',
  }),
  roles: Object.freeze({
    coverShooter: Object.freeze({
      displayName: 'Cover Shooter',
      transitions: Object.freeze([
        Object.freeze({ from: 'spawn', to: 'seek', trigger: 'enters stage from right lane' }),
        Object.freeze({ from: 'seek', to: 'take-cover', trigger: 'cover prop available between enemy and player' }),
        Object.freeze({ from: 'take-cover', to: 'telegraph', trigger: 'line of sight plus attack cooldown ready' }),
        Object.freeze({ from: 'telegraph', to: 'attack', trigger: 'muzzle flash / warning bar completes' }),
        Object.freeze({ from: 'attack', to: 'recover', trigger: 'projectile burst fired' }),
        Object.freeze({ from: 'recover', to: 'reposition', trigger: 'cover destroyed or player closes distance' }),
      ]),
      tells: Object.freeze(['muzzle flash', 'attack-windup-bar', 'cover peek frame']),
      preferredRange: 'mid',
      counters: Object.freeze(['crouch', 'jump lane', 'destroy cover', 'grenade']),
    }),
    meleeRusher: Object.freeze({
      displayName: 'Melee Rusher',
      transitions: Object.freeze([
        Object.freeze({ from: 'spawn', to: 'seek', trigger: 'player inside stage lock' }),
        Object.freeze({ from: 'seek', to: 'telegraph', trigger: 'within lunge distance or after panic charge wind-up' }),
        Object.freeze({ from: 'telegraph', to: 'attack', trigger: 'hands/weapon shake completes' }),
        Object.freeze({ from: 'attack', to: 'recover', trigger: 'lunge/swing resolves' }),
        Object.freeze({ from: 'recover', to: 'reposition', trigger: 'missed attack or player jumps over' }),
      ]),
      tells: Object.freeze(['shake pose', 'lunge crouch', 'yellow attack bar']),
      preferredRange: 'close',
      counters: Object.freeze(['jump', 'blade timing', 'knockback shot']),
    }),
    flyerHarasser: Object.freeze({
      displayName: 'Flyer Harasser',
      transitions: Object.freeze([
        Object.freeze({ from: 'spawn', to: 'seek', trigger: 'upper lane entry' }),
        Object.freeze({ from: 'seek', to: 'telegraph', trigger: 'safe lane found and cooldown ready' }),
        Object.freeze({ from: 'telegraph', to: 'attack', trigger: 'glow pulse completes' }),
        Object.freeze({ from: 'attack', to: 'recover', trigger: 'tax pulse / projectile released' }),
        Object.freeze({ from: 'recover', to: 'reposition', trigger: 'lane overlaps another attacker or player holds aim' }),
      ]),
      safeLaneRule: 'Flyer hazards should never overlap every jump/crouch lane; always leave at least one readable safe lane.',
      preferredRange: 'upper-mid',
      counters: Object.freeze(['jump timing', 'anti-air shots', 'safe-lane read']),
    }),
    armoredPressure: Object.freeze({
      displayName: 'Armored Pressure',
      transitions: Object.freeze([
        Object.freeze({ from: 'spawn', to: 'seek', trigger: 'mini-boss or elite enters lock' }),
        Object.freeze({ from: 'seek', to: 'telegraph', trigger: 'stomp/charge cooldown ready' }),
        Object.freeze({ from: 'telegraph', to: 'attack', trigger: 'heavy flash completes' }),
        Object.freeze({ from: 'attack', to: 'recover', trigger: 'shockwave/charge resolves' }),
        Object.freeze({ from: 'recover', to: 'reposition', trigger: 'player reaches rear/vertical lane' }),
      ]),
      armorRule: 'Armored enemies move slowly, telegraph heavily, and reward rare weapons or explosives instead of spam fire.',
      counters: Object.freeze(['Hash Rail', 'grenade', 'cover bait', 'vertical reposition']),
    }),
  }),
});

export const LESTER_ARCADE_WORKFLOW_AUTOMATION = Object.freeze({
  goal: 'Create a repeatable improvement pipeline that turns game-design research into canon, assets, runtime balance, tests, browser smoke evidence, and next-slice tickets.',
  loops: Object.freeze([
    Object.freeze({ id: 'research-to-canon', cadence: 'per feature batch', input: 'articles, playtest notes, competitor references', automation: 'summarize principles into scored recommendations', output: 'docs/game-design improvement canon plus model/test updates' }),
    Object.freeze({ id: 'asset-ingestion', cadence: 'per art/audio drop', input: 'source sheets, stills, SFX, music', automation: 'deterministic copy/slice/manifest generation with dimensions and missing-asset flags', output: 'manifest-backed runtime assets' }),
    Object.freeze({ id: 'balance-sim', cadence: 'before every playable preview', input: 'enemy stats, stage caps, score weights', automation: 'unit tests and small simulations for pacing, damage, caps, and reward timing', output: 'tuning notes and protected contracts' }),
    Object.freeze({ id: 'browser-smoke', cadence: 'before handoff', input: 'local portal URL', automation: 'scripted public flow click-through, console scan, screenshots, and public flow assertions', output: 'verified wallet → cabinet → mode → play → game-over → exit evidence' }),
  ]),
  gates: Object.freeze([
    Object.freeze({ command: 'npm test', purpose: 'model, scoring, free/ranked separation, AI contracts, and public loop tests' }),
    Object.freeze({ command: 'npm run check', purpose: 'JavaScript syntax plus Python asset script compilation' }),
    Object.freeze({ command: 'npm run assets:verify', purpose: 'generated/runtime art and audio manifest integrity' }),
    Object.freeze({ command: 'npm run contracts:check', purpose: 'contract file structure and safety rails' }),
    Object.freeze({ command: 'browser smoke public flow', purpose: 'real DOM/user path evidence from Lester’s Arcade splash into gameplay and back out' }),
  ]),
  backlogTemplate: Object.freeze(['design intent', 'player-facing change', 'model/test contract', 'runtime/CSS work', 'asset/audio need', 'verification evidence']),
});

export const LESTERS_ARCADE_V2_APP_SHELL = Object.freeze({
  layout: 'full-screen-arcade-app',
  productionDomain: 'lestersarcade.io',
  principle: 'Most prototype/debug/network/codex material is hidden behind menus; the default player experience is login → animated arcade entry → cabinet select → Hard Money Heroes intro splash → mode select → Level 1 intro → play/profile/leaderboards/settings.',
  initialFlow: Object.freeze(['wallet-login', 'profile-activation', 'cabinet-select', 'game-intro-splash', 'game-menu', 'run-or-leaderboards']),
  publicFlow: Object.freeze(['connect-wallet', 'select-game', 'watch-or-skip-intro', 'choose-mode', 'begin-level', 'play']),
  officialFlow: Object.freeze(['wallet-splash', 'arcade-walk-in', 'cabinet-select', 'hard-money-heroes-intro', 'mode-select', 'level-one-intro', 'begin-level']),
  hiddenByDefault: Object.freeze(['build-stack-panels', 'network-rails', 'debug-codex', 'generated-gallery', 'prototype-test-buttons', 'developer-backstage']),
  primaryNav: Object.freeze([
    Object.freeze({ id: 'cabinets', label: 'Play', purpose: 'Select Hard Money Heroes and start playing.' }),
    Object.freeze({ id: 'profile', label: 'Profile', purpose: 'View the active wallet profile and run history.' }),
    Object.freeze({ id: 'leaderboards', label: 'Scores', purpose: 'Browse global boards plus the current wallet profile placement.' }),
  ]),
  navigation: Object.freeze([
    Object.freeze({ id: 'cabinets', label: 'Play', purpose: 'Select Hard Money Heroes or future Lester arcade cabinets.' }),
    Object.freeze({ id: 'profile', label: 'Profile', purpose: 'Edit username/avatar, view wallet-bound progress, achievements, and high scores.' }),
    Object.freeze({ id: 'leaderboards', label: 'Scores', purpose: 'Browse global boards plus the current wallet profile placement.' }),
    Object.freeze({ id: 'settings', label: 'Settings', purpose: 'Controls, audio, accessibility, network status, and sign-out.' }),
  ]),
  cabinets: Object.freeze([
    Object.freeze({
      id: 'hard-money-heroes',
      gameId: 'lester-blaster',
      title: 'Hard Money Heroes',
      status: 'playable',
      playable: true,
      description: 'The first playable Lester arcade cabinet: tactical run-and-gun score survival on LitVM LiteForge.',
      desktopCabinetSprite: HMH_CABINET_SPRITE_MANIFEST,
    }),
    Object.freeze({ id: 'lilly-lightning', gameId: 'lilly-lightning', title: 'Lilly Lightning', status: 'coming-soon', playable: false, description: 'Future Lilly cabinet using the teal sprite direction.' }),
    Object.freeze({ id: 'mempool-mayhem', gameId: 'mempool-mayhem', title: 'Mempool Mayhem', status: 'coming-soon', playable: false, description: 'Future score-attack cabinet for wallet-profile expansion.' }),
  ]),
  modeSelect: Object.freeze({
    free: Object.freeze({ label: 'Free Mode', official: false, copy: 'Practice locally with no official leaderboard, achievement, progress, or transaction writes. The parent Lester’s Arcade wallet profile is already active.' }),
    ranked: Object.freeze({ label: 'Play Ranked', official: true, requiresZkLtc: true, chainId: 4441, token: 'zkLTC', faucetUrl: LITVM_LITEFORGE_NETWORK.faucetUrl, copy: 'Ranked testnet runs use the already-active Lester’s Arcade profile and require a small amount of zkLTC for now. Get testnet zkLTC from the LitVM LiteForge faucet; it has no real value.' }),
  }),
  gameIntro: Object.freeze({
    id: 'hard-money-heroes-intro-splash',
    videoSrc: './assets/video/hard-money-heroes-intro.mp4',
    transition: 'fade-to-black-then-mode-select',
    skipAllowed: true,
    targetStep: 'mode-select',
  }),
  levelIntro: Object.freeze({
    levelId: 'level-1-underchain',
    title: 'Level 1 // Underchain District',
    durationSeconds: 8,
    hasBeginButton: true,
    controlsSummary: 'WASD/arrows move · Ctrl crouch · Space jump · Left click shoot · E/right click melee · F throwable',
    goalCopy: 'Survive as long as possible, clear staged enemy sections, chain kills and damage without getting hit, then submit official scores only at game over.',
  }),
  profileRules: Object.freeze({
    walletIsPrimaryKey: true,
    walletLockCopy: 'Progress, high scores, achievements, uploads, and official paid-run submissions are assigned to the connected wallet. Sign out to use a different wallet.',
    username: Object.freeze({ editable: true, minLength: 3, maxLength: 18, appearsOnLeaderboards: true }),
    avatar: Object.freeze({ editable: true, upload: true, requiredPixels: 150, shape: 'square', appearsOnLeaderboards: true }),
  }),
  leaderboardRules: Object.freeze({
    cadences: Object.freeze(['daily', 'weekly', 'monthly', 'yearly', 'all-time']),
    views: Object.freeze(['global-top', 'my-placement', 'friends-future']),
    submissionTrigger: 'game-over-score-submit',
    onChainPayload: Object.freeze(['gameId', 'score', 'username', 'wallet', 'avatarUri', 'cadence', 'chainId', 'runReceipt']),
    officialModeOnly: true,
  }),
});

export const LESTER_BLASTER_TACTICAL_COMBAT_V2 = Object.freeze({
  feel: 'slower tactical side-scroller with staged combat rooms, cover, platforming, and readable enemy tells instead of constant speed-run scrolling',
  controls: Object.freeze({
    move: 'WASD / Arrow Keys',
    crouch: 'Control / S / ArrowDown',
    jump: 'Space',
    shoot: 'Left Click',
    melee: 'E / Right Click',
    throwable: 'F',
  }),
  levelOne: Object.freeze({
    stageCountRange: Object.freeze([12, 14]),
    wavesPerPauseRange: Object.freeze([1, 3]),
    normalEnemiesOnScreenRange: Object.freeze([2, 3]),
    miniBossEnemiesOnScreenRange: Object.freeze([4, 5]),
    miniBossEveryStages: Object.freeze([3, 4]),
    finalBoss: 'randomized-from-boss-pool',
    baseScrollPace: 'player-led-rightward-camera-with-no-idle-autoscroll',
    stageLoop: Object.freeze(['player-led tactical travel', 'scroll-lock engagement room', '1-3 enemy waves', 'clear gate', 'platforming-transition']),
    platformingSections: Object.freeze(['timed gap jumps', 'short wall hops', 'obstacle vaults', 'power-up pickup lanes']),
    tacticalRoomTuning: Object.freeze({
      engagementArenaWidthPixels: 1320,
      playerStrafeLanePixels: 390,
      minCoverSpacingPixels: 132,
      enemySpawnDelayFrames: 56,
      rangedShotCooldownFrames: 132,
      requiredCoverKinds: Object.freeze(['player-cover', 'enemy-cover', 'destructible-crate', 'explosive-barrel', 'vertical-platform']),
      coverPlacements: Object.freeze([
        Object.freeze({ id: 'player-cover', kind: 'cover', label: 'Player Cover', x: 168, yOffset: 42, w: 50, h: 54, hp: 30, cover: true }),
        Object.freeze({ id: 'enemy-cover-a', kind: 'crate', label: 'Enemy Crate', x: 500, yOffset: 46, w: 56, h: 54, hp: 28, cover: true }),
        Object.freeze({ id: 'explosive-barrel', kind: 'barrel', label: 'Explosive Barrel', x: 664, yOffset: 34, w: 32, h: 42, hp: 12, cover: false, explosive: true }),
        Object.freeze({ id: 'enemy-cover-b', kind: 'crate', label: 'Tall Crate', x: 820, yOffset: 62, w: 58, h: 70, hp: 34, cover: true }),
        Object.freeze({ id: 'mid-wall', kind: 'wall', label: 'Half Wall', x: 1048, yOffset: 50, w: 34, h: 58, hp: 24, cover: true }),
      ]),
      platformPlacements: Object.freeze([
        Object.freeze({ id: 'low-platform', x: 420, yOffset: 76, w: 104, h: 12, label: 'low cover platform' }),
        Object.freeze({ id: 'high-platform', x: 708, yOffset: 122, w: 92, h: 12, label: 'high dodge platform' }),
        Object.freeze({ id: 'exit-platform', x: 986, yOffset: 88, w: 118, h: 12, label: 'exit platform' }),
      ]),
    }),
  }),
  health: Object.freeze({
    playerMaxPercent: 100,
    damagePerNormalHitPercent: 5,
    deathAtPercent: 0,
    invulnerabilityAfterHitFrames: 72,
    gameOverActions: Object.freeze(['Exit to Main Menu', 'Play Again']),
  }),
  enemyAi: Object.freeze({
    roles: Object.freeze(['cover-shooter', 'aggressive-melee-rusher', 'armored-pressure', 'flying-harasser']),
    rateOfFire: 'reduced-readable',
    coverDecision: 'defensive enemies attempt cover first; aggressive enemies rush Lester/Lilly for delayed melee attacks',
    spawnRule: 'spawn from the right side during staged locks; keep only the allowed stage cap alive on screen',
    readableTells: Object.freeze(['attack-windup-bar', 'muzzle-flash-before-shot', 'melee-lunge-pose', 'boss-phase-flash', 'safe-lane-warning']),
  }),
  gameplayMenu: Object.freeze({
    pauseAvailableAnytime: true,
    actions: Object.freeze(['Resume', 'Restart', 'Toggle Music On/Off', 'Swap Characters', 'Windowed / Fullscreen', 'Return to Game Menu', 'Exit Game']),
    screens: Object.freeze({
      pause: Object.freeze({ title: 'Paused', purpose: 'Pause action and expose clear resume/restart/audio/window/exit controls.' }),
      gameOver: Object.freeze({ title: 'Game Over', purpose: 'Summarize score, explain free/ranked restart cost, and provide Play Again or exit.' }),
    }),
    exitGameTarget: 'cabinet-select',
    restart: Object.freeze({
      freeModeCost: 'free-restart-from-level-start',
      paidModeCost: 'requires-new-paid-credit',
    }),
  }),
  viewportModes: Object.freeze({
    default: 'fullscreen',
    available: Object.freeze(['fullscreen', 'windowed', 'expanded-fullscreen', 'embedded-window']),
  }),
  runStateSeparation: Object.freeze({
    freeMode: 'local-sandbox-only',
    paidMode: 'official-sync-only-at-game-over',
    restartPaidCopy: 'Paid/ranked restarts require a new testnet credit and never silently resubmit a prior score.',
  }),
  sectionPlan: Object.freeze([
    Object.freeze({ section: 1, goal: 'load area and teach cover/jump/shoot', enemyCount: [2, 3], lock: 'soft-scroll-lock' }),
    Object.freeze({ section: 2, goal: 'advance after first clear with more cover and vertical props', enemyCount: [3, 4], lock: 'kill-gate' }),
    Object.freeze({ section: 3, goal: 'add platforms, holes, explosive props, and one mini-boss', enemyCount: [2, 3], miniBoss: true, lock: 'mini-boss-scroll-lock' }),
    Object.freeze({ section: 8, goal: 'main boss arena after tactical escalation', enemyCount: [0, 2], boss: true, lock: 'boss-scroll-lock' }),
  ]),
  pacingRules: Object.freeze([
    'Use player-led rightward camera advancement instead of constant auto-scroll so players can read threats before committing.',
    'Keep a short backward allowance on screen, but never rewind world progress once the camera has advanced.',
    'Keep 0–4 enemies on screen; prefer fewer enemies with stronger tells over spam.',
    'Reduce enemy movement speed and rate of fire so crouch/cover/jump decisions matter.',
    'Enemy melee counters should lag player melee by roughly 1–2 seconds after a readable tell.',
    'Use destructible cover, explosive props, platforms, and ground gaps to create tactical decisions.',
    'Scroll resumes only after staged enemies, mini-bosses, or bosses are cleared.',
  ]),
});

export const LESTER_BLASTER_TACTICAL_CAMERA_MODEL = Object.freeze({
  mode: 'player-led-rightward-scroll',
  canvasWidth: 760,
  autoScrollWhenIdle: false,
  playerStartScreenX: 108,
  playerMinScreenX: 72,
  cameraLeadStartX: 300,
  playerMaxScreenX: 420,
  engagementPlayerMaxScreenX: 520,
  backwardAllowancePixels: 128,
  backtrackFloorScreenX: 172,
  engagementArenaWidthPixels: LESTER_BLASTER_TACTICAL_COMBAT_V2.levelOne.tacticalRoomTuning.engagementArenaWidthPixels,
  stageTravelGoalBasePixels: 220,
  stageTravelGoalPerStagePixels: 34,
  scrollAdvanceMultiplier: 1.12,
  objectScrollMultiplier: 1.15,
  principles: Object.freeze([
    'Camera only advances when the player presses right past the lead zone.',
    'World progress never rewinds; left/back movement is limited to a few meters of tactical repositioning.',
    'Engagements become wider arena locks with cover, vertical props, and readable enemy tells.',
    'Sprites stay large, but the playable lane is wider so dodging, crouching, and cover choices have room to breathe.',
  ]),
});

export const LESTER_BLASTER_HUD_OVERLAY_MODEL = Object.freeze({
  purpose: 'Always-visible browser HUD overlay for player health, score, timer, throwables/power-ups, weapon state, stage progress, and current lock/status.',
  requiredWidgets: Object.freeze(['health', 'score', 'timer', 'power-ups', 'weapon', 'stage', 'status']),
  refresh: 'every fixed-step HUD sync and every pause/options state change',
  readabilityRules: Object.freeze([
    'Use short labels and high contrast so players do not read a dashboard mid-fight.',
    'Keep official/free sync copy outside the combat HUD; the HUD is moment-to-moment gameplay only.',
    'Expose pause/options through an overlay popup, not a hidden browser menu.',
  ]),
});

export const LESTER_BLASTER_DEV_BALANCE_OVERLAY = Object.freeze({
  enabledByDefault: false,
  publicUiDefault: 'hidden',
  queryParam: 'hmhDebug',
  queryValue: 'balance',
  keyboardToggle: 'F10',
  purpose: 'Developer-only tactical readability overlay for camera bounds, player lanes, arena locks, enemy AI tells, and cover/prop placement.',
  layers: Object.freeze([
    Object.freeze({ id: 'camera-bounds', label: 'Camera Bounds', color: '#19f7ff' }),
    Object.freeze({ id: 'player-lanes', label: 'Player Lanes', color: '#45ff8a' }),
    Object.freeze({ id: 'arena-locks', label: 'Arena Locks', color: '#ffe84d' }),
    Object.freeze({ id: 'enemy-ai', label: 'Enemy AI', color: '#ff5c7a' }),
    Object.freeze({ id: 'cover-props', label: 'Cover + Props', color: '#b76cff' }),
  ]),
  safeguards: Object.freeze([
    'Never enable by default in the public player flow.',
    'Expose only runtime tuning data; do not include wallet, score-submission, or private player data.',
    'Use hmhDebug=balance or F10 in local/dev smoke only.',
  ]),
});

export const LESTER_BLASTER_ART_REDO_BRIEF = Object.freeze({
  priority: 'Redo production character art before polishing enemy sheets; Lester must match Justin-provided references more closely.',
  referenceAssets: Object.freeze([
    Object.freeze({ id: 'lilly-teal-reference', path: './assets/reference/lilly-reference-teal-sprite-sheet.png', dimensions: '1448x1086', role: 'Lilly visual direction and future alternate playable sheet' }),
    Object.freeze({ id: 'lester-sheet-01', path: './assets/reference/lester-sprites-sheet-01.png', dimensions: '1448x1086', role: 'Lester production silhouette/action reference' }),
    Object.freeze({ id: 'lester-sheet-02', path: './assets/reference/lester-sprites-sheet-02.png', dimensions: '1448x1086', role: 'Lester production pose/animation reference' }),
  ]),
  lesterMustReadAs: Object.freeze(['Lester first, not generic commando', 'chunky readable side-scroller silhouette', 'consistent head/face proportions across every frame', 'blue/silver Litecoin arcade accents without logo wallpaper']),
  requiredHeroStates: Object.freeze(['idle', 'run', 'crouch', 'jump', 'fall', 'shoot', 'melee', 'throw', 'hurt', 'death', 'victory']),
  enemySpriteUpgrade: Object.freeze(['idle', 'walk-or-fly', 'attack-tell', 'attack', 'melee-counter', 'hit', 'death', 'optional-gore-overlay']),
  aiSpriteToolingCandidates: Object.freeze(['manual pixel cleanup from reference sheets', 'Aseprite/LibreSprite slicing and animation validation', 'image-generation reference-to-sprite pass only after license/consistency review']),
});

export const LESTER_BLASTER_ANIMATION_PRODUCTION_BRIEFS = Object.freeze({
  placeholderPolicy: 'briefs-only-no-shipping-placeholder-sprites',
  heroPriorityStates: Object.freeze(['crouch', 'hurt', 'death', 'victory', 'fall', 'shoot', 'melee', 'throw']),
  enemyPriorityStates: Object.freeze(['attack-tell', 'hit', 'death', 'melee-counter', 'optional-gore-overlay']),
  defaultFrameCounts: Object.freeze({
    hero: Object.freeze({ crouch: 6, hurt: 6, death: 10, victory: 8, fall: 6, shoot: 8, melee: 8, throw: 8 }),
    enemy: Object.freeze({ 'attack-tell': 6, 'melee-counter': 8, hit: 4, death: 8, 'optional-gore-overlay': 4 }),
  }),
  sheetRequirements: Object.freeze([
    '128x128 transparent PNG frames or an Aseprite-exported sheet with JSON frame tags.',
    'Frame names must match manifest states exactly before runtime integration.',
    'Use silhouette-first readability: crouch, hurt, death, and attack-tell must read at canvas scale.',
    'No generated placeholder sprites should be shipped as production art; create briefs, then ingest approved art drops.',
  ]),
  approvalNeeded: Object.freeze(['final character likeness/style sign-off', 'gore/optional overlay level', 'enemy faction visual escalation', 'audio pack licensing before production import']),
});

export const LESTER_ARCADE_MUSIC_LIBRARY = Object.freeze({
  id: LESTER_ARCADE_PLAYLIST_MANIFEST.id,
  title: LESTER_ARCADE_PLAYLIST_MANIFEST.title,
  tracks: Object.freeze(LESTER_ARCADE_PLAYLIST_MANIFEST.tracks.map((track) => Object.freeze({ ...track }))),
  defaultQueue: Object.freeze([...LESTER_ARCADE_PLAYLIST_MANIFEST.defaultQueue]),
  gameQueues: Object.freeze(Object.fromEntries(
    Object.entries(LESTER_ARCADE_PLAYLIST_MANIFEST.gameQueues).map(([key, queue]) => [key, Object.freeze([...queue])]),
  )),
  playerUi: Object.freeze({
    position: 'global-overlay',
    minimalByDefault: true,
    expandable: true,
    controls: Object.freeze(['previous', 'play-pause', 'mute', 'next', 'expand']),
    purpose: 'Parent Lester\'s Arcade music player shared by cabinets so games can use arcade-level queues instead of owning separate background music.',
  }),
});

function formatArcadeMusicTime(seconds = 0) {
  const safeSeconds = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const rounded = Math.floor(safeSeconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')}`;
}

function arcadeMusicTrackById(trackId) {
  return LESTER_ARCADE_MUSIC_LIBRARY.tracks.find((track) => track.id === trackId) ?? LESTER_ARCADE_MUSIC_LIBRARY.tracks[0] ?? null;
}

export function buildArcadeMusicQueueForContext(context = 'arcade') {
  const queueIds = LESTER_ARCADE_MUSIC_LIBRARY.gameQueues[context]
    ?? LESTER_ARCADE_MUSIC_LIBRARY.gameQueues[String(context).replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)]
    ?? LESTER_ARCADE_MUSIC_LIBRARY.defaultQueue;
  const tracks = queueIds.map(arcadeMusicTrackById).filter(Boolean);
  return tracks.length ? tracks : [...LESTER_ARCADE_MUSIC_LIBRARY.tracks];
}

export function buildArcadeMusicPlayerModel({
  context = 'arcade',
  currentTrackId = null,
  currentTimeSeconds = 0,
  playing = false,
  muted = false,
  expanded = false,
} = {}) {
  const queue = buildArcadeMusicQueueForContext(context);
  const currentTrack = queue.find((track) => track.id === currentTrackId) ?? queue[0] ?? null;
  const durationSeconds = currentTrack?.durationSeconds ?? 0;
  const safeTime = Math.min(Math.max(0, currentTimeSeconds), durationSeconds || currentTimeSeconds || 0);
  const percent = durationSeconds > 0 ? Math.max(0, Math.min(100, (safeTime / durationSeconds) * 100)) : 0;
  return Object.freeze({
    context,
    title: currentTrack?.title ?? 'Lester\'s Arcade Playlist',
    trackId: currentTrack?.id ?? null,
    src: currentTrack?.src ?? '',
    durationSeconds,
    durationLabel: currentTrack?.durationLabel ?? '0:00',
    playing,
    muted,
    expanded,
    queue: Object.freeze(queue.map((track) => Object.freeze({ id: track.id, title: track.title, durationLabel: track.durationLabel, src: track.src }))),
    progress: Object.freeze({
      currentSeconds: safeTime,
      currentLabel: formatArcadeMusicTime(safeTime),
      durationSeconds,
      durationLabel: currentTrack?.durationLabel ?? '0:00',
      percent,
      label: `${formatArcadeMusicTime(safeTime)} / ${currentTrack?.durationLabel ?? '0:00'}`,
    }),
    controls: Object.freeze([
      Object.freeze({ id: 'previous', label: 'Previous song', compactLabel: '⏮' }),
      Object.freeze({ id: 'play-pause', label: playing ? 'Pause music' : 'Play music', compactLabel: playing ? '⏸' : '▶' }),
      Object.freeze({ id: 'mute', label: muted ? 'Unmute music' : 'Mute music', compactLabel: muted ? '🔇' : '🔊' }),
      Object.freeze({ id: 'next', label: 'Next song', compactLabel: '⏭' }),
      Object.freeze({ id: 'expand', label: expanded ? 'Collapse playlist controls' : 'Expand playlist controls', compactLabel: expanded ? '▴' : '▾' }),
    ]),
  });
}

export const LESTER_BLASTER_AUDIO_ASSET_PLAN = Object.freeze({
  prototypeMusic: Object.freeze([
    Object.freeze({ id: 'lester-lilly-rap-getting-lit', title: 'Lester and Lilly Rap - Getting Lit', src: './assets/audio/music/lester-and-lilly-rap-getting-lit.mp3', use: 'prototype menu/attract or first gameplay loop after user interaction' }),
  ]),
  sfxNeeds: Object.freeze(['menu/login clicks', 'wallet connect', 'cabinet select', 'jump/land', 'gun fire', 'melee slash', 'throwable/explosion', 'enemy bark', 'player damage', 'enemy damage', 'pickup', 'game over', 'leaderboard submit/sync', 'ambient arcade/level bed']),
  freeLibraries: Object.freeze([
    Object.freeze({ name: 'Kenney Audio', license: 'CC0 on many packs', bestFor: 'UI, impact, sci-fi, RPG, casino/arcade prototype SFX' }),
    Object.freeze({ name: 'Mixkit Game SFX', license: 'Mixkit free SFX license', bestFor: 'quick arcade/game notification sounds' }),
    Object.freeze({ name: 'Sonniss GameAudioGDC', license: 'royalty-free media production; no AI/ML training', bestFor: 'larger production-quality ambience, impacts, weapons, and creature layers' }),
  ]),
});

const HARD_MONEY_FRAME_SIZE = Object.freeze([128, 128]);
const hardMoneyFrameRange = (actor, state, count = 8) => Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
  src: `./assets/hard-money-heroes/frames/${actor}/${state}/${actor}-${state}-${String(index).padStart(2, '0')}.png`,
  size: HARD_MONEY_FRAME_SIZE,
})));

const hardMoneyAnimationState = (actor, state, selectedFrom, count = 8) => Object.freeze({
  selectedFrom,
  frames: hardMoneyFrameRange(actor, state, count),
});

const hardMoneyAnimationSet = (actor, sourcePrefix) => Object.freeze({
  idle: hardMoneyAnimationState(actor, 'idle', `${sourcePrefix}-idle.png`),
  walk: hardMoneyAnimationState(actor, 'walk', `${sourcePrefix}-walk.png`),
  run: hardMoneyAnimationState(actor, 'run', `${sourcePrefix}-run.png`),
  jump: hardMoneyAnimationState(actor, 'jump', `${sourcePrefix}-jump.png`),
  attack: hardMoneyAnimationState(actor, 'attack', `${sourcePrefix}-attack.png`),
});

const hardMoneyEnemyArt = (actor, sourcePrefix) => Object.freeze({
  animations: hardMoneyAnimationSet(actor, sourcePrefix),
  stills: Object.freeze([
    Object.freeze({ src: `./assets/hard-money-heroes/stills/${actor}/${actor}-00.png` }),
    Object.freeze({ src: `./assets/hard-money-heroes/stills/${actor}/${actor}-01.png` }),
    Object.freeze({ src: `./assets/hard-money-heroes/stills/${actor}/${actor}-02.png` }),
  ]),
});

const lesterCharacterAssetManifest = Object.freeze({
  weapons: Object.freeze({
    machineGun: Object.freeze({ available: true, selectedFrom: './assets/hard-money-heroes/stills/lester/lester-machineGunRight.png' }),
    knife: Object.freeze({
      available: true,
      selectedFrom: './assets/hard-money-heroes/stills/lester/lester-knifeRight.png',
      stabAnimation: hardMoneyAnimationState('lester', 'stab', 'Lester-stab.png'),
    }),
    grenade: Object.freeze({ available: true, selectedFrom: './assets/hard-money-heroes/stills/lester/lester-grenadeRight.png' }),
    pistol: Object.freeze({ available: true, preservedFromPreviousPass: true, selectedFrom: './assets/generated/sliced/lester-shoot.png' }),
    shotgun: Object.freeze({ available: true, preservedFromPreviousPass: true, selectedFrom: './assets/lester-production/stills/lester-right-side-shotgun.png' }),
  }),
  stills: Object.freeze({
    facing: './assets/hard-money-heroes/stills/lester/lester-machineGunFacing.png',
    leftSide: './assets/hard-money-heroes/stills/lester/lester-machineGunLeft.png',
    rightSide: './assets/hard-money-heroes/stills/lester/lester-machineGunRight.png',
    knife: './assets/hard-money-heroes/stills/lester/lester-knifeRight.png',
    grenade: './assets/hard-money-heroes/stills/lester/lester-grenadeRight.png',
  }),
  animations: hardMoneyAnimationSet('lester', 'Lester'),
});

const lillyCharacterAssetManifest = Object.freeze({
  weapons: Object.freeze({
    machineGun: Object.freeze({ available: true, selectedFrom: './assets/hard-money-heroes/stills/lilly/lilly-machineGunRight.png' }),
    knife: Object.freeze({ available: true, selectedFrom: './assets/hard-money-heroes/stills/lilly/lilly-knifeRight.png' }),
    grenade: Object.freeze({ available: true, selectedFrom: './assets/hard-money-heroes/stills/lilly/lilly-grenadeRight.png' }),
    pistol: Object.freeze({ available: true, selectedFrom: './assets/hard-money-heroes/stills/lilly/lilly-pistolFacing.png' }),
    shotgun: Object.freeze({ available: true, selectedFrom: './assets/hard-money-heroes/stills/lilly/lilly-shotgunFacing.png' }),
  }),
  stills: Object.freeze({
    facing: './assets/hard-money-heroes/stills/lilly/lilly-machineGunFacing.png',
    leftSide: './assets/hard-money-heroes/stills/lilly/lilly-machineGunLeft.png',
    rightSide: './assets/hard-money-heroes/stills/lilly/lilly-machineGunRight.png',
    knife: './assets/hard-money-heroes/stills/lilly/lilly-knifeRight.png',
    grenade: './assets/hard-money-heroes/stills/lilly/lilly-grenadeRight.png',
  }),
  animations: hardMoneyAnimationSet('lilly', 'Lilly'),
});

export const HARD_MONEY_HEROES_ASSET_MANIFEST = Object.freeze({
  id: 'hard-money-heroes-justin-assets-v1',
  generatedFrom: 'user-provided Hard Money Heroes art assets ingested by scripts/ingest-hard-money-heroes-user-assets.py',
  runtimeManifest: './assets/hard-money-heroes/hard-money-heroes-user-asset-manifest.json',
  playableCharacters: Object.freeze({
    lester: lesterCharacterAssetManifest,
    lilly: lillyCharacterAssetManifest,
  }),
  enemies: Object.freeze({
    trenchDegen: Object.freeze({
      id: 'trench-degen',
      title: 'Trench Degen',
      art: hardMoneyEnemyArt('trench-degen', 'Trench Degen'),
      behavior: Object.freeze({ primary: 'slow-readable-melee', secondary: 'occasional-low-rate-pistol', moveSpeed: 0.72, pistolChance: 0.18, tellFrames: 34 }),
    }),
    evilBanker: Object.freeze({
      id: 'evil-banker',
      title: 'Evil Banker',
      art: hardMoneyEnemyArt('evil-banker', 'Evil Banker'),
      behavior: Object.freeze({ primary: 'fast-briefcase-melee-rusher', moveSpeed: 1.42, tellFrames: 22 }),
    }),
    warrenSpearRider: Object.freeze({
      id: 'warren-spear-rider',
      title: 'Warren Spear Rider',
      art: hardMoneyEnemyArt('warren-spear-rider', 'Evil Boss'),
      extraFramesIngested: true,
      behavior: Object.freeze({ primary: 'mounted-spear-pressure', spearThrowAccuracy: 0.6, dodgeRequired: true, moveSpeed: 0.52, meleeRange: 86, throwCooldownFrames: 185, tellFrames: 46 }),
    }),
    cryptoBro: Object.freeze({
      id: 'crypto-bro',
      title: 'Crypto Bro',
      art: hardMoneyEnemyArt('crypto-bro', 'Crypto Bro'),
      behavior: Object.freeze({ primary: 'kol-ranged-taunt', secondary: 'jumping-knife-dodge-pressure', moveSpeed: 1.04, tellFrames: 30, rangedChance: 0.38, tauntCooldownFrames: 150 }),
    }),
    gasBeast: Object.freeze({
      id: 'gas-beast',
      title: 'Gas Beast',
      art: hardMoneyEnemyArt('gas-beast', 'Gas Beast'),
      behavior: Object.freeze({ primary: 'slow-gas-cloud-bruiser', secondary: 'area-denial-tax-pulse', moveSpeed: 0.68, tellFrames: 42, hazardRadius: 72, armor: 'medium' }),
    }),
  }),
  screens: Object.freeze({
    splash: Object.freeze({ src: './assets/hard-money-heroes/screens/boot-splash.png' }),
    mainMenu: Object.freeze({ src: './assets/hard-money-heroes/screens/main-menu.png' }),
    options: Object.freeze({ src: './assets/hard-money-heroes/screens/options.png' }),
    modeSelect: Object.freeze({ src: './assets/hard-money-heroes/screens/mode-select.png' }),
  }),
  audio: Object.freeze({
    musicTracks: Object.freeze([
      Object.freeze({ id: 'getting-lit-vocals', title: 'Lester and Lilly Rap - Getting Lit (Vocals)', src: './assets/audio/music/lester-and-lilly-rap-getting-lit-vocals.mp3' }),
      Object.freeze({ id: 'going-to-the-moon', title: 'LitVM Going To The Moon', src: './assets/audio/music/litvm-going-to-the-moon-new-2.mp3' }),
      Object.freeze({ id: 'testnet-teaser', title: 'LitVM TestNet Teaser', src: './assets/audio/music/litvm-testnet-teaser.mp3' }),
      Object.freeze({ id: 'rise-to-the-occasion', title: 'Rise to the Occasion', src: './assets/audio/music/rise-to-the-occasion.mp3' }),
    ]),
    sfxPlan: Object.freeze({
      weaponFire: Object.freeze(['pistol', 'machine-gun', 'shotgun', 'grenade-launch']),
      melee: Object.freeze(['knife-swipe', 'knife-hit-spark']),
      damageTypes: Object.freeze(['bullet-hit', 'blade-hit', 'grenade-blast', 'spear-stab', 'spear-throw-dodge-window', 'briefcase-smack']),
      powerUps: Object.freeze(['health-pickup', 'shield-pulse', 'ammo-restock', 'score-multiplier-chime']),
      enemyBarks: Object.freeze(['trench-degen-grunt', 'evil-banker-charge', 'warren-spear-rider-horse', 'crypto-bro-taunt', 'gas-beast-growl']),
    }),
  }),
});

export const ACHIEVEMENTS = Object.freeze({
  CABINET_PIONEER: {
    id: 'cabinet-pioneer',
    title: 'Cabinet Pioneer',
    description: 'Connected a wallet profile inside Lester\'s Arcade.',
    unlockType: 'login',
  },
  FIRST_PAID_RUN: {
    id: 'first-paid-run',
    title: 'First Paid Run',
    description: 'Inserted an official credit and played a leaderboard-eligible run.',
    unlockType: 'paid-run',
  },
  FIRST_1000_POINTS: {
    id: 'first-1000-points',
    title: 'First 1,000 Points',
    description: 'Scored at least 1,000 points in an official paid run.',
    unlockType: 'score',
  },
  BOSS_BREAKER: {
    id: 'boss-breaker',
    title: 'Boss Breaker',
    description: 'Defeated a rotating Hard Money Heroes boss during an official paid run.',
    unlockType: 'boss',
  },
  FIVE_MINUTE_RUN: {
    id: 'five-minute-run',
    title: 'Five-Minute Fighter',
    description: 'Survived at least the target average five-minute Hard Money Heroes run.',
    unlockType: 'survival',
  },
  MASTER_SURVIVOR: {
    id: 'master-survivor',
    title: 'Master Survivor',
    description: 'Survived at least fifteen minutes in Hard Money Heroes.',
    unlockType: 'survival',
  },
  HASH_RAIL_SPECIALIST: {
    id: 'hash-rail-specialist',
    title: 'Hash Rail Specialist',
    description: 'Completed an official run using the Hash Rail upgrade.',
    unlockType: 'weapon',
  },
  SPREAD_LTC_SPECIALIST: {
    id: 'spread-ltc-specialist',
    title: 'Spread LTC Specialist',
    description: 'Completed an official run using the Spread LTC upgrade.',
    unlockType: 'weapon',
  },
  NO_DAMAGE_BOSS: {
    id: 'no-damage-boss',
    title: 'Untouchable Boss Clear',
    description: 'Beat a boss without taking damage during the boss phase.',
    unlockType: 'skill',
  },
  POWERUP_COLLECTOR: {
    id: 'powerup-collector',
    title: 'Power-Up Collector',
    description: 'Collected three or more different power-up types in one run.',
    unlockType: 'collection',
  },
  ALL_BOSSES_SCOUTED: {
    id: 'all-bosses-scouted',
    title: 'Full Boss Roster Scouted',
    description: 'Encountered or defeated all ten Hard Money Heroes bosses across runs.',
    unlockType: 'collection',
  },
});

export const LESTER_BLASTER_CHARACTER_ROSTER = Object.freeze([
  Object.freeze({
    id: 'lester',
    title: 'Lester',
    role: 'main playable Hard Money Hero',
    tagline: 'Rambo-like Litecoin City commando walking against the panic.',
    personality: 'stubborn, brave, goofy-gritty arcade tough guy; says little, solves scams with steel and gunfire',
    spriteSheet: './assets/sprite-lester-commando.svg',
    portraitAsset: './assets/sprite-lester-commando.svg',
    referenceImages: Object.freeze(['./assets/hard-money-heroes/reference/Lester/Lester-Sprites-01.png', './assets/hard-money-heroes/reference/Lester/Lester-Sprites-02.png']),
    unlock: 'starter',
    stats: Object.freeze({ maxHealth: 100, speed: 1.0, jump: 1.0, melee: 1.0, luck: 1.0 }),
    artDirection: 'high-detail 16-bit/Neo-Geo chunky commando silhouette, clean Litecoin blue/silver hero accents, optional rain/cyberpunk grime, readable blade arc and muzzle flashes.',
    animations: Object.freeze(['idle', 'run', 'jump', 'double-jump', 'shoot', 'melee', 'grenade', 'hurt', 'death', 'victory']),
  }),
  Object.freeze({
    id: 'lilly',
    title: 'Lilly',
    role: 'future unlockable alternate art hero',
    tagline: 'Same moveset as Lester, new sprite/personality pass later.',
    spriteSheet: './assets/sprite-lilly-runner.svg',
    portraitAsset: './assets/sprite-lilly-runner.svg',
    unlock: 'future unlockable; setup after Lester production sprite pass',
    stats: Object.freeze({ maxHealth: 100, speed: 1.0, jump: 1.0, melee: 1.0, luck: 1.0 }),
    artDirection: 'match Lester gameplay silhouette and hitbox while swapping the visible character art/sprites.',
    animations: Object.freeze(['idle', 'run', 'jump', 'double-jump', 'shoot', 'melee', 'grenade', 'hurt', 'death', 'victory']),
  }),
  Object.freeze({
    id: 'max-mempool',
    title: 'Max Mempool',
    role: 'parked future character concept',
    tagline: 'Retained as a non-canon placeholder until Justin approves a third hero.',
    spriteSheet: './assets/sprite-max-mempool.svg',
    portraitAsset: './assets/sprite-max-mempool.svg',
    unlock: 'parked; not part of current Hard Money Heroes canon',
    stats: Object.freeze({ maxHealth: 124, speed: 0.86, jump: 0.84, melee: 1.28, luck: 0.88 }),
    artDirection: 'chunky arcade bruiser placeholder only; do not produce final assets until approved.',
    animations: Object.freeze(['idle', 'run', 'jump', 'double-jump', 'shoot', 'melee', 'grenade', 'hurt', 'victory']),
  }),
]);

export const LESTER_BLASTER_WEAPON_SYSTEM = Object.freeze({
  namingStyle: 'hybrid arcade weapon names with crypto twist; function-first, not exhausting pun-first',
  feel: 'Metal Slug-inspired arcade-realistic: chunky recoil, readable muzzle flashes, grounded but exaggerated',
  upgradeStats: Object.freeze(['rateOfFire', 'damage', 'reloadSpeed']),
  primaryWeapons: Object.freeze([
    Object.freeze({
      id: 'coin-blaster',
      title: 'The Settler',
      type: 'starter',
      rarity: 'starter',
      damage: 3,
      fireRatePerSecond: 5.8,
      reloadSeconds: 0.7,
      range: 'mid',
      ammo: 'infinite',
      animation: 'crisp blue muzzle flash, small silver tracer, dependable semi-auto recoil',
      soundCue: 'sfx_settler_pop',
      bestFor: 'baseline enemy waves and always-has-a-way-out fallback combat',
      description: 'Clean silver-and-blue sidearm named for fast settlement; reliable, accurate, unlimited ammo.',
      upgrades: Object.freeze({ rateOfFire: '+18%', damage: '+1 per tier', reloadSpeed: '+22%' }),
    }),
    Object.freeze({
      id: 'scatter-shotgun',
      title: 'The Block Breaker',
      type: 'weapon-pickup',
      rarity: 'uncommon',
      damage: 2,
      pellets: 7,
      fireRatePerSecond: 2.3,
      reloadSeconds: 1.1,
      range: 'short cone',
      ammo: 30,
      animation: 'wide orange blast, heavy pump frame, blue shell-loader kickback',
      soundCue: 'sfx_block_breaker_pump',
      bestFor: 'close-range swarms, room clears, and mini-boss armor chips',
      description: 'Blocky pump-action crowd clearer; devastating up close and weak at range.',
      upgrades: Object.freeze({ rateOfFire: '+10%', damage: '+pellet damage', reloadSpeed: '+18%' }),
    }),
    Object.freeze({
      id: 'auto-miner',
      title: 'The Hashstorm',
      type: 'weapon-pickup',
      rarity: 'uncommon',
      damage: 2,
      fireRatePerSecond: 10.5,
      reloadSeconds: 1.4,
      range: 'mid-long stream',
      ammo: 90,
      animation: 'rapid silver tracers, spinning blue energy coil, rising whine, light screen shake',
      soundCue: 'sfx_hashstorm_rattle',
      bestFor: 'Bot Swarms, Liquidation cascades, and holding a line under pressure',
      description: 'Sustained full-auto suppressive fire that burns ammo quickly.',
      upgrades: Object.freeze({ rateOfFire: '+20%', damage: '+1 every two tiers', reloadSpeed: '+25%' }),
    }),
    Object.freeze({
      id: 'spread-ltc',
      title: 'Spread LTC',
      type: 'upgrade',
      rarity: 'rare',
      damage: 2,
      pellets: 5,
      fireRatePerSecond: 3.8,
      reloadSeconds: 0.9,
      range: 'short-mid cone',
      ammo: 'timed upgrade',
      animation: 'five-coin fan blast with cyan trails',
      soundCue: 'sfx_spread_ltc_burst',
      bestFor: 'crowd control and flying swarms',
      upgrades: Object.freeze({ rateOfFire: '+12%', damage: '+pellet damage', reloadSpeed: '+15%' }),
    }),
    Object.freeze({
      id: 'hash-rail',
      title: 'Hash Rail',
      type: 'upgrade',
      rarity: 'rare',
      damage: 9,
      pierce: true,
      fireRatePerSecond: 1.6,
      reloadSeconds: 1.8,
      range: 'long piercing beam',
      ammo: 'timed upgrade',
      animation: 'charging rail line, then white/cyan screen streak',
      soundCue: 'sfx_hash_rail_charge_fire',
      bestFor: 'armored enemies, bosses, and lane clears',
      upgrades: Object.freeze({ rateOfFire: '+8%', damage: '+beam damage', reloadSpeed: '+12%' }),
    }),
    Object.freeze({
      id: 'oracle-slayer',
      title: 'Oracle Slayer',
      type: 'weapon-pickup',
      rarity: 'super-rare',
      damage: 24,
      pierce: true,
      fireRatePerSecond: 1.1,
      reloadSeconds: 2.4,
      range: 'full-screen charged shot',
      ammo: 6,
      animation: 'screen-darkening purple charge, white dragon-beam release',
      soundCue: 'sfx_oracle_slayer_super',
      bestFor: 'emergency boss phase deletes and master-run clutch moments',
      upgrades: Object.freeze({ rateOfFire: '+5%', damage: '+super charge damage', reloadSpeed: '+10%' }),
    }),
  ]),
  melee: Object.freeze({
    id: 'litecoin-knife',
    title: 'The Litecoin Blade',
    signatureMechanic: true,
    damage: 8,
    rangePixels: 58,
    cooldownMs: 320,
    oneShotBasicGrunts: Object.freeze(['fud-goblin', 'paper-hand']),
    animation: 'three-frame clean silver arc-trail slash with Ł spark stamp on successful close-range kills; optional gore only if enabled pre-run',
    soundCue: 'sfx_litecoin_blade_slash',
  }),
  grenades: Object.freeze([
    Object.freeze({
      id: 'satoshi-frag',
      title: 'Crypto Bombs',
      damage: 14,
      radiusPixels: 92,
      fuseMs: 650,
      role: 'AOE throwable',
      animation: 'matte-black Ł-stamped bomb, arcing throw, blue-white blast flash',
      soundCue: 'sfx_crypto_bomb_beep_boom',
    }),
    Object.freeze({
      id: 'chain-cluster',
      title: 'Hard Forks',
      damage: 9,
      radiusPixels: 40,
      fragments: 1,
      fuseMs: 0,
      role: 'precision straight-line throwable axe',
      animation: 'silver hatchet with Litecoin-blue handle spins flat, sticks into enemies or walls',
      soundCue: 'sfx_hard_fork_spin_hit',
    }),
  ]),
});

export const LESTER_BLASTER_POWER_UPS = Object.freeze([
  Object.freeze({ id: 'health-pack', title: 'Cold Storage', category: 'health', effect: 'heal', amount: 35, sprite: 'glowing blue hardware-wallet medkit with white Ł heartbeat glow', rarity: 'common' }),
  Object.freeze({ id: 'grenade-crate', title: 'Crypto Bomb Cache', category: 'ammo', effect: 'grenades', amount: 2, sprite: 'matte-black bomb cache stamped with small blue Ł', rarity: 'common' }),
  Object.freeze({ id: 'bonus-life', title: 'Extra Hard Money Hero', category: 'life', effect: 'life', amount: 1, sprite: 'tiny Lester head icon with silver-blue halo', rarity: 'rare' }),
  Object.freeze({ id: 'spread-ltc-chip', title: 'Spread LTC Chip', category: 'weapon', effect: 'weapon', weaponId: 'spread-ltc', durationSeconds: 18, sprite: 'cyan fan chip', rarity: 'uncommon' }),
  Object.freeze({ id: 'hash-rail-core', title: 'Hash Rail Core', category: 'weapon', effect: 'weapon', weaponId: 'hash-rail', durationSeconds: 14, sprite: 'glowing white/cyan core', rarity: 'rare' }),
  Object.freeze({ id: 'score-multiplier', title: '2x Hard Money Multiplier', category: 'score', effect: 'scoreMultiplier', multiplier: 2, durationSeconds: 20, sprite: 'gold x2 token with subtle blue rim', rarity: 'uncommon' }),
  Object.freeze({ id: 'shield-cache', title: 'Cold Wallet Shield', category: 'defense', effect: 'shield', amount: 1, durationSeconds: 12, sprite: 'hovering blue-and-silver hex barrier device', rarity: 'uncommon' }),
  Object.freeze({ id: 'ammo-cache', title: 'Ammo Cache', category: 'ammo', effect: 'ammo', amount: 30, sprite: 'silver magazine crate with orange hazard stripe', rarity: 'common' }),
  Object.freeze({ id: 'ltc-cache', title: 'LTC Cache', category: 'score', effect: 'scoreBonus', score: 500, sprite: 'sparkling silver coin pile used as pickup accent, not wallpaper', rarity: 'common' }),
]);

export const LESTER_BLASTER_ENVIRONMENTS = Object.freeze([
  Object.freeze({
    id: 'underchain-district',
    title: 'The Slums: Underchain District',
    levelId: 'the-slums',
    runWindowMinutes: [0, 2],
    palette: ['#06142e', '#345dcc', '#ff3b1f', '#c8d3e8'],
    mood: 'tight, claustrophobic neon alleys where rugged players survive under broken 1000x billboards',
    props: Object.freeze(['noodle stalls', 'pawn-kiosks trading desperate wallets', 'stacked shipping-container housing', 'dead-coin graffiti']),
    hazards: Object.freeze(['steam grates', 'flickering scam signs', 'cheap platforms yanked by Rug Rats']),
    parallaxLayers: Object.freeze(['distant financial towers', 'tangled overhead cables', 'neon puddle reflections', 'foreground alley clutter']),
    musicTrack: 'track_underchain_slums',
  }),
  Object.freeze({
    id: 'industrial-foundry',
    title: 'The Slums: Industrial Foundry',
    levelId: 'the-slums',
    runWindowMinutes: [2, 5],
    palette: ['#0f1117', '#ff8a22', '#345dcc', '#d6d9df'],
    mood: 'counterfeit token factory of molten mint furnaces, hydraulic presses, and smelt-pits',
    props: Object.freeze(['conveyor belts', 'counterfeit token presses', 'catwalks', 'ornate rug platform over machinery']),
    hazards: Object.freeze(['moving conveyor floor', 'smelt-pits', 'hydraulic press timing gates']),
    parallaxLayers: Object.freeze(['orange furnace haze', 'machine silhouettes', 'catwalk rails', 'foreground conveyor belts']),
    musicTrack: 'track_foundry_barons_floor',
  }),
  Object.freeze({
    id: 'financial-district-tower',
    title: 'The Tower: Financial District Ascent',
    levelId: 'the-tower',
    runWindowMinutes: [5, 10],
    palette: ['#050913', '#d4af37', '#345dcc', '#ff304f'],
    mood: 'chrome-and-black-glass extraction machine dressed as legitimacy',
    props: Object.freeze(['holographic stock tickers', 'marble lobby', 'trading floor screens', 'glass elevator shaft']),
    hazards: Object.freeze(['atrium drops', 'elevator edge hooks', 'server-rack flank corridors']),
    parallaxLayers: Object.freeze(['tower skyline', 'holo ticker rain', 'interior glass reflections', 'foreground marble rails']),
    musicTrack: 'track_tower_vertical_market',
  }),
  Object.freeze({
    id: 'penthouse-rooftop',
    title: 'The Tower: Penthouse Rain',
    levelId: 'the-tower',
    runWindowMinutes: [10, 13],
    palette: ['#030711', '#ffd166', '#ff3df2', '#7ac7ff'],
    mood: 'open-air rain, influencer ring-light glow, and the entire city below',
    props: Object.freeze(['ring-light holo rigs', 'follower-count displays', 'champagne loot decoys', 'rain-slick balcony glass']),
    hazards: Object.freeze(['bot shield swarms', 'sponsored-post bombs', 'open-air knockback edges']),
    parallaxLayers: Object.freeze(['glowing city below', 'rain streaks', 'penthouse holo displays', 'foreground balcony rail']),
    musicTrack: 'track_mr_ngmi_penthouse',
  }),
  Object.freeze({
    id: 'mainnet-express',
    title: 'The Getaway: Mainnet Express',
    levelId: 'the-getaway',
    runWindowMinutes: [13, 20],
    palette: ['#02040c', '#345dcc', '#ffffff', '#ff6a00'],
    mood: 'bullet train chase through neon night, luxury cars, vault cars, engine machinery, and rooftop rain',
    props: Object.freeze(['luxury passenger seats', 'glowing vault crates', 'engine wiring', 'roof car seams']),
    hazards: Object.freeze(['wind knockback', 'sparking breached car', 'passing-pylon light flicker', 'train-bank camera shake']),
    parallaxLayers: Object.freeze(['smeared city lights', 'countryside neon streaks', 'data tunnel bands', 'foreground roof panels']),
    musicTrack: 'track_mainnet_express_finale',
  }),
]);

export const LESTER_BLASTER_ENEMY_CATALOG = Object.freeze([
  Object.freeze({ id: 'fud-goblin', title: 'FUD Goblin', class: 'grunt', baseHealth: 7, damage: 7, speed: 1.8, score: 80, spawnAfterSeconds: 0, aiArchetype: 'swarm-shambler', animationStates: Object.freeze(['shamble', 'lob-sell', 'hit', 'red-candle-pop']), attackPatterns: Object.freeze(['slow-sell-arc', 'swarm-body-block']), deathEffect: 'puff of red candle smoke + always-on silver impact sparks', tells: 'mouth opens with SELL bubble wind-up' }),
  Object.freeze({ id: 'gas-fee-wisp', title: 'Gas Fee Wisp', class: 'hazard-flyer', baseHealth: 10, damage: 8, speed: 2.2, score: 140, spawnAfterSeconds: 35, aiArchetype: 'hover-taxer', animationStates: Object.freeze(['float', 'tax-pulse', 'tar-drop', 'hit', 'pop']), attackPatterns: Object.freeze(['resource-tax', 'sticky-tar-puddle']), deathEffect: 'orange flame pop + pump handle fragments', tells: 'gas-pump body glows before taxing' }),
  Object.freeze({ id: 'paper-hand', title: 'Paper Hands', class: 'panic-melee', baseHealth: 12, damage: 9, speed: 2.0, score: 120, spawnAfterSeconds: 0, aiArchetype: 'panic-charge-flee', animationStates: Object.freeze(['tremble', 'panic-charge', 'wild-swing', 'flee', 'crumple']), attackPatterns: Object.freeze(['wild-melee', 'ally-collision-chaos']), deathEffect: 'white paper confetti + optional red flecks if gore enabled', tells: 'crumpled hands shake before charge' }),
  Object.freeze({ id: 'crypto-bro', title: 'Crypto Bro', class: 'kol-ranged-grunt', baseHealth: 18, damage: 12, speed: 1.9, score: 210, spawnAfterSeconds: 55, aiArchetype: 'taunt-strafe-shooter', enemyKey: 'cryptoBro', animationStates: Object.freeze(['idle', 'walk', 'run', 'jump', 'attack', 'hit']), attackPatterns: Object.freeze(['phone-taunt-shot', 'jump-back-flex', 'close-knife-panic']), deathEffect: 'shattered phone pixels + green candle confetti', tells: 'phone screen flashes before the shot/taunt' }),
  Object.freeze({ id: 'gas-beast', title: 'Gas Beast', class: 'armored-bruiser', baseHealth: 32, damage: 16, speed: 0.95, score: 340, spawnAfterSeconds: 115, aiArchetype: 'gas-cloud-area-denial', enemyKey: 'gasBeast', animationStates: Object.freeze(['idle', 'walk', 'run', 'jump', 'attack', 'hit']), attackPatterns: Object.freeze(['gas-tax-pulse', 'slow-claw-swipe', 'short-hop-body-check']), deathEffect: 'orange/blue gas burst + ETH fee shards', tells: 'chest vents glow orange before gas pulse' }),
  Object.freeze({ id: 'sybil-drone', title: 'Bot Swarm (Sybil Drones)', class: 'formation-flyer', baseHealth: 9, damage: 10, speed: 2.4, score: 150, spawnAfterSeconds: 80, aiArchetype: 'parent-drone-formation', animationStates: Object.freeze(['hover', 'sync-strafe', 'laser-ping', 'scatter', 'explode']), attackPatterns: Object.freeze(['formation-laser-ping', 'parent-drone-scatter']), deathEffect: 'cyan electric shards + wallet-address pixels', tells: 'blank wallet face flashes red target dot' }),
  Object.freeze({ id: 'rug-rat', title: 'Rug Rat', class: 'disruptor', baseHealth: 8, damage: 7, speed: 3.3, score: 130, spawnAfterSeconds: 70, aiArchetype: 'platform-yanker', animationStates: Object.freeze(['scurry', 'rug-drag', 'floor-yank', 'hit', 'escape']), attackPatterns: Object.freeze(['platform-yank', 'low-dash-knockback']), deathEffect: 'torn carpet scraps + red dust puff', tells: 'tiny rolled rug lifts before dash' }),
  Object.freeze({ id: 'honeypot-turret', title: 'Honeypot Turret', class: 'stationary-trap', baseHealth: 18, damage: 13, speed: 0, score: 220, spawnAfterSeconds: 90, aiArchetype: 'loot-bait-trap', animationStates: Object.freeze(['fake-loot', 'snap-open', 'clamp-fire', 'hit', 'shatter']), attackPatterns: Object.freeze(['short-range-spread', 'clamp-burst']), deathEffect: 'golden hex shards + blue reveal sparks', tells: 'too-perfect loot glow pulses twice' }),
  Object.freeze({ id: 'slippage-skater', title: 'Slippage Skater', class: 'mid-tier-rusher', baseHealth: 20, damage: 14, speed: 3.6, score: 260, spawnAfterSeconds: 130, aiArchetype: 'overshoot-u-turn', animationStates: Object.freeze(['skate', 'slide-rush', 'u-turn', 'hit', 'wipeout']), attackPatterns: Object.freeze(['slide-rush', 'overshoot-return']), deathEffect: 'ice-trail shards + orange skid sparks', tells: 'skates spark before line rush' }),
  Object.freeze({ id: 'phishing-angler', title: 'Phishing Angler', class: 'zoning-hook', baseHealth: 24, damage: 16, speed: 1.2, score: 300, spawnAfterSeconds: 180, aiArchetype: 'fake-wallet-lure', animationStates: Object.freeze(['idle-cast', 'popup-lure', 'reel', 'melee', 'hit', 'fade']), attackPatterns: Object.freeze(['connect-wallet-lure', 'hook-reel']), deathEffect: 'fake popup shatter + cloak smoke', tells: 'glowing Connect Wallet lure appears before hook is active' }),
  Object.freeze({ id: 'mev-reaper', title: 'MEV Reaper', class: 'elite-flanker', baseHealth: 34, damage: 19, speed: 3.0, score: 420, spawnAfterSeconds: 240, aiArchetype: 'sandwich-pincer', animationStates: Object.freeze(['cloak', 'dash-flank', 'sandwich-strike', 'hit', 'vanish']), attackPatterns: Object.freeze(['two-sided-pincer', 'same-frame-blade-strike']), deathEffect: 'dark cloak tear + sandwich-blade sparks', tells: 'two shadows split to either side' }),
  Object.freeze({ id: 'liquidation-cascade-golem', title: 'Liquidation Cascade Golem', class: 'armored-elite', baseHealth: 54, damage: 24, speed: 0.9, score: 560, spawnAfterSeconds: 360, aiArchetype: 'slow-armored-shockwave', animationStates: Object.freeze(['stomp', 'block-stack', 'shockwave', 'crack', 'cascade-collapse']), attackPatterns: Object.freeze(['armored-stomp', 'death-cascade-shockwave']), deathEffect: 'stacked red ticker blocks collapse into chain shockwave', tells: 'block stack flashes margin-call red before collapse' }),
]);

export const LESTER_BLASTER_PERFORMANCE_TARGETS = Object.freeze({
  targetFps: 60,
  frameBudgetMs: 16.67,
  gameplayStep: 'fixed-timestep-logic-variable-render',
  canvasScale: 'integer pixel scale where possible; CSS scales viewport only',
  renderRules: Object.freeze([
    'batch pixel particles and sprite quads',
    'avoid layout work inside requestAnimationFrame',
    'cap particles during boss super moves',
    'camera scroll is float-smoothed while sprite sampling stays pixel-snapped',
  ]),
});

export const LESTER_BLASTER_ANIMATION_PLAN = Object.freeze({
  playerStates: Object.freeze(['idle', 'run', 'jump', 'double-jump', 'shoot', 'melee', 'grenade', 'reload', 'hurt', 'death', 'victory']),
  enemyStates: Object.freeze(['spawn', 'move', 'attack-tell', 'attack', 'hit', 'blood-burst', 'death']),
  bossStates: Object.freeze(['intro', 'phase-1', 'phase-2', 'phase-3-enrage', 'super-move', 'defeat']),
  propStates: Object.freeze(['idle-loop', 'break', 'explode', 'pickup-spin']),
  frameRate: Object.freeze({ targetFps: 60, idle: 6, run: 12, shoot: 10, melee: 14, reload: 8, explosion: 15, blood: 18 }),
  pixelArtDetail: 'high-detail-16-bit-snes-neo-geo-inspired',
  rules: Object.freeze([
    'All attacks need one readable anticipation frame before damage.',
    'Player hit flash should never obscure the silhouette for more than 250ms.',
    'Boss phase transitions should use palette flashes plus unique sound cues.',
    'Use sub-pixel smoothing for camera/parallax while pixel-snapping character and enemy sprites.',
    'Death animations should be enemy-specific and should not hide incoming hazards.',
  ]),
});

const HMH_HD_PLAYABLE_GROUP = HMH_HD_SPRITE_ATLAS_MANIFEST.groups.find((group) => group.actor === 'lester');

export const LESTER_BLASTER_HD_SPRITE_ATLAS = Object.freeze({
  id: HMH_HD_SPRITE_ATLAS_MANIFEST.id,
  style: HMH_HD_SPRITE_ATLAS_MANIFEST.style,
  imageSrc: HMH_HD_SPRITE_ATLAS_MANIFEST.image.src,
  previewSrc: HMH_HD_SPRITE_ATLAS_MANIFEST.image.previewSrc,
  frameSize: Object.freeze({
    width: HMH_HD_SPRITE_ATLAS_MANIFEST.image.frameWidth,
    height: HMH_HD_SPRITE_ATLAS_MANIFEST.image.frameHeight,
  }),
  columns: HMH_HD_SPRITE_ATLAS_MANIFEST.image.columns,
  rows: HMH_HD_SPRITE_ATLAS_MANIFEST.image.rows,
  totalFrames: HMH_HD_SPRITE_ATLAS_MANIFEST.totalFrames,
  playableStates: Object.freeze([...(HMH_HD_PLAYABLE_GROUP?.states ?? [])]),
  animationCount: Object.keys(HMH_HD_SPRITE_ATLAS_MANIFEST.animations).length,
  actorGroups: Object.freeze(HMH_HD_SPRITE_ATLAS_MANIFEST.groups.map((group) => Object.freeze({
    actor: group.actor,
    states: Object.freeze([...group.states]),
    frameCount: group.frameCount,
  }))),
});

export const LESTER_BLASTER_CONTROL_SCHEME = Object.freeze({
  keyboard: Object.freeze({ moveLeft: 'A / ArrowLeft', moveRight: 'D / ArrowRight', crouch: 'Control / S / ArrowDown', jump: 'Space', shoot: 'Left Click', melee: 'E / Right Click', grenade: 'F', reload: 'R', pause: 'Enter', swapWeapon: 'Q' }),
  gamepad: Object.freeze({ move: 'Left Stick / D-Pad', jump: 'A', shoot: 'X / RT', melee: 'B', grenade: 'Y / RB', pause: 'Start', swapWeapon: 'LB' }),
  touch: Object.freeze({ move: 'left thumb virtual stick', jump: 'right thumb jump', shoot: 'right thumb fire', melee: 'right thumb melee', grenade: 'right thumb grenade' }),
  accessibility: Object.freeze(['rebindable controls', 'screen shake toggle', 'flash intensity toggle', 'music/sfx sliders', 'high-contrast projectile option']),
});

export const LESTER_BLASTER_MENU_OPTIONS = Object.freeze({
  main: Object.freeze([
    Object.freeze({ id: 'connect-wallet', title: 'Connect Wallet', section: 'login', description: 'Activate the parent Lester account.' }),
    Object.freeze({ id: 'free-run', title: 'Free Run', section: 'play', description: 'Casual infinite run; local score only.' }),
    Object.freeze({ id: 'paid-run', title: 'Official $0.25 Run', section: 'play', description: 'Leaderboard-eligible paid session.' }),
    Object.freeze({ id: 'loadout', title: 'Loadout', section: 'prep', description: 'Choose character, primary weapon, grenade, and cosmetic unlocks.' }),
    Object.freeze({ id: 'leaderboard', title: 'Leaderboard', section: 'scores', description: 'Global paid high-score board.' }),
    Object.freeze({ id: 'achievements', title: 'Achievements', section: 'profile', description: 'Unlock medals, skins, weapons, music, and cabinet art.' }),
    Object.freeze({ id: 'sound-options', title: 'Sound / Music', section: 'options', description: 'Adjust synthwave/darksynth music, arcade voice barks, SFX, and attract-mode audio.' }),
    Object.freeze({ id: 'accessibility', title: 'Controls + Accessibility', section: 'options', description: 'Rebind controls and tune camera/flash settings.' }),
  ]),
  runPause: Object.freeze(['resume', 'restart-free', 'cash-out-score-summary', 'options', 'quit-to-arcade']),
  postRun: Object.freeze(['share-local-summary-draft', 'view-leaderboard', 'upgrade-loadout', 'play-again', 'return-to-cartridges']),
});

export const LESTER_BLASTER_SOUND_DESIGN = Object.freeze({
  stylePrompt: 'Synthwave brand spine pushed into darksynth / arcade-techno during combat: analog bass, gated drums, arpeggiated leads, neon rain atmosphere, no copyrighted artist references.',
  genreSpine: 'synthwave → arcade-techno/darksynth escalation',
  voiceBarks: Object.freeze(['THE SETTLER!', 'BLOCK BREAKER!', 'HASHSTORM!', 'MISSION COMPLETE!', 'HARD MONEY HERO!']),
  litecoinMotif: 'short 3-5 note motif woven through menu theme, level-clear sting, and final boss track',
  musicTracks: Object.freeze([
    Object.freeze({ id: 'track_attract_mode', title: 'Attract Mode: Hard Money After Dark', bpm: 112, mood: 'melodic synthwave brand identity', loopSeconds: 64 }),
    Object.freeze({ id: 'track_underchain_slums', title: 'Underchain Rain', bpm: 146, mood: 'opening slum combat, gritty but goofy', loopSeconds: 96 }),
    Object.freeze({ id: 'track_foundry_barons_floor', title: 'Counterfeit Foundry', bpm: 154, mood: 'industrial darksynth pressure', loopSeconds: 96 }),
    Object.freeze({ id: 'track_tower_vertical_market', title: 'Extraction Tower', bpm: 160, mood: 'corporate-techno vertical climb', loopSeconds: 92 }),
    Object.freeze({ id: 'track_mr_ngmi_penthouse', title: 'Sponsored Apocalypse', bpm: 172, mood: 'boss theme with ring-light synth stabs', loopSeconds: 88 }),
    Object.freeze({ id: 'track_mainnet_express_finale', title: 'Mainnet Express Rooftop', bpm: 178, mood: 'high-speed final chase and quantum glitch boss', loopSeconds: 104 }),
  ]),
  sfx: Object.freeze([
    Object.freeze({ id: 'sfx_wallet_connect', title: 'Wallet Connect Coin Lock', description: 'coin insert + soft digital latch' }),
    Object.freeze({ id: 'sfx_settler_pop', title: 'The Settler Pop', description: 'crisp semi-auto blue muzzle pop' }),
    Object.freeze({ id: 'sfx_block_breaker_pump', title: 'Block Breaker Pump', description: 'fat blast + ka-CHUNK pump action' }),
    Object.freeze({ id: 'sfx_hashstorm_rattle', title: 'Hashstorm Rattle', description: 'rapid-fire chatter with rising coil whine' }),
    Object.freeze({ id: 'sfx_litecoin_blade_slash', title: 'Litecoin Blade Slash', description: 'clean silver arc slash + Ł spark stamp' }),
    Object.freeze({ id: 'sfx_powerup_pickup', title: 'Power-Up Pickup', description: 'three-note ascending sparkle using the Litecoin motif' }),
    Object.freeze({ id: 'sfx_boss_warning', title: 'Boss Warning Siren', description: 'low siren + cabinet rumble + voice bark' }),
    Object.freeze({ id: 'sfx_leaderboard_sync', title: 'Leaderboard Sync', description: 'score tally into chain-confirm chime' }),
  ]),
  mixRules: Object.freeze(['duck music by 3dB under boss warnings', 'prioritize player damage and pickup cues', 'mute attract mode until user interaction in browser builds', 'boss themes get the largest arrangement and clearest voice barks']),
});

export const LESTER_BLASTER_UNLOCKABLES = Object.freeze([
  Object.freeze({ id: 'skin-classic-lester', type: 'skin', title: 'Classic Lester Jacket', unlock: 'starter' }),
  Object.freeze({ id: 'skin-litecoin-silver', type: 'skin', title: 'Litecoin Silver Armor', unlock: 'score 10,000+ in paid mode' }),
  Object.freeze({ id: 'character-lilly', type: 'character', title: 'Lilly Alternate Hero', unlock: 'future unlockable after Lester sprite pass' }),
  Object.freeze({ id: 'character-max-mempool', type: 'character', title: 'Max Mempool Placeholder', unlock: 'parked concept, not current canon' }),
  Object.freeze({ id: 'weapon-hashstorm', type: 'weapon', title: 'Hashstorm Permanent Loadout', unlock: 'Hashstorm Specialist achievement' }),
  Object.freeze({ id: 'music-mainnet-express', type: 'music', title: 'Mainnet Express Rooftop Jukebox Track', unlock: 'survive 15 minutes' }),
  Object.freeze({ id: 'cabinet-boss-rush-marquee', type: 'cabinet-art', title: 'Boss Rush Marquee', unlock: 'defeat five bosses' }),
  Object.freeze({ id: 'badge-no-damage-boss', type: 'profile-badge', title: 'Untouchable Boss Badge', unlock: 'no-damage boss clear' }),
  Object.freeze({ id: 'gallery-boss-concepts', type: 'gallery', title: 'Boss Concept Gallery', unlock: 'encounter all ten bosses' }),
]);

export const LESTER_BLASTER_AI_DIRECTOR = Object.freeze({
  goals: Object.freeze(['average run around five minutes', 'masters can survive 15-20 minutes', 'boss pressure every 3-5 minutes', 'avoid unfair unavoidable hits']),
  knobs: Object.freeze(['enemySpawnMultiplier', 'enemyAiLevel', 'enemyProjectileSpeedMultiplier', 'powerUpScarcity', 'bonusLifeChance', 'bossFrequencyMultiplier']),
  fairnessRules: Object.freeze(['never spawn a boss and instant hazard on same lane without warning', 'always telegraph melee and projectile attacks', 'give one recovery pickup after a boss if player health is critical']),
});

export const LESTER_BLASTER_LEVEL_PLAN = Object.freeze([
  Object.freeze({
    id: 'level-1-the-slums',
    title: 'Level 1: The Slums',
    subtitle: 'Underchain District → Industrial Foundry',
    mode: 'authored-scroll',
    scrolling: 'left-to-right',
    verticality: 'low-to-medium',
    traversalRhythm: 'ground-outward',
    targetMinutes: [0, 5],
    bossId: 'rug-pull-baron',
    parallaxLayers: Object.freeze([
      { id: 'distant-financial-towers', speed: 0.10 },
      { id: 'tangled-cables-and-ticker-haze', speed: 0.24 },
      { id: 'slum-kiosks-to-foundry-machines', speed: 0.52 },
      { id: 'foreground-puddles-conveyors', speed: 1.0 },
    ]),
    miniBossScrollLocks: Object.freeze([{ id: 'conveyor-belt-ambush', trigger: 'foundry conveyor', unlocks: 'Block Breaker tutorial' }]),
  }),
  Object.freeze({
    id: 'level-2-the-tower',
    title: 'Level 2: The Tower',
    subtitle: 'Financial District → Vertical Skyscraper Ascent',
    mode: 'authored-vertical-ascent',
    scrolling: 'mixed-horizontal-vertical',
    verticality: 'high',
    traversalRhythm: 'vertical-upward',
    targetMinutes: [5, 13],
    bossId: 'mr-ngmi',
    parallaxLayers: Object.freeze([
      { id: 'street-plaza-to-skyline', speed: 0.12 },
      { id: 'ticker-glass-elevator-shaft', speed: 0.30 },
      { id: 'trading-floor-server-vip-lounge', speed: 0.62 },
      { id: 'foreground-marble-and-penthouse-rain', speed: 1.12 },
    ]),
    miniBossScrollLocks: Object.freeze([{ id: 'glass-elevator-sybil-rush', trigger: 'exterior elevator shaft', unlocks: 'Hashstorm tutorial' }]),
  }),
  Object.freeze({
    id: 'level-3-the-getaway',
    title: 'Level 3: The Getaway',
    subtitle: 'Bullet Train Interior → Rooftop Finale',
    mode: 'authored-chase-into-escalation',
    scrolling: 'left-to-right-high-speed',
    verticality: 'medium-with-rooftop-hazards',
    traversalRhythm: 'horizontal-high-speed',
    targetMinutes: [13, Infinity],
    bossId: 'quantum-hacker',
    parallaxLayers: Object.freeze([
      { id: 'smeared-neon-city-lights', speed: 0.20 },
      { id: 'data-tunnel-and-pylons', speed: 0.46 },
      { id: 'train-car-interiors-and-roofline', speed: 0.82 },
      { id: 'foreground-roof-seams-rain-wind', speed: 1.28 },
    ]),
    miniBossScrollLocks: Object.freeze([{ id: 'vault-car-liquidation-gate', trigger: 'cargo/vault car', unlocks: 'Hard Fork precision throwable tutorial' }]),
  }),
]);

export const LESTER_BLASTER_COMBAT_EFFECTS = Object.freeze({
  sparks: Object.freeze({
    alwaysEnabled: true,
    style: 'silver Ł sparks, orange impact sparks, shell casings, muzzle flashes, electric drone shards',
    readabilityRole: 'always-on feedback for hits, parries, pickups, and enemy deaths even when gore is disabled',
  }),
  blood: Object.freeze({
    enabledByDefault: false,
    toggleBeforeRun: true,
    style: 'stylized pixel blood splatter and dismemberment chunks only after explicit pre-run toggle',
    palette: Object.freeze(['#ff1f4f', '#9b1230', '#ff7b2f', '#3b0712']),
    particles: Object.freeze(['hit-spray', 'ground-splatter', 'air-pop', 'enemy-limb-chunk', 'boss-phase-burst']),
  }),
  enemyDeathEffects: Object.freeze(Object.fromEntries(LESTER_BLASTER_ENEMY_CATALOG.map((enemy) => [enemy.id, enemy.deathEffect]))),
  weaponEffects: Object.freeze([
    { id: 'muzzle-flash', title: 'Weapon muzzle flash', description: 'two-frame yellow/white/blue flash at barrel' },
    { id: 'shell-casings', title: 'Shell casings', description: 'small brass pixels ejected downward on gunfire' },
    { id: 'knife-hit-sparks', title: 'Litecoin Blade sparks', description: 'silver slash arc plus orange impact sparks; optional gore if enabled' },
    { id: 'shotgun-smoke', title: 'Block Breaker smoke cone', description: 'short-lived grey/orange pixel cloud' },
    { id: 'rail-afterimage', title: 'Hash Rail afterimage', description: 'cyan beam trail and screen line persistence' },
  ]),
});

export const LESTER_BLASTER_GAMEPLAY = Object.freeze({
  title: 'Hard Money Heroes',
  workingTitle: true,
  legacyWorkingTitle: 'Lester Blaster',
  world: HARD_MONEY_HEROES_CANON.world.name,
  inspiration: 'Metal Slug-style score-attack shooter with goofy/gritty Web3 satire in Litecoin City After Dark',
  format: 'authored three-level side-scrolling campaign that can evolve into survival scoring and boss rotations',
  targetAverageRunMinutes: 5,
  veteranRunMinutes: [15, 20],
  bossIntervalMinutes: [3, 5],
  targetRunCadence: Object.freeze({ averageSeconds: 300, veteranSeconds: [900, 1200], bossEverySeconds: [180, 300] }),
  coreMoves: Object.freeze(['run', 'jump', 'double-jump', 'basic-shoot', 'basic-melee', 'grenade-throw', 'crouch', 'weapon-swap']),
  pickups: Object.freeze([...LESTER_BLASTER_POWER_UPS.map((powerUp) => powerUp.id), 'grenade-pickup']),
  weaponUpgrades: LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons.filter((weapon) => weapon.type === 'upgrade'),
  healthModel: Object.freeze({ paidLives: 3, freeLives: Infinity, iframesMs: 900, checkpointing: 'none in official score mode', mercyRule: 'first thirty seconds cannot spawn armored enemies' }),
  scoring: Object.freeze({ formula: 'survival seconds + distance + kills + boss clears + coins + no-damage bonuses + difficulty tier', paidOnly: 'official leaderboard', freeMode: 'no tracking: practice only' }),
  bossRoster: Object.freeze([
    { id: 'rug-pull-baron', title: 'The Rug Pull Baron', specialty: 'tilting rug arena reveals grinding foundry press', unlockHint: 'Level 1 boss' },
    { id: 'mt-goxzilla', title: 'Mt. Goxzilla', specialty: 'withdrawals-paused beam and offline weak point', unlockHint: 'exchange-ruin kaiju' },
    { id: 'the-whale', title: 'The Whale', specialty: 'market-dump pressure waves and flooded platforming', unlockHint: 'wave-management boss' },
    { id: 'sir-fud-bear-king', title: 'Sir FUD, the Bear King', specialty: 'red-candlestick warhammer, goblin summons, burning floor zones', unlockHint: 'bear-market knight' },
    { id: 'fifty-one-percent-hydra', title: 'The 51% Hydra', specialty: 'mining-rig heads and central consensus node puzzle', unlockHint: 'mechanic-puzzle boss' },
    { id: 'tetherra-stable-queen', title: 'Tetherra, the Stable Queen', specialty: 'peg-pillar invulnerability and depeg panic fire', unlockHint: 'reserve-pillar boss' },
    { id: 'the-maximalist', title: 'The Maximalist', specialty: 'corrupted Lester mirror duel using player-like moveset', unlockHint: 'skill-check duel' },
    { id: 'gas-titan', title: 'Gas Titan (The Congestion)', specialty: 'fee spike floor hazards with low-fee damage windows', unlockHint: 'timing boss' },
    { id: 'mr-ngmi', title: 'The Influencer (Mr. NGMI)', specialty: 'Sybil Swarm shield, shill beams, sponsored-post bombs', unlockHint: 'Level 2 penthouse boss' },
    { id: 'quantum-hacker', title: 'The Quantum Hacker', specialty: 'three fork phases, illusions, vault damage race, leaked seed-phrase reveal', unlockHint: 'Level 3 final boss' },
  ]),
});

export const LESTER_BLASTER_BOSS_SYSTEM = Object.freeze({
  phaseRules: Object.freeze([
    'mini-boss and boss doors pause side scrolling until defeated',
    'phase transition pauses side scroll and changes arena hazards',
    'boss super moves require unique wind-up, audio siren, and safe-lane readability',
  ]),
  bosses: Object.freeze(LESTER_BLASTER_GAMEPLAY.bossRoster.map((boss, index) => Object.freeze({
    ...boss,
    stages: Object.freeze(index % 3 === 0
      ? ['phase-1-pattern-learn', 'phase-2-arena-shift', 'phase-3-enrage']
      : ['phase-1-pattern-learn', 'phase-2-enrage']),
    attackPatterns: Object.freeze([
      'lane-charge',
      'lobbed-projectiles',
      'ranged-burst',
      'floor-shockwave',
      'summon-minions',
      'safe-lane-sweep',
      ...(index % 2 === 0 ? ['homing-orb'] : []),
    ]),
    superMoves: Object.freeze(index > 6
      ? ['screen-wide-warning-blast', 'multi-lane-bullet-hell', 'desperation-dash-chain']
      : ['screen-wide-warning-blast', 'desperation-dash-chain']),
  }))),
});

export const ARCADE_GAMES = Object.freeze([
  {
    id: 'lester-blaster',
    title: 'Hard Money Heroes',
    cabinet: 'RUN-N-GUN CABINET 01',
    genre: 'Goofy/gritty Web3 satire side-scrolling run-n-gun',
    status: 'playable',
    developer: 'Lester\'s Arcade Core Team',
    entryFeeMicroUsdc: DEFAULT_ENTRY_FEE_MICRO_USDC,
    livesPaid: 3,
    livesFree: Infinity,
    tagline: 'Fight through Litecoin City After Dark with sparks-only defaults and optional pre-run gore.',
    systemRole: 'child-dapp-cartridge',
    parentSystem: 'Lester\'s Arcade',
    gameplay: LESTER_BLASTER_GAMEPLAY,
    presentation: Object.freeze({
      medium: 'snes-cartridge',
      colorway: 'silver-neon-cyan',
      cabinetAsset: './assets/cabinet-lester-blaster.svg',
      cartridgeAsset: './assets/cartridge-lester-blaster.svg',
      marquee: 'HARD MONEY HEROES',
    }),
  },
  {
    id: 'lilly-pinball',
    title: 'Lilly\'s Lightning Pinball',
    cabinet: 'PINBALL BAY 02',
    genre: 'Pinball',
    status: 'coming-soon',
    developer: 'Future cabinet builder',
    entryFeeMicroUsdc: DEFAULT_ENTRY_FEE_MICRO_USDC,
    livesPaid: 3,
    livesFree: Infinity,
    tagline: 'Neo-noir Litecoin pinball with multiball bonus rounds.',
    systemRole: 'child-dapp-cartridge',
    parentSystem: 'Lester\'s Arcade',
    presentation: Object.freeze({
      medium: 'snes-cartridge',
      colorway: 'violet-neon-yellow',
      cabinetAsset: './assets/cabinet-generic-pinball.svg',
      cartridgeAsset: './assets/cartridge-lilly-pinball.svg',
      marquee: 'LIGHTNING PINBALL',
    }),
  },
  {
    id: 'block-brawler',
    title: 'Block Brawler',
    cabinet: 'BEAT-EM-UP 03',
    genre: 'Side-scrolling beat-em-up',
    status: 'coming-soon',
    developer: 'Future cabinet builder',
    entryFeeMicroUsdc: DEFAULT_ENTRY_FEE_MICRO_USDC,
    livesPaid: 3,
    livesFree: Infinity,
    tagline: 'Punch through rug-pull gangs and boss-rush crypto villains.',
    systemRole: 'child-dapp-cartridge',
    parentSystem: 'Lester\'s Arcade',
    presentation: Object.freeze({
      medium: 'snes-cartridge',
      colorway: 'purple-neon-red',
      cabinetAsset: './assets/cabinet-generic-brawler.svg',
      cartridgeAsset: './assets/cartridge-block-brawler.svg',
      marquee: 'BLOCK BRAWLER',
    }),
  },
  {
    id: 'mega-lester',
    title: 'Mega Lester',
    cabinet: 'PLATFORMER 04',
    genre: 'Platformer / boss rush',
    status: 'coming-soon',
    developer: 'Future cabinet builder',
    entryFeeMicroUsdc: DEFAULT_ENTRY_FEE_MICRO_USDC,
    livesPaid: 3,
    livesFree: Infinity,
    tagline: 'Jump, dash, and collect silver power crystals across LitVM sectors.',
    systemRole: 'child-dapp-cartridge',
    parentSystem: 'Lester\'s Arcade',
    presentation: Object.freeze({
      medium: 'snes-cartridge',
      colorway: 'blue-neon-green',
      cabinetAsset: './assets/cabinet-generic-platformer.svg',
      cartridgeAsset: './assets/cartridge-mega-lester.svg',
      marquee: 'MEGA LESTER',
    }),
  },
]);

function clone(value) {
  return value == null || typeof structuredClone !== 'function'
    ? JSON.parse(JSON.stringify(value))
    : structuredClone(value);
}

function clampNumber(value, min, max) {
  const safeValue = Number.isFinite(value) ? value : min;
  return Math.max(min, Math.min(max, safeValue));
}

function formatClock(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function getCharacter(characterId = 'lester') {
  const character = LESTER_BLASTER_CHARACTER_ROSTER.find((candidate) => candidate.id === characterId);
  if (!character) throw new Error(`Unknown Hard Money Heroes character: ${characterId}`);
  return character;
}

function getPrimaryWeapon(weaponId = 'coin-blaster') {
  const weapon = LESTER_BLASTER_WEAPON_SYSTEM.primaryWeapons.find((candidate) => candidate.id === weaponId);
  if (!weapon) throw new Error(`Unknown Hard Money Heroes weapon: ${weaponId}`);
  return weapon;
}

function getGrenade(grenadeId = 'satoshi-frag') {
  const grenade = LESTER_BLASTER_WEAPON_SYSTEM.grenades.find((candidate) => candidate.id === grenadeId);
  if (!grenade) throw new Error(`Unknown Hard Money Heroes throwable: ${grenadeId}`);
  return grenade;
}

function getPowerUp(powerUpId) {
  const powerUp = LESTER_BLASTER_POWER_UPS.find((candidate) => candidate.id === powerUpId);
  if (!powerUp) throw new Error(`Unknown Hard Money Heroes power-up: ${powerUpId}`);
  return powerUp;
}

export function buildRunLoadout({ characterId = 'lester', weaponId = 'coin-blaster', grenadeId = 'satoshi-frag' } = {}) {
  const character = getCharacter(characterId);
  return {
    character: clone(character),
    primaryWeapon: clone(getPrimaryWeapon(weaponId)),
    melee: clone(LESTER_BLASTER_WEAPON_SYSTEM.melee),
    grenade: clone(getGrenade(grenadeId)),
  };
}

export function createCombatRunState({ mode = 'free', characterId = 'lester', weaponId = 'coin-blaster', grenadeId = 'satoshi-frag' } = {}) {
  if (!['free', 'paid'].includes(mode)) throw new Error(`Unsupported combat mode: ${mode}`);
  const loadout = buildRunLoadout({ characterId, weaponId, grenadeId });
  const maxHealth = loadout.character.stats.maxHealth;

  return {
    mode,
    character: loadout.character,
    health: { current: maxHealth, max: maxHealth, shieldCharges: 0, invulnerableUntilMs: 0 },
    lives: mode === 'paid' ? 3 : Infinity,
    grenades: mode === 'paid' ? 3 : 9,
    ammoReserve: 0,
    scoreMultiplier: 1,
    activePowerUps: [],
    collectedPowerUps: [],
    loadout,
    controls: clone(LESTER_BLASTER_CONTROL_SCHEME),
    runRules: clone(LESTER_BLASTER_GAMEPLAY.healthModel),
  };
}

export function applyPowerUp(runState, powerUpId) {
  if (!runState || typeof runState !== 'object') throw new Error('runState is required');
  const powerUp = getPowerUp(powerUpId);
  runState.collectedPowerUps ??= [];
  if (!runState.collectedPowerUps.includes(powerUp.id)) runState.collectedPowerUps.push(powerUp.id);

  switch (powerUp.effect) {
    case 'heal':
      runState.health.current = Math.min(runState.health.max, runState.health.current + powerUp.amount);
      break;
    case 'grenades':
      runState.grenades += powerUp.amount;
      break;
    case 'life':
      if (Number.isFinite(runState.lives)) runState.lives += powerUp.amount;
      break;
    case 'weapon':
      runState.loadout.primaryWeapon = clone(getPrimaryWeapon(powerUp.weaponId));
      runState.activePowerUps.push({ id: powerUp.id, weaponId: powerUp.weaponId, durationSeconds: powerUp.durationSeconds });
      break;
    case 'scoreMultiplier':
      runState.scoreMultiplier = Math.max(runState.scoreMultiplier, powerUp.multiplier);
      runState.activePowerUps.push({ id: powerUp.id, multiplier: powerUp.multiplier, durationSeconds: powerUp.durationSeconds });
      break;
    case 'shield':
      runState.health.shieldCharges += powerUp.amount;
      runState.activePowerUps.push({ id: powerUp.id, durationSeconds: powerUp.durationSeconds });
      break;
    case 'ammo':
      runState.ammoReserve = (runState.ammoReserve ?? 0) + powerUp.amount;
      break;
    case 'scoreBonus':
      runState.pendingScoreBonus = (runState.pendingScoreBonus ?? 0) + powerUp.score;
      break;
    default:
      throw new Error(`Unsupported power-up effect: ${powerUp.effect}`);
  }

  return runState;
}

function aiStateMachineRoleForEnemy(enemy) {
  const signature = `${enemy.aiArchetype ?? ''} ${enemy.class ?? ''}`;
  if (/fly|hover|drone|wisp/i.test(signature)) return 'flyerHarasser';
  if (/armored|golem|elite|mini-boss|pressure|turret/i.test(signature)) return 'armoredPressure';
  if (/melee|charge|rusher|skater|rat|panic/i.test(signature)) return 'meleeRusher';
  return 'coverShooter';
}

export function chooseEnemySpawn({ elapsedSeconds = 0, seed = 0 } = {}) {
  const difficulty = getLesterBlasterDifficultyAt(elapsedSeconds);
  const rawIndex = Math.abs(Math.floor(seed)) % LESTER_BLASTER_ENEMY_CATALOG.length;
  const rawEnemy = LESTER_BLASTER_ENEMY_CATALOG[rawIndex];
  const eligible = LESTER_BLASTER_ENEMY_CATALOG.filter((enemy) => enemy.spawnAfterSeconds <= elapsedSeconds);
  const enemy = rawEnemy.spawnAfterSeconds <= elapsedSeconds ? rawEnemy : (eligible.at(-1) ?? LESTER_BLASTER_ENEMY_CATALOG[0]);
  const environmentIndex = Math.min(LESTER_BLASTER_ENVIRONMENTS.length - 1, Math.floor((elapsedSeconds / 60) / 4));
  const environment = LESTER_BLASTER_ENVIRONMENTS[environmentIndex];
  const scaledHealth = Math.ceil(enemy.baseHealth * (1 + difficulty.tier * 0.18));
  const stateMachineRole = aiStateMachineRoleForEnemy(enemy);
  const fairness = LESTER_BLASTER_ENEMY_AI_STATE_MACHINE.globalFairness;

  return {
    enemy: clone(enemy),
    scaledHealth,
    scaledDamage: Math.ceil(enemy.damage * (1 + difficulty.tier * 0.08)),
    ai: {
      archetype: enemy.aiArchetype,
      stateMachineRole,
      aggression: Number((0.8 + difficulty.enemyAiLevel * 0.13).toFixed(2)),
      projectileSpeedMultiplier: difficulty.enemyProjectileSpeedMultiplier,
      spawnMultiplier: difficulty.enemySpawnMultiplier,
      fairnessTell: enemy.tells,
      telegraphFrames: fairness.minTelegraphFrames + Math.min(18, difficulty.enemyAiLevel),
      recoveryFrames: fairness.recoveryFramesAfterAttack + (stateMachineRole === 'armoredPressure' ? 12 : 0),
      maxActiveAttackers: fairness.maxActiveAttackers,
    },
    environment: clone(environment),
    difficulty,
  };
}

export function buildLesterBlasterDesignCodex() {
  return {
    architecture: clone(LESTER_ARCADE_BUILD_STACK),
    login: {
      parentSystem: 'Lester\'s Arcade parent account',
      states: ['guest', 'wallet-connected', 'profile-loaded', 'free-session', 'paid-session', 'post-run-sync'],
      walletRole: 'EVM wallet owns profile, run eligibility, achievements, high scores, and transactions across child cabinets.',
    },
    menus: clone(LESTER_BLASTER_MENU_OPTIONS),
    controls: clone(LESTER_BLASTER_CONTROL_SCHEME),
    performance: clone(LESTER_BLASTER_PERFORMANCE_TARGETS),
    characters: clone(LESTER_BLASTER_CHARACTER_ROSTER),
    animations: clone(LESTER_BLASTER_ANIMATION_PLAN),
    weapons: clone(LESTER_BLASTER_WEAPON_SYSTEM),
    powerUps: clone(LESTER_BLASTER_POWER_UPS),
    levels: clone(LESTER_BLASTER_LEVEL_PLAN),
    environments: clone(LESTER_BLASTER_ENVIRONMENTS),
    combatEffects: clone(LESTER_BLASTER_COMBAT_EFFECTS),
    ai: {
      director: clone(LESTER_BLASTER_AI_DIRECTOR),
      enemies: clone(LESTER_BLASTER_ENEMY_CATALOG),
      bosses: clone(LESTER_BLASTER_GAMEPLAY.bossRoster),
    },
    bosses: clone(LESTER_BLASTER_BOSS_SYSTEM),
    leaderboard: {
      officialMode: 'paid runs only',
      freeMode: 'practice-only; no progress, achievements, high scores, or transactions',
      scoreFormula: LESTER_BLASTER_GAMEPLAY.scoring.formula,
      season: { cadences: [...HARD_MONEY_HEROES_CANON.leaderboards.cadences], antiCheat: 'future verifier-signed replay summary' },
    },
    sound: clone(LESTER_BLASTER_SOUND_DESIGN),
    unlockables: clone(LESTER_BLASTER_UNLOCKABLES),
  };
}

export function buildLesterBlasterControlDisplayModel() {
  return [
    { label: 'Move', key: `${LESTER_BLASTER_CONTROL_SCHEME.keyboard.moveLeft} + ${LESTER_BLASTER_CONTROL_SCHEME.keyboard.moveRight}`, hint: 'Dodge left or advance right through staged combat rooms.' },
    { label: 'Crouch', key: LESTER_BLASTER_CONTROL_SCHEME.keyboard.crouch, hint: 'Duck behind cover and lower your hitbox under slower enemy fire.' },
    { label: 'Jump', key: LESTER_BLASTER_CONTROL_SCHEME.keyboard.jump, hint: 'Jump to platforms, clear holes, and time tactical vertical lanes.' },
    { label: 'Shoot', key: LESTER_BLASTER_CONTROL_SCHEME.keyboard.shoot, hint: 'Fire The Settler or the current pickup weapon.' },
    { label: 'Blade', key: LESTER_BLASTER_CONTROL_SCHEME.keyboard.melee, hint: 'Close-range Litecoin Blade slash with sparks; gore only if enabled pre-run.' },
    { label: 'Throwable', key: LESTER_BLASTER_CONTROL_SCHEME.keyboard.grenade, hint: 'Throw Crypto Bombs or Hard Fork precision axes.' },
    { label: 'Reload', key: LESTER_BLASTER_CONTROL_SCHEME.keyboard.reload ?? 'R', hint: 'Reload concept for production weapons with finite magazines.' },
  ].map((control) => Object.freeze(control));
}

export function buildOfficialRunStatusModel({ gameTitle = 'Hard Money Heroes', connected = false, currentSession = null, lastResult = null } = {}) {
  if (!connected) {
    return Object.freeze({
      channel: 'official',
      state: 'guest',
      heading: 'Waiting for player...',
      details: 'Connect wallet, select Hard Money Heroes, then choose free practice or official paid mode.',
    });
  }

  if (lastResult && currentSession?.isPaid) {
    return Object.freeze({
      channel: 'official',
      state: 'paid-synced',
      heading: 'Official paid result synced',
      details: `${gameTitle} score ${lastResult.score.toLocaleString()} accepted for paid leaderboard, achievements, transaction history, and parent progress.`,
    });
  }

  if (lastResult) {
    return Object.freeze({
      channel: 'official',
      state: 'casual-synced',
      heading: 'Practice result not tracked',
      details: `${gameTitle} score ${lastResult.score.toLocaleString()} stayed practice-only: no progress, achievement, high-score, or transaction record was created.`,
    });
  }

  if (currentSession) {
    return Object.freeze({
      channel: 'official',
      state: currentSession.isPaid ? 'paid-armed' : 'free-armed',
      heading: `${gameTitle} ${currentSession.isPaid ? 'official paid' : 'free casual'} run armed`,
      details: currentSession.isPaid
        ? `${formatMicroUsdc(currentSession.entryFeeMicroUsdc)} simulated credit reserved. Syncing a result will update official leaderboard, achievements, transaction history, and parent progress.`
        : 'Free practice run armed. Completing it stays untracked: no progress, achievements, high scores, or transactions.',
    });
  }

  return Object.freeze({
    channel: 'official',
    state: 'connected-idle',
    heading: 'Parent account online.',
    details: 'Choose Free Play for untracked practice or Insert Credit for an official leaderboard-eligible run. The combat sandbox can run separately for testing controls.',
  });
}

export function buildCombatSandboxStatusModel({ running = false, elapsedSeconds = 0, fps = 60, activeMode = 'practice' } = {}) {
  if (!running) {
    return Object.freeze({
      channel: 'sandbox',
      state: 'idle',
      heading: 'Local combat sandbox idle',
      details: 'Start the 60fps Canvas sandbox to practice movement, shooting, blade attacks, throwables, pickups, and boss locks without changing official paid-run state.',
    });
  }

  return Object.freeze({
    channel: 'sandbox',
    state: 'running',
    heading: 'Local combat sandbox running',
    details: `${Math.round(fps)}fps preview · ${Math.floor(elapsedSeconds)}s accelerated ${activeMode} combat · this does not overwrite official paid-run state.`,
  });
}

export function advanceTacticalCameraModel({
  playerX = LESTER_BLASTER_TACTICAL_CAMERA_MODEL.playerStartScreenX,
  scroll = 0,
  furthestScroll = 0,
  inputDirection = 0,
  stagePhase = 'travel',
  scrollLocked = false,
  speed = 3.1,
  camera = LESTER_BLASTER_TACTICAL_CAMERA_MODEL,
} = {}) {
  const direction = Math.sign(Number(inputDirection) || 0);
  const currentScroll = Math.max(0, Number(scroll) || 0);
  const currentFurthestScroll = Math.max(currentScroll, Number(furthestScroll) || 0);
  const rightCap = stagePhase === 'engagement' || stagePhase === 'boss' || scrollLocked
    ? camera.engagementPlayerMaxScreenX
    : camera.playerMaxScreenX;
  const minX = camera.backtrackFloorScreenX;
  let nextPlayerX = clampNumber((Number(playerX) || camera.playerStartScreenX) + direction * speed, minX, rightCap);
  let nextScroll = currentScroll;
  let scrollDelta = 0;
  let movementMode = 'screen-space';
  const canAdvanceCamera = direction > 0 && !scrollLocked && stagePhase === 'travel';

  if (canAdvanceCamera && nextPlayerX > camera.cameraLeadStartX) {
    const overflow = nextPlayerX - camera.cameraLeadStartX;
    scrollDelta = overflow * camera.scrollAdvanceMultiplier;
    nextScroll += scrollDelta;
    nextPlayerX = camera.cameraLeadStartX;
    movementMode = 'camera-advance';
  }

  const nextFurthest = Math.max(currentFurthestScroll, nextScroll);
  return Object.freeze({
    playerX: Number(nextPlayerX.toFixed(3)),
    scroll: Number(nextScroll.toFixed(3)),
    furthestScroll: Number(nextFurthest.toFixed(3)),
    scrollDelta: Number(scrollDelta.toFixed(3)),
    movementMode,
    backtrackFloorScreenX: camera.backtrackFloorScreenX,
    rightCap,
    worldProgressLocked: nextScroll >= currentScroll,
  });
}

export function buildCombatHudOverlayModel({
  health = 100,
  score = 0,
  elapsedSeconds = 0,
  grenades = 0,
  ammo = Infinity,
  weaponTitle = 'The Settler',
  powerUpsCollected = 0,
  stageIndex = 1,
  stageCount = 13,
  status = 'TRAVEL',
  fps = 60,
} = {}) {
  const healthValue = `${clampNumber(Math.round(Number(health) || 0), 0, 100)}%`;
  const scoreValue = Math.max(0, Math.round(Number(score) || 0)).toLocaleString();
  const ammoValue = ammo === Infinity || ammo === '∞' ? '∞' : Math.max(0, Math.round(Number(ammo) || 0)).toLocaleString();
  const widgets = Object.freeze([
    Object.freeze({ id: 'health', label: 'HP', value: healthValue, tone: healthValue === '0%' ? 'danger' : 'vital' }),
    Object.freeze({ id: 'score', label: 'Score', value: scoreValue, tone: 'score' }),
    Object.freeze({ id: 'timer', label: 'Time', value: formatClock(elapsedSeconds), tone: 'time' }),
    Object.freeze({ id: 'power-ups', label: 'Power', value: `THROW ${Math.max(0, Math.round(Number(grenades) || 0))} // PICKUPS ${Math.max(0, Math.round(Number(powerUpsCollected) || 0))}`, tone: 'power' }),
    Object.freeze({ id: 'weapon', label: 'Weapon', value: `${String(weaponTitle).toUpperCase()} // AMMO ${ammoValue}`, tone: 'weapon' }),
    Object.freeze({ id: 'stage', label: 'Stage', value: `${Math.max(1, Math.round(Number(stageIndex) || 1))}/${Math.max(1, Math.round(Number(stageCount) || 1))} // ${Math.round(Number(fps) || 60)}FPS`, tone: 'stage' }),
    Object.freeze({ id: 'status', label: 'Status', value: String(status || 'TRAVEL'), tone: String(status || '').includes('LOCK') ? 'warning' : 'status' }),
  ]);

  return Object.freeze({
    model: LESTER_BLASTER_HUD_OVERLAY_MODEL.purpose,
    widgets,
    widgetMap: Object.freeze(Object.fromEntries(widgets.map((widget) => [widget.id, widget]))),
  });
}

export function buildCombatOptionsMenuModel({
  paused = false,
  gameOver = false,
  musicEnabled = true,
  viewportMode = 'fullscreen',
  currentMode = 'free',
  officialScoreSubmitted = false,
} = {}) {
  const official = currentMode === 'paid' || currentMode === 'ranked';
  const actions = [
    ...(gameOver ? [] : [Object.freeze({ id: 'resume', label: 'Resume', icon: '▶', enabled: paused })]),
    ...(gameOver && official ? [Object.freeze({ id: 'submit-official-score', label: officialScoreSubmitted ? 'Score Synced' : 'Submit Official Score', icon: '★', enabled: !officialScoreSubmitted })] : []),
    Object.freeze({ id: 'restart', label: gameOver ? 'Play Again' : (official ? 'Restart: New Credit' : 'Restart Free'), icon: '⟲', enabled: true }),
    Object.freeze({ id: 'toggle-music', label: musicEnabled ? 'Music On' : 'Music Off', icon: musicEnabled ? '♪' : '⊘', enabled: true }),
    Object.freeze({ id: 'toggle-fullscreen', label: viewportMode === 'fullscreen' || viewportMode === 'expanded-fullscreen' ? 'Windowed Mode' : 'Full Screen', icon: '▣', enabled: true }),
    Object.freeze({ id: 'return-to-game-menu', label: 'Game Menu', icon: '☰', enabled: true }),
    Object.freeze({ id: 'exit-to-arcade', label: 'Exit to Lester’s Arcade', icon: '⏏', enabled: true, danger: true }),
  ];

  return Object.freeze({
    title: gameOver ? 'Game Over' : 'Paused',
    state: gameOver ? 'game-over' : paused ? 'paused' : 'running',
    copy: gameOver
      ? 'Review the run summary, submit eligible ranked scores, restart, or exit cleanly back to Lester’s Arcade.'
      : 'Resume, restart, toggle music, switch fullscreen/windowed, return to the game menu, or exit back to Lester’s Arcade.',
    actions: Object.freeze(actions),
  });
}

export function buildTacticalBalanceDebugOverlayModel({
  debugEnabled = false,
  playerX = LESTER_BLASTER_TACTICAL_CAMERA_MODEL.playerStartScreenX,
  scroll = 0,
  furthestScroll = 0,
  stagePhase = 'travel',
  scrollLocked = false,
  stageTravel = 0,
  stageTravelGoal = 1,
  enemies = [],
  props = [],
  camera = LESTER_BLASTER_TACTICAL_CAMERA_MODEL,
} = {}) {
  const safeEnemies = Array.isArray(enemies) ? enemies : [];
  const safeProps = Array.isArray(props) ? props : [];
  const enemyItems = safeEnemies.map((enemy, index) => {
    const role = enemy.role ?? enemy.kind ?? enemy.type ?? 'enemy';
    const state = enemy.state ?? enemy.aiState ?? enemy.phase ?? 'seek';
    const timer = Number.isFinite(enemy.attackTimer) ? ` timer ${Math.round(enemy.attackTimer)}` : '';
    const x = Number.isFinite(enemy.x) ? ` @${Math.round(enemy.x)}px` : '';
    return `${index + 1}. ${role} ${state}${x}${timer}`;
  });
  const coverCount = safeProps.filter((prop) => prop.cover || prop.kind === 'crate' || prop.kind === 'wall').length;
  const explosiveCount = safeProps.filter((prop) => prop.explosive || prop.kind === 'barrel').length;
  const telegraphing = safeEnemies.filter((enemy) => /tell|telegraph|windup/i.test(String(enemy.state ?? enemy.aiState ?? enemy.phase ?? ''))).length;
  const safeStageGoal = Math.max(1, Math.round(Number(stageTravelGoal) || 1));
  const safeStageTravel = Math.max(0, Math.round(Number(stageTravel) || 0));
  const layerItems = Object.freeze({
    'camera-bounds': Object.freeze([
      `${camera.mode} // scroll ${Math.round(Number(scroll) || 0)}px`,
      `furthest ${Math.round(Number(furthestScroll) || 0)}px // backtrack ${camera.backwardAllowancePixels}px`,
      `lead ${camera.cameraLeadStartX}px // player cap ${camera.playerMaxScreenX}px`,
    ]),
    'player-lanes': Object.freeze([
      `player x ${Math.round(Number(playerX) || camera.playerStartScreenX)}px`,
      `min ${camera.playerMinScreenX}px // floor ${camera.backtrackFloorScreenX}px`,
      `engagement cap ${camera.engagementPlayerMaxScreenX}px`,
    ]),
    'arena-locks': Object.freeze([
      `${stagePhase}${scrollLocked ? ' // LOCKED' : ' // open travel'}`,
      `stage travel ${safeStageTravel}/${safeStageGoal}M`,
      `arena width ${camera.engagementArenaWidthPixels}px`,
    ]),
    'enemy-ai': Object.freeze(enemyItems.length ? enemyItems : ['no enemies active']),
    'cover-props': Object.freeze([
      `${coverCount} cover props`,
      `${explosiveCount} explosive props`,
      `${safeProps.length} total tactical props`,
    ]),
  });
  const layers = Object.freeze(LESTER_BLASTER_DEV_BALANCE_OVERLAY.layers.map((layer) => Object.freeze({
    ...clone(layer),
    items: layerItems[layer.id] ?? Object.freeze([]),
  })));

  return Object.freeze({
    enabled: Boolean(debugEnabled),
    publicUiDefault: LESTER_BLASTER_DEV_BALANCE_OVERLAY.publicUiDefault,
    queryParam: LESTER_BLASTER_DEV_BALANCE_OVERLAY.queryParam,
    layers,
    metrics: Object.freeze({
      camera: Object.freeze({
        mode: camera.mode,
        scroll: Math.round(Number(scroll) || 0),
        furthestScroll: Math.round(Number(furthestScroll) || 0),
        backtrackLimit: `${camera.backwardAllowancePixels}px`,
      }),
      stage: Object.freeze({ phase: stagePhase, locked: Boolean(scrollLocked), progress: `${safeStageTravel}/${safeStageGoal}M` }),
      player: Object.freeze({ x: Math.round(Number(playerX) || camera.playerStartScreenX), backtrackFloor: camera.backtrackFloorScreenX }),
      enemies: Object.freeze({ count: safeEnemies.length, telegraphing }),
      cover: Object.freeze({ coverCount, explosiveCount, propCount: safeProps.length }),
    }),
    safeguards: LESTER_BLASTER_DEV_BALANCE_OVERLAY.safeguards,
  });
}

function availableAnimationStates(animationMap = {}) {
  return Object.entries(animationMap)
    .filter(([, animation]) => (animation?.frames?.length ?? 0) > 0)
    .map(([state]) => state);
}

function deriveStillCoveredHeroStates(character = {}) {
  const stills = character.stills ?? {};
  const weapons = character.weapons ?? {};
  const covered = [];
  if (stills.rightSide || weapons.machineGun?.selectedFrom || weapons.pistol?.selectedFrom || weapons.shotgun?.selectedFrom) covered.push('shoot');
  if (stills.knife || weapons.knife?.selectedFrom) covered.push('melee');
  if (stills.grenade || weapons.grenade?.selectedFrom) covered.push('throw');
  return covered;
}

export function buildHardMoneyHeroesAnimationCoverageReport(manifest = HARD_MONEY_HEROES_ASSET_MANIFEST) {
  const requiredHeroStates = [...LESTER_BLASTER_ART_REDO_BRIEF.requiredHeroStates];
  const requiredEnemyStates = [...LESTER_BLASTER_ART_REDO_BRIEF.enemySpriteUpgrade];
  const enemyStateAliases = Object.freeze({
    'walk-or-fly': Object.freeze(['walk', 'fly', 'run']),
    'attack-tell': Object.freeze(['attack-tell', 'tell', 'telegraph']),
    'melee-counter': Object.freeze(['melee-counter', 'counter']),
    'optional-gore-overlay': Object.freeze(['gore', 'gore-overlay']),
  });

  const characters = Object.fromEntries(Object.entries(manifest.playableCharacters ?? {}).map(([id, character]) => {
    const animated = availableAnimationStates(character.animations ?? {});
    const stillCovered = deriveStillCoveredHeroStates(character);
    const allCovered = new Set([...animated, ...stillCovered, animated.includes('attack') ? 'melee' : null].filter(Boolean));
    return [id, Object.freeze({
      id,
      availableAnimatedStates: Object.freeze(animated),
      coveredByStillStates: Object.freeze(stillCovered),
      missingStates: Object.freeze(requiredHeroStates.filter((state) => !allCovered.has(state))),
      missingAnimatedStates: Object.freeze(requiredHeroStates.filter((state) => !animated.includes(state))),
      nextArtPriority: Object.freeze(['crouch', 'hurt', 'death', 'victory', 'fall'].filter((state) => !animated.includes(state))),
    })];
  }));

  const enemies = Object.fromEntries(Object.entries(manifest.enemies ?? {}).map(([key, enemy]) => {
    const art = enemy.art ?? enemy;
    const animated = availableAnimationStates(art.animations ?? {});
    const satisfies = (state) => {
      const aliases = enemyStateAliases[state] ?? [state];
      return aliases.some((alias) => animated.includes(alias));
    };
    return [key, Object.freeze({
      id: enemy.id ?? key,
      title: enemy.title ?? key,
      availableAnimatedStates: Object.freeze(animated),
      missingAnimatedStates: Object.freeze(requiredEnemyStates.filter((state) => !satisfies(state))),
      behavior: clone(enemy.behavior ?? {}),
    })];
  }));

  return Object.freeze({
    manifestId: manifest.id,
    requiredHeroStates: Object.freeze(requiredHeroStates),
    requiredEnemyStates: Object.freeze(requiredEnemyStates),
    characters: Object.freeze(characters),
    enemies: Object.freeze(enemies),
    recommendations: Object.freeze([
      'Use Aseprite or LibreSprite to slice every new sheet into the manifest states before runtime integration.',
      'Prioritize crouch, hurt, death, fall, and victory loops for Lester/Lilly because current provided art covers core motion but relies on stills for weapon poses.',
      'Add enemy attack-tell, hit, death, and melee-counter frames so AI fairness reads visually instead of only through timers.',
      'Keep the manifest audit in CI so missing states become visible immediately after new art drops.',
    ]),
  });
}

export function buildHardMoneyHeroesAnimationProductionBriefs(coverage = buildHardMoneyHeroesAnimationCoverageReport()) {
  const heroFrameCounts = LESTER_BLASTER_ANIMATION_PRODUCTION_BRIEFS.defaultFrameCounts.hero;
  const enemyFrameCounts = LESTER_BLASTER_ANIMATION_PRODUCTION_BRIEFS.defaultFrameCounts.enemy;
  const heroReadability = Object.freeze({
    crouch: 'must visibly lower the hitbox behind cover and read at 128px canvas scale',
    hurt: 'damage reaction must flash/tilt clearly so players understand they were hit',
    death: 'defeat pose must read quickly without gore dependency',
    victory: 'short celebration loop for level clear and arcade identity',
    fall: 'falling silhouette must separate from jump for platform timing',
    shoot: 'muzzle/recoil pose must point clearly to the right with chunky arcade timing',
    melee: 'blade arc must communicate close-range risk/reward',
    throw: 'throw anticipation and release should sync with projectile spawn',
  });
  const enemyPurpose = Object.freeze({
    'attack-tell': 'telegraph danger before damage so enemy AI feels fair instead of random',
    'melee-counter': 'show delayed counter timing after player closes distance',
    hit: 'confirm player shots/melee connect before score/combo feedback',
    death: 'clean removal/readability for kills, combo chains, and arena clear state',
    'optional-gore-overlay': 'optional pre-run intensity layer only; keep base death readable without it',
  });

  const heroEntries = Object.fromEntries(Object.entries(coverage.characters ?? {}).map(([id, character]) => {
    const priorityStates = LESTER_BLASTER_ANIMATION_PRODUCTION_BRIEFS.heroPriorityStates
      .filter((state) => character.missingAnimatedStates?.includes(state));
    const remainingStates = (character.missingAnimatedStates ?? []).filter((state) => !priorityStates.includes(state));
    const requests = [...priorityStates, ...remainingStates].map((state, index) => Object.freeze({
      id: `${id}-${state}`,
      actorId: id,
      actorType: 'hero',
      state,
      manifestState: state,
      priority: index < priorityStates.length ? 'high' : 'normal',
      frameCount: heroFrameCounts[state] ?? 6,
      readabilityGoal: heroReadability[state] ?? 'match existing 128px side-scroller silhouette and action timing',
      delivery: 'transparent PNG frames or Aseprite sheet tag ready for manifest ingestion',
    }));
    return [id, Object.freeze({
      id,
      title: id === 'lester' ? 'Lester' : id === 'lilly' ? 'Lilly' : id,
      currentAnimatedStates: character.availableAnimatedStates,
      stillCoveredStates: character.coveredByStillStates,
      requests: Object.freeze(requests),
    })];
  }));

  const enemyEntries = Object.fromEntries(Object.entries(coverage.enemies ?? {}).map(([key, enemy]) => {
    const priorityStates = LESTER_BLASTER_ANIMATION_PRODUCTION_BRIEFS.enemyPriorityStates
      .filter((state) => enemy.missingAnimatedStates?.includes(state));
    const remainingStates = (enemy.missingAnimatedStates ?? []).filter((state) => !priorityStates.includes(state));
    const requests = [...priorityStates, ...remainingStates].map((state, index) => Object.freeze({
      id: `${enemy.id}-${state}`,
      actorId: enemy.id,
      actorKey: key,
      actorType: 'enemy',
      state,
      manifestState: state,
      priority: index < priorityStates.length ? 'high' : 'normal',
      frameCount: enemyFrameCounts[state] ?? 6,
      aiPurpose: enemyPurpose[state] ?? 'make enemy role readable before damage or removal',
      behavior: clone(enemy.behavior ?? {}),
      delivery: 'transparent PNG frames or Aseprite sheet tag ready for manifest ingestion',
    }));
    return [key, Object.freeze({
      id: enemy.id,
      title: enemy.title,
      currentAnimatedStates: enemy.availableAnimatedStates,
      requests: Object.freeze(requests),
    })];
  }));

  const heroRequestCount = Object.values(heroEntries).reduce((total, hero) => total + hero.requests.length, 0);
  const enemyRequestCount = Object.values(enemyEntries).reduce((total, enemy) => total + enemy.requests.length, 0);

  return Object.freeze({
    generatedFromManifest: coverage.manifestId,
    placeholderPolicy: 'No placeholder production sprites are generated by this tool; it emits art-direction briefs and manifest requirements only.',
    sheetRequirements: LESTER_BLASTER_ANIMATION_PRODUCTION_BRIEFS.sheetRequirements,
    approvalNeeded: LESTER_BLASTER_ANIMATION_PRODUCTION_BRIEFS.approvalNeeded,
    heroes: Object.freeze(heroEntries),
    enemies: Object.freeze(enemyEntries),
    summary: Object.freeze({ heroRequestCount, enemyRequestCount, totalRequestCount: heroRequestCount + enemyRequestCount }),
    pipeline: Object.freeze([
      Object.freeze({ command: 'npm run design:audit', purpose: 'regenerate missing animation coverage and action plan' }),
      Object.freeze({ command: 'npm run assets:verify', purpose: 'verify manifests/frames after approved art ingestion' }),
      Object.freeze({ command: 'npm test', purpose: 'keep animation coverage, fairness, and runtime contracts green' }),
    ]),
  });
}

export function buildGameOverSummaryModel({ session = null, score = 0, elapsedSeconds = 0, kills = 0, bossesDefeated = 0, acceptedForGlobalLeaderboard = false } = {}) {
  const official = Boolean(session?.isPaid || session?.mode === 'paid' || session?.leaderboardEligible);
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
  const safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, Math.round(elapsedSeconds)) : 0;
  const safeKills = Number.isFinite(kills) ? Math.max(0, Math.round(kills)) : 0;
  const safeBosses = Number.isFinite(bossesDefeated) ? Math.max(0, Math.round(bossesDefeated)) : 0;
  const metrics = Object.freeze([
    Object.freeze({ id: 'score', label: 'Score', value: safeScore.toLocaleString() }),
    Object.freeze({ id: 'time', label: 'Time', value: `${Math.floor(safeElapsed / 60)}:${String(safeElapsed % 60).padStart(2, '0')}` }),
    Object.freeze({ id: 'kills', label: 'Enemies', value: safeKills.toLocaleString() }),
    Object.freeze({ id: 'bosses', label: 'Bosses', value: safeBosses.toLocaleString() }),
  ]);
  const baseActions = [
    Object.freeze({ id: official ? 'play-again-ranked' : 'play-again-free', label: official ? 'Play Again Ranked' : 'Play Again Free', cost: official ? 'requires new testnet credit' : 'free', target: 'level-intro', enabled: true }),
    Object.freeze({ id: 'return-to-game-menu', label: 'Game Menu', cost: 'none', target: 'mode-select', enabled: true }),
    Object.freeze({ id: 'return-to-arcade', label: 'Exit to Lester’s Arcade', cost: 'none', target: 'cabinet-select', enabled: true }),
  ];

  if (!official) {
    return Object.freeze({
      channel: 'practice',
      state: 'free-practice-game-over',
      title: 'Practice Run Complete',
      metrics,
      trackingCopy: 'Free practice result is not tracked: no progress, achievements, official scores, or transactions were written.',
      actions: Object.freeze(baseActions),
      exitRampCopy: LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.exitRamps.find((ramp) => ramp.id === 'return-to-arcade')?.copy,
    });
  }

  return Object.freeze({
    channel: 'official',
    state: acceptedForGlobalLeaderboard ? 'official-score-synced' : 'official-submit-ready',
    title: acceptedForGlobalLeaderboard ? 'Official Score Synced' : 'Ranked Run Complete',
    metrics,
    trackingCopy: acceptedForGlobalLeaderboard
      ? 'Official score synced to parent progress, achievements, leaderboard, and transaction history.'
      : 'Submit Official Score to write this ranked result. Until then, nothing is synced to the official leaderboard.',
    actions: Object.freeze([
      Object.freeze({ id: 'submit-official-score', label: acceptedForGlobalLeaderboard ? 'Score Already Synced' : 'Submit Official Score', cost: 'paid run receipt', target: 'parent-sync', enabled: !acceptedForGlobalLeaderboard }),
      ...baseActions,
    ]),
    exitRampCopy: LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.exitRamps.find((ramp) => ramp.id === 'return-to-arcade')?.copy,
  });
}

export function buildUiQualityGuideModel({ connected = false, selectedGameId = 'lester-blaster', activeControl = null } = {}) {
  const tooltipByAnchor = Object.fromEntries(LESTER_ARCADE_UI_QUALITY_SYSTEM.tooltips.map((tooltip) => [tooltip.anchor, clone(tooltip)]));
  const iconById = Object.fromEntries(LESTER_ARCADE_BRAND_SYSTEM.icons.map((icon) => [icon.id, clone(icon)]));

  return {
    connected,
    selectedGameId,
    activeControl,
    brand: clone(LESTER_ARCADE_BRAND_SYSTEM),
    quickStart: LESTER_ARCADE_UI_QUALITY_SYSTEM.quickStart.map((step, index) => ({
      ...clone(step),
      number: String(index + 1).padStart(2, '0'),
      iconSymbol: iconById[step.icon]?.symbol ?? '?',
      state: connected || index === 0 ? 'ready' : 'locked-until-wallet',
    })),
    instructions: clone(LESTER_ARCADE_UI_QUALITY_SYSTEM.instructions),
    tooltips: clone(LESTER_ARCADE_UI_QUALITY_SYSTEM.tooltips),
    tooltipByAnchor,
    controls: clone(LESTER_ARCADE_UI_QUALITY_SYSTEM.controls),
    iconLegend: LESTER_ARCADE_BRAND_SYSTEM.icons.map((icon) => ({
      ...clone(icon),
      tooltip: icon.id === 'coin'
        ? 'Official paid runs are simulated in this prototype.'
        : icon.usage,
    })),
    qualityChecklist: LESTER_ARCADE_UI_QUALITY_SYSTEM.qualityChecklist.map((item) => ({
      ...clone(item),
      badge: item.status === 'prototype-pass' ? 'PASS' : 'NEXT',
    })),
    colorUsageSummary: LESTER_ARCADE_BRAND_SYSTEM.palette.map((color) => `${color.name}: ${color.usage}`),
  };
}

export function buildLoginMenuModel({ connected = false, selectedGameId = 'lester-blaster', wallet = null } = {}) {
  const game = getGame(selectedGameId);
  const login = connected
    ? {
      state: 'connected',
      primaryAction: 'Wallet Connected',
      wallet: normalizeWallet(wallet),
      walletShort: `${normalizeWallet(wallet).slice(0, 8)}…${normalizeWallet(wallet).slice(-6)}`,
      copy: 'Parent account online; child cabinet runs can sync progress, transactions, and achievements.',
    }
    : {
      state: 'guest',
      primaryAction: 'Connect Wallet',
      wallet: null,
      walletShort: null,
      copy: 'Connect an EVM wallet to activate official paid runs, achievements, transactions, and leaderboard identity.',
    };

  const menuItems = LESTER_BLASTER_MENU_OPTIONS.main.map((item) => ({
    ...item,
    disabled: (item.id === 'paid-run' && !connected)
      || (item.id === 'leaderboard' && game.status !== 'playable')
      || (item.id === 'loadout' && game.status !== 'playable'),
    active: item.id === 'free-run' && game.status === 'playable' && !connected,
  }));

  return {
    selectedGame: { id: game.id, title: game.title, status: game.status },
    login,
    menuItems,
  };
}

export function buildLeaderboardModel(state, { gameId = 'lester-blaster', wallet = null } = {}) {
  const game = getGame(gameId);
  const normalizedWallet = wallet ? normalizeWallet(wallet) : null;
  const entries = (state.leaderboards?.[gameId] ?? []).map((entry, index) => ({ ...entry, rank: index + 1 }));
  const playerEntries = normalizedWallet ? entries.filter((entry) => entry.wallet === normalizedWallet) : [];
  const playerBest = playerEntries[0] ?? null;

  return {
    gameId: game.id,
    gameTitle: game.title,
    topEntries: entries.slice(0, 10),
    playerBest,
    playerRank: playerBest?.rank ?? null,
    scoreFormula: 'survival + distance + kills + boss clears + coins + power-up bonuses + difficulty tier',
    eligibility: 'official leaderboard requires paid session and future verifier-signed score summary',
    season: {
      id: 'prototype-season-00',
      cadences: [...HARD_MONEY_HEROES_CANON.leaderboards.cadences],
      resetCadence: 'daily-weekly-monthly-yearly-all-time-prototype',
      prizeNotes: 'future tournament pool; no real prizes in local prototype',
    },
  };
}

export function resolveAchievementUnlocksForRun({ score = 0, elapsedSeconds = 0, bossId = null, weaponId = null, noDamage = false, collectedPowerUps = [] } = {}) {
  const unlocks = [];
  if (score >= 1000) unlocks.push(ACHIEVEMENTS.FIRST_1000_POINTS.id);
  if (bossId) unlocks.push(ACHIEVEMENTS.BOSS_BREAKER.id);
  if (elapsedSeconds >= 5 * 60) unlocks.push(ACHIEVEMENTS.FIVE_MINUTE_RUN.id);
  if (elapsedSeconds >= 15 * 60) unlocks.push(ACHIEVEMENTS.MASTER_SURVIVOR.id);
  if (weaponId === 'hash-rail') unlocks.push(ACHIEVEMENTS.HASH_RAIL_SPECIALIST.id);
  if (weaponId === 'spread-ltc') unlocks.push(ACHIEVEMENTS.SPREAD_LTC_SPECIALIST.id);
  if (noDamage && bossId) unlocks.push(ACHIEVEMENTS.NO_DAMAGE_BOSS.id);
  if (new Set(collectedPowerUps).size >= 3) unlocks.push(ACHIEVEMENTS.POWERUP_COLLECTOR.id);
  return [...new Set(unlocks)];
}

export function normalizeWallet(wallet) {
  if (typeof wallet !== 'string') {
    throw new TypeError('wallet must be a string');
  }

  const normalized = wallet.trim().toLowerCase();
  if (!/^0x[a-f0-9]{40}$/.test(normalized)) {
    throw new Error(`Invalid EVM wallet address: ${wallet}`);
  }

  return normalized;
}

function normalizeChainId(chainId) {
  if (chainId === null || chainId === undefined || chainId === '') return null;
  if (typeof chainId === 'number') return `0x${chainId.toString(16)}`;
  const raw = String(chainId).trim().toLowerCase();
  if (!raw) return null;
  if (raw.startsWith('0x')) return raw;
  if (/^\d+$/.test(raw)) return `0x${Number(raw).toString(16)}`;
  return raw;
}

function liteForgeWalletAddParams() {
  return Object.freeze({
    chainId: LITVM_LITEFORGE_NETWORK.chainIdHex,
    chainName: LITVM_LITEFORGE_NETWORK.name,
    nativeCurrency: { ...LITVM_LITEFORGE_NETWORK.nativeCurrency },
    rpcUrls: [LITVM_LITEFORGE_NETWORK.rpcUrls.http],
    blockExplorerUrls: [LITVM_LITEFORGE_NETWORK.explorerUrl],
  });
}

function buildChainGuard({ providerAvailable, normalizedWallet, chainId }) {
  const currentChainId = normalizeChainId(chainId);
  const expectedChainIdHex = LITVM_LITEFORGE_NETWORK.chainIdHex;
  let status = 'needs-wallet-connection';
  let copy = `Connect MetaMask/Rabby on ${LITVM_LITEFORGE_NETWORK.name} (Chain ID ${LITVM_LITEFORGE_NETWORK.chainId}) or use the mock fallback for offline QA.`;

  if (!providerAvailable && !normalizedWallet) {
    status = 'mock-fallback';
    copy = `No injected EVM wallet detected. Mock fallback is available; real testnet play uses ${LITVM_LITEFORGE_NETWORK.name} and faucet zkLTC.`;
  } else if (normalizedWallet && !currentChainId) {
    status = 'chain-unknown';
    copy = `Wallet connected, but the browser did not report a chain. Switch or add ${LITVM_LITEFORGE_NETWORK.name} before live testnet transactions.`;
  } else if (normalizedWallet && currentChainId === expectedChainIdHex) {
    status = 'right-chain';
    copy = `${LITVM_LITEFORGE_NETWORK.name} ready. Chain ID ${LITVM_LITEFORGE_NETWORK.chainId} // gas token ${LITVM_LITEFORGE_NETWORK.nativeCurrency.symbol} // faucet available for free testnet gas.`;
  } else if (normalizedWallet && currentChainId !== expectedChainIdHex) {
    status = 'wrong-chain';
    copy = `Switch or add ${LITVM_LITEFORGE_NETWORK.name} in MetaMask/Rabby. Expected Chain ID ${LITVM_LITEFORGE_NETWORK.chainId} (${expectedChainIdHex}); detected ${currentChainId}.`;
  }

  return Object.freeze({
    expectedNetwork: LITVM_LITEFORGE_NETWORK.name,
    expectedChainId: LITVM_LITEFORGE_NETWORK.chainId,
    expectedChainIdHex,
    currentChainId,
    status,
    copy,
    nativeCurrency: { ...LITVM_LITEFORGE_NETWORK.nativeCurrency },
    rpcUrl: LITVM_LITEFORGE_NETWORK.rpcUrls.http,
    explorerUrl: LITVM_LITEFORGE_NETWORK.explorerUrl,
    faucetUrl: LITVM_LITEFORGE_NETWORK.faucetUrl,
    portalUrl: LITVM_LITEFORGE_NETWORK.portalUrl,
    switchMethod: 'wallet_switchEthereumChain',
    addMethod: 'wallet_addEthereumChain',
    addEthereumChainParams: liteForgeWalletAddParams(),
  });
}

export function buildWalletConnectionModel({ providerAvailable = false, wallet = null, chainId = null } = {}) {
  const normalizedWallet = wallet ? normalizeWallet(wallet) : null;
  const chainGuard = buildChainGuard({ providerAvailable: Boolean(providerAvailable), normalizedWallet, chainId });
  const connectors = LESTER_ARCADE_WALLET_RAILS.connectors.map((connector) => Object.freeze({
    ...connector,
    available: connector.id === 'injected-evm' ? Boolean(providerAvailable) : true,
    recommended: connector.id === 'injected-evm' && Boolean(providerAvailable),
  }));

  const status = normalizedWallet
    ? chainGuard.status === 'right-chain'
      ? 'connected-valid-chain'
      : chainGuard.status === 'wrong-chain'
        ? 'connected-wrong-chain'
        : 'connected-chain-unknown'
    : providerAvailable
      ? 'ready'
      : 'mock-ready';

  return Object.freeze({
    parentSystem: LESTER_ARCADE_WALLET_RAILS.parentSystem,
    childGame: LESTER_ARCADE_WALLET_RAILS.activeChildGame,
    targetNetwork: LESTER_ARCADE_WALLET_RAILS.targetNetwork,
    network: Object.freeze({
      name: LITVM_LITEFORGE_NETWORK.name,
      chainId: LITVM_LITEFORGE_NETWORK.chainId,
      chainIdHex: LITVM_LITEFORGE_NETWORK.chainIdHex,
      nativeCurrency: { ...LITVM_LITEFORGE_NETWORK.nativeCurrency },
      rpcUrls: { ...LITVM_LITEFORGE_NETWORK.rpcUrls },
      explorerUrl: LITVM_LITEFORGE_NETWORK.explorerUrl,
      faucetUrl: LITVM_LITEFORGE_NETWORK.faucetUrl,
      portalUrl: LITVM_LITEFORGE_NETWORK.portalUrl,
      safetyNotes: [...LITVM_LITEFORGE_NETWORK.safetyNotes],
    }),
    status,
    wallet: normalizedWallet,
    walletShort: normalizedWallet ? `${normalizedWallet.slice(0, 8)}…${normalizedWallet.slice(-6)}` : null,
    connectors,
    permissions: {
      readScopes: [...LESTER_ARCADE_WALLET_RAILS.permissions.readScopes],
      writeScopes: [...LESTER_ARCADE_WALLET_RAILS.permissions.writeScopes],
      freeModeRule: LESTER_ARCADE_WALLET_RAILS.permissions.freeModeRule,
      paidModeRule: LESTER_ARCADE_WALLET_RAILS.permissions.paidModeRule,
    },
    chainGuard,
  });
}

function stablePrototypeHash(parts = []) {
  const source = parts.map((part) => String(part ?? '')).join('|');
  let seed = 0x811c9dc5;
  let hex = '';
  for (let block = 0; block < 8; block += 1) {
    let hash = seed ^ block;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index) + block * 31;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    hex += hash.toString(16).padStart(8, '0');
    seed = Math.imul(seed ^ hash, 0x45d9f3b) >>> 0;
  }
  return `0x${hex.slice(0, 64)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function createEmptyGameProgress(gameId) {
  return {
    gameId,
    bestPaidScore: 0,
    bestFreeScore: 0,
    paidRuns: 0,
    freeRuns: 0,
    longestRunSeconds: 0,
    bestDistanceMeters: 0,
    bossesDefeated: [],
    lastSessionId: null,
    lastPlayedAt: null,
  };
}

function ensureGameProgress(profile, gameId) {
  profile.progress ??= {};
  profile.progress[gameId] ??= createEmptyGameProgress(gameId);
  return profile.progress[gameId];
}

function ensureAllGameProgress(profile) {
  for (const game of ARCADE_GAMES) {
    ensureGameProgress(profile, game.id);
  }
  return profile.progress;
}

export function createPlayerProfile(wallet, options = {}) {
  const normalizedWallet = normalizeWallet(wallet);
  const profile = {
    wallet: normalizedWallet,
    handle: options.handle || `Player ${normalizedWallet.slice(-4).toUpperCase()}`,
    avatar: options.avatar || '🕹️',
    rank: 'New Challenger',
    xp: 0,
    joinedAt: nowIso(),
    achievements: [],
    creditsLabel: '0.25 USDC paid runs unlock global boards',
    totalPaidRuns: 0,
    totalFreeRuns: 0,
    progress: {},
  };

  ensureAllGameProgress(profile);
  return profile;
}

export function createInitialArcadeState() {
  return {
    systemName: 'Lester\'s Arcade',
    systemRole: 'parent-arcade-portal',
    games: [...ARCADE_GAMES],
    profiles: {},
    sessions: {},
    localScores: [],
    payments: [],
    transactions: [],
    officialSessions: [],
    loginEvents: [],
    leaderboards: Object.fromEntries(ARCADE_GAMES.map((game) => [game.id, []])),
  };
}

export function getGame(gameId) {
  const game = ARCADE_GAMES.find((candidate) => candidate.id === gameId);

  if (!game) {
    throw new Error(`Unknown arcade game: ${gameId}`);
  }

  return game;
}

export function getCartridgeSelectModel() {
  return ARCADE_GAMES.map((game) => ({
    id: game.id,
    title: game.title,
    status: game.status,
    genre: game.genre,
    developer: game.developer,
    tagline: game.tagline,
    entryFeeMicroUsdc: game.entryFeeMicroUsdc,
    systemRole: game.systemRole,
    parentSystem: game.parentSystem,
    presentation: { ...game.presentation },
  }));
}

export function calculateRevenueSplit(amountMicroUnits, splitBps = DEFAULT_REVENUE_SPLIT_BPS) {
  if (!Number.isInteger(amountMicroUnits) || amountMicroUnits < 0) {
    throw new Error('amountMicroUnits must be a non-negative integer');
  }

  const totalBps = Object.values(splitBps).reduce((sum, value) => sum + value, 0);
  if (totalBps !== 10_000) {
    throw new Error(`revenue split must equal 10,000 bps; received ${totalBps}`);
  }

  const infrastructure = Math.floor((amountMicroUnits * splitBps.infrastructure) / 10_000);
  const developer = Math.floor((amountMicroUnits * splitBps.developer) / 10_000);
  const tournament = Math.floor((amountMicroUnits * splitBps.tournament) / 10_000);
  const community = Math.floor((amountMicroUnits * splitBps.community) / 10_000);
  const allocated = infrastructure + developer + tournament + community;

  return {
    infrastructure: infrastructure + (amountMicroUnits - allocated),
    developer,
    tournament,
    community,
  };
}

export function unlockAchievement(profile, achievementId) {
  if (!Object.values(ACHIEVEMENTS).some((achievement) => achievement.id === achievementId)) {
    throw new Error(`Unknown achievement: ${achievementId}`);
  }

  if (!profile.achievements.includes(achievementId)) {
    profile.achievements.push(achievementId);
    return true;
  }

  return false;
}

function updateRank(profile) {
  if (profile.xp >= 1000) profile.rank = 'Arcade Legend';
  else if (profile.xp >= 500) profile.rank = 'Boss Hunter';
  else if (profile.xp >= 150) profile.rank = 'Quarter Master';
  else profile.rank = 'New Challenger';
}

export function connectPlayerAccount(state, wallet, options = {}) {
  const normalizedWallet = normalizeWallet(wallet);

  if (!state || typeof state !== 'object') {
    throw new Error('state is required');
  }

  if (!state.profiles[normalizedWallet]) {
    state.profiles[normalizedWallet] = createPlayerProfile(normalizedWallet, options);
    unlockAchievement(state.profiles[normalizedWallet], ACHIEVEMENTS.CABINET_PIONEER.id);
  } else if (options.handle) {
    state.profiles[normalizedWallet].handle = options.handle;
  }

  const profile = state.profiles[normalizedWallet];
  ensureAllGameProgress(profile);

  const loginEvent = {
    wallet: normalizedWallet,
    kind: 'wallet-login',
    systemRole: 'parent-arcade-account',
    occurredAt: nowIso(),
  };
  state.loginEvents ??= [];
  state.loginEvents.push(loginEvent);

  return {
    systemRole: 'parent-arcade-account',
    parentSystem: state.systemName || 'Lester\'s Arcade',
    profile,
    loginEvent,
  };
}

export function ensureProfile(state, wallet) {
  return connectPlayerAccount(state, wallet).profile;
}

export function startPlaySession({ wallet, gameId, mode = 'free' }) {
  const normalizedWallet = normalizeWallet(wallet);
  const game = getGame(gameId);

  if (!['free', 'paid'].includes(mode)) {
    throw new Error(`Unsupported play mode: ${mode}`);
  }

  if (game.status !== 'playable') {
    throw new Error(`${game.title} is not playable yet`);
  }

  const isPaid = mode === 'paid';
  const sequence = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    sessionId: `${gameId}-${mode}-${sequence}`,
    wallet: normalizedWallet,
    gameId,
    gameTitle: game.title,
    parentSystem: game.parentSystem,
    childDappRole: game.systemRole,
    mode,
    isPaid,
    leaderboardEligible: isPaid,
    lives: isPaid ? game.livesPaid : game.livesFree,
    entryFeeMicroUsdc: isPaid ? game.entryFeeMicroUsdc : 0,
    revenueSplit: isPaid ? calculateRevenueSplit(game.entryFeeMicroUsdc) : null,
    parentWriteScopes: isPaid ? [...LESTER_ARCADE_WALLET_RAILS.permissions.writeScopes] : [],
    startedAt: nowIso(),
  };
}

export function buildParentSyncPacket(session, { score = null, runStats = {}, unlockedAchievements = [] } = {}) {
  if (!session?.wallet || !session?.gameId) {
    throw new Error('session with wallet and gameId is required');
  }
  const game = getGame(session.gameId);
  const writeSets = session.leaderboardEligible
    ? ['profile progress', 'achievements', 'official scores', 'transaction receipts']
    : [];

  return Object.freeze({
    parentSystem: game.parentSystem,
    targetNetwork: LESTER_ARCADE_WALLET_RAILS.targetNetwork,
    network: Object.freeze({
      name: LITVM_LITEFORGE_NETWORK.name,
      chainId: LITVM_LITEFORGE_NETWORK.chainId,
      chainIdHex: LITVM_LITEFORGE_NETWORK.chainIdHex,
      nativeCurrency: { ...LITVM_LITEFORGE_NETWORK.nativeCurrency },
      rpcUrl: LITVM_LITEFORGE_NETWORK.rpcUrls.http,
      explorerUrl: LITVM_LITEFORGE_NETWORK.explorerUrl,
      faucetUrl: LITVM_LITEFORGE_NETWORK.faucetUrl,
    }),
    childGame: Object.freeze({
      id: game.id,
      title: game.title,
      role: game.systemRole,
    }),
    sessionId: session.sessionId,
    wallet: normalizeWallet(session.wallet),
    mode: session.mode,
    leaderboardEligible: Boolean(session.leaderboardEligible),
    writeSets,
    scoreClaim: Object.freeze({
      score,
      runStats: { ...runStats },
      unlockedAchievements: [...unlockedAchievements],
    }),
    transactionClaim: session.revenueSplit ? Object.freeze({
      kind: 'paid-session',
      amountMicroUsdc: session.entryFeeMicroUsdc,
      split: { ...session.revenueSplit },
    }) : null,
    verifier: Object.freeze({
      status: LESTER_ARCADE_WALLET_RAILS.verifier.currentStatus,
      nextStep: LESTER_ARCADE_WALLET_RAILS.verifier.nextStep,
    }),
  });
}

function maybeUnlockRunAchievements(profile, score, runStats = {}) {
  const unlockedAchievements = [];

  if (unlockAchievement(profile, ACHIEVEMENTS.FIRST_PAID_RUN.id)) {
    unlockedAchievements.push(ACHIEVEMENTS.FIRST_PAID_RUN.id);
  }

  for (const achievementId of resolveAchievementUnlocksForRun({
    score,
    elapsedSeconds: runStats.elapsedSeconds ?? 0,
    bossId: runStats.bossId,
    weaponId: runStats.weaponId,
    noDamage: runStats.noDamage,
    collectedPowerUps: runStats.collectedPowerUps ?? [],
  })) {
    if (unlockAchievement(profile, achievementId)) unlockedAchievements.push(achievementId);
  }

  return unlockedAchievements;
}

function updateProgressFromRun(progress, session, score, runStats = {}) {
  progress.lastSessionId = session.sessionId;
  progress.lastPlayedAt = nowIso();
  progress.longestRunSeconds = Math.max(progress.longestRunSeconds, runStats.elapsedSeconds ?? 0);
  progress.bestDistanceMeters = Math.max(progress.bestDistanceMeters, runStats.distanceMeters ?? 0);

  if (runStats.bossId && !progress.bossesDefeated.includes(runStats.bossId)) {
    progress.bossesDefeated.push(runStats.bossId);
  }

  if (session.leaderboardEligible) {
    progress.paidRuns += 1;
    progress.bestPaidScore = Math.max(progress.bestPaidScore, score);
  } else {
    progress.freeRuns += 1;
    progress.bestFreeScore = Math.max(progress.bestFreeScore, score);
  }
}

export function recordScore(state, session, score, runStats = {}) {
  if (!state || typeof state !== 'object') {
    throw new Error('state is required');
  }

  if (!session?.wallet || !session?.gameId) {
    throw new Error('session with wallet and gameId is required');
  }

  if (!Number.isInteger(score) || score < 0) {
    throw new Error('score must be a non-negative integer');
  }

  const profile = ensureProfile(state, session.wallet);
  const game = getGame(session.gameId);
  const progress = ensureGameProgress(profile, game.id);

  if (!session.leaderboardEligible) {
    const localScore = {
      wallet: profile.wallet,
      handle: profile.handle,
      gameId: game.id,
      gameTitle: game.title,
      score,
      mode: 'free',
      ephemeral: true,
      runStats: { ...runStats },
      recordedAt: nowIso(),
    };
    return {
      acceptedForGlobalLeaderboard: false,
      trackingDisabled: true,
      localScore,
      unlockedAchievements: [],
    };
  }

  updateProgressFromRun(progress, session, score, runStats);
  profile.totalPaidRuns += 1;
  profile.xp += Math.max(25, Math.floor(score / 20));
  const unlockedAchievements = maybeUnlockRunAchievements(profile, score, runStats);
  const parentSync = buildParentSyncPacket(session, { score, runStats, unlockedAchievements });
  updateRank(profile);

  const entry = {
    sessionId: session.sessionId,
    wallet: profile.wallet,
    handle: profile.handle,
    gameId: game.id,
    gameTitle: game.title,
    score,
    mode: 'paid',
    runStats: { ...runStats },
    recordedAt: nowIso(),
  };

  state.leaderboards[game.id] ??= [];
  state.leaderboards[game.id].push(entry);
  state.leaderboards[game.id].sort((a, b) => b.score - a.score || a.recordedAt.localeCompare(b.recordedAt));
  state.leaderboards[game.id] = state.leaderboards[game.id].slice(0, 10);

  if (session.revenueSplit) {
    const simulatedTxHash = stablePrototypeHash([session.sessionId, profile.wallet, game.id, score, session.entryFeeMicroUsdc]);
    const payment = {
      sessionId: session.sessionId,
      wallet: profile.wallet,
      gameId: game.id,
      kind: 'paid-session',
      amountMicroUsdc: session.entryFeeMicroUsdc,
      split: session.revenueSplit,
      network: `${LITVM_LITEFORGE_NETWORK.name} testnet simulation`,
      chainId: LITVM_LITEFORGE_NETWORK.chainId,
      chainIdHex: LITVM_LITEFORGE_NETWORK.chainIdHex,
      nativeCurrency: LITVM_LITEFORGE_NETWORK.nativeCurrency.symbol,
      explorerUrl: LITVM_LITEFORGE_NETWORK.explorerUrl,
      faucetUrl: LITVM_LITEFORGE_NETWORK.faucetUrl,
      simulatedTxHash,
      parentSync,
      recordedAt: nowIso(),
    };
    state.payments.push(payment);
    state.transactions ??= [];
    state.transactions.push(payment);
  }

  state.officialSessions ??= [];
  const officialSession = {
    sessionId: session.sessionId,
    wallet: profile.wallet,
    gameId: game.id,
    gameTitle: game.title,
    mode: session.mode,
    status: 'synced-to-parent',
    score,
    runStats: { ...runStats },
    parentSync,
    syncedAt: nowIso(),
  };
  state.officialSessions.push(officialSession);
  state.sessions ??= {};
  state.sessions[session.sessionId] = officialSession;

  return {
    acceptedForGlobalLeaderboard: true,
    leaderboardEntry: entry,
    unlockedAchievements,
    parentSync,
  };
}

function cloneProgress(progress) {
  return Object.fromEntries(Object.entries(progress).map(([gameId, entry]) => [
    gameId,
    {
      ...entry,
      bossesDefeated: [...entry.bossesDefeated],
      officialLeaderboardRank: null,
    },
  ]));
}

export function buildPlayerArcadeSnapshot(state, wallet) {
  const profile = ensureProfile(state, wallet);
  const progress = cloneProgress(profile.progress);
  const highScores = [];

  for (const [gameId, entries] of Object.entries(state.leaderboards)) {
    entries.forEach((entry, index) => {
      if (entry.wallet === profile.wallet) {
        progress[gameId].officialLeaderboardRank = index + 1;
        highScores.push({ ...entry, rank: index + 1 });
      }
    });
  }

  return {
    parentSystem: state.systemName || 'Lester\'s Arcade',
    systemRole: 'parent-arcade-account',
    profile: {
      wallet: profile.wallet,
      handle: profile.handle,
      avatar: profile.avatar,
      rank: profile.rank,
      xp: profile.xp,
      joinedAt: profile.joinedAt,
      totalPaidRuns: profile.totalPaidRuns,
      totalFreeRuns: profile.totalFreeRuns,
    },
    progress,
    achievements: Object.values(ACHIEVEMENTS).map((achievement) => ({
      ...achievement,
      unlocked: profile.achievements.includes(achievement.id),
    })),
    transactions: (state.transactions ?? [])
      .filter((transaction) => transaction.wallet === profile.wallet)
      .map((transaction) => ({ ...transaction, split: transaction.split ? { ...transaction.split } : null })),
    officialSessions: (state.officialSessions ?? [])
      .filter((session) => session.wallet === profile.wallet)
      .map((session) => ({
        ...session,
        runStats: { ...session.runStats },
        parentSync: session.parentSync ? {
          ...session.parentSync,
          writeSets: [...session.parentSync.writeSets],
          scoreClaim: {
            ...session.parentSync.scoreClaim,
            runStats: { ...session.parentSync.scoreClaim.runStats },
            unlockedAchievements: [...session.parentSync.scoreClaim.unlockedAchievements],
          },
          transactionClaim: session.parentSync.transactionClaim ? {
            ...session.parentSync.transactionClaim,
            split: { ...session.parentSync.transactionClaim.split },
          } : null,
        } : null,
      })),
    highScores,
    loginEvents: (state.loginEvents ?? []).filter((event) => event.wallet === profile.wallet),
  };
}

export function getLesterBlasterDifficultyAt(elapsedSeconds) {
  const seconds = Math.max(0, Number(elapsedSeconds) || 0);
  const minutes = seconds / 60;
  const tier = Math.min(10, 1 + Math.floor(minutes / 2.5));
  const enemyAiLevel = Math.min(10, 1 + Math.floor(minutes / 2));
  const playerHealthMultiplier = Math.max(0.35, 1 - minutes * 0.035);
  const powerUpScarcity = Math.min(0.8, minutes * 0.04);
  const bonusLifeChance = Math.max(0.02, 0.18 - minutes * 0.008);
  const bossFrequencyMultiplier = 1 + Math.min(2.5, minutes / 8);

  return {
    elapsedSeconds: seconds,
    tier,
    enemyAiLevel,
    playerHealthMultiplier,
    powerUpScarcity,
    bonusLifeChance,
    bossFrequencyMultiplier,
    enemySpawnMultiplier: 1 + minutes / 6,
    enemyProjectileSpeedMultiplier: 1 + minutes / 10,
  };
}

export function scheduleBossEncounter({ elapsedSeconds, seed = 0 } = {}) {
  const seconds = Math.max(0, Number(elapsedSeconds) || 0);
  const minSeconds = LESTER_BLASTER_GAMEPLAY.bossIntervalMinutes[0] * 60;
  const maxSeconds = LESTER_BLASTER_GAMEPLAY.bossIntervalMinutes[1] * 60;
  const interval = 4 * 60;
  const windowIndex = Math.max(0, Math.floor(seconds / interval));
  const timeSinceLastWindow = seconds % interval;
  const shouldSpawn = seconds >= minSeconds && timeSinceLastWindow <= 75;
  const bossIndex = Math.abs(Math.floor(seed) + windowIndex) % LESTER_BLASTER_GAMEPLAY.bossRoster.length;

  return {
    shouldSpawn,
    boss: shouldSpawn ? LESTER_BLASTER_GAMEPLAY.bossRoster[bossIndex] : null,
    window: [minSeconds, maxSeconds],
    nextCheckSeconds: (windowIndex + 1) * interval,
  };
}

export function formatMicroUsdc(amountMicroUsdc) {
  return `$${(amountMicroUsdc / 1_000_000).toFixed(2)}`;
}

export function calculateLesterBlasterScore({
  elapsedSeconds = 0,
  kills = 0,
  bossesDefeated = 0,
  maxKillCombo = 0,
  maxDamageCombo = 0,
  noDamageSeconds = 0,
  powerUpsCollected = 0,
  weaponUpgrades = [],
  rareWeaponId = null,
  distanceMeters = null,
  coinsCollected = 0,
  difficultyTier = null,
} = {}) {
  const safeElapsed = Math.max(0, Math.floor(elapsedSeconds));
  const safeKills = Math.max(0, Math.floor(kills));
  const inferredDistance = distanceMeters ?? Math.round(safeElapsed * 2.7);
  const difficulty = getLesterBlasterDifficultyAt(safeElapsed);
  const tier = difficultyTier ?? difficulty.tier;
  const rareWeaponBonus = rareWeaponId ? 750 : 0;
  const uniqueUpgrades = new Set(weaponUpgrades);

  const breakdown = {
    survival: safeElapsed * 8,
    distance: Math.max(0, Math.floor(inferredDistance)) * 2,
    kills: safeKills * 95,
    bosses: Math.max(0, bossesDefeated) * 1500,
    combo: Math.max(0, maxKillCombo) * 85 + Math.max(0, maxDamageCombo) * 3 + Math.max(0, noDamageSeconds) * 4,
    powerUps: Math.max(0, powerUpsCollected) * 175,
    upgrades: uniqueUpgrades.size * 325 + rareWeaponBonus,
    coins: Math.max(0, coinsCollected) * 15,
    difficulty: tier * 120,
  };

  const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
  return { total, breakdown };
}

export function simulateLesterBlasterRun({ mode, entropy = Date.now(), elapsedSeconds = 300, kills = null, bossId = null, weaponId = 'coin-blaster', scoreMultiplier = 1 } = {}) {
  const difficulty = getLesterBlasterDifficultyAt(elapsedSeconds);
  const modeBonus = mode === 'paid' ? 350 : 75;
  const base = 600 + (Math.abs(Math.floor(entropy)) % 900);
  const coinBonus = (Math.abs(Math.floor(entropy / 7)) % 25) * 25;
  const resolvedKills = kills ?? (Math.abs(Math.floor(entropy / 11)) % 12);
  const enemyBonus = resolvedKills * 40;
  const survivalBonus = Math.floor(elapsedSeconds * 2.2);
  const difficultyBonus = difficulty.tier * 90;
  const bossBonus = bossId ? 1000 + difficulty.tier * 120 : 0;
  const weaponBonus = weaponId === 'hash-rail' ? 180 : weaponId === 'spread-ltc' ? 125 : 0;

  return Math.floor((base + coinBonus + enemyBonus + survivalBonus + difficultyBonus + bossBonus + weaponBonus + modeBonus) * scoreMultiplier);
}
