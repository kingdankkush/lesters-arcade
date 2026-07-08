import { HMH_HD_SPRITE_ATLAS_MANIFEST } from '../assets/generated/hmh-hd-sprite-atlas.mjs';
import { HMH_EXPANDED_PIXEL_PACK_MANIFEST } from '../assets/generated/hmh-expanded-pixel-pack.mjs';
import { HMH_ACHIEVEMENT_ATLAS } from '../assets/generated/hmh-achievement-atlas/hmh-achievement-atlas-manifest.mjs';
import { HMH_ENVIRONMENT_ASSET_MANIFEST } from '../assets/hard-money-heroes/environment/hmh-environment-manifest.mjs';
import { HMH_CABINET_SPRITE_MANIFEST } from '../assets/hard-money-heroes/cabinet/hmh-cabinet-sprite-manifest.mjs';
import { LESTER_ARCADE_PLAYLIST_MANIFEST } from './arcade-playlist-manifest.mjs';
import { SITE_VERSION, GAME_VERSION } from './version-tracking.mjs';
import {
  LEADERBOARD_CADENCES,
  recordCadenceScore,
  getLeaderboard,
  getAllCadenceLeaderboards,
} from './leaderboard-engine.mjs';
import {
  setPlayerUsername,
  resolveDisplayName,
  validateUsername,
  isUsernameAvailable,
} from './username-registry.mjs';
import {
  WEAPON_UPGRADE_TREES,
  computeWeaponUpgrades,
  reloadProgress,
  effectiveReloadSeconds,
  hasSpecial,
  validateWeaponUpgrades,
} from './weapon-upgrades.mjs';
import {
  HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG,
  HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES,
  syncConfiguredCharacterUnlocks,
  resolveSelectedCharacterId,
} from './hmh-character-config.mjs';
import { HMH_COPY_SHEET } from './hmh-copy-sheet.mjs';
import { normalizeProfileIdentity } from './hmh-profile-parity.mjs';
import { createSeededSubstreams } from './seeded-rng.mjs';
import { gameSlugFor } from './arcade-router.mjs';

export {
  LEADERBOARD_CADENCES,
  getLeaderboard,
  getAllCadenceLeaderboards,
  validateUsername,
  isUsernameAvailable,
  resolveDisplayName,
  // Weapon upgrade tree API — surfaces the pure upgrade system to callers.
  WEAPON_UPGRADE_TREES,
  computeWeaponUpgrades,
  reloadProgress,
  effectiveReloadSeconds,
  hasSpecial,
  validateWeaponUpgrades,
};
export const HARD_MONEY_HEROES_ENVIRONMENT_MANIFEST = HMH_ENVIRONMENT_ASSET_MANIFEST;
export const HARD_MONEY_HEROES_EXPANDED_PIXEL_PACK_MANIFEST = HMH_EXPANDED_PIXEL_PACK_MANIFEST;

export const DEFAULT_ENTRY_FEE_MICRO_USDC = 0; // Ranked is free on testnet — only zkLTC gas for settlement

// Ranked $0.25 fee split. Cost-first intent: a settlement reserve covers the
// on-chain gas to write the player's score/achievements/username; the dev bucket
// is the biggest share and funds future game development, community building, and
// more. Any settlement-reserve gas left unused rolls into the dev bucket (see
// calculateRevenueSplit -> settlementRemainderToDev). Must total 10,000 bps.
export const DEFAULT_REVENUE_SPLIT_BPS = Object.freeze({
  settlement: 1500,  // 15% reserved for on-chain settlement gas (zkLTC)
  dev: 5500,         // 55% -> dev wallet (biggest share)
  tournament: 1800,  // 18% -> tournament prize pools
  community: 1200,   // 12% -> community building
});

// Dev wallet that receives the dev share + unused settlement-gas remainder.
// Placeholder until Justin provides his real address; settlement stays simulated
// (SETTLEMENT_LIVE=false) so no funds move until deploy + approval.
export const DEV_WALLET = Object.freeze({
  address: '0x07cec6Fc49CAf6528F2f2F796042629cd3f48B26',
  label: "Justin's Revenue Wallet",
  purpose: 'Receives all Lester\'s Arcade profit share (dev share of Ranked fees + unused settlement-gas remainder). For third-party games, receives 25% of revenue with 75% going to the creator.',
  receives: Object.freeze(['dev share of every Ranked fee', 'unused settlement-gas remainder', '25% of third-party game revenue']),
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
    Object.freeze({ id: 'lit-commando', title: 'Lit Commando', playable: true, personality: 'stubborn, brave, goofy-gritty arcade tough guy; says little, solves scams with steel and gunfire', role: 'starter playable Hard Money Hero' }),
    Object.freeze({ id: 'lit-valkyrie', title: 'Lit Valkyrie', playable: true, personality: 'sharp, quick, fearless skirmisher; darts through the panic and punishes mistakes', role: 'starter playable Hard Money Hero' }),
    Object.freeze({ id: 'lester-original', title: 'Lester', playable: 'unlockable-level-1-clear', personality: 'Rambo-like arcade commando: stubborn, brave, over-the-top, one-liners implied, walks against the panic.', role: 'unlockable playable Hard Money Hero' }),
    Object.freeze({ id: 'lilly', title: 'Lilly', playable: 'unlockable-10-ranked-matches', personality: 'teal-haired tactical companion with agile veteran energy and distinct weapon silhouettes.', role: 'unlockable playable Hard Money Hero' }),
  ]),
  levels: Object.freeze([
    Object.freeze({
      id: 'the-slums',
      title: 'Level 1 — Crypto Wasteland',
      route: 'Desert Approach → Ghost Town → Crossroads → City Threshold',
      boss: 'The Rug Pull Baron',
      visualShift: 'sun-bleached roads, ghost-town ruins, dry forests, and oasis breaks gradually frame Litecoin City on the horizon',
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
    Object.freeze({ file: './assets/reference/lester-reference-sprites-01.png', purpose: 'repo-local Lester reference for future production sprite pass' }),
    Object.freeze({ file: './assets/reference/lester-reference-sprites-02.png', purpose: 'repo-local Lester reference for future production sprite pass' }),
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
    writeScopes: Object.freeze(['ranked testnet sessions', 'profile progress', 'achievements', 'official scores', 'transaction receipts']),
    freeModeRule: 'free practice never writes progress, achievements, scores, or transactions to the parent account',
    paidModeRule: 'ranked testnet runs create a parent-sync packet for progress, achievements, leaderboard, and receipt state',
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
    Object.freeze({ id: 'coin', symbol: '◉', label: 'Ranked credit', usage: 'ranked testnet session and score eligibility' }),
    Object.freeze({ id: 'trophy', symbol: '★', label: 'Official leaderboard', usage: 'ranked high-score tracking' }),
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
    Object.freeze({ id: 'choose-mode', title: 'Pick Free or Ranked', copy: 'Free is local practice. Ranked is an official testnet score write that waits for game over submission.', icon: 'coin' }),
    Object.freeze({ id: 'start-combat', title: 'Start Combat', copy: 'Launch the 60fps Canvas test and practice movement, shooting, Litecoin Blade attacks, throwables, and pickups.', icon: 'weapon' }),
    Object.freeze({ id: 'survive-score', title: 'Survive + Score', copy: 'Survival time, kills, combos, bosses, power-ups, and rare weapons all feed score.', icon: 'trophy' }),
    Object.freeze({ id: 'sync-results', title: 'Sync Run', copy: 'Finish a run summary, then write progress back to the parent account model when the player submits.', icon: 'trophy' }),
  ]),
  instructions: Object.freeze([
    Object.freeze({ title: 'Survive as long as possible', body: 'Level 1 and 2 introduce mechanics; Level 3 becomes an infinite escalation run.' }),
    Object.freeze({ title: 'Keep the combo alive', body: 'Damage chains and kills without taking damage grow your score faster.' }),
    Object.freeze({ title: 'Save the grenade for swarms', body: 'The grenade is your one manual weapon: a wide blast that clears packed waves. Right click (or the NADE button on mobile) when enemies bunch up.' }),
    Object.freeze({ title: 'Save rare weapons for bosses', body: 'The Hashstorm suppresses waves; rare charged weapons are intended for armor, boss phases, and clutch survival moments.' }),
    Object.freeze({ title: 'Watch for arena locks', body: 'Mini-boss and boss rooms pause forward progression until the threat is defeated; use cover and vertical space before pushing right again.' }),
  ]),
  tooltips: Object.freeze([
    Object.freeze({ anchor: 'connectWalletButton', title: 'Wallet login', copy: 'Tries MetaMask/Rabby first, requests LitVM LiteForge if needed, then falls back to a local mock wallet. No funds or live game transaction.' }),
    Object.freeze({ anchor: 'freePlayButton', title: 'Free play', copy: 'Practice for free with no official tracking: no progress, achievements, high scores, or transactions.' }),
    Object.freeze({ anchor: 'paidPlayButton', title: 'Play Ranked', copy: 'Publishes your score, achievements, and name on-chain to LitVM as a permanent run record. On testnet the only cost is the zkLTC gas to write it — free from the faucet, no real funds.' }),
    Object.freeze({ anchor: 'simulateRunButton', title: 'Sync sample result', copy: 'Completes a generated run summary and writes progress back to the parent account model.' }),
    Object.freeze({ anchor: 'startCombatButton', title: 'Start 60fps practice', copy: 'Starts the Canvas run loop. Target: 60fps, smooth controls, pixel-snapped sprites.' }),
    Object.freeze({ anchor: 'jumpButton', title: 'Jump / double jump', copy: 'Keyboard: Space. Use double jump to reach vertical platforms and dodge boss sweeps.' }),
    Object.freeze({ anchor: 'shootButton', title: 'Shoot', copy: 'Mouse: Left Click. Fire your current gun; pickups can swap blaster, shotgun, auto, rail, or rare super weapon.' }),
    Object.freeze({ anchor: 'grenadeButton', title: 'Grenade', copy: 'Desktop: Right Click or F. Mobile: NADE button. Wide-area Crypto Bomb blast — scarce, replenished by map pickups.' }),
    Object.freeze({ anchor: 'powerUpButton', title: 'Drop power-up', copy: 'Practice helper for testing health, shield, ammo, +1up, score multiplier, and weapon pickups.' }),
    Object.freeze({ anchor: 'combatCanvas', title: 'Gameplay viewport', copy: 'Isometric roguelite arena with authored POIs, swarms, boss beats, and extraction pressure.' }),
    Object.freeze({ anchor: 'leaderboardPanel', title: 'Official board', copy: 'Only Ranked Testnet runs can submit official leaderboard state.' }),
  ]),
  controls: Object.freeze({
    keyboard: Object.freeze([
      Object.freeze({ action: 'Move Left', key: 'A / ArrowLeft', tip: 'Tap or hold to dodge while the camera scrolls right.' }),
      Object.freeze({ action: 'Move Right', key: 'D / ArrowRight', tip: 'Advance toward pickups and boss arenas.' }),
      Object.freeze({ action: 'Crouch', key: 'Control / S / ArrowDown', tip: 'Duck behind cover and lower your hitbox under slower enemy fire.' }),
      Object.freeze({ action: 'Jump', key: 'Space', tip: 'Press twice for double jump and vertical lanes.' }),
      Object.freeze({ action: 'Shoot', key: 'Left Click', tip: 'Core ranged attack; maintain fire for combos.' }),
      Object.freeze({ action: 'Grenade', key: 'Right Click / F', tip: 'Crypto Bomb area burst for swarms and boss phases.' }),
      Object.freeze({ action: 'Reload', key: 'R', tip: 'Reload limited-ammo pickups.' }),
    ]),
    gamepad: Object.freeze([
      Object.freeze({ action: 'Move', key: 'D-pad / Left Stick', tip: 'Arcade baseline movement.' }),
      Object.freeze({ action: 'Jump', key: 'A', tip: 'Jump and double jump.' }),
      Object.freeze({ action: 'Shoot', key: 'X / RT', tip: 'Primary fire.' }),
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
    Object.freeze({ id: 'return-to-arcade', label: 'Exit to Lester’s Arcade', target: 'cabinet-select', copy: 'No hidden ranked submit occurs when a player exits back to Lester’s Arcade.' }),
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
    Object.freeze({ id: 'settings', label: 'Settings', purpose: 'Controls, audio, accessibility, network status, and sign-out.' }),
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
      description: 'The first playable Lester arcade cabinet: isometric roguelite score survival on LitVM LiteForge.',
      desktopCabinetSprite: HMH_CABINET_SPRITE_MANIFEST,
    }),
    Object.freeze({
      id: 'chikun',
      gameId: 'chikun',
      title: "Chikun's Escape",
      status: 'coming-soon',
      playable: false,
      devPlayable: true,
      description: "In development by Louie / LitVM Port Team. Chikun's Escape is being integrated behind the dev cabinet harness and is not publicly playable yet.",
      desktopCabinetSprite: Object.freeze({
        id: 'chikun-cabinet',
        frameDurationMs: 600,
        frames: Object.freeze([
          Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-front.png?v=transparent-v2', durationMs: 600 }),
          Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-front-right.png?v=transparent-v2', durationMs: 600 }),
          Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-right.png?v=transparent-v2', durationMs: 600 }),
          Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-back.png?v=transparent-v2', durationMs: 600 }),
          Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-left.png?v=transparent-v2', durationMs: 600 }),
          Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-front-right-low.png?v=transparent-v2', durationMs: 600 }),
        ]),
      }),
    }),
    Object.freeze({ id: 'mweb-invaders', gameId: 'mweb-invaders', title: 'MWEB Invaders', status: 'coming-soon', playable: false, description: 'Descending rows of privacy-shattering aliens — shield your Lit wallet!', bannerArt: './assets/generated/hmh-banners/mweb-invaders-keyart.jpg' }),
    Object.freeze({ id: 'litvm-legends', gameId: 'litvm-legends', title: 'LitVM Legends', status: 'coming-soon', playable: false, description: 'Co-op dungeon crawl through endless LitVM realms (but its actually LTC).', bannerArt: './assets/generated/hmh-banners/litvm-legends-keyart.jpg' }),
  ]),
  modeSelect: Object.freeze({
    free: Object.freeze({ label: HMH_COPY_SHEET.modeSelect.free.label, official: false, copy: HMH_COPY_SHEET.modeSelect.free.copy }),
    ranked: Object.freeze({ label: HMH_COPY_SHEET.modeSelect.ranked.label, official: true, requiresZkLtc: true, chainId: 4441, token: 'zkLTC', faucetUrl: LITVM_LITEFORGE_NETWORK.faucetUrl, copy: HMH_COPY_SHEET.modeSelect.ranked.copy }),
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
    title: HMH_COPY_SHEET.levelIntro.title,
    durationSeconds: 8,
    hasBeginButton: true,
    controlsSummary: HMH_COPY_SHEET.levelIntro.controlsSummary,
    goalCopy: HMH_COPY_SHEET.levelIntro.goalCopy,
  }),
  profileRules: Object.freeze({
    walletIsPrimaryKey: true,
    walletLockCopy: 'Progress, high scores, achievements, uploads, and ranked testnet submissions are assigned to the connected wallet. Sign out to use a different wallet.',
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
    throwable: 'Right Click / F',
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

const freezeRank = (rank) => Object.freeze({ ...rank });

const rankStats = (stat, deltas) => Object.freeze(deltas.map((statDelta, index) => freezeRank({ rank: index + 1, stat, statDelta })));

const roguelikeSkill = ({
  id,
  title,
  stat = null,
  category,
  description,
  maxRank = 4,
  ranks = null,
  gate = null,
  kind = 'stat',
  grenadeType = null,
  rarity = 'common',
  presentation = null,
  evolutionId = null,
  payoff = null,
}) => {
  const frozenRanks = Object.freeze((ranks ?? rankStats(stat, Array.from({ length: maxRank }, () => 5))).map(freezeRank));
  const safeMaxRank = frozenRanks.length;
  return Object.freeze({
    id,
    title,
    stat,
    category,
    kind,
    maxRank: safeMaxRank,
    maxLevel: safeMaxRank,
    perLevelPercent: frozenRanks[0]?.statDelta ?? 0,
    ranks: frozenRanks,
    gate: gate ? Object.freeze({
      ...gate,
      requires: Object.freeze((gate.requires ?? []).map((req) => Object.freeze({ ...req }))),
    }) : null,
    grenadeType,
    rarity,
    presentation: Object.freeze({ tone: rarity === 'golden' ? 'gold' : 'cyan', label: rarity.toUpperCase(), ...(presentation ?? {}) }),
    evolutionId,
    payoff: payoff ? Object.freeze({ ...payoff }) : null,
    availableFromCampaignLevel: 1,
    description,
  });
};

const unlockSkill = ({ id, title, category = 'throwable', description, gate, grenadeType = null, statDelta = null, stat = null }) => roguelikeSkill({
  id,
  title,
  stat,
  category,
  description,
  maxRank: 1,
  kind: 'unlock',
  grenadeType,
  gate,
  ranks: Object.freeze([freezeRank({ rank: 1, stat, statDelta, unlock: true, grenadeType })]),
});

export const HMH_WEAPON_EVOLUTION_LIBRARY = Object.freeze([
  Object.freeze({
    id: 'evolve-settler-rail',
    evolutionId: 'settler-rail',
    title: 'Settler Rail Dividend',
    weaponId: 'coin-blaster',
    requires: Object.freeze([{ skillId: 'damage-alpha', rank: 5 }, { skillId: 'pierce', rank: 4 }, { skillId: 'rate-of-fire', rank: 3 }]),
    payoff: Object.freeze({ scoreMultiplier: 1.35, projectileTag: 'rail-dividend', banner: 'EVOLUTION // SETTLER RAIL' }),
    counterFantasy: 'Coin Blaster shots become clean Litecoin rail payouts that punch through elite packs.',
  }),
  Object.freeze({
    id: 'evolve-hashstorm-overdrive',
    evolutionId: 'hashstorm-overdrive',
    title: 'Hashstorm Overdrive',
    weaponId: 'auto-miner',
    requires: Object.freeze([{ skillId: 'rate-of-fire', rank: 5 }, { skillId: 'magazine-size', rank: 4 }, { skillId: 'reload-hands', rank: 3 }]),
    payoff: Object.freeze({ scoreMultiplier: 1.3, projectileTag: 'overdrive-barrage', banner: 'EVOLUTION // HASHSTORM' }),
    counterFantasy: 'Auto fire becomes a readable max-build spray moment without hiding enemy tells.',
  }),
  Object.freeze({
    id: 'evolve-crit-candle',
    evolutionId: 'crit-candle',
    title: 'Golden Crit Candle',
    weaponId: 'hash-rail',
    requires: Object.freeze([{ skillId: 'critical-chance', rank: 4 }, { skillId: 'critical-damage', rank: 4 }, { skillId: 'projectile-speed', rank: 3 }]),
    payoff: Object.freeze({ scoreMultiplier: 1.4, projectileTag: 'gold-crit', banner: 'EVOLUTION // CRIT CANDLE' }),
    counterFantasy: 'Rail hits flash gold on crit chains and create a visible score spike.',
  }),
  Object.freeze({
    id: 'evolve-crypto-bomb-orbit',
    evolutionId: 'crypto-bomb-orbit',
    title: 'Crypto Bomb Orbit',
    weaponId: 'crypto-bombs',
    requires: Object.freeze([{ skillId: 'grenade-damage', rank: 4 }, { skillId: 'grenade-radius', rank: 4 }, { skillId: 'grenade-capacity', rank: 4 }]),
    payoff: Object.freeze({ scoreMultiplier: 1.25, projectileTag: 'orbit-bomb', banner: 'EVOLUTION // BOMB ORBIT' }),
    counterFantasy: 'Grenade builds graduate into orbiting bomb protection for one-more-run survival.',
  }),
]);

const evolutionSkill = (evolution) => roguelikeSkill({
  id: evolution.id,
  title: evolution.title,
  category: 'weapon-evolution',
  description: evolution.counterFantasy,
  maxRank: 1,
  kind: 'evolution',
  rarity: 'golden',
  evolutionId: evolution.evolutionId,
  gate: { playerLevel: 18, requires: evolution.requires },
  payoff: evolution.payoff,
  ranks: Object.freeze([freezeRank({ rank: 1, unlock: true, evolutionId: evolution.evolutionId, stat: 'weaponEvolution', statDelta: 1 })]),
  presentation: { tone: 'gold', label: 'GOLDEN EVOLUTION', icon: '★', banner: evolution.payoff.banner },
});

export const LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY = Object.freeze([
  roguelikeSkill({ id: 'damage-alpha', title: 'Damage Alpha', stat: 'damage', category: 'damage', maxRank: 5, ranks: rankStats('damage', [10, 8, 7, 6, 5]), description: 'Weapon damage rises with diminishing returns.' }),
  roguelikeSkill({ id: 'reload-hands', title: 'Reload Hands', stat: 'reloadSpeed', category: 'reload-speed', maxRank: 4, ranks: rankStats('reloadSpeed', [10, 8, 6, 5]), description: 'Reload faster without changing weapon identity.' }),
  roguelikeSkill({ id: 'move-speed', title: 'Street Runner', stat: 'movementSpeed', category: 'movement-speed', maxRank: 4, ranks: rankStats('movementSpeed', [8, 6, 5, 4]), description: 'Base movement upgrade, the escape valve for the speed law.' }),
  roguelikeSkill({ id: 'magazine-size', title: 'Deep Mags', stat: 'magazineSize', category: 'magazine-size', maxRank: 4, ranks: rankStats('magazineSize', [14, 11, 9, 7]), description: 'More shots before reload pressure hits.' }),
  roguelikeSkill({ id: 'rate-of-fire', title: 'Hashrate Fire', stat: 'rateOfFire', category: 'fire-rate', maxRank: 5, ranks: rankStats('rateOfFire', [9, 8, 6, 5, 4]), description: 'Fire faster with controlled late-rank returns.' }),
  roguelikeSkill({ id: 'pickup-radius', title: 'Magnet Wallet', stat: 'pickupRadius', category: 'pickup-magnet', maxRank: 4, ranks: rankStats('pickupRadius', [20, 15, 12, 9]), description: 'Pull XP and coins from a wider safe route.' }),
  roguelikeSkill({ id: 'max-health', title: 'Cold Storage', stat: 'maxHealth', category: 'max-hp', maxRank: 4, ranks: rankStats('maxHealth', [18, 14, 11, 8]), description: 'Increase max HP for longer survival.' }),
  roguelikeSkill({ id: 'critical-chance', title: 'Crit Candle', stat: 'criticalChance', category: 'crit-chance', maxRank: 4, ranks: rankStats('criticalChance', [6, 5, 4, 3]), description: 'Add critical-hit chance.' }),

  roguelikeSkill({ id: 'critical-damage', title: 'Crit Multiplier', stat: 'criticalDamage', category: 'crit-damage', maxRank: 4, gate: { playerLevel: 5, requires: [{ skillId: 'critical-chance', rank: 1 }] }, ranks: rankStats('criticalDamage', [18, 14, 11, 8]), description: 'Critical hits pay harder once crits exist.' }),
  roguelikeSkill({ id: 'projectile-speed', title: 'Tracer Velocity', stat: 'bulletSpeed', category: 'projectile-speed', maxRank: 4, gate: { playerLevel: 5 }, ranks: rankStats('bulletSpeed', [12, 9, 7, 5]), description: 'Shots cross lanes faster.' }),
  roguelikeSkill({ id: 'pierce', title: 'Piercing Ledger', stat: 'pierce', category: 'pierce', maxRank: 4, gate: { playerLevel: 5, requires: [{ skillId: 'damage-alpha', rank: 1 }] }, ranks: rankStats('pierce', [1, 1, 1, 1]), description: 'Bullets punch through more bodies.' }),
  roguelikeSkill({ id: 'spread-control', title: 'Spread Control', stat: 'spreadControl', category: 'spread-control', maxRank: 4, gate: { playerLevel: 5 }, ranks: rankStats('spreadControl', [12, 9, 7, 5]), description: 'Tighten wide weapons and make aim matter.' }),
  roguelikeSkill({ id: 'grenade-capacity', title: 'Nade Pockets', stat: 'grenadeCapacity', category: 'grenade-capacity', maxRank: 4, gate: { playerLevel: 5 }, ranks: rankStats('grenadeCapacity', [1, 1, 1, 1]), description: 'Raise grenade carry cap.' }),
  roguelikeSkill({ id: 'armor', title: 'Cold Armor', stat: 'armor', category: 'armor', maxRank: 4, gate: { playerLevel: 5 }, ranks: rankStats('armor', [7, 6, 5, 4]), description: 'Reduce incoming damage.' }),

  roguelikeSkill({ id: 'grenade-damage', title: 'Frag Yield', stat: 'grenadeDamage', category: 'grenade-damage', maxRank: 4, gate: { playerLevel: 10, requires: [{ skillId: 'grenade-capacity', rank: 1 }] }, ranks: rankStats('grenadeDamage', [16, 13, 10, 8]), description: 'Grenades hit harder.' }),
  roguelikeSkill({ id: 'grenade-radius', title: 'Blast Radius', stat: 'grenadeRadius', category: 'grenade-radius', maxRank: 4, gate: { playerLevel: 10, requires: [{ skillId: 'grenade-capacity', rank: 1 }] }, ranks: rankStats('grenadeRadius', [14, 11, 9, 7]), description: 'Grenade blasts cover more tiles.' }),
  roguelikeSkill({ id: 'xp-gain', title: 'Wisdom Candles', stat: 'xpGain', category: 'xp-gain', maxRank: 4, gate: { playerLevel: 10 }, ranks: rankStats('xpGain', [12, 9, 7, 5]), description: 'Earn XP faster without adding extra picks.' }),
  roguelikeSkill({ id: 'power-up-luck', title: 'Green Luck', stat: 'luck', category: 'power-up-luck', maxRank: 4, gate: { playerLevel: 10 }, ranks: rankStats('luck', [10, 8, 6, 5]), description: 'Shift drop rarity weights without increasing volume.' }),
  roguelikeSkill({ id: 'dash-cooldown', title: 'Dash Clock', stat: 'dashCooldown', category: 'dash-cooldown', maxRank: 4, gate: { playerLevel: 10 }, ranks: rankStats('dashCooldown', [10, 8, 6, 5]), description: 'Recover dash sooner.' }),
  unlockSkill({ id: 'launcher-rig', title: 'Launcher Rig', grenadeType: 'launcher-rig', description: 'Switch grenades to a longer, flatter, faster launcher arc.', gate: { playerLevel: 10 } }),

  roguelikeSkill({ id: 'dash-distance', title: 'Gap Runner', stat: 'dashDistance', category: 'dash-distance', maxRank: 4, gate: { playerLevel: 15, requires: [{ skillId: 'dash-cooldown', rank: 2 }] }, ranks: rankStats('dashDistance', [12, 9, 7, 5]), description: 'Dash farther through authored routes.' }),
  roguelikeSkill({ id: 'health-regen', title: 'Self Custody', stat: 'healthRegen', category: 'hp-regen', maxRank: 4, gate: { playerLevel: 15, requires: [{ skillId: 'max-health', rank: 2 }] }, ranks: rankStats('healthRegen', [0.35, 0.28, 0.22, 0.18]), description: 'Regenerate small HP amounts during long kites.' }),
  roguelikeSkill({ id: 'coin-value', title: 'Hard Money', stat: 'scoreMultiplier', category: 'coin-value', maxRank: 4, gate: { playerLevel: 15 }, ranks: rankStats('scoreMultiplier', [12, 9, 7, 5]), description: 'Coins and score caches pay more.' }),
  roguelikeSkill({ id: 'combo-retention', title: 'Diamond Combo', stat: 'comboRetention', category: 'combo-retention', maxRank: 4, gate: { playerLevel: 15 }, ranks: rankStats('comboRetention', [18, 14, 11, 8]), description: 'Combo drops more slowly under pressure.' }),
  unlockSkill({ id: 'homing-cluster', title: 'Homing Cluster', grenadeType: 'homing-cluster', description: 'Switch grenades to seek the largest enemy cluster.', gate: { playerLevel: 15, requires: [{ skillId: 'grenade-damage', rank: 2 }] } }),
  unlockSkill({ id: 'block-buster', title: 'Block Buster', grenadeType: 'block-buster', description: 'Switch grenades to a huge heavy blast with lower carry cap.', gate: { playerLevel: 15, requires: [{ skillId: 'grenade-radius', rank: 2 }] } }),

  ...HMH_WEAPON_EVOLUTION_LIBRARY.map(evolutionSkill),

  unlockSkill({ id: 'revive', title: 'Second Wallet', category: 'defense', stat: 'revive', statDelta: 1, description: 'Survive one killing blow when the late run turns ugly.', gate: { playerLevel: 20, requires: [{ skillId: 'max-health', rank: 3 }, { skillId: 'armor', rank: 2 }] } }),
]);

export const LESTER_BLASTER_ISOMETRIC_ROGUELIKE = Object.freeze({
  genre: 'isometric-run-and-gun-roguelike',
  camera: Object.freeze({
    projection: 'isometric',
    tileWidth: 64,
    tileHeight: 32,
    screenCenter: Object.freeze({ x: 380, y: 164 }),
    followMode: 'free-roam-map-centered-on-player',
  }),
  movement: Object.freeze({
    model: '8-way-directional-free-roam',
    directions: Object.freeze(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']),
    keyboard: 'WASD / arrows normalize diagonals to preserve speed',
    gamepad: 'left-stick analog movement with right-stick/aim support later',
  }),
  combat: Object.freeze({
    aimModel: 'mouse-directional-run-and-gun',
    projectileSpace: 'world-x-y converted through isometric projection at render time',
    enemyBehaviors: Object.freeze(['chase-player', 'circle-strafe', 'ranged-fire', 'elite-pressure', 'boss-patterns']),
  }),
  mapGeneration: Object.freeze({
    procedural: true,
    tilesetPerspective: 'isometric',
    chunkSizeTiles: 16,
    tileAssetNeeds: Object.freeze(['isometric-ground', 'isometric-road', 'isometric-curb', 'isometric-building-base', 'isometric-collision-mask']),
    reusable2dProps: Object.freeze(['buildings', 'trees', 'garbage-cans', 'street-props', 'signs', 'cars', 'crates']),
  }),
  runPacing: Object.freeze({
    mode: 'open-ended-survival',
    eliteBandMinutes: Object.freeze([20, 25]),
    pressureFantasy: 'Vampire-Survivors-style escalating enemy density with Hard Money Heroes guns, bosses, and wallet-safe score runs.',
    pressureCurveMinutes: Object.freeze([0, 5, 10, 15, 20, 25, 30]),
  }),
  xp: Object.freeze({
    source: 'enemy-kills-drop-xp-gems',
    baseXpPerKill: 6,
    curve: 'open-ended survival uses a slower 150+ XP curve so upgrades pace across long runs instead of chaining several level-ups from one pack',
  }),
  levelUp: Object.freeze({
    pausesGame: true,
    choicesPerLevel: 2,
    rerollsPerLevel: 1,
    skills: LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.length,
    totalRanks: LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.reduce((sum, skill) => sum + skill.maxRank, 0),
    levelsPerSkill: [3, 5],
    statStepPercent: 'per-rank-data',
  }),
  modeBoundary: Object.freeze({
    freeWritesOfficialState: false,
    rankedRequiresExplicitSubmit: true,
  }),
});

function skillRequirementProgress(run, requirements = []) {
  const items = requirements.map((req) => {
    const current = run?.skills?.[req.skillId] ?? 0;
    return Object.freeze({ ...req, current, complete: current >= req.rank });
  });
  const complete = items.filter((item) => item.complete).length;
  const totalRequiredRanks = items.reduce((sum, item) => sum + item.rank, 0) || 1;
  const earnedRanks = items.reduce((sum, item) => sum + Math.min(item.current, item.rank), 0);
  return Object.freeze({ items: Object.freeze(items), complete, total: items.length, progressPct: Math.round((earnedRanks / totalRequiredRanks) * 100) });
}

export function buildRoguelikePowerMomentState(run = {}) {
  const evolutions = HMH_WEAPON_EVOLUTION_LIBRARY.filter((evolution) => run.unlocks?.[evolution.id]).map((evolution) => evolution.evolutionId);
  const maxedSkills = Object.entries(run.skills ?? {}).filter(([id, rank]) => {
    const skill = LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.find((candidate) => candidate.id === id);
    return skill && rank >= skill.maxRank;
  }).map(([id]) => id);
  const bestPayoff = HMH_WEAPON_EVOLUTION_LIBRARY
    .filter((evolution) => evolutions.includes(evolution.evolutionId))
    .sort((a, b) => (b.payoff.scoreMultiplier ?? 1) - (a.payoff.scoreMultiplier ?? 1))[0]?.payoff ?? null;
  return Object.freeze({
    evolutions: Object.freeze(evolutions),
    maxedSkills: Object.freeze(maxedSkills),
    activePayoff: bestPayoff ? Object.freeze({ ...bestPayoff }) : null,
    lastMoment: run.powerMoments?.lastMoment ? Object.freeze({ ...run.powerMoments.lastMoment }) : null,
  });
}

export function buildRoguelikeSynergyHudModel(run = {}) {
  const chips = HMH_WEAPON_EVOLUTION_LIBRARY.map((evolution) => {
    const progress = skillRequirementProgress(run, evolution.requires);
    const unlocked = Boolean(run.unlocks?.[evolution.id]);
    const status = unlocked ? 'evolved' : progress.complete === progress.total ? 'ready' : progress.progressPct >= 70 ? 'near' : 'building';
    return Object.freeze({
      id: evolution.evolutionId,
      title: evolution.title,
      status,
      progressPct: progress.progressPct,
      requirements: progress.items,
      payoff: evolution.payoff,
      label: status === 'ready' ? `GOLDEN READY // ${evolution.title}` : `${evolution.title} ${progress.progressPct}%`,
    });
  });
  const readyCount = chips.filter((chip) => chip.status === 'ready' || chip.status === 'evolved').length;
  return Object.freeze({
    title: 'POWER MOMENT SYNERGIES',
    chips: Object.freeze(chips),
    readyCount,
    maxBuildPayoff: Object.freeze({
      label: readyCount >= 2 ? 'MAX BUILD PAYOFF ONLINE' : 'MAX BUILD PAYOFF PREVIEW',
      reward: Object.freeze({ scoreMultiplier: readyCount >= 2 ? 1.35 : 1.25, banner: 'MAX BUILD // GOLDEN PAYOFF' }),
    }),
  });
}

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
  chrome: Object.freeze({
    id: 'combat-hud-frame',
    priority: 'P0',
    assetPath: './assets/generated/hmh-vfx-ui-chrome/combat-hud-frame.png',
    className: 'combat-hud-overlay hmh-combat-hud-frame',
    rule: 'Diegetic LitVM arcade rail: compact, high-contrast stat chips that leave combat space visible.',
  }),
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
    controls: Object.freeze(['previous', 'play-pause', 'mute', 'next', 'shuffle', 'expand']),
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

export function chooseArcadeMusicNextIndex({
  currentIndex = 0,
  queueLength = 0,
  shuffle = false,
  random = Math.random,
} = {}) {
  const safeLength = Math.max(0, Number.isFinite(queueLength) ? Math.floor(queueLength) : 0);
  if (safeLength <= 0) return -1;
  const normalizedCurrent = ((Number.isFinite(currentIndex) ? Math.floor(currentIndex) : 0) % safeLength + safeLength) % safeLength;
  if (!shuffle || safeLength === 1) return (normalizedCurrent + 1) % safeLength;
  const randomValue = Math.max(0, Math.min(0.999999, Number(random?.()) || 0));
  const candidate = Math.floor(randomValue * (safeLength - 1));
  return candidate >= normalizedCurrent ? candidate + 1 : candidate;
}

// Pick a starting track index for a freshly entered game/level. Used so a level
// begins on a random song from its queue instead of always the first track.
export function chooseArcadeMusicStartIndex({
  queueLength = 0,
  random = Math.random,
} = {}) {
  const safeLength = Math.max(0, Number.isFinite(queueLength) ? Math.floor(queueLength) : 0);
  if (safeLength <= 0) return 0;
  const randomValue = Math.max(0, Math.min(0.999999, Number(random?.()) || 0));
  return Math.floor(randomValue * safeLength);
}

// Single source of truth for the combat pause gate. The game loop, timer, input,
// and audio all consult this so they freeze together — preventing the classic
// "modal open but game still running" bug. The simulation (and the extraction
// timer that advances with it) is frozen whenever the run is not actively
// playing: an explicit pause, an open level-up choice, game-over, the
// pre-run "pending begin" window, or an inactive run. Returns a structured
// model so callers can also drive audio/input/UI consistently.
export function buildCombatPauseGate({
  active = false,
  paused = false,
  levelUpPaused = false,
  gameOver = false,
  pendingBegin = false,
} = {}) {
  // Any modal-style interruption that should halt the live simulation.
  const interrupted = Boolean(paused || levelUpPaused || gameOver || pendingBegin);
  // The sim (and the timer that rides on it) only advances while the run is
  // active AND nothing is interrupting it.
  const simFrozen = !active || interrupted;
  const timerFrozen = simFrozen;
  // Gameplay input is captured (ignored by the sim) whenever the sim is frozen,
  // so on-screen touch controls can't "fire through" an open menu/modal.
  const inputCaptured = simFrozen;
  // Combat audio (SFX/ambient) should idle for every frozen live-combat state,
  // including the pre-begin READY gate so auto-fire cannot be heard behind the
  // level loading/title screens.
  const audioPaused = Boolean(paused || levelUpPaused || gameOver || pendingBegin);
  // A user-dismissable overlay is showing (pause menu or level-up choice).
  const overlayOpen = Boolean(paused || levelUpPaused || gameOver);
  let reason = 'running';
  if (!active) reason = 'inactive';
  else if (gameOver) reason = 'game-over';
  else if (paused) reason = 'paused';
  else if (levelUpPaused) reason = 'level-up';
  else if (pendingBegin) reason = 'pending-begin';
  return Object.freeze({ simFrozen, timerFrozen, inputCaptured, audioPaused, overlayOpen, interrupted, reason });
}

export function buildArcadeMusicPlayerModel({
  context = 'arcade',
  currentTrackId = null,
  currentTimeSeconds = 0,
  playing = false,
  muted = false,
  expanded = false,
  shuffle = false,
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
    shuffle,
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
      Object.freeze({ id: 'shuffle', label: shuffle ? 'Turn shuffle off' : 'Turn shuffle on', compactLabel: shuffle ? '🔀' : '⇄', active: shuffle }),
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

const lesterProductionAnimationState = (state, selectedFrom, count = 25) => Object.freeze({
  selectedFrom,
  frameSource: 'cropped-production-sprite-cells',
  frames: Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
    src: `./assets/lester-production/frames/${state}/lester-${state}-${String(index).padStart(2, '0')}.png`,
    size: HARD_MONEY_FRAME_SIZE,
    frameSource: 'cropped-production-sprite-cell',
  }))),
});

const lesterProductionAnimationSet = Object.freeze({
  idle: lesterProductionAnimationState('idle', 'Lester-idle.png'),
  walk: lesterProductionAnimationState('walk', 'Lester-walk.png'),
  run: lesterProductionAnimationState('run', 'Lester-run.png'),
  jump: lesterProductionAnimationState('jump', 'Lester-jump.png'),
  attack: hardMoneyAnimationState('lester', 'attack', 'Lester-attack.png'),
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
  animations: lesterProductionAnimationSet,
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

const ACHIEVEMENT_BADGE_BY_ID = new Map([
  ...(HMH_EXPANDED_PIXEL_PACK_MANIFEST.achievementBadges ?? []).map((badge) => [badge.id, badge]),
  ...Object.entries(HMH_ACHIEVEMENT_ATLAS.achievementsById ?? {}).map(([id, badge]) => [id, badge]),
]);

function achievementBadgeFor(id) {
  const badge = ACHIEVEMENT_BADGE_BY_ID.get(id);
  return Object.freeze({
    src: badge?.src ?? `./assets/generated/achievement-badges/${id}.png`,
    lockedSrc: badge?.lockedSrc ?? `./assets/generated/achievement-badges/locked-${id}.png`,
  });
}

function defineAchievement({ key, id, title, description, tier, difficulty, unlockType, icon, requirement }) {
  const badge = achievementBadgeFor(id);
  const tierId = tier ?? 'bronze';
  const unlockId = unlockType ?? 'score';
  return Object.freeze({
    key,
    id,
    title,
    description,
    tier,
    difficulty,
    unlockType,
    icon,
    requirement: Object.freeze({ ...(requirement ?? {}) }),
    badgeSrc: badge.src,
    lockedBadgeSrc: badge.lockedSrc,
    tierBadgeSrc: HMH_ACHIEVEMENT_ATLAS.tiersById?.[tierId]?.src ?? null,
    unlockTypeIconSrc: HMH_ACHIEVEMENT_ATLAS.unlockTypesById?.[unlockId]?.src ?? null,
    uiChrome: Object.freeze({
      toastFrameId: 'achievement-toast-frame',
      badgeFrameId: `achievement-tier-${tierId}`,
      unlockTypeFrameId: `achievement-unlock-${unlockId}`,
      assetPath: './assets/generated/hmh-vfx-ui-chrome/achievement-toast-frame.png',
      toastClassName: `hmh-achievement-toast-frame achievement-toast-tier-${tierId} achievement-toast-type-${unlockId}`,
      badgeClassName: `achievement-badge tier-${tierId} achievement-badge-frame achievement-unlock-${unlockId}`,
    }),
  });
}

const ACHIEVEMENT_DEFINITIONS = Object.freeze([
  defineAchievement({ key: 'CABINET_PIONEER', id: 'cabinet-pioneer', title: 'Cabinet Pioneer', description: 'Connected a wallet profile inside Lester\'s Arcade.', tier: 'bronze', difficulty: 'easy', unlockType: 'login', icon: '🕹️', requirement: { login: true } }),
  defineAchievement({ key: 'FIRST_PAID_RUN', id: 'first-paid-run', title: 'First Ranked Run', description: 'Started an official testnet credit and played a leaderboard-eligible run.', tier: 'bronze', difficulty: 'easy', unlockType: 'paid-run', icon: '◉', requirement: { paidRuns: 1 } }),
  defineAchievement({ key: 'FIRST_1000_POINTS', id: 'first-1000-points', title: 'First 1,000 Points', description: 'Scored at least 1,000 points in an official run.', tier: 'bronze', difficulty: 'easy', unlockType: 'score', icon: '★', requirement: { score: 1000 } }),
  defineAchievement({ key: 'FIRST_BLOOD', id: 'first-blood', title: 'First Blood', description: 'Defeated your first Hard Money Heroes enemy.', tier: 'bronze', difficulty: 'easy', unlockType: 'kill', icon: '⚔', requirement: { kills: 1 } }),
  defineAchievement({ key: 'TEN_ENEMY_KILLS', id: 'ten-enemy-kills', title: 'Ten-Enemy Cleanup', description: 'Defeated 10 enemies in one official run.', tier: 'bronze', difficulty: 'easy', unlockType: 'kill', icon: '☠', requirement: { kills: 10 } }),
  defineAchievement({ key: 'FIRST_GRENADE_KILL', id: 'first-grenade-kill', title: 'Crypto Bomb Initiate', description: 'Defeated an enemy with a grenade.', tier: 'bronze', difficulty: 'easy', unlockType: 'grenade', icon: '●', requirement: { grenadeKills: 1 } }),
  defineAchievement({ key: 'FIRST_POWERUP', id: 'first-powerup', title: 'Pickup Ready', description: 'Collected a power-up during a run.', tier: 'bronze', difficulty: 'easy', unlockType: 'collection', icon: '⬢', requirement: { powerUpsCollected: 1 } }),
  defineAchievement({ key: 'BEAT_LEVEL_1_BOSS', id: 'beat-level-1-boss', title: 'Beat Level 1 Boss', description: 'Defeated the Level 1 boss lock.', tier: 'bronze', difficulty: 'easy', unlockType: 'boss', icon: '⚠', requirement: { bossId: 'any' } }),
  defineAchievement({ key: 'FIVE_MINUTE_RUN', id: 'five-minute-run', title: 'Five-Minute Fighter', description: 'Survived at least five minutes.', tier: 'bronze', difficulty: 'easy', unlockType: 'survival', icon: '⌛', requirement: { elapsedSeconds: 300 } }),
  defineAchievement({ key: 'COMBO_STARTER', id: 'combo-starter', title: 'Combo Starter', description: 'Reached a 5-hit combo.', tier: 'bronze', difficulty: 'easy', unlockType: 'combo', icon: '×5', requirement: { maxCombo: 5 } }),

  defineAchievement({ key: 'GAS_BEAST_HUNTER', id: 'gas-beast-hunter', title: 'Gas Beast Hunter', description: 'Defeated 50 Gas Beasts across official runs.', tier: 'silver', difficulty: 'medium', unlockType: 'enemy-hunt', icon: '☣', requirement: { enemyId: 'gas-beast', cumulativeKills: 50 } }),
  defineAchievement({ key: 'GOBLIN_CLEANUP', id: 'goblin-cleanup', title: 'Goblin Cleanup', description: 'Defeated 75 FUD Goblins, Paper Hands, or Rug Rats.', tier: 'silver', difficulty: 'medium', unlockType: 'enemy-hunt', icon: '☠', requirement: { family: 'goblin', cumulativeKills: 75 } }),
  defineAchievement({ key: 'DRONE_SWATTER', id: 'drone-swatter', title: 'Drone Swatter', description: 'Defeated 60 Sybil Drones or bot enemies.', tier: 'silver', difficulty: 'medium', unlockType: 'enemy-hunt', icon: '✦', requirement: { family: 'drone', cumulativeKills: 60 } }),
  defineAchievement({ key: 'GRENADE_CENTURY', id: 'grenade-century', title: 'Grenade Century', description: 'Defeated 100 enemies with grenades across official runs.', tier: 'silver', difficulty: 'medium', unlockType: 'grenade', icon: '●', requirement: { cumulativeGrenadeKills: 100 } }),
  defineAchievement({ key: 'BLADE_MASTER', id: 'blade-master', title: 'Blade Master', description: 'Defeated 100 enemies with the Litecoin Blade across official runs.', tier: 'silver', difficulty: 'medium', unlockType: 'melee', icon: '⌁', requirement: { cumulativeMeleeKills: 100 } }),
  defineAchievement({ key: 'HASH_RAIL_SPECIALIST', id: 'hash-rail-specialist', title: 'Hash Rail Specialist', description: 'Completed an official run using the Hash Rail upgrade.', tier: 'silver', difficulty: 'medium', unlockType: 'weapon', icon: '━', requirement: { weaponId: 'hash-rail' } }),
  defineAchievement({ key: 'SPREAD_LTC_SPECIALIST', id: 'spread-ltc-specialist', title: 'Spread LTC Specialist', description: 'Completed an official run using the Spread LTC upgrade.', tier: 'silver', difficulty: 'medium', unlockType: 'weapon', icon: '⇶', requirement: { weaponId: 'spread-ltc' } }),
  defineAchievement({ key: 'POWERUP_COLLECTOR', id: 'powerup-collector', title: 'Power-Up Collector', description: 'Collected three or more different power-up types in one run.', tier: 'silver', difficulty: 'medium', unlockType: 'collection', icon: '⬢', requirement: { uniquePowerUps: 3 } }),
  defineAchievement({ key: 'SCORE_5000', id: 'score-5000', title: '5K Scorecard', description: 'Scored at least 5,000 points in an official run.', tier: 'silver', difficulty: 'medium', unlockType: 'score', icon: '5K', requirement: { score: 5000 } }),
  defineAchievement({ key: 'SCORE_10000', id: 'score-10000', title: '10K Neon Run', description: 'Scored at least 10,000 points in an official run.', tier: 'silver', difficulty: 'medium', unlockType: 'score', icon: '10K', requirement: { score: 10000 } }),

  defineAchievement({ key: 'BOSS_BREAKER', id: 'boss-breaker', title: 'Boss Breaker', description: 'Defeated any rotating Hard Money Heroes boss during an official run.', tier: 'gold', difficulty: 'hard', unlockType: 'boss', icon: '⚠', requirement: { bossId: 'any' } }),
  defineAchievement({ key: 'NO_DAMAGE_BOSS', id: 'no-damage-boss', title: 'Untouchable Boss Clear', description: 'Beat a boss without taking damage during the boss phase.', tier: 'gold', difficulty: 'hard', unlockType: 'skill', icon: '◆', requirement: { bossId: 'any', noDamage: true } }),
  defineAchievement({ key: 'SLUMS_CLEAR', id: 'slums-clear', title: 'Wasteland Clear', description: 'Cleared the opening Crypto Wasteland district set.', tier: 'gold', difficulty: 'hard', unlockType: 'level-clear', icon: 'Ⅰ', requirement: { stageIndexReached: 4 } }),
  defineAchievement({ key: 'FOUNDRY_CLEAR', id: 'foundry-clear', title: 'POI Clear', description: 'Cleared a Level 1 authored POI route without breaking the run.', tier: 'gold', difficulty: 'hard', unlockType: 'level-clear', icon: 'Ⅱ', requirement: { stageIndexReached: 8 } }),
  defineAchievement({ key: 'GETAWAY_CLEAR', id: 'getaway-clear', title: 'Getaway Clear', description: 'Cleared the Level 1 finale route.', tier: 'gold', difficulty: 'hard', unlockType: 'level-clear', icon: 'Ⅲ', requirement: { stageIndexReached: 13, bossId: 'any' } }),
  defineAchievement({ key: 'BIG_COMBO', id: 'big-combo', title: 'Big Combo', description: 'Reached a 15-hit combo.', tier: 'gold', difficulty: 'hard', unlockType: 'combo', icon: '×15', requirement: { maxCombo: 15 } }),
  defineAchievement({ key: 'DAMAGE_CHAIN', id: 'damage-chain', title: 'Damage Chain', description: 'Built a 250-damage chain before it broke.', tier: 'gold', difficulty: 'hard', unlockType: 'combo', icon: '⚡', requirement: { maxDamageCombo: 250 } }),
  defineAchievement({ key: 'WEAPON_COLLECTOR', id: 'weapon-collector', title: 'Weapon Collector', description: 'Used three different weapon upgrades across official runs.', tier: 'gold', difficulty: 'hard', unlockType: 'collection', icon: '⌁', requirement: { uniqueWeapons: 3 } }),
  defineAchievement({ key: 'LUCKY_SURVIVOR', id: 'lucky-survivor', title: 'Lucky Survivor', description: 'Survived past 10 minutes after dropping below 20% health.', tier: 'gold', difficulty: 'hard', unlockType: 'survival', icon: '♡', requirement: { elapsedSeconds: 600, lowHealthSurvival: true } }),
  defineAchievement({ key: 'TEN_PAID_RUNS', id: 'ten-paid-runs', title: 'Ranked Regular', description: 'Completed 10 official ranked runs.', tier: 'gold', difficulty: 'hard', unlockType: 'volume', icon: '10', requirement: { paidRuns: 10 } }),

  defineAchievement({ key: 'MASTER_SURVIVOR', id: 'master-survivor', title: 'Master Survivor', description: 'Survived at least fifteen minutes in Hard Money Heroes.', tier: 'platinum', difficulty: 'expert', unlockType: 'survival', icon: '⌛', requirement: { elapsedSeconds: 900 } }),
  defineAchievement({ key: 'SCORE_25000', id: 'score-25000', title: '25K Riot', description: 'Scored at least 25,000 points in an official run.', tier: 'platinum', difficulty: 'expert', unlockType: 'score', icon: '25K', requirement: { score: 25000 } }),
  defineAchievement({ key: 'SCORE_50000', id: 'score-50000', title: '50K Legend Run', description: 'Scored at least 50,000 points in an official run.', tier: 'platinum', difficulty: 'expert', unlockType: 'score', icon: '50K', requirement: { score: 50000 } }),
  defineAchievement({ key: 'NO_DAMAGE_10_MINUTES', id: 'no-damage-10-minutes', title: 'Glass Cannon Saint', description: 'Survived 10 minutes in an official run without taking damage.', tier: 'platinum', difficulty: 'expert', unlockType: 'skill', icon: '◇', requirement: { elapsedSeconds: 600, noDamage: true } }),
  defineAchievement({ key: 'ALL_BOSSES_SCOUTED', id: 'all-bosses-scouted', title: 'Full Boss Roster Scouted', description: 'Encountered or defeated all major Hard Money Heroes bosses across runs.', tier: 'platinum', difficulty: 'expert', unlockType: 'collection', icon: '⚠', requirement: { bossesDefeatedCount: 10 } }),
  defineAchievement({ key: 'ENEMY_REAPER_250', id: 'enemy-reaper-250', title: 'Enemy Reaper 250', description: 'Defeated 250 enemies across official runs.', tier: 'platinum', difficulty: 'expert', unlockType: 'kill', icon: '250', requirement: { cumulativeKills: 250 } }),
  defineAchievement({ key: 'ENEMY_REAPER_500', id: 'enemy-reaper-500', title: 'Enemy Reaper 500', description: 'Defeated 500 enemies across official runs.', tier: 'platinum', difficulty: 'expert', unlockType: 'kill', icon: '500', requirement: { cumulativeKills: 500 } }),
  defineAchievement({ key: 'GRENADE_DEMOLITIONIST', id: 'grenade-demolitionist', title: 'Grenade Demolitionist', description: 'Defeated 250 enemies with grenades across official runs.', tier: 'platinum', difficulty: 'expert', unlockType: 'grenade', icon: '●', requirement: { cumulativeGrenadeKills: 250 } }),
  defineAchievement({ key: 'BLADE_SAMURAI', id: 'blade-samurai', title: 'Blade Samurai', description: 'Defeated 250 enemies with the Litecoin Blade across official runs.', tier: 'platinum', difficulty: 'expert', unlockType: 'melee', icon: '⌁', requirement: { cumulativeMeleeKills: 250 } }),
  defineAchievement({ key: 'POWERUP_HOARDER', id: 'powerup-hoarder', title: 'Power-Up Hoarder', description: 'Collected 250 power-ups across official runs.', tier: 'platinum', difficulty: 'expert', unlockType: 'collection', icon: '⬢', requirement: { cumulativePowerUps: 250 } }),

  defineAchievement({ key: 'RANKED_REGULAR', id: 'ranked-regular', title: 'Ranked Regular+', description: 'Completed 50 official ranked runs.', tier: 'diamond', difficulty: 'long-haul', unlockType: 'volume', icon: '50', requirement: { paidRuns: 50 } }),
  defineAchievement({ key: 'BOSS_RUSH_TEN', id: 'boss-rush-ten', title: 'Boss Rush Ten', description: 'Defeated 10 bosses across official runs.', tier: 'diamond', difficulty: 'long-haul', unlockType: 'boss', icon: '10⚠', requirement: { cumulativeBossKills: 10 } }),
  defineAchievement({ key: 'SPEED_CLEAR', id: 'speed-clear', title: 'Speed Clear', description: 'Beat the Level 1 boss in under 8 minutes.', tier: 'diamond', difficulty: 'long-haul', unlockType: 'skill', icon: '⏱', requirement: { bossId: 'any', elapsedSecondsAtMost: 480 } }),
  defineAchievement({ key: 'HARD_FORK_HERO', id: 'hard-fork-hero', title: 'Hard Fork Hero', description: 'Reached Stage 13 while carrying a throwable-focused run.', tier: 'diamond', difficulty: 'long-haul', unlockType: 'grenade', icon: '⚒', requirement: { stageIndexReached: 13, grenadeKills: 20 } }),
  defineAchievement({ key: 'MAX_COMBO_30', id: 'max-combo-30', title: '30-Combo Signal', description: 'Reached a 30-hit combo.', tier: 'diamond', difficulty: 'long-haul', unlockType: 'combo', icon: '×30', requirement: { maxCombo: 30 } }),

  defineAchievement({ key: 'TWO_HUNDRED_RANKED_RUNS', id: 'two-hundred-ranked-runs', title: '200 Ranked Runs', description: 'Completed 200 official ranked runs.', tier: 'mythic', difficulty: 'endgame', unlockType: 'volume', icon: '200', requirement: { paidRuns: 200 } }),
  defineAchievement({ key: 'TWO_FIFTY_RANKED_RUNS', id: 'two-fifty-ranked-runs', title: '250 Ranked Runs', description: 'Completed 250 official ranked runs.', tier: 'mythic', difficulty: 'endgame', unlockType: 'volume', icon: '250', requirement: { paidRuns: 250 } }),
  defineAchievement({ key: 'MARATHON_WALLET', id: 'marathon-wallet', title: 'Marathon Wallet', description: 'Survived a cumulative 10 hours across official runs.', tier: 'mythic', difficulty: 'endgame', unlockType: 'volume', icon: '10H', requirement: { cumulativeSeconds: 36000 } }),
  defineAchievement({ key: 'PERFECT_BOSS_GAUNTLET', id: 'perfect-boss-gauntlet', title: 'Perfect Boss Gauntlet', description: 'Defeated three bosses without taking damage in their boss phases.', tier: 'mythic', difficulty: 'endgame', unlockType: 'skill', icon: '◇⚠', requirement: { perfectBossKills: 3 } }),
  defineAchievement({ key: 'ARCADE_LEGEND_500', id: 'arcade-legend-500', title: 'Arcade Legend 500', description: 'Completed 500 official ranked runs.', tier: 'mythic', difficulty: 'endgame', unlockType: 'volume', icon: '500', requirement: { paidRuns: 500 } }),
  // Level 2 Litecoin City achievements
  defineAchievement({ key: 'L2_SURVIVE_5MIN', id: 'l2-survive-5min', title: 'City Threshold', description: 'Survived 5 minutes in Level 2: Litecoin City.', tier: 'gold', difficulty: 'hard', unlockType: 'survival', icon: '🏙', requirement: { levelId: 'level-2-litecoin-city', elapsedSeconds: 300 } }),
  defineAchievement({ key: 'L2_BRIDGE_EXPLOITER', id: 'l2-bridge-exploiter', title: 'Bridge Breaker', description: 'Defeated the Bridge Exploiter in DeFi Harbor.', tier: 'gold', difficulty: 'hard', unlockType: 'boss', icon: '🌉', requirement: { bossId: 'bridge-exploiter' } }),
  defineAchievement({ key: 'L2_WHALE_SLAYER', id: 'l2-whale-slayer', title: 'Whale Slayer', description: 'Defeated The Whale in Financial Downtown.', tier: 'platinum', difficulty: 'expert', unlockType: 'boss', icon: '🐋', requirement: { bossId: 'the-whale' } }),
  defineAchievement({ key: 'L2_OBFUSCATOR', id: 'l2-obfuscator', title: 'Privacy Piercer', description: 'Defeated The Obfuscator in MimbleWimble Grove.', tier: 'platinum', difficulty: 'expert', unlockType: 'boss', icon: '🌫', requirement: { bossId: 'the-obfuscator' } }),
  defineAchievement({ key: 'L2_51_PERCENT', id: 'l2-51-percent', title: 'Consensus Breaker', description: 'Defeated the 51% Boss in Hashrate District.', tier: 'platinum', difficulty: 'expert', unlockType: 'boss', icon: '⛏', requirement: { bossId: 'fifty-one-percent' } }),
  defineAchievement({ key: 'L2_NGMI', id: 'l2-ngmi', title: 'Not Gonna Make It... Did', description: 'Defeated Mr. NGMI and cleared Level 2: Litecoin City.', tier: 'diamond', difficulty: 'long-haul', unlockType: 'level-clear', icon: '🏆', requirement: { levelId: 'level-2-litecoin-city', bossId: 'mr-ngmi' } }),
  defineAchievement({ key: 'L2_NO_DAMAGE_NGMI', id: 'l2-no-damage-ngmi', title: 'Influencer Immune', description: 'Defeated Mr. NGMI without taking damage during the boss phase.', tier: 'mythic', difficulty: 'endgame', unlockType: 'skill', icon: '✨', requirement: { bossId: 'mr-ngmi', noDamage: true } }),
]);

export const ACHIEVEMENTS = Object.freeze(Object.fromEntries(ACHIEVEMENT_DEFINITIONS.map((achievement) => [achievement.key, achievement])));
export const ACHIEVEMENT_LIST = Object.freeze(ACHIEVEMENT_DEFINITIONS.map((achievement) => achievement));

export const LESTER_BLASTER_CHARACTER_ROSTER = Object.freeze([
  Object.freeze({
    id: 'lit-commando',
    title: 'Lit Commando',
    role: 'main playable Hard Money Hero — tanky bruiser',
    tagline: 'Litecoin-silver tactical commando: more HP, armor and damage, a touch slower.',
    personality: 'stubborn, brave, goofy-gritty arcade tough guy; says little, solves scams with steel and gunfire',
    spriteSheet: './assets/sprite-lester-commando.svg',
    portraitAsset: './assets/sprite-lester-commando.svg',
    legacyId: 'lit-commando',
    unlock: 'starter',
    stats: Object.freeze({ maxHealth: 120, speed: 0.92, jump: 1.0, melee: 1.15, luck: 0.95 }),
    startStatMods: Object.freeze({ maxHealth: 1.2, damage: 1.12, armor: 1.1, movementSpeed: 0.92 }),
    artDirection: 'high-detail 16-bit/Neo-Geo commando: silver + Litecoin-blue armor, glowing cyan visor helmet, readable muzzle flashes and blade arcs, 8-direction isometric.',
    animations: Object.freeze(['idle', 'walk', 'run', 'fire-pistol', 'melee-knife', 'throw-axe', 'fire-shotgun', 'fire-machinegun', 'hurt', 'stun', 'pickup', 'levelup', 'death']),
  }),
  Object.freeze({
    id: 'lit-valkyrie',
    title: 'Lit Valkyrie',
    role: 'playable Hard Money Hero — agile glass-cannon',
    tagline: 'Teal-plasma energy warrior: faster, higher fire-rate and crit, but more fragile.',
    personality: 'sharp, quick, fearless skirmisher; darts through the panic and punishes mistakes',
    spriteSheet: './assets/sprite-lilly-runner.svg',
    portraitAsset: './assets/sprite-lilly-runner.svg',
    legacyId: 'lit-valkyrie',
    unlock: 'starter',
    stats: Object.freeze({ maxHealth: 88, speed: 1.15, jump: 1.0, melee: 0.95, luck: 1.15 }),
    startStatMods: Object.freeze({ movementSpeed: 1.15, rateOfFire: 1.12, criticalChance: 1.15, maxHealth: 0.88 }),
    artDirection: 'teal/cyan plasma armor, short teal hair, agile silhouette, glowing energy trim, readable fire/crit VFX, 8-direction isometric.',
    animations: Object.freeze(['idle', 'walk', 'run', 'fire-pistol', 'melee-knife', 'throw-axe', 'fire-shotgun', 'fire-machinegun', 'hurt', 'stun', 'pickup', 'levelup', 'death']),
  }),
  Object.freeze({
    id: 'lester-original',
    title: 'Lester',
    role: 'unlockable Hard Money Hero — the original arcade commando',
    tagline: 'The legendary Litecoin commando from the arcade days. Unlocked by clearing Level 1: The Crypto Wasteland.',
    personality: 'Rambo-like arcade commando: stubborn, brave, over-the-top, one-liners implied, walks against the panic.',
    spriteSheet: './assets/generated/hmh-animated-roster/lester/idle/south-west/00.png',
    portraitAsset: './assets/generated/hmh-animated-roster/lester/idle/south-west/00.png',
    legacyId: 'lester',
    unlock: 'achievement:getaway-clear',
    unlockDescription: 'Complete Level 1: The Crypto Wasteland to unlock Lester.',
    stats: Object.freeze({ maxHealth: 100, speed: 1.0, jump: 1.0, melee: 1.0, luck: 1.0 }),
    startStatMods: Object.freeze({ maxHealth: 1.0, damage: 1.0, armor: 1.0, movementSpeed: 1.0 }),
    artDirection: 'classic Lester reference-first commando: blue mask/helmet with white face mark, tan pants, black boots/gloves, ammo bandolier, pistol/shotgun/machine-gun/grenade/knife poses, 8-direction isometric.',
    animations: Object.freeze(['idle', 'walk', 'run', 'fire-pistol', 'melee-knife', 'throw-grenade', 'fire-shotgun', 'fire-machinegun', 'hurt', 'stun', 'pickup', 'levelup', 'death', 'victory']),
  }),
  Object.freeze({
    id: 'lilly',
    title: 'Lilly',
    role: 'unlockable Hard Money Hero — 10 ranked match reward',
    tagline: 'Teal-haired tactical companion. Unlocked after playing 10 ranked matches.',
    personality: 'confident, quick, and precise; a distinct named hero, not the Lit Valkyrie starter skin.',
    spriteSheet: './assets/generated/hmh-animated-roster/lilly/idle/south/00.png',
    portraitAsset: './assets/generated/hmh-animated-roster/lilly/idle/south/00.png',
    legacyId: 'lilly',
    unlock: 'achievement:ten-paid-runs',
    unlockDescription: 'Complete 10 ranked Hard Money Heroes matches to unlock Lilly.',
    stats: Object.freeze({ maxHealth: 96, speed: 1.08, jump: 1.0, melee: 1.05, luck: 1.08 }),
    startStatMods: Object.freeze({ movementSpeed: 1.08, rateOfFire: 1.05, criticalChance: 1.08, maxHealth: 0.96 }),
    artDirection: 'reference-first Lilly: long teal hair, round glasses, dark tactical armor with gold/teal accents, pistol/shotgun/machine-gun/grenade/knife poses, readable 8-direction isometric silhouette.',
    animations: Object.freeze(['idle', 'walk', 'run', 'fire-pistol', 'melee-knife', 'throw-grenade', 'fire-shotgun', 'fire-machinegun', 'hurt', 'stun', 'pickup', 'levelup', 'death', 'victory']),
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
      displayName: 'Pistol',
      type: 'starter',
      rarity: 'starter',
      damage: 3,
      // Starter pistol: deliberately SLOW semi-auto with a small 8-round clip and
      // a slow reload. The run is meant to level up over time — fire-rate and
      // reload-speed upgrades make it feel better, and shotgun/MG pickups change
      // the whole feel. Never auto-emptying-fast at the start.
      fireRatePerSecond: 2.6,
      reloadSeconds: 1.5,
      clip: 8,
      range: 'mid',
      ammo: 8,
      animation: 'crisp blue muzzle flash, small silver tracer, dependable semi-auto recoil',
      soundCue: 'sfx_settler_pop',
      bestFor: 'baseline enemy waves and always-has-a-way-out fallback combat',
      description: 'Clean silver-and-blue semi-auto sidearm named for fast settlement; 8-round clip, slow but reliable. Scales up as you level the run.',
      upgrades: Object.freeze({ rateOfFire: '+18%', damage: '+1 per tier', reloadSpeed: '+22%' }),
    }),
    Object.freeze({
      id: 'scatter-shotgun',
      title: 'The Block Breaker',
      displayName: 'Shotgun',
      type: 'weapon-pickup',
      rarity: 'uncommon',
      damage: 9,
      pellets: 8,
      blastRadius: true,
      // High damage, AOE pellet spread, very low fire rate, tiny 2-shell clip and
      // a slow reload. A burst-clear weapon you respect, not spam.
      fireRatePerSecond: 0.95,
      reloadSeconds: 2.0,
      clip: 2,
      range: 'short cone',
      ammo: 2,
      animation: 'wide orange blast, heavy pump frame, blue shell-loader kickback',
      soundCue: 'sfx_block_breaker_pump',
      bestFor: 'close-range swarms, room clears, and mini-boss armor chips',
      description: 'Blocky pump-action crowd clearer: high-damage AOE blast, 2-shell clip, slow fire and reload. Devastating up close, weak at range.',
      upgrades: Object.freeze({ rateOfFire: '+10%', damage: '+pellet damage', reloadSpeed: '+18%' }),
    }),
    Object.freeze({
      id: 'auto-miner',
      title: 'The Hashstorm',
      displayName: 'Machine Gun',
      type: 'weapon-pickup',
      rarity: 'uncommon',
      damage: 2,
      automatic: true,
      // Full-auto: high starting fire rate, big 120-round clip, but the SLOWEST
      // reload of any weapon — empty it and you're exposed for a long beat.
      fireRatePerSecond: 12,
      reloadSeconds: 3.0,
      clip: 120,
      range: 'mid-long stream',
      ammo: 120,
      animation: 'rapid silver tracers, spinning blue energy coil, rising whine, light screen shake',
      soundCue: 'sfx_hashstorm_rattle',
      bestFor: 'Bot Swarms, Liquidation cascades, and holding a line under pressure',
      description: 'Sustained full-auto suppressive fire: 120-round clip, high fire rate, but the slowest reload in the kit.',
      upgrades: Object.freeze({ rateOfFire: '+20%', damage: '+1 every two tiers', reloadSpeed: '+25%' }),
    }),
    Object.freeze({
      id: 'spread-ltc',
      title: 'Spread LTC',
      displayName: 'Spread Gun',
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
      displayName: 'Rail Gun',
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
      displayName: 'Super Cannon',
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
  Object.freeze({ id: 'block-breaker-shells', title: 'Block Breaker Shells', category: 'weapon', effect: 'weapon', weaponId: 'scatter-shotgun', durationSeconds: 16, sprite: 'orange shotgun shell chip that unlocks a short-range pellet cone', rarity: 'uncommon' }),
  Object.freeze({ id: 'hashstorm-drum', title: 'Hashstorm Drum', category: 'weapon', effect: 'weapon', weaponId: 'auto-miner', durationSeconds: 15, sprite: 'cyan machine-gun drum magazine with rapid-fire tracer sparks', rarity: 'uncommon' }),
  Object.freeze({ id: 'spread-ltc-chip', title: 'Spread LTC Chip', category: 'weapon', effect: 'weapon', weaponId: 'spread-ltc', durationSeconds: 18, sprite: 'cyan fan chip', rarity: 'uncommon' }),
  Object.freeze({ id: 'hash-rail-core', title: 'Hash Rail Core', category: 'weapon', effect: 'weapon', weaponId: 'hash-rail', durationSeconds: 14, sprite: 'glowing white/cyan core', rarity: 'rare' }),
  Object.freeze({ id: 'score-multiplier', title: '2x Hard Money Multiplier', category: 'score', effect: 'scoreMultiplier', multiplier: 2, durationSeconds: 20, sprite: 'gold x2 token with subtle blue rim', rarity: 'uncommon' }),
  Object.freeze({ id: 'shield-cache', title: 'Cold Wallet Shield', category: 'defense', effect: 'shield', amount: 1, durationSeconds: 12, sprite: 'hovering blue-and-silver hex barrier device', rarity: 'uncommon' }),
  Object.freeze({ id: 'ammo-cache', title: 'Ammo Cache', category: 'ammo', effect: 'ammo', amount: 30, sprite: 'silver magazine crate with orange hazard stripe', rarity: 'common' }),
  Object.freeze({ id: 'ltc-cache', title: 'LTC Cache', category: 'score', effect: 'scoreBonus', score: 250, sprite: 'sparkling silver coin pile used as pickup accent, not wallpaper', rarity: 'common' }),
  // --- Roguelike power-ups (wave: hmh-fx-powerups) ---
  Object.freeze({ id: 'magnet-surge', title: 'Magnet Wallet Surge', category: 'utility', effect: 'magnet', durationSeconds: 8, sprite: 'glowing horseshoe magnet with blue pull rings', rarity: 'uncommon' }),
  Object.freeze({ id: 'time-dilation', title: 'Block-Time Dilation', category: 'utility', effect: 'slowEnemies', durationSeconds: 6, sprite: 'blue hourglass with slow-motion swirl', rarity: 'rare' }),
  Object.freeze({ id: 'berserk-candle', title: 'Green-Candle Berserk', category: 'offense', effect: 'berserk', durationSeconds: 7, sprite: 'red-and-green flaming candlestick', rarity: 'rare' }),
  Object.freeze({ id: 'nuke-liquidation', title: 'Liquidation Nuke', category: 'offense', effect: 'screenNuke', sprite: 'red glowing screen-clear nuke', rarity: 'super-rare' }),
]);

export const LESTER_BLASTER_ENVIRONMENTS = Object.freeze([
  Object.freeze({
    id: 'underchain-district',
    title: 'Crypto Wasteland: Desert Approach',
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
    title: 'Crypto Wasteland: Ghost Town & Salvage Belt',
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
  Object.freeze({ id: 'fud-goblin', title: 'FUD Goblin', class: 'grunt', baseHealth: 7, damage: 7, speed: 1.8, score: 80, spawnAfterSeconds: 0, aiArchetype: 'swarm-shambler', districtFamilies: Object.freeze(['ghost_town', 'country_road', 'residential_edge']), animationStates: Object.freeze(['shamble', 'lob-sell', 'attack-tell', 'hit', 'red-candle-pop']), attackPatterns: Object.freeze(['slow-sell-arc', 'swarm-body-block']), deathEffect: 'puff of red candle smoke + always-on silver impact sparks', tells: 'mouth opens with SELL bubble wind-up' }),
  Object.freeze({ id: 'gas-fee-wisp', title: 'Gas Fee Wisp', class: 'hazard-flyer', baseHealth: 10, damage: 8, speed: 2.2, score: 140, spawnAfterSeconds: 35, aiArchetype: 'hover-taxer', districtFamilies: Object.freeze(['desert_approach', 'inner_city']), preferredRangeMode: 'ranged', animationStates: Object.freeze(['float', 'tax-pulse', 'attack-tell', 'tar-drop', 'hit', 'pop']), attackPatterns: Object.freeze(['resource-tax', 'sticky-tar-puddle']), deathEffect: 'orange flame pop + pump handle fragments', tells: 'gas-pump body glows before taxing' }),
  Object.freeze({ id: 'paper-hand', title: 'Paper Hands', class: 'panic-melee', baseHealth: 12, damage: 9, speed: 2.0, score: 120, spawnAfterSeconds: 0, aiArchetype: 'panic-charge-flee', districtFamilies: Object.freeze(['ghost_town', 'inner_city']), preferredRangeMode: 'melee', animationStates: Object.freeze(['tremble', 'panic-charge', 'attack-tell', 'wild-swing', 'flee', 'hit', 'crumple', 'death']), attackPatterns: Object.freeze(['wild-melee', 'ally-collision-chaos']), deathEffect: 'white paper confetti + optional red flecks if gore enabled', tells: 'crumpled hands shake before charge' }),
  Object.freeze({ id: 'fud-goblin-cave', title: 'Cave FUD Goblin', class: 'cave-grunt', baseHealth: 9, damage: 8, speed: 2.05, score: 110, spawnAfterSeconds: 45, aiArchetype: 'cave-lob-scatter', districtFamilies: Object.freeze(['country_road', 'dry_forest_cave']), poiIds: Object.freeze(['dry-forest-cave']), preferredRangeMode: 'melee', enemyKey: 'trenchDegen', animationStates: Object.freeze(['idle', 'run', 'attack-tell', 'attack', 'hit', 'death']), attackPatterns: Object.freeze(['torch-lob', 'cave-mouth-scatter']), deathEffect: 'torch ash burst + cave dust puff', tells: 'bright torch-up silhouette before the cave toss' }),
  Object.freeze({ id: 'claim-jumper', title: 'Claim Jumper', class: 'rifle-bandit', baseHealth: 16, damage: 12, speed: 2.1, score: 190, spawnAfterSeconds: 120, aiArchetype: 'cover-peek-rifle', districtFamilies: Object.freeze(['ghost_town', 'residential_edge']), poiIds: Object.freeze(['rugpull-gulch', 'mesa-overlook']), preferredRangeMode: 'ranged', animationStates: Object.freeze(['idle', 'walk', 'attack-tell', 'attack', 'reload', 'hit', 'death']), attackPatterns: Object.freeze(['cover-peek-rifle', 'false-front-reposition']), deathEffect: 'hat flip + coin-spur sparks + dust burst', tells: 'rifle sights glint before the lane shot' }),
  Object.freeze({ id: 'claim-jumper-sheriff', title: 'Claim-Jumper Sheriff', class: 'rifle-bandit-miniboss', baseHealth: 42, damage: 17, speed: 1.85, score: 620, spawnAfterSeconds: 180, aiArchetype: 'cover-peek-rifle-commander', districtFamilies: Object.freeze(['ghost_town']), poiIds: Object.freeze(['rugpull-gulch']), preferredRangeMode: 'ranged', animationStates: Object.freeze(['idle', 'walk', 'attack-tell', 'attack', 'reload', 'command-point', 'hit', 'death']), attackPatterns: Object.freeze(['cover-peek-rifle', 'false-front-reposition', 'command-volley']), deathEffect: 'sheriff badge spin + coin-spur sparks + dust plume', tells: 'badge glint and scoped rifle raise before the command volley' }),
  Object.freeze({ id: 'scam-cult-zealot', title: 'Scam Cult Zealot', class: 'fan-shot-zealot', baseHealth: 21, damage: 14, speed: 2.15, score: 255, spawnAfterSeconds: 125, aiArchetype: 'chant-fan-shot', districtFamilies: Object.freeze(['ghost_town']), poiIds: Object.freeze(['rugpull-gulch']), preferredRangeMode: 'ranged', animationStates: Object.freeze(['idle', 'walk', 'attack-tell', 'attack', 'reload', 'hit', 'death']), attackPatterns: Object.freeze(['fan-shot-blast', 'chant-aura-stepback']), deathEffect: 'flare ash + robe shred + red dust burst', tells: 'lantern flare pulses before the shotgun fan' }),
  Object.freeze({ id: 'crypto-bro', title: 'Crypto Bro', class: 'kol-ranged-grunt', baseHealth: 18, damage: 12, speed: 1.9, score: 210, spawnAfterSeconds: 55, aiArchetype: 'taunt-strafe-shooter', districtFamilies: Object.freeze(['inner_city', 'residential_edge']), preferredRangeMode: 'ranged', enemyKey: 'cryptoBro', animationStates: Object.freeze(['idle', 'walk', 'run', 'jump', 'attack-tell', 'attack', 'hit', 'death']), attackPatterns: Object.freeze(['phone-taunt-shot', 'jump-back-flex', 'close-knife-panic']), deathEffect: 'shattered phone pixels + green candle confetti', tells: 'phone screen flashes before the shot/taunt' }),
  Object.freeze({ id: 'gas-beast', title: 'Gas Beast', class: 'armored-bruiser', baseHealth: 32, damage: 16, speed: 0.95, score: 340, spawnAfterSeconds: 115, aiArchetype: 'gas-cloud-area-denial', districtFamilies: Object.freeze(['inner_city', 'residential_edge']), preferredRangeMode: 'melee', enemyKey: 'gasBeast', animationStates: Object.freeze(['idle', 'walk', 'run', 'jump', 'attack-tell', 'attack', 'hit', 'death']), attackPatterns: Object.freeze(['gas-tax-pulse', 'slow-claw-swipe', 'short-hop-body-check']), deathEffect: 'orange/blue gas burst + ETH fee shards', tells: 'chest vents glow orange before gas pulse' }),
  Object.freeze({ id: 'sybil-drone', title: 'Bot Swarm (Sybil Drones)', class: 'formation-flyer', baseHealth: 9, damage: 10, speed: 2.4, score: 150, spawnAfterSeconds: 80, aiArchetype: 'parent-drone-formation', districtFamilies: Object.freeze(['desert_approach', 'inner_city']), preferredRangeMode: 'ranged', animationStates: Object.freeze(['hover', 'attack-tell', 'sync-strafe', 'laser-ping', 'scatter', 'hit', 'explode']), attackPatterns: Object.freeze(['formation-laser-ping', 'parent-drone-scatter']), deathEffect: 'cyan electric shards + wallet-address pixels', tells: 'blank wallet face flashes red target dot' }),
  Object.freeze({ id: 'rug-rat', title: 'Rug Rat', class: 'disruptor', baseHealth: 8, damage: 7, speed: 3.3, score: 130, spawnAfterSeconds: 70, aiArchetype: 'platform-yanker', districtFamilies: Object.freeze(['ghost_town', 'country_road']), preferredRangeMode: 'melee', animationStates: Object.freeze(['scurry', 'attack-tell', 'rug-drag', 'floor-yank', 'hit', 'escape', 'death']), attackPatterns: Object.freeze(['platform-yank', 'low-dash-knockback']), deathEffect: 'torn carpet scraps + red dust puff', tells: 'tiny rolled rug lifts before dash' }),
  Object.freeze({ id: 'honeypot-turret', title: 'Honeypot Turret', class: 'stationary-trap', baseHealth: 18, damage: 13, speed: 0, score: 220, spawnAfterSeconds: 90, aiArchetype: 'loot-bait-trap', districtFamilies: Object.freeze(['country_road', 'inner_city']), preferredRangeMode: 'ranged', animationStates: Object.freeze(['fake-loot', 'snap-open', 'attack-tell', 'clamp-fire', 'hit', 'shatter', 'death']), attackPatterns: Object.freeze(['short-range-spread', 'clamp-burst']), deathEffect: 'golden hex shards + blue reveal sparks', tells: 'too-perfect loot glow pulses twice' }),
  Object.freeze({ id: 'coyote-pack-runner', title: 'Coyote Pack Runner', class: 'pack-ambusher', baseHealth: 18, damage: 13, speed: 3.5, score: 235, spawnAfterSeconds: 90, aiArchetype: 'pack-feint-lunge', districtFamilies: Object.freeze(['country_road', 'dry_forest_cave']), poiIds: Object.freeze(['dry-forest-cave', 'crossroads-trading-post']), preferredRangeMode: 'melee', animationStates: Object.freeze(['idle', 'run', 'attack-tell', 'attack', 'hit', 'death']), attackPatterns: Object.freeze(['pack-feint-lunge', 'side-lane-collapse']), deathEffect: 'dust skid + bone-chip burst', tells: 'head drops and shoulders coil before the pack leap' }),
  Object.freeze({ id: 'wild-boar', title: 'Wild Boar', class: 'charger-animal', baseHealth: 24, damage: 15, speed: 3.1, score: 275, spawnAfterSeconds: 105, aiArchetype: 'straight-line-charge', districtFamilies: Object.freeze(['country_road', 'dry_forest_cave']), poiIds: Object.freeze(['dry-forest-cave', 'crossroads-trading-post']), preferredRangeMode: 'melee', animationStates: Object.freeze(['idle', 'run', 'attack-tell', 'attack', 'hit', 'death']), attackPatterns: Object.freeze(['hoof-scrape-charge', 'recovery-skid-turn']), deathEffect: 'dirt spray + tusk-chip burst', tells: 'front hoof scrapes dirt before the charge commits' }),
  Object.freeze({ id: 'buzzard', title: 'Buzzard', class: 'flyer-animal', baseHealth: 14, damage: 10, speed: 2.7, score: 185, spawnAfterSeconds: 85, aiArchetype: 'circle-dive-harass', districtFamilies: Object.freeze(['desert_approach', 'oasis_lakeside']), poiIds: Object.freeze(['old-hashrate-camp', 'oasis-lakeside']), preferredRangeMode: 'ranged', animationStates: Object.freeze(['hover', 'bank', 'attack-tell', 'dive', 'hit', 'death']), attackPatterns: Object.freeze(['shadow-mark-dive', 'peck-pass']), deathEffect: 'feather burst + dust spiral', tells: 'ground shadow tightens before the dive line' }),
  Object.freeze({ id: 'rattlesnake', title: 'Rattlesnake', class: 'ambusher-animal', baseHealth: 20, damage: 14, speed: 2.5, score: 255, spawnAfterSeconds: 100, aiArchetype: 'coil-rattle-strike', districtFamilies: Object.freeze(['desert_approach', 'residential_edge', 'oasis_lakeside']), poiIds: Object.freeze(['oasis-lakeside', 'mesa-overlook']), preferredRangeMode: 'melee', animationStates: Object.freeze(['idle', 'burrow', 'attack-tell', 'attack', 'hit', 'death']), attackPatterns: Object.freeze(['coil-rattle-strike', 'sand-recoil-reset']), deathEffect: 'sand plume + venom mist flicker', tells: 'tail rattle and head lift sync before the strike' }),
  Object.freeze({ id: 'scorpion-ambusher', title: 'Scorpion Ambusher', class: 'burrow-trap', baseHealth: 22, damage: 15, speed: 2.4, score: 280, spawnAfterSeconds: 110, aiArchetype: 'burrow-tail-strike', districtFamilies: Object.freeze(['desert_approach', 'oasis_lakeside']), poiIds: Object.freeze(['old-hashrate-camp', 'oasis-lakeside']), preferredRangeMode: 'melee', animationStates: Object.freeze(['idle', 'burrow', 'attack-tell', 'attack', 'hit', 'death']), attackPatterns: Object.freeze(['sand-burrow-pop', 'tail-overhead-sting']), deathEffect: 'sand plume + neon venom spray', tells: 'tail rises out of the sand before the sting breaks the surface' }),
  Object.freeze({ id: 'bandit-captain', title: 'Bandit Captain', class: 'elite-ranged-human', enemyKey: 'evilBanker', baseHealth: 38, damage: 18, speed: 1.95, score: 520, spawnAfterSeconds: 190, aiArchetype: 'banner-plant-volley', districtFamilies: Object.freeze(['country_road', 'ghost_town']), poiIds: Object.freeze(['crossroads-trading-post', 'rugpull-gulch']), preferredRangeMode: 'ranged', animationStates: Object.freeze(['idle', 'walk', 'attack-tell', 'attack', 'command-point', 'hit', 'death']), attackPatterns: Object.freeze(['banner-plant-buff', 'sidearm-burst', 'wagon-flank-order']), deathEffect: 'banner shred + brass spark burst + dust plume', tells: 'banner drops and off-hand sidearm flares before the order burst' }),
  Object.freeze({ id: 'ridge-raider', title: 'Ridge Raider', class: 'sniper-human', enemyKey: 'evilBanker', baseHealth: 30, damage: 17, speed: 1.7, score: 410, spawnAfterSeconds: 165, aiArchetype: 'ridge-scope-relocate', districtFamilies: Object.freeze(['residential_edge']), poiIds: Object.freeze(['mesa-overlook']), preferredRangeMode: 'ranged', animationStates: Object.freeze(['idle', 'walk', 'attack-tell', 'attack', 'reload', 'hit', 'death']), attackPatterns: Object.freeze(['scope-volley', 'switchback-reposition']), deathEffect: 'scope-glint shards + cliff dust burst', tells: 'scope glint holds a beat before the ridge shot breaks' }),
  Object.freeze({ id: 'slippage-skater', title: 'Slippage Skater', class: 'mid-tier-rusher', baseHealth: 20, damage: 14, speed: 3.6, score: 260, spawnAfterSeconds: 130, aiArchetype: 'overshoot-u-turn', districtFamilies: Object.freeze(['country_road', 'inner_city']), preferredRangeMode: 'melee', animationStates: Object.freeze(['skate', 'attack-tell', 'slide-rush', 'u-turn', 'hit', 'wipeout', 'death']), attackPatterns: Object.freeze(['slide-rush', 'overshoot-return']), deathEffect: 'ice-trail shards + orange skid sparks', tells: 'skates spark before line rush' }),

  Object.freeze({ id: 'phishing-angler', title: 'Phishing Angler', class: 'zoning-hook', baseHealth: 24, damage: 16, speed: 1.2, score: 300, spawnAfterSeconds: 180, aiArchetype: 'fake-wallet-lure', districtFamilies: Object.freeze(['residential_edge', 'inner_city']), preferredRangeMode: 'ranged', animationStates: Object.freeze(['idle-cast', 'attack-tell', 'popup-lure', 'reel', 'melee', 'hit', 'fade', 'death']), attackPatterns: Object.freeze(['connect-wallet-lure', 'hook-reel']), deathEffect: 'fake popup shatter + cloak smoke', tells: 'glowing Connect Wallet lure appears before hook is active' }),
  Object.freeze({ id: 'mev-reaper', title: 'MEV Reaper', class: 'elite-flanker', baseHealth: 34, damage: 19, speed: 3.0, score: 420, spawnAfterSeconds: 240, aiArchetype: 'sandwich-pincer', districtFamilies: Object.freeze(['inner_city', 'residential_edge']), preferredRangeMode: 'melee', animationStates: Object.freeze(['cloak', 'attack-tell', 'dash-flank', 'sandwich-strike', 'hit', 'vanish', 'death']), attackPatterns: Object.freeze(['two-sided-pincer', 'same-frame-blade-strike']), deathEffect: 'dark cloak tear + sandwich-blade sparks', tells: 'two shadows split to either side' }),
  Object.freeze({ id: 'liquidation-cascade-golem', title: 'Liquidation Cascade Golem', class: 'armored-elite', baseHealth: 54, damage: 24, speed: 0.9, score: 560, spawnAfterSeconds: 360, aiArchetype: 'slow-armored-shockwave', districtFamilies: Object.freeze(['inner_city']), preferredRangeMode: 'melee', animationStates: Object.freeze(['stomp', 'attack-tell', 'block-stack', 'shockwave', 'crack', 'cascade-collapse', 'death']), attackPatterns: Object.freeze(['armored-stomp', 'death-cascade-shockwave']), deathEffect: 'stacked red ticker blocks collapse into chain shockwave', tells: 'block stack flashes margin-call red before collapse' }),
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
  // Isometric roguelike scheme — SIMPLIFIED. Desktop: WASD/arrows move; the gun
  // AUTO-FIRES toward the mouse cursor. Left click = manual fire, right click
  // or F = grenade (the only manual action). Melee/axes removed so the player
  // focuses on movement + positioning. Mobile: drag to move + auto-fire in the
  // heading direction; on-screen buttons for grenade/power-up.
  keyboard: Object.freeze({ move: 'WASD / Arrow Keys', aim: 'Mouse (gun auto-fires)', fire: 'Left Click (manual fire)', grenade: 'Right Click / F', reload: 'R (auto on empty)', pause: 'Esc', powerUp: 'on-screen / hotkey' }),
  gamepad: Object.freeze({ move: 'Left Stick / D-Pad', aim: 'Right Stick (auto-fire)', grenade: 'B / RB', pause: 'Start' }),
  touch: Object.freeze({ move: 'drag to move (auto-fire heading dir)', grenade: 'NADE button', powerUp: 'POWER button' }),
  accessibility: Object.freeze(['rebindable controls', 'screen shake toggle', 'flash intensity toggle', 'music/sfx sliders', 'high-contrast projectile option']),
});

export const LESTER_BLASTER_MENU_OPTIONS = Object.freeze({
  main: Object.freeze([
    Object.freeze({ id: 'connect-wallet', title: 'Connect Wallet', section: 'login', description: 'Activate the parent Lester account.' }),
    Object.freeze({ id: 'free-run', title: 'Free Run', section: 'play', description: 'Casual infinite run; local score only.' }),
    Object.freeze({ id: 'paid-run', title: 'Ranked Run ⛓', section: 'play', description: 'Leaderboard-eligible run published on-chain to LitVM (testnet: zkLTC gas only).' }),
    Object.freeze({ id: 'loadout', title: 'Loadout', section: 'prep', description: 'Choose character, primary weapon, grenade, and cosmetic unlocks.' }),
    Object.freeze({ id: 'leaderboard', title: 'Leaderboard', section: 'scores', description: 'Global ranked high-score board.' }),
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
  Object.freeze({ id: 'skin-litecoin-silver', type: 'skin', title: 'Litecoin Silver Armor', unlock: 'score 10,000+ in Ranked Testnet' }),
  Object.freeze({ id: 'character-lester', type: 'character', title: 'Lester', unlock: 'clear Level 1: The Crypto Wasteland' }),
  Object.freeze({ id: 'character-lilly', type: 'character', title: 'Lilly', unlock: 'play 10 ranked matches' }),
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
    title: 'Level 1: Crypto Wasteland',
    subtitle: 'Desert Approach → Ghost Town → Crossroads → City Threshold',
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
  {
    id: 'chikun',
    title: 'Chikun: The Flying Coin',
    cabinet: 'FLAPPY CABINET 04',
    genre: 'One-button flappy-bird arcade with Litecoin coin mechanic',
    status: 'coming-soon',
    publicPlayable: false,
    devPlayable: true,
    developer: 'Louie / LitVM Port Team',
    entryFeeMicroUsdc: DEFAULT_ENTRY_FEE_MICRO_USDC,
    livesPaid: 3,
    livesFree: Infinity,
    tagline: 'Tap to flap. Dodge the forks. Stack the silver.',
    systemRole: 'child-dapp-cartridge',
    parentSystem: 'Lester\'s Arcade',
    presentation: Object.freeze({
      medium: 'snes-cartridge',
      colorway: 'gold-neon-cyan',
      cabinetAsset: './assets/cabinet-chikun.svg',
      cartridgeAsset: './assets/cartridge-chikun.svg',
      marquee: 'CHIKUN',
    }),
    desktopCabinetSprite: Object.freeze({
      id: 'chikun-cabinet',
      frameDurationMs: 600,
      frames: Object.freeze([
        Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-front.png?v=transparent-v2', durationMs: 600 }),
        Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-front-right.png?v=transparent-v2', durationMs: 600 }),
        Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-right.png?v=transparent-v2', durationMs: 600 }),
        Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-back.png?v=transparent-v2', durationMs: 600 }),
        Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-left.png?v=transparent-v2', durationMs: 600 }),
        Object.freeze({ src: './assets/generated/chikun-cabinet/chikun-cabinet-front-right-low.png?v=transparent-v2', durationMs: 600 }),
      ]),
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


const roguelikeStatDefaults = () => Object.fromEntries(
  LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY
    .filter((skill) => skill.stat)
    .map((skill) => [skill.stat, 1]),
);

// Per-hero STARTING stat identity (multipliers layered on the level-1 defaults).
// These give each playable hero a distinct, balanced play style; level-up
// upgrades stack on top of these starting values. Trade-offs keep them even:
//   lit-commando = tanky bruiser (more HP/damage/armor, a touch slower)
//   lit-valkyrie = agile glass-cannon (faster, higher fire-rate/crit, less HP)
//   lester-original = balanced unlockable based on Justin's Lester reference art
//   lilly = agile unlockable based on Justin's Lilly reference art
export const HERO_STARTING_STAT_MODIFIERS = Object.freeze(Object.fromEntries(
  Object.entries(HMH_PLAYABLE_CHARACTER_STAT_IDENTITIES).map(([id, identity]) => [id, Object.freeze({ ...identity.simMultipliers })]),
));

function roguelikeStartingStatsFor(characterId) {
  const stats = roguelikeStatDefaults();
  const mods = HERO_STARTING_STAT_MODIFIERS[characterId];
  if (mods) {
    for (const [key, mult] of Object.entries(mods)) {
      stats[key] = (stats[key] ?? 1) * mult;
    }
  }
  return stats;
}

export const ROGUELIKE_LEVEL_CAP = 80;
export const POST_CAP_XP_TO_SCORE = 2;

export function roguelikeXpCostForLevel(level = 1) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  const completedLevels = safeLevel - 1;
  // Wave 2 economy: cheap early levels, quadratic late stretch, hard cap at 80.
  // Tuned against the current Level 1 spawn/kill XP simulator so strong runs land
  // L58-L70 at 20:00 and rare record chases can touch L72-L80 by ~28:00.
  return Math.round(45 + completedLevels * 2.5 + completedLevels * completedLevels * 0.15);
}

export function calculateRoguelikeKillXp(enemy = {}) {
  const score = Math.max(0, Number(enemy.score) || 80);
  const tier = enemy.tier ?? null;
  let value = 8 + Math.round(Math.min(score, 260) / 48);
  if (tier === 'heavy') value += 3;
  if (enemy.elite) value += 8;
  if (enemy.miniBoss) value = Math.max(value, 62);
  if (enemy.boss) value = Math.max(value, 115);
  return Math.max(6, Math.min(enemy.miniBoss ? 80 : enemy.boss ? 140 : 26, value));
}

export const HMH_LEVEL_ONE_PLAYTEST_BALANCE = Object.freeze({
  mode: 'open-ended-survival',
  eliteBandSeconds: Object.freeze({ start: 20 * 60, end: 25 * 60 }),
  world: Object.freeze({
    // User playtest note: the previous 1050x900 finite map felt too large.
    // Keep the authored route dense and halve the runtime footprint for faster
    // loading, better framerate, and less empty traversal.
    width: 525,
    height: 450,
    traversalTargetPct: 0.58,
    traversalEfficiency: 0.32,
    traversalBudgetSeconds: 4 * 60,
  }),
  player: Object.freeze({
    baseMoveSpeedTilesPerSecond: 4.15,
    expectedCircleKiteEfficiency: 0.32,
  }),
  pressure: Object.freeze({
    combinedTauSeconds: 540,
  }),
  director: Object.freeze({
    spawnIntervalStartSeconds: 2.45,
    spawnIntervalFloorSeconds: 0.34,
    spawnIntervalTauSeconds: 420,
    maxEnemiesStart: 14,
    maxEnemiesCap: 140,
    maxEnemiesTauSeconds: 480,
    chaseShareStart: 0.62,
    chaseShareCap: 0.78,
    chaseShareTauSeconds: 520,
    rangedShareStart: 0.18,
    rangedShareCap: 0.31,
    rangedShareTauSeconds: 560,
    eliteShareStart: 0.02,
    eliteShareCap: 0.38,
    eliteShareTauSeconds: 540,
    projectileSpeedStart: 1,
    projectileSpeedCap: 1.72,
    projectileSpeedTauSeconds: 600,
    archetypeMixStart: 2,
    archetypeMixCap: 7,
    archetypeMixTauSeconds: 480,
    packCohesionStart: 0.12,
    packCohesionCap: 0.82,
    packCohesionTauSeconds: 600,
    patternDensityStart: 1,
    patternDensityCap: 2.4,
    patternDensityTauSeconds: 520,
    healthMultiplierStart: 1,
    healthMultiplierCap: 2,
    healthMultiplierTauSeconds: 900,
    damageMultiplierStart: 1,
    damageMultiplierCap: 1.35,
    damageMultiplierTauSeconds: 600,
  }),
  drops: Object.freeze({
    normalStartChance: 0.16,
    normalCapChance: 0.36,
    normalTauSeconds: 520,
    rareChance: 1,
  }),
  pickupAssist: Object.freeze({
    xpAttractRadiusStartMultiplier: 1,
    xpAttractRadiusCapMultiplier: 2.35,
    xpAttractSpeedStartMultiplier: 1,
    xpAttractSpeedCapMultiplier: 2.1,
    xpTtlStartFrames: 900,
    xpTtlCapFrames: 1320,
    powerUpAttractRadiusStartMultiplier: 1,
    powerUpAttractRadiusCapMultiplier: 1.75,
    powerUpTtlStartFrames: 720,
    powerUpTtlCapFrames: 960,
    maxLooseXpGems: 180,
    maxLoosePowerUps: 42,
  }),
  performance: Object.freeze({
    maxParticlesStart: 210,
    maxParticlesCap: 150,
    maxFloatingTextsStart: 84,
    maxFloatingTextsCap: 64,
    hitSparkEveryNthHitStart: 1,
    hitSparkEveryNthHitCap: 3,
    deathBurstStartScale: 1,
    deathBurstCapScale: 0.62,
    maxAnimatedEnemiesStart: 72,
    maxAnimatedEnemiesCap: 48,
    enemyAnimationFpsStart: 12,
    enemyAnimationFpsCap: 8,
    obstacleRenderRadiusWindowedStart: 18,
    obstacleRenderRadiusWindowedCap: 15,
    obstacleRenderRadiusFullscreenStart: 45,
    obstacleRenderRadiusFullscreenCap: 34,
    groundOverscanWindowedStartTiles: 6,
    groundOverscanWindowedCapTiles: 4,
    groundOverscanFullscreenStartTiles: 20,
    groundOverscanFullscreenCapTiles: 10,
    reduceMotionScale: 0.58,
  }),
  xpPacing: Object.freeze({
    passiveRun: Object.freeze({ assumedKillsPerMinute: 8, targetLevelAtEliteBand: 24 }),
    swarmFighterRun: Object.freeze({ assumedKillsPerMinute: 20, targetLevelAtEliteBand: 50 }),
  }),
});

export const HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE = Object.freeze([
  Object.freeze({ id: 'beat-001-mini-pair', type: 'mini-boss-pair', startSeconds: 210, pressureTier: 1, rosterOffset: 0 }),
  Object.freeze({ id: 'beat-002-major-boss', type: 'major-boss', startSeconds: 510, pressureTier: 1, rosterOffset: 0 }),
  Object.freeze({ id: 'beat-003-mini-pair', type: 'mini-boss-pair', startSeconds: 690, pressureTier: 2, rosterOffset: 1 }),
  Object.freeze({ id: 'beat-004-major-rematch', type: 'major-boss', startSeconds: 870, pressureTier: 2, rosterOffset: 0 }),
  Object.freeze({ id: 'beat-005-mini-pair', type: 'mini-boss-pair', startSeconds: 1050, pressureTier: 3, rosterOffset: 2 }),
  Object.freeze({ id: 'beat-006-major-rematch', type: 'major-boss', startSeconds: 1230, pressureTier: 3, rosterOffset: 0 }),
  Object.freeze({ id: 'beat-007-mini-pair', type: 'mini-boss-pair', startSeconds: 1410, pressureTier: 4, rosterOffset: 0 }),
  Object.freeze({ id: 'beat-008-major-rematch', type: 'major-boss', startSeconds: 1590, pressureTier: 4, rosterOffset: 0 }),
]);

export const LEVEL_ONE_THREAT_BEAT_TYPES = Object.freeze([
  'SURGE',
  'PINCER',
  'HUNTER',
  'ARTILLERY_MINUTE',
  'BLACKOUT',
]);

const LEVEL_ONE_THREAT_BEAT_META = Object.freeze({
  SURGE: Object.freeze({ label: 'SURGE', telegraph: 'one-gate weak swarm', durationSeconds: 28, composition: Object.freeze({ swarm: 30, rangedBias: 0.08, eliteBias: 0 }) }),
  PINCER: Object.freeze({ label: 'PINCER', telegraph: 'opposite-gate synchronized packs', durationSeconds: 34, composition: Object.freeze({ packs: 2, rangedBias: 0.16, flankBias: 0.42 }) }),
  HUNTER: Object.freeze({ label: 'HUNTER', telegraph: 'bounty elite enters fast', durationSeconds: 36, composition: Object.freeze({ elites: 1, bounty: true, flankBias: 0.2 }) }),
  ARTILLERY_MINUTE: Object.freeze({ label: 'ARTILLERY MINUTE', telegraph: 'ranged-heavy dodge pressure', durationSeconds: 60, composition: Object.freeze({ rangedBias: 0.48, volleyBias: 0.35 }) }),
  BLACKOUT: Object.freeze({ label: 'BLACKOUT', telegraph: 'ambient light drop; neon and muzzle flashes carry the read', durationSeconds: 8, composition: Object.freeze({ ambientDimPct: 40, rangedBias: 0.18 }) }),
});

function threatBeatHash(seed = 0, salt = 0) {
  let x = (Math.imul((Number(seed) || 0) >>> 0, 1664525) + 1013904223 + Math.imul(salt + 1, 2246822519)) >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 2246822507) >>> 0;
  x ^= x >>> 13;
  return x >>> 0;
}

export function levelOneThreatBeatSchedule({ seed = 0, minutes = 15 } = {}) {
  const totalSeconds = Math.max(0, Number(minutes) || 0) * 60;
  const offset = threatBeatHash(seed, 11) % LEVEL_ONE_THREAT_BEAT_TYPES.length;
  let cursor = 60 + (threatBeatHash(seed, 3) % 16);
  const beats = [];
  let index = 0;
  while (cursor <= totalSeconds) {
    const type = LEVEL_ONE_THREAT_BEAT_TYPES[(offset + index) % LEVEL_ONE_THREAT_BEAT_TYPES.length];
    const meta = LEVEL_ONE_THREAT_BEAT_META[type];
    beats.push(Object.freeze({
      id: `wo42-${String(index + 1).padStart(2, '0')}-${type.toLowerCase().replace(/_/g, '-')}`,
      type,
      label: meta.label,
      startSeconds: Math.round(cursor),
      endSeconds: Math.round(cursor + meta.durationSeconds),
      durationSeconds: meta.durationSeconds,
      telegraphSeconds: 2,
      telegraph: meta.telegraph,
      composition: meta.composition,
    }));
    cursor += 60 + (threatBeatHash(seed, 100 + index) % 31);
    index += 1;
  }
  return Object.freeze(beats);
}

export function levelOneThreatBeatAt(elapsedSeconds = 0, { seed = 0 } = {}) {
  const seconds = Math.max(0, Number(elapsedSeconds) || 0);
  const schedule = levelOneThreatBeatSchedule({ seed, minutes: Math.max(15, Math.ceil(seconds / 60) + 2) });
  return schedule.find((beat) => seconds >= beat.startSeconds - beat.telegraphSeconds && seconds <= beat.endSeconds) ?? null;
}

export const HMH_LEVEL_ONE_SHIP_FOCUS = Object.freeze({
  mode: 'open-ended-survival',
  runEndsOnlyOnDeath: true,
  levelOneOnlyUntilPolished: true,
  targetLevelId: 'level-1-crypto-wasteland',
  deferredSystems: Object.freeze(['level-2-litecoin-city', 'level-3-the-getaway']),
  polishPriorities: Object.freeze([
    'ground/path/water tiles',
    'biome-authored towns/forests/waterfronts',
    'parallax bridges/tunnels/cliffs/overpasses',
    'playable hero sprite/animation QA',
    'enemy and boss animation readability',
    '100%-scale enemy hit detection',
    'combat physics/VFX/audio feel',
  ]),
  note: 'Level 1 has no 8-minute target or milestone. Pressure climbs smoothly from 0:00, elite play should reach the 20-25 minute band, and runs end on death.',
});

export const HMH_LEVEL_ONE_BOSS_PROXY_ROSTER = Object.freeze([
  Object.freeze({ role: 'mini-boss', zoneId: 'ghost-saloon-mainstreet', enemyId: 'claim-jumper-sheriff', title: 'Claim-Jumper Sheriff', humanoid: true, animatedCuratedAssetKey: 'universal/enemy/claim-jumper', read: 'rifle humanoid commander for the first saloon lock' }),
  Object.freeze({ role: 'mini-boss', zoneId: 'dead-forest-mushroom-grove', enemyId: 'scam-cult-zealot', title: 'Scam Cult Zealot Alpha', humanoid: true, animatedCuratedAssetKey: 'universal/enemy/scam-cult-zealot', read: 'fully animated humanoid zealot used as forest-loop pressure until bespoke mini-boss art exists' }),
  Object.freeze({ role: 'mini-boss', zoneId: 'warehouse-gas-station-yard', enemyId: 'gas-beast', title: 'Gas Beast Tank', humanoid: true, animatedCuratedAssetKey: 'universal/enemy/gas-beast-tank', read: 'large humanoid tank for warehouse/gas-station pressure' }),
  Object.freeze({ role: 'boss', zoneId: 'rugpull-gulch-boss-yard', enemyId: 'bandit-captain', title: 'Bandit Captain', humanoid: true, animatedCuratedAssetKey: 'universal/enemy/evil-banker-ranged', read: 'ranged humanoid captain scaled as the temporary Level 1 boss proxy' }),
]);

export function levelOneRoguelikeBossProxyRoster() {
  return HMH_LEVEL_ONE_BOSS_PROXY_ROSTER;
}

export function buildLevelOneRunWorldDimensions({
  width = HMH_LEVEL_ONE_PLAYTEST_BALANCE.world.width,
  height = HMH_LEVEL_ONE_PLAYTEST_BALANCE.world.height,
  targetSessionSeconds = HMH_LEVEL_ONE_PLAYTEST_BALANCE.world.traversalBudgetSeconds,
  moveSpeedTilesPerSecond = HMH_LEVEL_ONE_PLAYTEST_BALANCE.player.baseMoveSpeedTilesPerSecond,
  traversalEfficiency = HMH_LEVEL_ONE_PLAYTEST_BALANCE.world.traversalEfficiency,
} = {}) {
  const safeWidth = Math.max(1, Math.round(Number(width) || HMH_LEVEL_ONE_PLAYTEST_BALANCE.world.width));
  const safeHeight = Math.max(1, Math.round(Number(height) || HMH_LEVEL_ONE_PLAYTEST_BALANCE.world.height));
  const uniqueTiles = Math.max(0, Number(moveSpeedTilesPerSecond) || 0) * Math.max(0, Number(targetSessionSeconds) || 0) * Math.max(0, Number(traversalEfficiency) || 0);
  const baselineAxis = Math.max(safeWidth, safeHeight);
  const minX = -safeWidth / 2;
  const maxX = safeWidth / 2;
  const minY = -safeHeight / 2;
  const maxY = safeHeight / 2;
  return Object.freeze({
    finite: true,
    origin: 'center',
    width: safeWidth,
    height: safeHeight,
    minX,
    maxX,
    minY,
    maxY,
    boundaryInsetTiles: 4,
    targetSessionSeconds,
    moveSpeedTilesPerSecond,
    traversalEfficiency,
    traversalTargetPct: HMH_LEVEL_ONE_PLAYTEST_BALANCE.world.traversalTargetPct,
    expectedUniqueTraversalTiles: Number(uniqueTiles.toFixed(1)),
    expectedUniqueTraversalPct: Number(clampNumber(uniqueTiles / baselineAxis, 0, 1).toFixed(3)),
  });
}

export function clampLevelOneWorldPoint({ x = 0, y = 0, world = buildLevelOneRunWorldDimensions() } = {}) {
  const safeWorld = world ?? buildLevelOneRunWorldDimensions();
  const minX = Number.isFinite(safeWorld.minX) ? safeWorld.minX : -((safeWorld.width ?? 1) / 2);
  const maxX = Number.isFinite(safeWorld.maxX) ? safeWorld.maxX : ((safeWorld.width ?? 1) / 2);
  const minY = Number.isFinite(safeWorld.minY) ? safeWorld.minY : -((safeWorld.height ?? 1) / 2);
  const maxY = Number.isFinite(safeWorld.maxY) ? safeWorld.maxY : ((safeWorld.height ?? 1) / 2);
  const rawX = Number(x) || 0;
  const rawY = Number(y) || 0;
  const clampedX = clampNumber(rawX, minX, maxX);
  const clampedY = clampNumber(rawY, minY, maxY);
  return Object.freeze({ x: Number(clampedX.toFixed(3)), y: Number(clampedY.toFixed(3)), clamped: clampedX !== rawX || clampedY !== rawY });
}

export function pointWithinLevelOneBounds({ x = 0, y = 0, world = buildLevelOneRunWorldDimensions() } = {}) {
  return !clampLevelOneWorldPoint({ x, y, world }).clamped;
}

function levelOneMinimapMarker({ x = 0, y = 0, world = buildLevelOneRunWorldDimensions(), id = null, label = null, tone = 'cyan' } = {}) {
  const clamped = clampLevelOneWorldPoint({ x, y, world });
  const width = Math.max(1, world.width ?? (world.maxX - world.minX) ?? 1);
  const height = Math.max(1, world.height ?? (world.maxY - world.minY) ?? 1);
  const minX = Number.isFinite(world.minX) ? world.minX : -width / 2;
  const minY = Number.isFinite(world.minY) ? world.minY : -height / 2;
  return Object.freeze({
    id,
    label,
    tone,
    x: Number(clampNumber((clamped.x - minX) / width, 0, 1).toFixed(3)),
    y: Number(clampNumber((clamped.y - minY) / height, 0, 1).toFixed(3)),
    edgeClamped: clamped.clamped,
  });
}

function levelOneExplorationGrid({ world = buildLevelOneRunWorldDimensions(), cellSize = 8 } = {}) {
  const safeWorld = world ?? buildLevelOneRunWorldDimensions();
  const safeCellSize = Math.max(2, Math.round(Number(cellSize) || 8));
  const width = Math.max(1, safeWorld.width ?? (safeWorld.maxX - safeWorld.minX) ?? 1);
  const height = Math.max(1, safeWorld.height ?? (safeWorld.maxY - safeWorld.minY) ?? 1);
  return Object.freeze({
    cellSize: safeCellSize,
    columns: Math.max(1, Math.ceil(width / safeCellSize)),
    rows: Math.max(1, Math.ceil(height / safeCellSize)),
    minX: Number.isFinite(safeWorld.minX) ? safeWorld.minX : -width / 2,
    minY: Number.isFinite(safeWorld.minY) ? safeWorld.minY : -height / 2,
  });
}

function levelOneExplorationCellForPoint({ x = 0, y = 0, world = buildLevelOneRunWorldDimensions(), cellSize = 8 } = {}) {
  const grid = levelOneExplorationGrid({ world, cellSize });
  const clamped = clampLevelOneWorldPoint({ x, y, world });
  const col = Math.max(0, Math.min(grid.columns - 1, Math.floor((clamped.x - grid.minX) / grid.cellSize)));
  const row = Math.max(0, Math.min(grid.rows - 1, Math.floor((clamped.y - grid.minY) / grid.cellSize)));
  return Object.freeze({ col, row, key: `${col},${row}` });
}

function normalizedVisitedCellSet(visitedCells = []) {
  const raw = visitedCells instanceof Set ? [...visitedCells] : Array.isArray(visitedCells) ? visitedCells : [];
  return new Set(raw.filter((value) => /^\d+,\d+$/.test(String(value))).map(String));
}

export function updateLevelOneExplorationTrail({
  world = buildLevelOneRunWorldDimensions(),
  player = { x: 0, y: 0 },
  visitedCells = [],
  cellSize = 8,
  revealRadius = 1,
} = {}) {
  const grid = levelOneExplorationGrid({ world, cellSize });
  const playerCell = levelOneExplorationCellForPoint({ x: player.x, y: player.y, world, cellSize: grid.cellSize });
  const revealed = normalizedVisitedCellSet(visitedCells);
  const radius = Math.max(0, Math.round(Number(revealRadius) || 0));
  for (let col = playerCell.col - radius; col <= playerCell.col + radius; col += 1) {
    for (let row = playerCell.row - radius; row <= playerCell.row + radius; row += 1) {
      if (col < 0 || row < 0 || col >= grid.columns || row >= grid.rows) continue;
      revealed.add(`${col},${row}`);
    }
  }
  return Object.freeze([...revealed].sort((a, b) => {
    const [ac, ar] = a.split(',').map(Number);
    const [bc, br] = b.split(',').map(Number);
    return ar - br || ac - bc;
  }));
}

export function buildLevelOneExplorationFogModel({
  world = buildLevelOneRunWorldDimensions(),
  player = { x: 0, y: 0 },
  visitedCells = [],
  cellSize = 8,
  revealRadius = 1,
} = {}) {
  const safeWorld = world ?? buildLevelOneRunWorldDimensions();
  const grid = levelOneExplorationGrid({ world: safeWorld, cellSize });
  const trail = updateLevelOneExplorationTrail({ world: safeWorld, player, visitedCells, cellSize: grid.cellSize, revealRadius });
  const revealedKeys = normalizedVisitedCellSet(trail);
  const playerCell = levelOneExplorationCellForPoint({ x: player.x, y: player.y, world: safeWorld, cellSize: grid.cellSize });
  const revealedCells = [];
  const fogCells = [];
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.columns; col += 1) {
      const key = `${col},${row}`;
      const cell = Object.freeze({
        key,
        col,
        row,
        x: Number((col / grid.columns).toFixed(4)),
        y: Number((row / grid.rows).toFixed(4)),
        w: Number((1 / grid.columns).toFixed(4)),
        h: Number((1 / grid.rows).toFixed(4)),
      });
      if (revealedKeys.has(key)) revealedCells.push(cell);
      else fogCells.push(cell);
    }
  }
  const total = Math.max(1, grid.columns * grid.rows);
  return Object.freeze({
    version: 'wo-69-level-one-exploration-v1',
    grid,
    playerCell,
    visitedCells: trail,
    revealedKeys,
    revealedCells: Object.freeze(revealedCells),
    fogCells: Object.freeze(fogCells),
    coveragePct: Number((revealedCells.length / total).toFixed(3)),
  });
}

export function levelOneVisionFogStateForPoint(model, { x = 0, y = 0 } = {}) {
  if (!model?.grid || !model?.stateByKey) return 'visible';
  const col = Math.max(0, Math.min(model.grid.columns - 1, Math.floor(((Number(x) || 0) - model.grid.minX) / model.grid.cellSize)));
  const row = Math.max(0, Math.min(model.grid.rows - 1, Math.floor(((Number(y) || 0) - model.grid.minY) / model.grid.cellSize)));
  return model.stateByKey[`${col},${row}`] ?? 'hidden';
}

export function buildLevelOneVisionFogModel({
  world = buildLevelOneRunWorldDimensions(),
  player = { x: 0, y: 0 },
  visitedCells = [],
  cellSize = 8,
  visibleRadius = 1,
} = {}) {
  const safeWorld = world ?? buildLevelOneRunWorldDimensions();
  const grid = levelOneExplorationGrid({ world: safeWorld, cellSize });
  const playerCell = levelOneExplorationCellForPoint({ x: player.x, y: player.y, world: safeWorld, cellSize: grid.cellSize });
  const visitedKeys = normalizedVisitedCellSet(visitedCells);
  const radius = Math.max(1, Math.round(Number(visibleRadius) || 1));
  const visibleKeys = new Set();
  for (let col = playerCell.col - radius; col <= playerCell.col + radius; col += 1) {
    for (let row = playerCell.row - radius; row <= playerCell.row + radius; row += 1) {
      if (col < 0 || row < 0 || col >= grid.columns || row >= grid.rows) continue;
      visibleKeys.add(`${col},${row}`);
    }
  }

  const states = { visible: [], explored: [], hidden: [] };
  const stateByKey = {};
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.columns; col += 1) {
      const key = `${col},${row}`;
      const state = visibleKeys.has(key) ? 'visible' : visitedKeys.has(key) ? 'explored' : 'hidden';
      stateByKey[key] = state;
      states[state].push(Object.freeze({
        key,
        col,
        row,
        state,
        minX: Number((grid.minX + col * grid.cellSize).toFixed(3)),
        maxX: Number((grid.minX + (col + 1) * grid.cellSize).toFixed(3)),
        minY: Number((grid.minY + row * grid.cellSize).toFixed(3)),
        maxY: Number((grid.minY + (row + 1) * grid.cellSize).toFixed(3)),
      }));
    }
  }
  const frozenStates = Object.freeze({
    visible: Object.freeze(states.visible),
    explored: Object.freeze(states.explored),
    hidden: Object.freeze(states.hidden),
  });
  return Object.freeze({
    version: 'wo-70-level-one-vision-fog-v1',
    grid,
    playerCell: Object.freeze({ ...playerCell, state: 'visible' }),
    stateByKey: Object.freeze(stateByKey),
    states: frozenStates,
    layers: Object.freeze([
      Object.freeze({ state: 'hidden', cells: frozenStates.hidden, fill: 'rgba(0, 0, 0, 0.58)', alpha: 0.58 }),
      Object.freeze({ state: 'explored', cells: frozenStates.explored, fill: 'rgba(3, 7, 17, 0.28)', alpha: 0.28 }),
    ]),
    fairness: Object.freeze({
      playerSafeRadiusCells: radius,
      rule: 'Player cell and adjacent melee-threat cells remain visible; explored cells use haze instead of blackout; hidden cells carry noir blackout.',
    }),
  });
}

function levelOneExplorationRevealsPoint(explorationModel, { x = 0, y = 0, world = buildLevelOneRunWorldDimensions() } = {}) {
  if (!explorationModel?.revealedKeys) return true;
  const cell = levelOneExplorationCellForPoint({ x, y, world, cellSize: explorationModel.grid?.cellSize ?? 8 });
  return explorationModel.revealedKeys.has(cell.key);
}

export function buildLevelOneMinimapModel({
  world = buildLevelOneRunWorldDimensions(),
  player = { x: 0, y: 0 },
  enemies = [],
  pois = [],
  extractionPoint = null,
  exploration = null,
} = {}) {
  const safeWorld = world ?? buildLevelOneRunWorldDimensions();
  const explorationModel = exploration
    ? buildLevelOneExplorationFogModel({
        world: safeWorld,
        player,
        visitedCells: exploration.visitedCells ?? [],
        cellSize: exploration.cellSize ?? 8,
        revealRadius: exploration.revealRadius ?? 1,
      })
    : null;
  const visibleEnemies = (Array.isArray(enemies) ? enemies : []).filter((enemy) => levelOneExplorationRevealsPoint(explorationModel, {
    x: enemy.mapX ?? enemy.x ?? 0,
    y: enemy.mapY ?? enemy.y ?? 0,
    world: safeWorld,
  }));
  const visiblePois = (Array.isArray(pois) ? pois : []).filter((poi) => levelOneExplorationRevealsPoint(explorationModel, {
    x: poi.worldX ?? poi.x ?? 0,
    y: poi.worldY ?? poi.y ?? 0,
    world: safeWorld,
  }));
  return Object.freeze({
    version: explorationModel ? 'wo-69-exploration-minimap-v2' : 'wo-21-finite-level-one-minimap-v1',
    bounds: Object.freeze({
      width: safeWorld.width,
      height: safeWorld.height,
      minX: safeWorld.minX,
      maxX: safeWorld.maxX,
      minY: safeWorld.minY,
      maxY: safeWorld.maxY,
    }),
    exploration: explorationModel ?? Object.freeze({ fogCells: Object.freeze([]), revealedCells: Object.freeze([]), coveragePct: 1 }),
    legend: Object.freeze({ explorationLabel: explorationModel ? `${Math.round(explorationModel.coveragePct * 100)}% explored` : 'Fully explored' }),
    player: levelOneMinimapMarker({ x: player.x, y: player.y, world: safeWorld, id: 'player', tone: 'green' }),
    enemies: Object.freeze(visibleEnemies.slice(0, 24).map((enemy, index) => levelOneMinimapMarker({
      x: enemy.mapX ?? enemy.x ?? 0,
      y: enemy.mapY ?? enemy.y ?? 0,
      world: safeWorld,
      id: enemy.id ?? `enemy-${index}`,
      tone: enemy.finalBossProxy || enemy.boss ? 'red' : enemy.elite || enemy.miniBoss ? 'orange' : 'magenta',
    }))),
    pois: Object.freeze(visiblePois.slice(0, 12).map((poi, index) => levelOneMinimapMarker({
      x: poi.worldX ?? poi.x ?? 0,
      y: poi.worldY ?? poi.y ?? 0,
      world: safeWorld,
      id: poi.id ?? `poi-${index}`,
      label: poi.label ?? poi.title ?? null,
      tone: 'cyan',
    }))),
    extraction: extractionPoint && levelOneExplorationRevealsPoint(explorationModel, { x: extractionPoint.worldX ?? extractionPoint.x ?? 0, y: extractionPoint.worldY ?? extractionPoint.y ?? 0, world: safeWorld }) ? levelOneMinimapMarker({
      x: extractionPoint.worldX ?? extractionPoint.x ?? 0,
      y: extractionPoint.worldY ?? extractionPoint.y ?? 0,
      world: safeWorld,
      id: 'extraction',
      label: extractionPoint.label ?? 'EXIT',
      tone: 'gold',
    }) : null,
  });
}

export function buildLevelOneBoundaryObstaclesNear({
  world = buildLevelOneRunWorldDimensions(),
  playerX = 0,
  playerY = 0,
  window = 45,
  segmentSpacingTiles = 24,
} = {}) {
  const safeWorld = world ?? buildLevelOneRunWorldDimensions();
  const spacing = Math.max(6, Math.round(Number(segmentSpacingTiles) || 24));
  const reach = Math.max(0, Number(window) || 0) + spacing;
  const px = Number(playerX) || 0;
  const py = Number(playerY) || 0;
  const segments = [];
  const boundaryVisualForSide = (side, index) => {
    const rotation = Math.abs(index) % 3;
    if (side === 'north') {
      return rotation === 0
        ? { key: 'wo102-megaprop/forest-rock-outcrop', role: 'wall', footprintTiles: { w: 5.2, h: 2.8 }, drawOrderBias: -4 }
        : { key: rotation === 1 ? 'level-1/prop/oval-rock4-ground-shadow' : 'level-1/prop/desert-09', role: 'wall', footprintTiles: { w: 2.4, h: 1.4 }, drawOrderBias: -3 };
    }
    if (side === 'south') {
      return rotation === 0
        ? { key: 'level-1/flora/broken-tree3', role: 'tree', footprintTiles: { w: 2.2, h: 2.8 }, drawOrderBias: 4 }
        : { key: rotation === 1 ? 'level-1/prop/dragon-bones-body-ground-shadow' : 'level-1/prop/oval-rock5-ground-shadow', role: 'wall', footprintTiles: { w: 2.8, h: 1.5 }, drawOrderBias: 3 };
    }
    if (side === 'west') {
      return rotation === 0
        ? { key: 'level-1/water/water-02', role: 'water-strip', footprintTiles: { w: 3.8, h: 1.2 }, drawOrderBias: 1 }
        : { key: 'level-1/prop/water-ruins2', role: 'wall', footprintTiles: { w: 2.6, h: 1.7 }, drawOrderBias: 2 };
    }
    return rotation === 0
      ? { key: 'wo105-world/container-cover-line', role: 'container', footprintTiles: { w: 3.6, h: 1.6 }, drawOrderBias: 3 }
      : { key: rotation === 1 ? 'level-1/prop/blue-gray-ruins1' : 'level-1/prop/brown-ruins2', role: 'wall', footprintTiles: { w: 2.6, h: 1.5 }, drawOrderBias: 3 };
  };
  const add = (side, x, y, index) => {
    if (Math.abs(x - px) > reach || Math.abs(y - py) > reach) return;
    const naturalEdgeType = side === 'north' ? 'ridge'
      : side === 'south' ? 'ravine'
        : side === 'west' ? 'riverbank'
          : 'fence';
    const visual = boundaryVisualForSide(side, index);
    segments.push(Object.freeze({
      id: `level-one-boundary-${side}-${index}`,
      worldX: Number(x.toFixed(3)),
      worldY: Number(y.toFixed(3)),
      radius: side === 'north' || side === 'south' ? 1.65 : 1.35,
      solid: true,
      kind: 'boundary-edge',
      sceneRole: visual.role,
      curatedAssetKey: visual.key,
      footprintTiles: Object.freeze(visual.footprintTiles),
      boundarySide: side,
      naturalEdgeType,
      drawOrderBias: visual.drawOrderBias,
    }));
  };
  let index = 0;
  for (let x = safeWorld.minX; x <= safeWorld.maxX; x += spacing) {
    add('north', x, safeWorld.minY, index++);
    add('south', x, safeWorld.maxY, index++);
  }
  for (let y = safeWorld.minY; y <= safeWorld.maxY; y += spacing) {
    add('west', safeWorld.minX, y, index++);
    add('east', safeWorld.maxX, y, index++);
  }
  return Object.freeze(segments);
}

function smoothPressureAt(seconds = 0, tauSeconds = 540) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const safeTau = Math.max(1, Number(tauSeconds) || 1);
  return 1 - Math.exp(-safeSeconds / safeTau);
}

function smoothKnobAt(seconds, start, cap, tauSeconds, precision = 3) {
  const p = smoothPressureAt(seconds, tauSeconds);
  return Number((start + (cap - start) * p).toFixed(precision));
}

export function levelOneRoguelikeDropChance({ elapsedSeconds = 0, rare = false } = {}) {
  if (rare) return HMH_LEVEL_ONE_PLAYTEST_BALANCE.drops.rareChance;
  const d = HMH_LEVEL_ONE_PLAYTEST_BALANCE.drops;
  return smoothKnobAt(elapsedSeconds, d.normalStartChance, d.normalCapChance, d.normalTauSeconds, 3);
}

export function levelOneRoguelikePickupAssistAt({ elapsedSeconds = 0, activeEnemies = 0 } = {}) {
  const pressure = smoothPressureAt(elapsedSeconds, HMH_LEVEL_ONE_PLAYTEST_BALANCE.pressure.combinedTauSeconds);
  const swarmPressure = clampNumber((Number(activeEnemies) || 0) / HMH_LEVEL_ONE_PLAYTEST_BALANCE.director.maxEnemiesCap, 0, 1);
  const assist = HMH_LEVEL_ONE_PLAYTEST_BALANCE.pickupAssist;
  const blendedSwarm = clampNumber(pressure * 0.75 + swarmPressure * 0.25, 0, 1);
  return Object.freeze({
    pressure: Number(pressure.toFixed(3)),
    swarmPressure: Number(swarmPressure.toFixed(3)),
    xpAttractRadiusMultiplier: Number((assist.xpAttractRadiusStartMultiplier + (assist.xpAttractRadiusCapMultiplier - assist.xpAttractRadiusStartMultiplier) * blendedSwarm).toFixed(2)),
    xpAttractSpeedMultiplier: Number((assist.xpAttractSpeedStartMultiplier + (assist.xpAttractSpeedCapMultiplier - assist.xpAttractSpeedStartMultiplier) * blendedSwarm).toFixed(2)),
    xpTtlFrames: Math.round(assist.xpTtlStartFrames + (assist.xpTtlCapFrames - assist.xpTtlStartFrames) * pressure),
    powerUpAttractRadiusMultiplier: Number((assist.powerUpAttractRadiusStartMultiplier + (assist.powerUpAttractRadiusCapMultiplier - assist.powerUpAttractRadiusStartMultiplier) * blendedSwarm).toFixed(2)),
    powerUpTtlFrames: Math.round(assist.powerUpTtlStartFrames + (assist.powerUpTtlCapFrames - assist.powerUpTtlStartFrames) * pressure),
    maxLooseXpGems: assist.maxLooseXpGems,
    maxLoosePowerUps: assist.maxLoosePowerUps,
  });
}

export function levelOneRoguelikePerformanceBudgetAt({ elapsedSeconds = 0, activeEnemies = 0, reduceMotion = false } = {}) {
  const pressure = smoothPressureAt(elapsedSeconds, HMH_LEVEL_ONE_PLAYTEST_BALANCE.pressure.combinedTauSeconds);
  const swarmPressure = clampNumber((Number(activeEnemies) || 0) / HMH_LEVEL_ONE_PLAYTEST_BALANCE.director.maxEnemiesCap, 0, 1);
  const blendedSwarm = clampNumber(pressure * 0.7 + swarmPressure * 0.3, 0, 1);
  const perf = HMH_LEVEL_ONE_PLAYTEST_BALANCE.performance;
  const motionScale = reduceMotion ? perf.reduceMotionScale : 1;
  const lodPressure = clampNumber((blendedSwarm - 0.55) / 0.35, 0, 1);
  const lerpPerf = (startKey, capKey, digits = null) => {
    const value = perf[startKey] + (perf[capKey] - perf[startKey]) * lodPressure;
    return digits == null ? value : Number(value.toFixed(digits));
  };
  return Object.freeze({
    pressure: Number(pressure.toFixed(3)),
    swarmPressure: Number(swarmPressure.toFixed(3)),
    lodPressure: Number(lodPressure.toFixed(3)),
    lodStage: lodPressure >= 0.45 ? 'pressure-lod' : 'full-fidelity',
    maxParticles: Math.max(48, Math.round((perf.maxParticlesStart + (perf.maxParticlesCap - perf.maxParticlesStart) * blendedSwarm) * motionScale)),
    maxFloatingTexts: Math.max(28, Math.round((perf.maxFloatingTextsStart + (perf.maxFloatingTextsCap - perf.maxFloatingTextsStart) * blendedSwarm) * motionScale)),
    hitSparkEveryNthHit: Math.max(1, Math.round(perf.hitSparkEveryNthHitStart + (perf.hitSparkEveryNthHitCap - perf.hitSparkEveryNthHitStart) * blendedSwarm)),
    deathBurstScale: Number((perf.deathBurstStartScale + (perf.deathBurstCapScale - perf.deathBurstStartScale) * blendedSwarm).toFixed(2)),
    maxAnimatedEnemies: Math.max(24, Math.round(lerpPerf('maxAnimatedEnemiesStart', 'maxAnimatedEnemiesCap') * motionScale)),
    enemyAnimationFps: Math.max(6, Math.round(lerpPerf('enemyAnimationFpsStart', 'enemyAnimationFpsCap'))),
    obstacleRenderRadiusWindowed: Math.max(12, Math.round(lerpPerf('obstacleRenderRadiusWindowedStart', 'obstacleRenderRadiusWindowedCap'))),
    obstacleRenderRadiusFullscreen: Math.max(28, Math.round(lerpPerf('obstacleRenderRadiusFullscreenStart', 'obstacleRenderRadiusFullscreenCap'))),
    groundOverscanWindowedTiles: Math.max(3, Math.round(lerpPerf('groundOverscanWindowedStartTiles', 'groundOverscanWindowedCapTiles'))),
    groundOverscanFullscreenTiles: Math.max(8, Math.round(lerpPerf('groundOverscanFullscreenStartTiles', 'groundOverscanFullscreenCapTiles'))),
  });
}

export function levelOneRoguelikeSpawnDirectorAt(elapsedSeconds = 0, { seed = 0 } = {}) {
  const seconds = Math.max(0, Number(elapsedSeconds) || 0);
  const minutes = seconds / 60;
  const pressure = smoothPressureAt(seconds, HMH_LEVEL_ONE_PLAYTEST_BALANCE.pressure.combinedTauSeconds);
  const d = HMH_LEVEL_ONE_PLAYTEST_BALANCE.director;
  const difficultyLabel = pressure >= 0.9
    ? 'record-chase'
    : pressure >= 0.8
      ? 'elite-band'
      : pressure >= 0.65
        ? 'pincer-pressure'
        : pressure >= 0.5
          ? 'market-crash'
          : pressure >= 0.25
            ? 'volatile'
            : 'opening';
  return Object.freeze({
    elapsedMinutes: Number(minutes.toFixed(2)),
    pressure: Number(pressure.toFixed(3)),
    spawnIntervalSeconds: smoothKnobAt(seconds, d.spawnIntervalStartSeconds, d.spawnIntervalFloorSeconds, d.spawnIntervalTauSeconds, 3),
    maxEnemiesOnMap: Math.round(smoothKnobAt(seconds, d.maxEnemiesStart, d.maxEnemiesCap, d.maxEnemiesTauSeconds, 3)),
    chaseEnemyShare: smoothKnobAt(seconds, d.chaseShareStart, d.chaseShareCap, d.chaseShareTauSeconds, 3),
    rangedEnemyShare: smoothKnobAt(seconds, d.rangedShareStart, d.rangedShareCap, d.rangedShareTauSeconds, 3),
    eliteEnemyShare: smoothKnobAt(seconds, d.eliteShareStart, d.eliteShareCap, d.eliteShareTauSeconds, 3),
    projectileSpeedMultiplier: smoothKnobAt(seconds, d.projectileSpeedStart, d.projectileSpeedCap, d.projectileSpeedTauSeconds, 3),
    archetypeMixCount: Math.round(smoothKnobAt(seconds, d.archetypeMixStart, d.archetypeMixCap, d.archetypeMixTauSeconds, 3)),
    packCohesion: smoothKnobAt(seconds, d.packCohesionStart, d.packCohesionCap, d.packCohesionTauSeconds, 3),
    patternDensity: smoothKnobAt(seconds, d.patternDensityStart, d.patternDensityCap, d.patternDensityTauSeconds, 3),
    currentThreatBeat: levelOneThreatBeatAt(seconds, { seed }),
    healthMultiplier: smoothKnobAt(seconds, d.healthMultiplierStart, d.healthMultiplierCap, d.healthMultiplierTauSeconds, 3),
    damageMultiplier: smoothKnobAt(seconds, d.damageMultiplierStart, d.damageMultiplierCap, d.damageMultiplierTauSeconds, 3),
    difficultyLabel,
  });
}

export function buildLevelOnePlaytestBalanceModel() {
  return Object.freeze({
    ...HMH_LEVEL_ONE_PLAYTEST_BALANCE,
    shipFocus: HMH_LEVEL_ONE_SHIP_FOCUS,
    world: buildLevelOneRunWorldDimensions(),
    bossProxyRoster: HMH_LEVEL_ONE_BOSS_PROXY_ROSTER,
    bossBeatSchedule: HMH_LEVEL_ONE_BOSS_BEAT_SCHEDULE,
    checkpoints: Object.freeze([0, 300, 600, 900, 1200, 1500, 1800].map((seconds) => levelOneRoguelikeSpawnDirectorAt(seconds))),
  });
}

function seededIndex(seed, salt, length) {
  if (length <= 0) return -1;
  const raw = Math.sin((Number(seed) || 0) * 12.9898 + salt * 78.233) * 43758.5453;
  return Math.abs(Math.floor(raw)) % length;
}

function cloneRoguelikeRun(run) {
  return {
    ...run,
    player: { ...run.player },
    stats: { ...run.stats },
    skills: { ...run.skills },
    unlocks: { ...(run.unlocks ?? {}) },
    powerMoments: {
      ...(run.powerMoments ?? {}),
      evolutions: [...(run.powerMoments?.evolutions ?? [])],
      maxedSkills: [...(run.powerMoments?.maxedSkills ?? [])],
      lastMoment: run.powerMoments?.lastMoment ? { ...run.powerMoments.lastMoment } : null,
    },
    map: { ...run.map },
    rngStreams: { ...(run.rngStreams ?? {}) },
    spawnDirector: { ...run.spawnDirector },
  };
}

const ROGUELIKE_RNG_STREAM_NAMES = Object.freeze(['spawns', 'drops', 'boss', 'draft', 'crit']);

export function createRoguelikeRunRngStreams(seed = 1) {
  return createSeededSubstreams(seed, ROGUELIKE_RNG_STREAM_NAMES);
}

export function buildIsometricRoguelikeRunConfig({ seed = 1, mapRadiusTiles = 42 } = {}) {
  const safeSeed = Math.floor(Number(seed) || 1);
  return Object.freeze({
    seed: safeSeed,
    genre: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.genre,
    camera: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.camera,
    map: Object.freeze({
      procedural: true,
      radiusTiles: mapRadiusTiles,
      chunkSizeTiles: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.mapGeneration.chunkSizeTiles,
      tilesetPerspective: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.mapGeneration.tilesetPerspective,
      seedLabel: `hmh-iso-${safeSeed}`,
    }),
    player: Object.freeze({
      startWorld: Object.freeze({ x: 0, y: 0 }),
      movement: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.movement,
      baseStats: Object.freeze({ damage: 1, rateOfFire: 1, reloadSpeed: 1, movementSpeed: 1, maxHealth: 100 }),
    }),
    spawnDirector: Object.freeze({
      mode: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.runPacing.mode,
      pressureCurveMinutes: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.runPacing.pressureCurveMinutes,
      eliteBandMinutes: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.runPacing.eliteBandMinutes,
      enemyBehaviors: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.combat.enemyBehaviors,
    }),
    levelUp: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp,
  });
}

export function createRoguelikeRunState({
  seed = 1,
  mode = 'free',
  characterId = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterLegacyId,
  campaignLevelId = 'level-1-crypto-wasteland',
  campaignLevelNumber = 1,
  carryOver = null,
} = {}) {
  const config = buildIsometricRoguelikeRunConfig({ seed });
  const carriedStats = carryOver?.stats ? { ...carryOver.stats } : null;
  const carriedSkills = carryOver?.skills ? { ...carryOver.skills } : null;
  const skills = Object.fromEntries(LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.map((skill) => [skill.id, carriedSkills?.[skill.id] ?? 0]));
  return {
    mode,
    seed: config.seed,
    rngStreams: createRoguelikeRunRngStreams(config.seed),
    characterId,
    campaignLevelId,
    campaignLevelNumber: Math.max(1, Math.floor(Number(campaignLevelNumber) || 1)),
    level: 1,
    xp: 0,
    xpToNextLevel: roguelikeXpCostForLevel(1),
    maxLevel: ROGUELIKE_LEVEL_CAP,
    postCapXpToScore: POST_CAP_XP_TO_SCORE,
    postCapScoreBonus: 0,
    maxLevelReached: false,
    pausedForLevelUp: false,
    pendingUpgradeChoices: 0,
    rerollsRemaining: LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.rerollsPerLevel,
    player: { x: config.player.startWorld.x, y: config.player.startWorld.y, facing: 'E' },
    stats: carriedStats ?? roguelikeStartingStatsFor(characterId),
    statTruthSource: 'hmh-character-config',
    skills,
    unlocks: { ...(carryOver?.unlocks ?? {}) },
    powerMoments: {
      evolutions: [...(carryOver?.powerMoments?.evolutions ?? [])],
      maxedSkills: [...(carryOver?.powerMoments?.maxedSkills ?? [])],
      lastMoment: carryOver?.powerMoments?.lastMoment ? { ...carryOver.powerMoments.lastMoment } : null,
    },
    map: { procedural: true, tilesetPerspective: config.map.tilesetPerspective, seedLabel: config.map.seedLabel },
    spawnDirector: getRoguelikeSpawnDirectorAt(0),
  };
}

export function grantRoguelikeXp(run, amount = 0) {
  const next = cloneRoguelikeRun(run);
  const xpMultiplier = next.stats.xpGain ?? 1;
  const gainedXp = Math.max(0, Number(amount) || 0) * xpMultiplier;
  if (next.level >= ROGUELIKE_LEVEL_CAP) {
    next.level = ROGUELIKE_LEVEL_CAP;
    next.maxLevelReached = true;
    next.xpToNextLevel = 0;
    next.postCapScoreBonus = Math.round((next.postCapScoreBonus ?? 0) + gainedXp * POST_CAP_XP_TO_SCORE);
    return next;
  }
  next.xp += gainedXp;
  while (!next.pausedForLevelUp && next.level < ROGUELIKE_LEVEL_CAP && next.xp >= next.xpToNextLevel) {
    next.xp -= next.xpToNextLevel;
    next.level += 1;
    if (next.level >= ROGUELIKE_LEVEL_CAP) {
      next.level = ROGUELIKE_LEVEL_CAP;
      next.maxLevelReached = true;
      next.xpToNextLevel = 0;
      if (next.xp > 0) {
        next.postCapScoreBonus = Math.round((next.postCapScoreBonus ?? 0) + next.xp * POST_CAP_XP_TO_SCORE);
        next.xp = 0;
      }
    } else {
      next.xpToNextLevel = roguelikeXpCostForLevel(next.level);
    }
    next.pausedForLevelUp = true;
    next.pendingUpgradeChoices = LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.choicesPerLevel;
    next.rerollsRemaining = LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.rerollsPerLevel;
  }
  return next;
}

function roguelikeGateSatisfied(skill, run) {
  const gate = skill.gate ?? null;
  if (!gate) return true;
  const level = Math.max(1, Math.floor(Number(run?.level) || 1));
  if (gate.playerLevel && level < gate.playerLevel) return false;
  for (const req of gate.requires ?? []) {
    if ((run?.skills?.[req.skillId] ?? 0) < req.rank) return false;
  }
  return true;
}

function gateHintForSkill(skill) {
  const gate = skill.gate ?? null;
  if (!gate) return '';
  const hints = [];
  if (gate.playerLevel) hints.push(`UNLOCKS AT LEVEL ${gate.playerLevel}`);
  for (const req of gate.requires ?? []) {
    const requiredSkill = LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.find((candidate) => candidate.id === req.skillId);
    hints.push(`REQUIRES ${(requiredSkill?.title ?? req.skillId).toUpperCase()} R${req.rank}`);
  }
  return hints.join(' + ');
}

function roguelikeDraftWeight(skill, run) {
  const currentRank = run?.skills?.[skill.id] ?? 0;
  if (skill.kind === 'unlock') return 3;
  return Math.max(1, skill.maxRank - currentRank);
}

function pickWeightedSkill(available, { seed, salt, rng, run }) {
  const totalWeight = available.reduce((sum, skill) => sum + roguelikeDraftWeight(skill, run), 0);
  if (totalWeight <= 0) return 0;
  let roll = rng?.next
    ? rng.next() * totalWeight
    : (Math.abs(Math.sin((Number(seed) || 0) * 12.9898 + salt * 78.233) * 43758.5453) % 1) * totalWeight;
  for (let i = 0; i < available.length; i += 1) {
    roll -= roguelikeDraftWeight(available[i], run);
    if (roll <= 0) return i;
  }
  return available.length - 1;
}

function optionForSkill(skill, run, slot = {}) {
  const currentRank = run?.skills?.[skill.id] ?? 0;
  const nextRank = currentRank + 1;
  const rank = skill.ranks?.[currentRank] ?? skill.ranks?.at?.(-1) ?? null;
  return Object.freeze({
    ...skill,
    currentRank,
    currentLevel: currentRank,
    nextRank,
    nextLevel: nextRank,
    nextRankStats: rank ? Object.freeze({ ...rank }) : null,
    gateHint: gateHintForSkill(skill),
    slotRole: slot.role ?? 'draft',
    slotLabel: slot.label ?? 'DRAFT PICK',
    slotReason: slot.reason ?? 'legal-offer',
    slotIndex: slot.index ?? 0,
  });
}

function hasRequiresGate(skill) {
  return (skill.gate?.requires?.length ?? 0) > 0;
}

function ownedRank(run, skill) {
  return run?.skills?.[skill.id] ?? 0;
}

function isFreshSkill(run, skill) {
  return ownedRank(run, skill) <= 0;
}

function pickGuidedSkill(pool, { seed, salt, rng, run }) {
  if (!pool.length) return null;
  const copy = [...pool];
  const index = pickWeightedSkill(copy, { seed, salt, rng, run });
  return copy[index] ?? copy[0];
}

function postCapCoinOption(slot) {
  return Object.freeze({
    id: `post-cap-coin-${slot.index + 1}`,
    title: 'Hard Money Dividend',
    category: 'economy',
    description: 'All upgrade trees are capped. Convert this draft slot into bonus score coins.',
    maxRank: 1,
    maxLevel: 1,
    currentRank: 0,
    currentLevel: 0,
    nextRank: 1,
    nextLevel: 1,
    perLevelPercent: null,
    rarity: 'post-cap',
    presentation: Object.freeze({ tone: 'gold', label: 'POST-CAP', icon: '💎' }),
    slotRole: slot.role,
    slotLabel: slot.label,
    slotReason: 'post-cap-coin-fallback',
    slotIndex: slot.index,
  });
}

export function chooseRoguelikeUpgradeOptions(run, { seed = run?.seed ?? 1, reroll = false, rng = null, includeLockedPreviews = false } = {}) {
  const available = LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.filter((skill) => {
    if (ownedRank(run, skill) >= skill.maxRank) return false;
    return roguelikeGateSatisfied(skill, run);
  });
  const saltBase = (run?.level ?? 1) * 17 + (reroll ? 101 : 0);
  const chosen = [];
  const chosenIds = new Set();
  const withoutChosen = (items) => items.filter((skill) => !chosenIds.has(skill.id));

  const justUnlockedDependent = available.filter((skill) => isFreshSkill(run, skill) && hasRequiresGate(skill));
  const ownedContinuation = available.filter((skill) => ownedRank(run, skill) > 0);
  const slotAReason = justUnlockedDependent.length ? 'newly-unlocked-dependent-stem'
    : ownedContinuation.length ? 'owned-tree-rank-up'
      : 'fresh-fallback';
  const slotASkill = pickGuidedSkill(
    justUnlockedDependent.length ? justUnlockedDependent : ownedContinuation.length ? ownedContinuation : available,
    { seed, salt: saltBase + 11, rng, run },
  );
  if (slotASkill) {
    chosen.push(optionForSkill(slotASkill, run, {
      index: 0,
      role: 'continuation',
      label: slotAReason === 'newly-unlocked-dependent-stem' ? 'UNLOCKED!' : 'CONTINUE YOUR BUILD',
      reason: slotAReason,
    }));
    chosenIds.add(slotASkill.id);
  }

  const freshBase = withoutChosen(available).filter((skill) => isFreshSkill(run, skill) && !hasRequiresGate(skill) && skill.kind !== 'evolution');
  const anyFresh = withoutChosen(available).filter((skill) => isFreshSkill(run, skill));
  const secondContinuation = withoutChosen(available).filter((skill) => ownedRank(run, skill) > 0);
  const slotBPool = freshBase.length ? freshBase : anyFresh.length ? anyFresh : secondContinuation.length ? secondContinuation : withoutChosen(available);
  const slotBReason = freshBase.length ? 'fresh-base-tree'
    : anyFresh.length ? 'fresh-gated-tree'
      : secondContinuation.length ? 'second-continuation-fallback'
        : 'legal-fallback';
  const slotBSkill = pickGuidedSkill(slotBPool, { seed, salt: saltBase + 29, rng, run });
  if (slotBSkill) {
    chosen.push(optionForSkill(slotBSkill, run, {
      index: 1,
      role: 'new',
      label: slotBReason.includes('continuation') ? 'CONTINUE ANOTHER TREE' : 'NEW TREE',
      reason: slotBReason,
    }));
    chosenIds.add(slotBSkill.id);
  }

  while (chosen.length < LESTER_BLASTER_ISOMETRIC_ROGUELIKE.levelUp.choicesPerLevel) {
    chosen.push(postCapCoinOption({
      index: chosen.length,
      role: chosen.length === 0 ? 'continuation' : 'new',
      label: chosen.length === 0 ? 'POST-CAP PAYOUT' : 'BONUS PAYOUT',
    }));
  }

  const lockedPreviews = includeLockedPreviews
    ? Object.freeze(LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY
      .filter((skill) => ownedRank(run, skill) < skill.maxRank && !roguelikeGateSatisfied(skill, run))
      .map((skill) => Object.freeze({ id: skill.id, title: skill.title, gateHint: gateHintForSkill(skill), gate: skill.gate })))
    : Object.freeze([]);
  return Object.freeze({
    options: Object.freeze(chosen),
    slots: Object.freeze(chosen.map((option) => Object.freeze({
      index: option.slotIndex,
      role: option.slotRole,
      label: option.slotLabel,
      skillId: option.id,
      reason: option.slotReason,
    }))),
    lockedPreviews,
    rerollsRemaining: Math.max(0, (run?.rerollsRemaining ?? 0) - (reroll ? 1 : 0)),
  });
}

export function applyRoguelikeSkillUpgrade(run, skillId) {
  const skill = LESTER_BLASTER_ROGUELIKE_SKILL_LIBRARY.find((candidate) => candidate.id === skillId);
  if (!skill) throw new Error(`Unknown roguelike skill: ${skillId}`);
  if (!roguelikeGateSatisfied(skill, run)) return cloneRoguelikeRun(run);
  const currentRank = run.skills?.[skill.id] ?? 0;
  if (currentRank >= skill.maxRank) return cloneRoguelikeRun(run);
  const rank = skill.ranks[currentRank] ?? skill.ranks.at(-1) ?? {};
  const next = cloneRoguelikeRun(run);
  next.skills[skill.id] = currentRank + 1;
  if (skill.kind === 'evolution') {
    next.unlocks[skill.id] = true;
    next.stats.weaponEvolution = skill.evolutionId;
    next.powerMoments = next.powerMoments ?? { evolutions: [], maxedSkills: [], lastMoment: null };
    if (!next.powerMoments.evolutions.includes(skill.evolutionId)) next.powerMoments.evolutions.push(skill.evolutionId);
    next.powerMoments.lastMoment = {
      id: skill.id,
      type: 'weapon-evolution',
      banner: skill.payoff?.banner ?? `EVOLUTION // ${skill.title.toUpperCase()}`,
      tone: 'gold',
      scoreMultiplier: skill.payoff?.scoreMultiplier ?? 1.25,
    };
  } else if (skill.kind === 'unlock') {
    next.unlocks[skill.id] = true;
    if (skill.grenadeType) next.stats.grenadeType = skill.grenadeType;
    if (skill.stat && Number.isFinite(Number(rank.statDelta))) next.stats[skill.stat] = (next.stats[skill.stat] ?? 0) + Number(rank.statDelta);
  } else if (skill.stat && Number.isFinite(Number(rank.statDelta))) {
    next.stats[skill.stat] = (next.stats[skill.stat] ?? 1) + Number(rank.statDelta) / 100;
  }
  next.pausedForLevelUp = false;
  next.pendingUpgradeChoices = 0;
  return next;
}

export function getRoguelikeSpawnDirectorAt(elapsedSeconds = 0) {
  return levelOneRoguelikeSpawnDirectorAt(elapsedSeconds);
}

export function buildFullscreenViewportModel({
  mode = 'fullscreen',
  fullscreenElementActive = false,
  screenWidth = 1920,
  screenHeight = 1080,
} = {}) {
  const isExpanded = mode === 'expanded-fullscreen' || mode === 'fullscreen';
  const isRealFullscreen = Boolean(fullscreenElementActive && isExpanded);
  const canvasCss = isRealFullscreen
    ? Object.freeze({ width: '100vw', height: '100vh', objectFit: 'contain' })
    : mode === 'windowed'
      ? Object.freeze({ width: 'min(100%, 660px)', height: 'auto', objectFit: 'contain' })
      : Object.freeze({ width: 'min(100%, 1180px)', height: 'auto', objectFit: 'contain' });
  return Object.freeze({
    mode,
    targetElement: 'officialCombatMount',
    browserApiAction: isExpanded && !fullscreenElementActive ? 'requestFullscreen' : mode === 'windowed' && fullscreenElementActive ? 'exitFullscreen' : 'none',
    isRealFullscreen,
    canvasCss,
    devicePixels: Object.freeze({ width: Math.max(1, Math.round(screenWidth)), height: Math.max(1, Math.round(screenHeight)) }),
  });
}

function formatClock(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function getCharacter(characterId = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterLegacyId) {
  // Resolve by current id OR explicit legacyId. The current playable canon is
  // starter Lit Commando/Lit Valkyrie plus unlockable Lester/Lilly; old `lester`
  // links intentionally resolve to the Lester unlockable, not to Lit Commando.
  const character = LESTER_BLASTER_CHARACTER_ROSTER.find(
    (candidate) => candidate.id === characterId || candidate.legacyId === characterId,
  );
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

export function buildRunLoadout({ characterId = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterLegacyId, weaponId = 'coin-blaster', grenadeId = 'satoshi-frag' } = {}) {
  const character = getCharacter(characterId);
  return {
    character: clone(character),
    primaryWeapon: clone(getPrimaryWeapon(weaponId)),
    melee: clone(LESTER_BLASTER_WEAPON_SYSTEM.melee),
    grenade: clone(getGrenade(grenadeId)),
  };
}

export function createCombatRunState({ mode = 'free', characterId = HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterLegacyId, weaponId = 'coin-blaster', grenadeId = 'satoshi-frag' } = {}) {
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

function normalizeSpawnAffinity(value = '') {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function enemyMatchesDistrictFamily(enemy, districtFamily) {
  const target = normalizeSpawnAffinity(districtFamily);
  if (!target) return false;
  return (enemy.districtFamilies ?? []).some((value) => normalizeSpawnAffinity(value) === target);
}

function enemyMatchesPoi(enemy, poiId) {
  const target = normalizeSpawnAffinity(poiId);
  if (!target) return false;
  return (enemy.poiIds ?? []).some((value) => normalizeSpawnAffinity(value) === target);
}

export function chooseEnemySpawn({ elapsedSeconds = 0, seed = 0, districtFamily = null, activePoiId = null, forceEnemyId = null } = {}) {
  const difficulty = getLesterBlasterDifficultyAt(elapsedSeconds);
  const eligible = LESTER_BLASTER_ENEMY_CATALOG.filter((enemy) => enemy.spawnAfterSeconds <= elapsedSeconds);
  const fallbackPool = eligible.length ? eligible : [LESTER_BLASTER_ENEMY_CATALOG[0]];
  const forceKey = normalizeSpawnAffinity(forceEnemyId);
  const forcedEnemy = forceKey
    ? (LESTER_BLASTER_ENEMY_CATALOG.find((enemy) => normalizeSpawnAffinity(enemy.id) == forceKey) ?? null)
    : null;
  const poiPool = activePoiId ? fallbackPool.filter((enemy) => enemyMatchesPoi(enemy, activePoiId)) : [];
  const districtPool = districtFamily ? fallbackPool.filter((enemy) => enemyMatchesDistrictFamily(enemy, districtFamily)) : [];
  const themedPool = poiPool.length ? poiPool : districtPool.length ? districtPool : fallbackPool;
  const source = forcedEnemy ? 'forced-id' : poiPool.length ? 'poi' : districtPool.length ? 'district-family' : 'timeline';
  const rawIndex = Math.abs(Math.floor(seed));
  const rawEnemy = LESTER_BLASTER_ENEMY_CATALOG[rawIndex % LESTER_BLASTER_ENEMY_CATALOG.length];
  const enemy = forcedEnemy
    ? forcedEnemy
    : source === 'timeline'
      ? (rawEnemy?.spawnAfterSeconds <= elapsedSeconds ? rawEnemy : (fallbackPool.at(-1) ?? LESTER_BLASTER_ENEMY_CATALOG[0]))
      : (themedPool[rawIndex % themedPool.length] ?? themedPool[0] ?? LESTER_BLASTER_ENEMY_CATALOG[0]);
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
    spawnContext: {
      source,
      districtFamily: districtFamily ?? null,
      activePoiId: activePoiId ?? null,
      forceEnemyId: forceEnemyId ?? null,
      poolSize: forcedEnemy ? 1 : themedPool.length,
    },
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
  const kb = LESTER_BLASTER_CONTROL_SCHEME.keyboard;
  return [
    { label: 'Move', key: kb.move, hint: 'WASD / arrow keys move your hero across the isometric battlefield (drag on mobile).' },
    { label: 'Aim & Fire', key: kb.aim, hint: 'Your gun auto-fires toward the mouse cursor on its fire-rate — no clicking needed.' },
    { label: 'Manual Fire', key: kb.fire, hint: 'Left click fires a deliberate shot at the cursor.' },
    { label: 'Grenade', key: kb.grenade, hint: 'Right click or F throws a Crypto Bomb — wide blast, scarce ammo (NADE button on mobile).' },
    { label: 'Reload', key: kb.reload, hint: 'R reloads; weapons also auto-reload when the clip empties.' },
    { label: 'Pause', key: kb.pause, hint: 'Esc opens the pause / options overlay.' },
  ].map((control) => Object.freeze(control));
}

export function buildOfficialRunStatusModel({ gameTitle = 'Hard Money Heroes', connected = false, currentSession = null, lastResult = null } = {}) {
  if (!connected) {
    return Object.freeze({
      channel: 'official',
      state: 'guest',
      heading: 'Waiting for player...',
      details: 'Connect wallet, select Hard Money Heroes, then choose Free Practice or Ranked Testnet.',
    });
  }

  if (lastResult && currentSession?.isPaid) {
    return Object.freeze({
      channel: 'official',
      state: 'ranked-synced',
      heading: 'Ranked Testnet result synced',
      details: `${gameTitle} score ${lastResult.score.toLocaleString()} accepted for ranked leaderboard, achievements, transaction history, and parent progress.`,
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
      state: currentSession.isPaid ? 'ranked-armed' : 'free-armed',
      heading: `${gameTitle} ${currentSession.isPaid ? 'Ranked Testnet' : 'Free Practice'} run armed`,
      details: currentSession.isPaid
        ? `${formatMicroUsdc(currentSession.entryFeeMicroUsdc)} testnet credit reserved. Syncing a result will update official leaderboard, achievements, transaction history, and parent progress.`
        : 'Free practice run armed. Completing it stays untracked: no progress, achievements, high scores, or transactions.',
    });
  }

  return Object.freeze({
    channel: 'official',
    state: 'connected-idle',
    heading: 'Parent account online.',
    details: 'Choose Free Practice for untracked practice or Play Ranked to publish an official, leaderboard-eligible run on-chain to LitVM. The combat sandbox can run separately for testing controls.',
  });
}

export function buildCombatSandboxStatusModel({ running = false, elapsedSeconds = 0, fps = 60, activeMode = 'practice' } = {}) {
  if (!running) {
    return Object.freeze({
      channel: 'sandbox',
      state: 'idle',
      heading: 'Local combat sandbox idle',
      details: 'Start the 60fps Canvas sandbox to practice movement, shooting, blade attacks, throwables, pickups, and boss locks without changing ranked testnet state.',
    });
  }

  return Object.freeze({
    channel: 'sandbox',
    state: 'running',
    heading: 'Local combat sandbox running',
    details: `${Math.round(fps)}fps preview · ${Math.floor(elapsedSeconds)}s accelerated ${activeMode} combat · this does not overwrite ranked testnet state.`,
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
  const chromeSlotByWidget = Object.freeze({
    health: 'hud-left-rail',
    score: 'hud-left-rail',
    timer: 'hud-center-rail',
    'power-ups': 'hud-center-rail',
    weapon: 'hud-right-rail',
    stage: 'hud-right-rail',
    status: 'hud-status-rail',
  });
  const widget = (item) => {
    const chromeSlot = chromeSlotByWidget[item.id] ?? 'hud-center-rail';
    return Object.freeze({
      ...item,
      chromeSlot,
      dataset: Object.freeze({ uiChrome: LESTER_BLASTER_HUD_OVERLAY_MODEL.chrome.id, chromeSlot }),
    });
  };
  const healthValue = `${clampNumber(Math.round(Number(health) || 0), 0, 100)}%`;
  const scoreValue = Math.max(0, Math.round(Number(score) || 0)).toLocaleString();
  const ammoValue = ammo === Infinity || ammo === '∞' ? '∞' : Math.max(0, Math.round(Number(ammo) || 0)).toLocaleString();
  const widgets = Object.freeze([
    widget({ id: 'health', label: 'HP', value: healthValue, tone: healthValue === '0%' ? 'danger' : 'vital' }),
    widget({ id: 'score', label: 'Score', value: scoreValue, tone: 'score' }),
    widget({ id: 'timer', label: 'Time', value: formatClock(elapsedSeconds), tone: 'time' }),
    widget({ id: 'power-ups', label: 'Power', value: `THROW ${Math.max(0, Math.round(Number(grenades) || 0))} // PICKUPS ${Math.max(0, Math.round(Number(powerUpsCollected) || 0))}`, tone: 'power' }),
    widget({ id: 'weapon', label: 'Weapon', value: `${String(weaponTitle).toUpperCase()} // AMMO ${ammoValue}`, tone: 'weapon' }),
    widget({ id: 'stage', label: 'Stage', value: `${Math.max(1, Math.round(Number(stageIndex) || 1))}/${Math.max(1, Math.round(Number(stageCount) || 1))} // ${Math.round(Number(fps) || 60)}FPS`, tone: 'stage' }),
    widget({ id: 'status', label: 'Status', value: String(status || 'TRAVEL'), tone: String(status || '').includes('LOCK') ? 'warning' : 'status' }),
  ]);

  return Object.freeze({
    model: LESTER_BLASTER_HUD_OVERLAY_MODEL.purpose,
    chrome: LESTER_BLASTER_HUD_OVERLAY_MODEL.chrome,
    className: LESTER_BLASTER_HUD_OVERLAY_MODEL.chrome.className,
    widgets,
    widgetMap: Object.freeze(Object.fromEntries(widgets.map((widget) => [widget.id, widget]))),
  });
}

export function buildCombatAccessibilitySettingsModel({
  reduceMotion = false,
  screenShake = true,
  reduceFlash = false,
  colorblindTags = false,
  autoAimAssist = true,
} = {}) {
  return Object.freeze({
    title: 'Accessibility',
    copy: 'Tune motion, flash, color labeling, and aim assist without leaving the run.',
    actions: Object.freeze([
      Object.freeze({ id: 'toggle-reduce-motion', label: reduceMotion ? 'Reduce Motion On' : 'Reduce Motion Off', icon: reduceMotion ? '◉' : '○', enabled: true, description: 'Softens camera motion and burst intensity.' }),
      Object.freeze({ id: 'toggle-screen-shake', label: screenShake ? 'Screen Shake On' : 'Screen Shake Off', icon: screenShake ? '≈' : '—', enabled: true, description: 'Toggles camera shake from impacts and explosions.' }),
      Object.freeze({ id: 'toggle-reduce-flash', label: reduceFlash ? 'Reduce Flash On' : 'Reduce Flash Off', icon: reduceFlash ? '☼' : '✦', enabled: true, description: 'Dials down muzzle flash and bright burst effects.' }),
      Object.freeze({ id: 'toggle-colorblind-tags', label: colorblindTags ? 'Color Tags On' : 'Color Tags Off', icon: colorblindTags ? '🏷' : '⊙', enabled: true, description: 'Adds explicit text tags to color-coded UI chips.' }),
      Object.freeze({ id: 'toggle-auto-aim', label: autoAimAssist ? 'Auto Aim On' : 'Auto Aim Off', icon: autoAimAssist ? '◎' : '◌', enabled: true, description: 'Nearest-enemy assist when you are not steering aim.' }),
    ]),
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
    Object.freeze({ id: 'toggle-settings', label: 'Settings', icon: '⚙', enabled: true }),
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
  groundRender = null,
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
  const groundRenderMetrics = Object.freeze({
    passMs: Number.isFinite(groundRender?.passMs) ? Number(groundRender.passMs.toFixed?.(2) ?? groundRender.passMs) : 0,
    groupCount: Math.max(0, Math.round(Number(groundRender?.groupCount) || 0)),
    cacheSize: Math.max(0, Math.round(Number(groundRender?.cacheSize) || 0)),
    cacheHits: Math.max(0, Math.round(Number(groundRender?.cacheHits) || 0)),
    cacheMisses: Math.max(0, Math.round(Number(groundRender?.cacheMisses) || 0)),
  });
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
    'ground-render': Object.freeze([
      `${groundRenderMetrics.passMs.toFixed(2)}ms ground pass`,
      `${groundRenderMetrics.groupCount} texture groups`,
      `cache ${groundRenderMetrics.cacheSize} cells // ${groundRenderMetrics.cacheHits} hits / ${groundRenderMetrics.cacheMisses} misses`,
    ]),
  });
  const layers = Object.freeze([
    ...LESTER_BLASTER_DEV_BALANCE_OVERLAY.layers.map((layer) => Object.freeze({
      ...clone(layer),
      items: layerItems[layer.id] ?? Object.freeze([]),
    })),
    Object.freeze({ id: 'ground-render', label: 'Ground render', items: layerItems['ground-render'] }),
  ]);

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
      groundRender: groundRenderMetrics,
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

export function buildGameOverSummaryModel({ session = null, score = 0, elapsedSeconds = 0, kills = 0, bossesDefeated = 0, acceptedForGlobalLeaderboard = false, extraction = null, killedBy = null, bestUpgrade = null, runSeed = null, previousBestScore = null, sessionStreak = 1, backgroundSettlementQueued = false } = {}) {
  const official = Boolean(session?.isPaid || session?.mode === 'paid' || session?.leaderboardEligible);
  const safeScore = Number.isFinite(score) ? Math.max(0, Math.round(score)) : 0;
  const safeElapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, Math.round(elapsedSeconds)) : 0;
  const safeKills = Number.isFinite(kills) ? Math.max(0, Math.round(kills)) : 0;
  const safeBosses = Number.isFinite(bossesDefeated) ? Math.max(0, Math.round(bossesDefeated)) : 0;
  const safePreviousBest = Number.isFinite(previousBestScore) ? Math.max(0, Math.round(previousBestScore)) : null;
  const personalBest = Object.freeze({
    previousBestScore: safePreviousBest,
    isNewBest: safePreviousBest !== null && safeScore > safePreviousBest,
    delta: safePreviousBest !== null ? Math.max(0, safeScore - safePreviousBest) : 0,
  });
  const streakCount = Math.max(1, Math.round(Number(sessionStreak) || 1));
  const streak = Object.freeze({
    count: streakCount,
    copy: streakCount > 1 ? `${streakCount}-run streak. One more run keeps the cabinet hot.` : 'First run of this streak. Run it back while the build is fresh.',
  });
  const oneMoreRun = Object.freeze({
    primaryActionId: 'run-it-back',
    estimatedRestartSeconds: 3,
    copy: 'Run it back in under 3 seconds: no menu detour, same mode, fresh seed.',
  });
  const settlement = Object.freeze(!official
    ? { status: 'local-only', copy: 'Free practice stays local; nothing publishes in the background.' }
    : acceptedForGlobalLeaderboard
      ? { status: 'published', copy: 'Run is already published on-chain and reflected in leaderboard/profile state.' }
      : backgroundSettlementQueued
        ? { status: 'background-pending', copy: 'Settlement continues in the background while Run It Back stays available.' }
        : { status: 'submit-ready', copy: 'Confirm or retry LitVM publish from this screen.' });
  const metricList = [
    Object.freeze({ id: 'score', label: 'Score', value: safeScore.toLocaleString() }),
    Object.freeze({ id: 'time', label: 'Time', value: `${Math.floor(safeElapsed / 60)}:${String(safeElapsed % 60).padStart(2, '0')}` }),
    Object.freeze({ id: 'kills', label: 'Enemies', value: safeKills.toLocaleString() }),
    Object.freeze({ id: 'bosses', label: 'Bosses', value: safeBosses.toLocaleString() }),
  ];
  // Death-recap metrics (Isaac/Hades-style "I died but learned" loop): grade,
  // time vs target, what killed you, and the run's defining augment.
  if (extraction && Number.isFinite(extraction.total)) {
    metricList.push(Object.freeze({ id: 'extraction', label: 'Extraction', value: `${Math.max(0, Math.round(extraction.total)).toLocaleString()} · ${extraction.grade ?? '—'}` }));
    if (Number.isFinite(extraction.timeDeltaSeconds)) {
      const delta = Math.round(extraction.timeDeltaSeconds);
      const mag = Math.abs(delta);
      const stamp = `${Math.floor(mag / 60)}:${String(mag % 60).padStart(2, '0')}`;
      metricList.push(Object.freeze({ id: 'vs-target', label: 'Vs Target', value: delta >= 0 ? `${stamp} under` : `${stamp} over` }));
    }
  }
  if (personalBest.isNewBest) metricList.push(Object.freeze({ id: 'personal-best', label: 'PB Flash', value: `NEW BEST +${personalBest.delta.toLocaleString()}` }));
  if (killedBy) metricList.push(Object.freeze({ id: 'killed-by', label: 'Killed By', value: String(killedBy) }));
  if (bestUpgrade) metricList.push(Object.freeze({ id: 'best-upgrade', label: 'Best Augment', value: String(bestUpgrade) }));
  if (runSeed !== null && runSeed !== undefined) metricList.push(Object.freeze({ id: 'run-seed', label: 'Run Seed', value: String(runSeed) }));
  const metrics = Object.freeze(metricList);
  const runItBackAction = Object.freeze({ id: 'run-it-back', label: 'Run It Back', cost: oneMoreRun.copy, target: 'instant-restart', enabled: true, estimatedSeconds: oneMoreRun.estimatedRestartSeconds });
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
      actions: Object.freeze([runItBackAction, ...baseActions]),
      oneMoreRun,
      personalBest,
      streak,
      settlement,
      exitRampCopy: LESTER_ARCADE_PUBLIC_EXPERIENCE_LOOP.exitRamps.find((ramp) => ramp.id === 'return-to-arcade')?.copy,
    });
  }

  return Object.freeze({
    channel: 'official',
    state: acceptedForGlobalLeaderboard ? 'official-score-synced' : 'official-submit-ready',
    title: acceptedForGlobalLeaderboard ? 'Official Score Published' : 'Ranked Run Complete',
    metrics,
    trackingCopy: acceptedForGlobalLeaderboard
      ? 'Score published on-chain to LitVM and synced to the global leaderboard, achievements, and your profile.'
      : 'Publishing your run to LitVM… confirm the transaction in your wallet. If you declined or it failed, use Retry Publish.',
    actions: Object.freeze([
      runItBackAction,
      Object.freeze({ id: 'submit-official-score', label: acceptedForGlobalLeaderboard ? 'Published On-Chain ✓' : 'Retry Publish', cost: settlement.copy, target: 'parent-sync', enabled: !acceptedForGlobalLeaderboard }),
      ...baseActions,
    ]),
    oneMoreRun,
    personalBest,
    streak,
    settlement,
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
      copy: 'Connect an EVM wallet to activate Ranked Testnet runs, achievements, transactions, and leaderboard identity.',
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
    eligibility: 'official leaderboard requires Ranked Testnet session and future verifier-signed score summary',
    season: {
      id: 'ranked-testnet-season-00',
      cadences: [...HARD_MONEY_HEROES_CANON.leaderboards.cadences],
      resetCadence: 'daily-weekly-monthly-yearly-all-time-testnet',
      prizeNotes: 'future tournament pool; no real prizes in local practice',
    },
    testnetDisclosure: {
      title: 'Ranked Testnet Beta',
      body: 'Scores are player-submitted and not yet cheat-proof on-chain. The client integrity gate catches obvious junk, but official anti-cheat verification is still in progress.',
      valueAttached: false,
      leaderboardResetNotice: 'Leaderboards may reset at the security redeploy; no token, prize, or cash value is attached to testnet rows.',
    },
    resetPolicy: 'Testnet leaderboards may reset during the WO-131 security redeploy. Pre-reset boards should be archived before any approved redeploy.',
  };
}

function leaderboardRowTrust(state, gameId, row) {
  const session = row.sessionId ? state?.sessions?.[row.sessionId] : null;
  const flagged = row.sessionId ? (state?.flaggedSessions ?? []).find((flag) => flag.sessionId === row.sessionId) : null;
  const verdict = flagged?.verdict ?? session?.integrity?.verdict ?? (row.settlementTxHash || session?.settlement?.primaryTxHash ? 'settled' : 'prototype');
  if (verdict === 'suspicious' || verdict === 'rejected') {
    return {
      verdict,
      label: verdict === 'rejected' ? 'Rejected' : 'Needs review',
      tone: verdict === 'rejected' ? 'danger' : 'warning',
      flags: [...(flagged?.flags ?? session?.integrity?.flags ?? [])],
    };
  }
  if (verdict === 'settled') {
    return { verdict: 'settled', label: 'Settled', tone: 'verified', flags: [] };
  }
  return { verdict: 'prototype', label: 'Prototype', tone: 'muted', flags: [] };
}

function leaderboardDetailFor(state, gameId, row) {
  const session = row.sessionId ? state?.sessions?.[row.sessionId] : null;
  const urlSessionId = session?.urlSessionId ?? row.urlSessionId ?? null;
  const gameSlug = gameSlugFor(gameId);
  return {
    sessionId: row.sessionId ?? null,
    urlSessionId,
    sequenceNumber: session?.sequenceNumber ?? null,
    detailHref: urlSessionId ? `/play/${gameSlug}/${urlSessionId}` : null,
    recordedAt: row.recordedAt ?? session?.syncedAt ?? null,
    runStats: { ...(session?.runStats ?? row.runStats ?? {}) },
    settlementTxHash: row.settlementTxHash ?? session?.settlement?.primaryTxHash ?? null,
  };
}

function leaderboardV2SourceHash(state, board) {
  const rowHash = board.topEntries.map((row) => [row.sessionId, row.score, row.settlementTxHash ?? '', row.recordedAt].join('/')).join('|');
  const flaggedHash = (state?.flaggedSessions ?? []).map((flag) => `${flag.sessionId}:${flag.verdict}`).join('|');
  return `${board.total}:${rowHash}:${flaggedHash}`;
}

function indexLeaderboardV2Rows(state, rows) {
  state.leaderboardIndexes ??= { bySessionId: {}, byUrlSessionId: {} };
  state.leaderboardIndexes.bySessionId ??= {};
  state.leaderboardIndexes.byUrlSessionId ??= {};
  for (const row of rows) {
    const summary = {
      gameId: row.gameId,
      sessionId: row.sessionId,
      urlSessionId: row.sessionDetail.urlSessionId,
      rank: row.rank,
      score: row.score,
      wallet: row.wallet,
      trustVerdict: row.trust.verdict,
    };
    if (row.sessionId) state.leaderboardIndexes.bySessionId[row.sessionId] = summary;
    if (row.sessionDetail.urlSessionId) state.leaderboardIndexes.byUrlSessionId[row.sessionDetail.urlSessionId] = summary;
  }
}

export function buildLeaderboardExperienceV2Model(state, {
  gameId = 'lester-blaster',
  cadence = 'all-time',
  wallet = null,
  displayNameFor = (w) => w,
  limit = 50,
  now = Date.now(),
} = {}) {
  const game = getGame(gameId);
  const board = getLeaderboard(state, game.id, cadence, { wallet, displayNameFor, limit, now });
  const cacheKey = `${game.id}:${board.cadence}:${board.periodKey}:limit-${limit}`;
  const sourceHash = leaderboardV2SourceHash(state, board);
  state.leaderboardV2Cache ??= {};
  const cached = state.leaderboardV2Cache[cacheKey];
  if (cached?.sourceHash === sourceHash) {
    return { ...cached.model, cache: { ...cached.model.cache, status: 'hit' } };
  }

  const rows = board.topEntries.map((row) => {
    const trust = leaderboardRowTrust(state, game.id, row);
    const sessionDetail = leaderboardDetailFor(state, game.id, row);
    return {
      ...row,
      gameId: game.id,
      trust,
      sessionDetail,
      actions: {
        viewSession: sessionDetail.detailHref,
        inspectTrust: trust.flags.length > 0,
      },
    };
  });
  indexLeaderboardV2Rows(state, rows);
  const trustSummary = {
    totalRankedRuns: board.total,
    settledRuns: rows.filter((row) => row.trust.verdict === 'settled' || row.sessionDetail.settlementTxHash).length,
    flaggedRuns: rows.filter((row) => row.trust.verdict === 'suspicious' || row.trust.verdict === 'rejected').length,
    prototypeRuns: rows.filter((row) => row.trust.verdict === 'prototype').length,
  };
  const model = {
    gameId: game.id,
    gameTitle: game.title,
    cadence: board.cadence,
    periodKey: board.periodKey,
    total: board.total,
    rows,
    topEntries: rows,
    playerRank: board.playerRank,
    playerEntry: rows.find((row) => row.isCurrentPlayer) ?? null,
    trustSummary,
    cache: { key: cacheKey, sourceHash, status: 'rebuilt' },
  };
  state.leaderboardV2Cache[cacheKey] = { sourceHash, model };
  return model;
}

export function resolveAchievementUnlocksForRun({
  score = 0,
  elapsedSeconds = 0,
  bossId = null,
  weaponId = null,
  rareWeaponId = null,
  noDamage = false,
  collectedPowerUps = [],
  kills = 0,
  totalKills = 0,
  grenadeKills = 0,
  cumulativeGrenadeKills = 0,
  meleeKills = 0,
  cumulativeMeleeKills = 0,
  enemyKillsByType = {},
  cumulativeEnemyKillsByType = {},
  maxCombo = 0,
  maxDamageCombo = 0,
  powerUpsCollected = 0,
  cumulativePowerUps = 0,
  paidRuns = 0,
  cumulativeSeconds = 0,
  bossesDefeatedCount = 0,
  cumulativeBossKills = 0,
  perfectBossKills = 0,
  stageIndexReached = 1,
  lowHealthSurvival = false,
  uniqueWeapons = 0,
} = {}) {
  const unlocks = [];
  const push = (achievement, condition) => {
    if (condition && achievement?.id) unlocks.push(achievement.id);
  };
  const uniquePowerUps = new Set(collectedPowerUps).size;
  const cumulativeKills = Math.max(totalKills, kills);
  const gasBeastKills = (enemyKillsByType['gas-beast'] ?? 0) + (cumulativeEnemyKillsByType['gas-beast'] ?? 0);
  const goblinKills = ['fud-goblin', 'paper-hand', 'rug-rat', 'trench-degen'].reduce((sum, id) => sum + (enemyKillsByType[id] ?? 0) + (cumulativeEnemyKillsByType[id] ?? 0), 0);
  const droneKills = ['sybil-drone', 'bot-swarm', 'evil-banker', 'scambot'].reduce((sum, id) => sum + (enemyKillsByType[id] ?? 0) + (cumulativeEnemyKillsByType[id] ?? 0), 0);
  const grenadeTotal = Math.max(cumulativeGrenadeKills, grenadeKills);
  const meleeTotal = Math.max(cumulativeMeleeKills, meleeKills);
  const powerUpTotal = Math.max(cumulativePowerUps, powerUpsCollected);
  const effectiveWeaponCount = Math.max(uniqueWeapons, weaponId ? 1 : 0, rareWeaponId ? 1 : 0);

  push(ACHIEVEMENTS.FIRST_PAID_RUN, paidRuns >= 1);
  push(ACHIEVEMENTS.FIRST_1000_POINTS, score >= 1000);
  push(ACHIEVEMENTS.FIRST_BLOOD, kills >= 1 || cumulativeKills >= 1);
  push(ACHIEVEMENTS.TEN_ENEMY_KILLS, kills >= 10);
  push(ACHIEVEMENTS.FIRST_GRENADE_KILL, grenadeKills >= 1 || grenadeTotal >= 1);
  push(ACHIEVEMENTS.FIRST_POWERUP, powerUpsCollected >= 1 || uniquePowerUps >= 1 || powerUpTotal >= 1);
  push(ACHIEVEMENTS.BEAT_LEVEL_1_BOSS, Boolean(bossId));
  push(ACHIEVEMENTS.FIVE_MINUTE_RUN, elapsedSeconds >= 5 * 60);
  push(ACHIEVEMENTS.COMBO_STARTER, maxCombo >= 5);

  push(ACHIEVEMENTS.GAS_BEAST_HUNTER, gasBeastKills >= 50);
  push(ACHIEVEMENTS.GOBLIN_CLEANUP, goblinKills >= 75);
  push(ACHIEVEMENTS.DRONE_SWATTER, droneKills >= 60);
  push(ACHIEVEMENTS.GRENADE_CENTURY, grenadeTotal >= 100);
  push(ACHIEVEMENTS.BLADE_MASTER, meleeTotal >= 100);
  push(ACHIEVEMENTS.HASH_RAIL_SPECIALIST, weaponId === 'hash-rail');
  push(ACHIEVEMENTS.SPREAD_LTC_SPECIALIST, weaponId === 'spread-ltc');
  push(ACHIEVEMENTS.POWERUP_COLLECTOR, uniquePowerUps >= 3);
  push(ACHIEVEMENTS.SCORE_5000, score >= 5000);
  push(ACHIEVEMENTS.SCORE_10000, score >= 10000);

  push(ACHIEVEMENTS.BOSS_BREAKER, Boolean(bossId));
  push(ACHIEVEMENTS.NO_DAMAGE_BOSS, noDamage && Boolean(bossId));
  push(ACHIEVEMENTS.SLUMS_CLEAR, stageIndexReached >= 4);
  push(ACHIEVEMENTS.FOUNDRY_CLEAR, stageIndexReached >= 8);
  push(ACHIEVEMENTS.GETAWAY_CLEAR, stageIndexReached >= 13 && Boolean(bossId));
  push(ACHIEVEMENTS.BIG_COMBO, maxCombo >= 15);
  push(ACHIEVEMENTS.DAMAGE_CHAIN, maxDamageCombo >= 250);
  push(ACHIEVEMENTS.WEAPON_COLLECTOR, effectiveWeaponCount >= 3);
  push(ACHIEVEMENTS.LUCKY_SURVIVOR, elapsedSeconds >= 10 * 60 && lowHealthSurvival);
  push(ACHIEVEMENTS.TEN_PAID_RUNS, paidRuns >= 10);

  push(ACHIEVEMENTS.MASTER_SURVIVOR, elapsedSeconds >= 15 * 60);
  push(ACHIEVEMENTS.SCORE_25000, score >= 25000);
  push(ACHIEVEMENTS.SCORE_50000, score >= 50000);
  push(ACHIEVEMENTS.NO_DAMAGE_10_MINUTES, noDamage && elapsedSeconds >= 10 * 60);
  push(ACHIEVEMENTS.ALL_BOSSES_SCOUTED, bossesDefeatedCount >= 10);
  push(ACHIEVEMENTS.ENEMY_REAPER_250, cumulativeKills >= 250);
  push(ACHIEVEMENTS.ENEMY_REAPER_500, cumulativeKills >= 500);
  push(ACHIEVEMENTS.GRENADE_DEMOLITIONIST, grenadeTotal >= 250);
  push(ACHIEVEMENTS.BLADE_SAMURAI, meleeTotal >= 250);
  push(ACHIEVEMENTS.POWERUP_HOARDER, powerUpTotal >= 250);

  push(ACHIEVEMENTS.RANKED_REGULAR, paidRuns >= 50);
  push(ACHIEVEMENTS.BOSS_RUSH_TEN, cumulativeBossKills >= 10);
  push(ACHIEVEMENTS.SPEED_CLEAR, Boolean(bossId) && elapsedSeconds > 0 && elapsedSeconds <= 8 * 60);
  push(ACHIEVEMENTS.HARD_FORK_HERO, stageIndexReached >= 13 && grenadeKills >= 20);
  push(ACHIEVEMENTS.MAX_COMBO_30, maxCombo >= 30);

  push(ACHIEVEMENTS.TWO_HUNDRED_RANKED_RUNS, paidRuns >= 200);
  push(ACHIEVEMENTS.TWO_FIFTY_RANKED_RUNS, paidRuns >= 250);
  push(ACHIEVEMENTS.MARATHON_WALLET, cumulativeSeconds >= 10 * 60 * 60);
  push(ACHIEVEMENTS.PERFECT_BOSS_GAUNTLET, perfectBossKills >= 3);
  push(ACHIEVEMENTS.ARCADE_LEGEND_500, paidRuns >= 500);

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

// --- Avatar sanitization helpers (pure, DOM-free, testable) ---------------
//
// Player avatars are user-supplied images. Storing the raw upload verbatim
// keeps EXIF/GPS metadata and lets a 2MB 8000px image bloat state + the nav.
// The real strip/re-encode happens on a <canvas> in main.js (drawing to a
// canvas and reading back a data URL discards all metadata), but the box-fit
// math + accept/size policy are pulled out here so they can be unit-tested.

export const AVATAR_RULES = Object.freeze({
  // Square output the UI renders at; uploads are downscaled to fit this box.
  maxDimension: 256,
  // Hard byte cap enforced before we even read the file.
  maxBytes: 2 * 1024 * 1024,
  allowedTypes: Object.freeze(['image/png', 'image/jpeg']),
  // Re-encode target: JPEG keeps avatars small + uniformly strips metadata.
  outputType: 'image/jpeg',
  outputQuality: 0.85,
});

// Validate the file-level policy (type + size) before reading bytes. Returns
// { ok, error, message } with a stable machine code on rejection.
export function validateAvatarFile({ type, size } = {}) {
  if (!AVATAR_RULES.allowedTypes.includes(type)) {
    return { ok: false, error: 'invalid-type', message: 'Only .png or .jpg images are allowed.' };
  }
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, error: 'empty', message: 'That file looks empty. Try another image.' };
  }
  if (size > AVATAR_RULES.maxBytes) {
    const mb = (size / 1024 / 1024).toFixed(1);
    return { ok: false, error: 'too-large', message: `That image is ${mb}MB — max is 2MB.` };
  }
  return { ok: true, error: null, message: 'ok' };
}

// Compute the target draw box that fits (srcW x srcH) inside a square of
// `maxDimension`, preserving aspect ratio and never upscaling. Returns integer
// width/height (>=1). Pure math so the re-encode path is unit-testable.
export function computeAvatarResize(srcW, srcH, maxDimension = AVATAR_RULES.maxDimension) {
  const w = Math.max(0, Math.floor(Number(srcW) || 0));
  const h = Math.max(0, Math.floor(Number(srcH) || 0));
  const max = Math.max(1, Math.floor(Number(maxDimension) || 1));
  if (w === 0 || h === 0) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
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
    totalKills: 0,
    grenadeKills: 0,
    meleeKills: 0,
    bossKills: 0,
    perfectBossKills: 0,
    cumulativeSeconds: 0,
    cumulativePowerUps: 0,
    maxCombo: 0,
    maxDamageCombo: 0,
    enemyKillsByType: {},
    weaponIdsUsed: [],
    uniquePowerUps: [],
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
    usernameSet: false,
    usernameKey: null,
    avatar: options.avatar || '🕹️',
    avatarUri: options.avatarUri || '',
    avatarDataUrl: options.avatarDataUrl || '',
    rank: 'New Challenger',
    xp: 0,
    joinedAt: nowIso(),
    achievements: [],
    creditsLabel: 'Ranked runs publish on-chain to LitVM (testnet: zkLTC gas only)',
    totalPaidRuns: 0,
    totalFreeRuns: 0,
    progress: {},
    unlocks: { characters: {} },
    preferences: { selectedCharacterId: HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG.starterLegacyId },
  };

  ensureAllGameProgress(profile);
  syncConfiguredCharacterUnlocks(profile, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG);
  return profile;
}

export function createInitialArcadeState() {
  return {
    systemName: 'Lester\'s Arcade',
    systemRole: 'parent-arcade-portal',
    games: [...ARCADE_GAMES],
    profiles: {},
    usernames: {},
    sessions: {},
    localScores: [],
    payments: [],
    transactions: [],
    officialSessions: [],
    settlements: [],
    loginEvents: [],
    // Monotonic global session counter across ALL games in the arcade. Each
    // ranked (or tracked) session gets the next number, formatted as the
    // user-facing/blockchain handle game-session-NNNNNNNNN.
    globalSessionSequence: 0,
    // Index of official sessions by their public game-session-NNNNNNNNN handle.
    sessionsByUrlId: {},
    leaderboards: Object.fromEntries(ARCADE_GAMES.map((game) => [game.id, []])),
    cadenceLeaderboards: Object.fromEntries(ARCADE_GAMES.map((game) => [game.id, Object.fromEntries(LEADERBOARD_CADENCES.map((c) => [c, {}]))])),
  };
}

export function getGame(gameId) {
  const game = ARCADE_GAMES.find((candidate) => candidate.id === gameId);

  if (!game) {
    throw new Error(`Unknown arcade game: ${gameId}`);
  }

  return game;
}

// Look up a recorded official session by its public handle (the
// game-session-NNNNNNNNN id used in the URL and on-chain). This is the
// user-facing "pull an old session" read path. Returns the session record or
// null. Falls back to a linear scan if the index is missing (older state).
export function getSessionByUrlId(state, urlSessionId) {
  if (!state || !urlSessionId) return null;
  const indexed = state.sessionsByUrlId?.[urlSessionId];
  if (indexed) return indexed;
  return (state.officialSessions ?? []).find((s) => s.urlSessionId === urlSessionId) ?? null;
}

export function getCartridgeSelectModel() {
  return ARCADE_GAMES.map((game) => {
    const slug = gameSlugFor(game.id);
    const discoveryText = `${game.genre ?? ''} ${game.tagline ?? ''}`.toLowerCase();
    const discoveryTags = [
      game.status,
      game.presentation?.medium,
      ...(discoveryText.includes('tap') ? ['tap'] : []),
      ...(discoveryText.includes('run') ? ['run-and-gun'] : []),
      ...(discoveryText.includes('pinball') ? ['pinball'] : []),
      ...(discoveryText.includes('platform') ? ['platformer'] : []),
    ].filter(Boolean);
    return {
      id: game.id,
      title: game.title,
      status: game.status,
      playable: game.status === 'playable' && game.publicPlayable !== false,
      routePath: game.status === 'playable' && game.publicPlayable !== false ? `/play/${slug}` : null,
      devRoutePath: game.devPlayable ? `/play/${slug}?devCabinets=1` : null,
      discoveryTags: Object.freeze([...new Set(discoveryTags)]),
      cabinet: game.cabinet,
      genre: game.genre,
      developer: game.developer,
      tagline: game.tagline,
      entryFeeMicroUsdc: game.entryFeeMicroUsdc,
      systemRole: game.systemRole,
      parentSystem: game.parentSystem,
      presentation: { ...game.presentation },
    };
  });
}

export function calculateRevenueSplit(amountMicroUnits, splitBps = DEFAULT_REVENUE_SPLIT_BPS, { settlementGasMicroUnits = null } = {}) {
  if (!Number.isInteger(amountMicroUnits) || amountMicroUnits < 0) {
    throw new Error('amountMicroUnits must be a non-negative integer');
  }

  const totalBps = Object.values(splitBps).reduce((sum, value) => sum + value, 0);
  if (totalBps !== 10_000) {
    throw new Error(`revenue split must equal 10,000 bps; received ${totalBps}`);
  }

  const settlement = Math.floor((amountMicroUnits * splitBps.settlement) / 10_000);
  const dev = Math.floor((amountMicroUnits * splitBps.dev) / 10_000);
  const tournament = Math.floor((amountMicroUnits * splitBps.tournament) / 10_000);
  const community = Math.floor((amountMicroUnits * splitBps.community) / 10_000);
  const allocated = settlement + dev + tournament + community;

  // Dust from flooring goes to dev (largest, owner-facing bucket).
  const split = {
    settlement,
    dev: dev + (amountMicroUnits - allocated),
    tournament,
    community,
  };

  // If we know the actual settlement gas this run needs, reserve exactly that
  // from the settlement bucket and roll the unused remainder into dev — i.e.
  // "cover the chain cost, what's left over goes to the dev wallet."
  if (Number.isInteger(settlementGasMicroUnits) && settlementGasMicroUnits >= 0) {
    const gasReserved = Math.min(settlement, settlementGasMicroUnits);
    const settlementRemainderToDev = settlement - gasReserved;
    split.settlement = gasReserved;
    split.dev += settlementRemainderToDev;
    split.settlementGasReserved = gasReserved;
    split.settlementRemainderToDev = settlementRemainderToDev;
    split.gasShortfall = Math.max(0, settlementGasMicroUnits - settlement);
  }

  return split;
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
  } else if (options.handle && !state.profiles[normalizedWallet].usernameSet) {
    // Only apply the connector's default handle when the player has never set
    // a custom display name — otherwise a reconnect would silently overwrite
    // the persisted username with 'LitVM Pilot'/'Lester Pilot'.
    state.profiles[normalizedWallet].handle = options.handle;
  }

  const profile = state.profiles[normalizedWallet];
  ensureAllGameProgress(profile);
  syncConfiguredCharacterUnlocks(profile, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG);

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

// Format a global session sequence number into the user-facing / blockchain
// handle, e.g. 1 -> 'game-session-000000001'. Zero-padded to 9 digits; longer
// numbers are not truncated.
export function formatUrlSessionId(sequence) {
  const n = Math.max(0, Math.floor(Number(sequence) || 0));
  return `game-session-${String(n).padStart(9, '0')}`;
}

// Reserve the next global session id from arcade state (mutates the counter).
// Returns { sequence, urlSessionId }. Used for ranked/tracked sessions so each
// gets a stable, searchable handle recorded both per-game and globally.
export function nextGlobalSessionId(state) {
  if (!state) throw new Error('state is required to allocate a session id');
  state.globalSessionSequence = (state.globalSessionSequence ?? 0) + 1;
  return {
    sequence: state.globalSessionSequence,
    urlSessionId: formatUrlSessionId(state.globalSessionSequence),
  };
}

export function startPlaySession({ wallet, gameId, mode = 'free', paymentToken = 'USDC', urlSessionId = null, sequenceNumber = null }) {
  const allowDevCabinet = Boolean(arguments[0]?.allowDevCabinet);
  const normalizedWallet = normalizeWallet(wallet);
  const game = getGame(gameId);

  if (!['free', 'paid'].includes(mode)) {
    throw new Error(`Unsupported play mode: ${mode}`);
  }

  if (game.status !== 'playable' && !(allowDevCabinet && game.devPlayable)) {
    throw new Error(`${game.title} is not playable yet`);
  }

  const isPaid = mode === 'paid';
  const sequence = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    sessionId: `${gameId}-${mode}-${sequence}`,
    // User-facing / blockchain-searchable handle (ranked sessions). Free runs
    // may leave this null; the URL then falls back to the game page.
    urlSessionId: urlSessionId,
    sequenceNumber: sequenceNumber,
    wallet: normalizedWallet,
    gameId,
    gameTitle: game.title,
    parentSystem: game.parentSystem,
    childDappRole: game.systemRole,
    mode,
    isPaid,
    paymentToken: isPaid ? paymentToken : null,
    leaderboardEligible: isPaid,
    lives: isPaid ? game.livesPaid : game.livesFree,
    entryFeeMicroUsdc: isPaid ? game.entryFeeMicroUsdc : 0,
    revenueSplit: isPaid ? calculateRevenueSplit(game.entryFeeMicroUsdc) : null,
    parentWriteScopes: isPaid ? [...LESTER_ARCADE_WALLET_RAILS.permissions.writeScopes] : [],
    startedAt: nowIso(),
    // Version tracking: every session records the site + game version at run
    // time so leaderboards can be scoped per-deploy (new deploy = new version =
    // fresh boards; old scores retained historically but filtered out).
    version: { siteVersion: SITE_VERSION, gameVersion: GAME_VERSION },
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

function maybeUnlockRunAchievements(profile, score, runStats = {}, progress = null) {
  const unlockedAchievements = [];

  if (unlockAchievement(profile, ACHIEVEMENTS.FIRST_PAID_RUN.id)) {
    unlockedAchievements.push(ACHIEVEMENTS.FIRST_PAID_RUN.id);
  }

  const cumulativeProgress = progress ?? { bossesDefeated: [] };
  for (const achievementId of resolveAchievementUnlocksForRun({
    score,
    elapsedSeconds: runStats.elapsedSeconds ?? 0,
    bossId: runStats.bossId,
    weaponId: runStats.weaponId,
    rareWeaponId: runStats.rareWeaponId,
    noDamage: runStats.noDamage,
    collectedPowerUps: runStats.collectedPowerUps ?? [],
    kills: runStats.kills ?? 0,
    totalKills: cumulativeProgress.totalKills ?? runStats.kills ?? 0,
    grenadeKills: runStats.grenadeKills ?? 0,
    cumulativeGrenadeKills: cumulativeProgress.grenadeKills ?? runStats.grenadeKills ?? 0,
    meleeKills: runStats.meleeKills ?? 0,
    cumulativeMeleeKills: cumulativeProgress.meleeKills ?? runStats.meleeKills ?? 0,
    enemyKillsByType: runStats.enemyKillsByType ?? {},
    cumulativeEnemyKillsByType: cumulativeProgress.enemyKillsByType ?? {},
    maxCombo: runStats.maxCombo ?? runStats.maxKillCombo ?? cumulativeProgress.maxCombo ?? 0,
    maxDamageCombo: runStats.maxDamageCombo ?? cumulativeProgress.maxDamageCombo ?? 0,
    powerUpsCollected: runStats.powerUpsCollected ?? (runStats.collectedPowerUps?.length ?? 0),
    cumulativePowerUps: cumulativeProgress.cumulativePowerUps ?? 0,
    paidRuns: profile.totalPaidRuns ?? 0,
    cumulativeSeconds: cumulativeProgress.cumulativeSeconds ?? 0,
    bossesDefeatedCount: cumulativeProgress.bossesDefeated?.length ?? 0,
    cumulativeBossKills: cumulativeProgress.bossKills ?? 0,
    perfectBossKills: cumulativeProgress.perfectBossKills ?? 0,
    stageIndexReached: runStats.stageIndexReached ?? 1,
    lowHealthSurvival: runStats.lowHealthSurvival ?? false,
    uniqueWeapons: cumulativeProgress.weaponIdsUsed?.length ?? 0,
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
  progress.totalKills = (progress.totalKills ?? 0) + Math.max(0, Math.floor(runStats.kills ?? 0));
  progress.grenadeKills = (progress.grenadeKills ?? 0) + Math.max(0, Math.floor(runStats.grenadeKills ?? 0));
  progress.meleeKills = (progress.meleeKills ?? 0) + Math.max(0, Math.floor(runStats.meleeKills ?? 0));
  progress.cumulativeSeconds = (progress.cumulativeSeconds ?? 0) + Math.max(0, Math.floor(runStats.elapsedSeconds ?? 0));
  progress.cumulativePowerUps = (progress.cumulativePowerUps ?? 0) + Math.max(0, Math.floor(runStats.powerUpsCollected ?? (runStats.collectedPowerUps?.length ?? 0)));
  progress.maxCombo = Math.max(progress.maxCombo ?? 0, runStats.maxCombo ?? runStats.maxKillCombo ?? 0);
  progress.maxDamageCombo = Math.max(progress.maxDamageCombo ?? 0, runStats.maxDamageCombo ?? 0);
  progress.enemyKillsByType ??= {};
  for (const [enemyId, count] of Object.entries(runStats.enemyKillsByType ?? {})) {
    progress.enemyKillsByType[enemyId] = (progress.enemyKillsByType[enemyId] ?? 0) + Math.max(0, Math.floor(count));
  }
  progress.weaponIdsUsed ??= [];
  if (runStats.weaponId && !progress.weaponIdsUsed.includes(runStats.weaponId)) progress.weaponIdsUsed.push(runStats.weaponId);
  if (runStats.rareWeaponId && !progress.weaponIdsUsed.includes(runStats.rareWeaponId)) progress.weaponIdsUsed.push(runStats.rareWeaponId);
  progress.uniquePowerUps ??= [];
  for (const powerId of runStats.collectedPowerUps ?? []) {
    if (!progress.uniquePowerUps.includes(powerId)) progress.uniquePowerUps.push(powerId);
  }

  if (runStats.bossId && !progress.bossesDefeated.includes(runStats.bossId)) {
    progress.bossesDefeated.push(runStats.bossId);
  }
  if (runStats.bossId) progress.bossKills = (progress.bossKills ?? 0) + 1;
  if (runStats.bossId && runStats.noDamage) progress.perfectBossKills = (progress.perfectBossKills ?? 0) + 1;

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
  const unlockedAchievements = maybeUnlockRunAchievements(profile, score, runStats, progress);
  const parentSync = buildParentSyncPacket(session, { score, runStats, unlockedAchievements });
  updateRank(profile);
  syncConfiguredCharacterUnlocks(profile, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG);

  const entry = {
    sessionId: session.sessionId,
    wallet: profile.wallet,
    handle: profile.handle,
    displayName: resolveDisplayName(profile, profile.wallet),
    gameId: game.id,
    gameTitle: game.title,
    score,
    mode: 'paid',
    runStats: { ...runStats },
    recordedAt: nowIso(),
  };

  state.leaderboards[game.id] ??= [];
  if (entry.sessionId) {
    const existingIndex = state.leaderboards[game.id].findIndex((row) => row.sessionId === entry.sessionId);
    if (existingIndex !== -1) state.leaderboards[game.id].splice(existingIndex, 1);
  }
  state.leaderboards[game.id].push(entry);
  state.leaderboards[game.id].sort((a, b) => b.score - a.score || a.recordedAt.localeCompare(b.recordedAt));
  state.leaderboards[game.id] = state.leaderboards[game.id].slice(0, 10);

  // File this ranked score into the daily/weekly/monthly/yearly/all-time boards.
  const cadenceKeys = recordCadenceScore(state, game.id, {
    wallet: profile.wallet,
    score,
    sessionId: session.sessionId,
    recordedAt: entry.recordedAt,
    runStats,
  });

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
    // Public, blockchain-searchable handle (game-session-NNNNNNNNN) for ranked
    // runs. Mirrored at the parent-arcade level so a user can pull this exact
    // session from any game, and globally across the arcade.
    urlSessionId: session.urlSessionId ?? null,
    sequenceNumber: session.sequenceNumber ?? null,
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
  // Index by the public handle so getSessionByUrlId() can pull it directly.
  if (session.urlSessionId) {
    state.sessionsByUrlId ??= {};
    state.sessionsByUrlId[session.urlSessionId] = officialSession;
  }

  return {
    acceptedForGlobalLeaderboard: true,
    leaderboardEntry: entry,
    cadenceKeys,
    unlockedAchievements,
    parentSync,
    // Input the runtime feeds to settlement.buildSettlementPlan() so Paid Mode
    // zkLTC can settle this score + unlocks + (changed) username to LitVM.
    settlementInput: {
      wallet: profile.wallet,
      gameId: game.id,
      sessionId: session.sessionId,
      score,
      // Run stats that ride inside the on-chain submitSession(...) call so the
      // plan matches the deployed ScoreSubmissionRegistry ABI exactly.
      kills: Math.max(0, Math.round(runStats.kills ?? 0)),
      maxCombo: Math.max(0, Math.round(runStats.maxCombo ?? runStats.maxKillCombo ?? 0)),
      survivalSeconds: Math.max(0, Math.round(runStats.elapsedSeconds ?? 0)),
      bossId: runStats.bossId ?? null,
      cadenceKeys,
      unlockedAchievements,
      username: profile.usernameSet ? profile.handle : null,
      profileChanged: false,
      entryFeeMicroUnits: session.entryFeeMicroUsdc ?? 0,
      paymentToken: session.paymentToken ?? 'USDC',
    },
  };
}

// Persist a completed settlement result (simulated or live) onto state so score
// history / achievement reads can pull tx hashes back. Stamps the matching
// leaderboard + cadence entries with the settlement tx hash.
export function applySettlement(state, settlement) {
  if (!state || typeof state !== 'object') throw new Error('state is required');
  if (!settlement?.sessionId) throw new Error('settlement with sessionId is required');

  state.settlements ??= [];
  const storedSettlement = { ...settlement, receipts: [...(settlement.receipts ?? [])] };
  const existingSettlementIndex = state.settlements.findIndex((row) => row.sessionId === settlement.sessionId);
  if (existingSettlementIndex === -1) {
    state.settlements.push(storedSettlement);
  } else {
    state.settlements[existingSettlementIndex] = storedSettlement;
  }

  const txHash = settlement.primaryTxHash ?? null;
  const simulatedTxHash = settlement.primarySimulatedTxHash ?? null;
  const gameId = settlement.gameId;

  // stamp flat board
  for (const e of state.leaderboards?.[gameId] ?? []) {
    if (e.sessionId === settlement.sessionId) {
      e.settlementTxHash = txHash;
      e.settlementSimulatedTxHash = simulatedTxHash;
    }
  }
  // stamp cadence buckets
  const cadenceStore = state.cadenceLeaderboards?.[gameId];
  if (cadenceStore) {
    for (const cadence of Object.keys(cadenceStore)) {
      for (const periodKey of Object.keys(cadenceStore[cadence])) {
        for (const row of cadenceStore[cadence][periodKey]) {
          if (row.sessionId === settlement.sessionId) {
            row.settlementTxHash = txHash;
            row.settlementSimulatedTxHash = simulatedTxHash;
          }
        }
      }
    }
  }
  // stamp official session
  if (state.sessions?.[settlement.sessionId]) {
    state.sessions[settlement.sessionId].settlement = {
      mode: settlement.mode,
      primaryTxHash: txHash,
      primarySimulatedTxHash: simulatedTxHash,
      settledAt: settlement.settledAt,
    };
    // Persist the run-integrity verdict (if the caller attached one) so a
    // 'suspicious' ranked run is durably auditable in state instead of only
    // being a transient console.warn. 'ok' verdicts are not stored (noise).
    if (settlement.integrity && settlement.integrity.verdict && settlement.integrity.verdict !== 'ok') {
      state.sessions[settlement.sessionId].integrity = {
        verdict: settlement.integrity.verdict,
        flags: [...(settlement.integrity.flags ?? [])],
      };
      state.flaggedSessions ??= [];
      if (!state.flaggedSessions.some((f) => f.sessionId === settlement.sessionId)) {
        state.flaggedSessions.push({
          sessionId: settlement.sessionId,
          gameId,
          wallet: settlement.wallet ?? null,
          verdict: settlement.integrity.verdict,
          flags: [...(settlement.integrity.flags ?? [])],
          flaggedAt: settlement.settledAt ?? nowIso(),
        });
      }
    }
  }
  return settlement;
}

// State-bound username setter that reuses the arcade's own ensureProfile.
export function setArcadeUsername(state, wallet, rawName) {
  return setPlayerUsername(state, wallet, rawName, { ensureProfile: ensureProfile });
}

function cloneProgress(progress) {
  return Object.fromEntries(Object.entries(progress).map(([gameId, entry]) => [
    gameId,
    {
      ...entry,
      bossesDefeated: [...entry.bossesDefeated],
      enemyKillsByType: { ...(entry.enemyKillsByType ?? {}) },
      weaponIdsUsed: [...(entry.weaponIdsUsed ?? [])],
      uniquePowerUps: [...(entry.uniquePowerUps ?? [])],
      officialLeaderboardRank: null,
    },
  ]));
}

export function buildPlayerArcadeSnapshot(state, wallet) {
  const profile = ensureProfile(state, wallet);
  ensureAllGameProgress(profile);
  syncConfiguredCharacterUnlocks(profile, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG);
  const identity = normalizeProfileIdentity({ wallet: profile.wallet, localProfile: profile });
  const progress = cloneProgress(profile.progress);
  const highScores = [];

  for (const [gameId, entries] of Object.entries(state.leaderboards)) {
    entries.forEach((entry, index) => {
      if (entry.wallet === profile.wallet) {
        // Defensive: a leaderboard may exist for a gameId the profile hasn't
        // initialized progress for (seeded boards, retired cabinets). Skip
        // rather than throw on progress[gameId] being undefined — an uncaught
        // throw here propagates up through render() and blanks the whole app
        // right after wallet connect.
        if (progress[gameId]) {
          progress[gameId].officialLeaderboardRank = index + 1;
        }
        highScores.push({ ...entry, rank: index + 1 });
      }
    });
  }

  return {
    parentSystem: state.systemName || 'Lester\'s Arcade',
    systemRole: 'parent-arcade-account',
    profile: {
      wallet: identity.wallet,
      handle: identity.handle,
      displayName: identity.displayName,
      usernameSet: Boolean(identity.usernameSet),
      avatar: profile.avatar,
      avatarDataUrl: identity.avatarDataUrl,
      avatarUri: identity.avatarUri,
      profileParity: identity.parity,
      rank: profile.rank,
      xp: profile.xp,
      joinedAt: profile.joinedAt,
      totalPaidRuns: profile.totalPaidRuns,
      totalFreeRuns: profile.totalFreeRuns,
      unlocks: clone(profile.unlocks ?? {}),
      preferences: clone(profile.preferences ?? {}),
      selectedCharacterId: resolveSelectedCharacterId(profile, HARD_MONEY_HEROES_CHARACTER_SLOT_CONFIG),
    },
    progress,
    achievementSummary: Object.freeze({
      total: Object.values(ACHIEVEMENTS).length,
      unlocked: Object.values(ACHIEVEMENTS).filter((achievement) => profile.achievements.includes(achievement.id)).length,
      locked: Object.values(ACHIEVEMENTS).filter((achievement) => !profile.achievements.includes(achievement.id)).length,
    }),
    achievements: Object.values(ACHIEVEMENTS).map((achievement) => {
      const unlocked = profile.achievements.includes(achievement.id);
      return {
        ...achievement,
        unlocked,
        locked: !unlocked,
        iconSrc: unlocked ? achievement.badgeSrc : achievement.lockedBadgeSrc,
      };
    }),
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
    settlements: (state.settlements ?? [])
      .filter((settlement) => settlement.wallet === profile.wallet)
      .map((settlement) => ({
        sessionId: settlement.sessionId,
        gameId: settlement.gameId,
        score: settlement.score,
        mode: settlement.mode,
        primaryTxHash: settlement.primaryTxHash,
        primarySimulatedTxHash: settlement.primarySimulatedTxHash,
        settledAt: settlement.settledAt,
        cadenceKeys: { ...(settlement.cadenceKeys ?? {}) },
      })),
    loginEvents: (state.loginEvents ?? []).filter((event) => event.wallet === profile.wallet),
  };
}

// Synthetic "rarity" for a prototype that has no real global unlock index yet.
// Rarer tiers map to a lower simulated "% of players who've unlocked it", so the
// stats module can surface a believable "top achievement by rarity". Clearly a
// prototype heuristic until on-chain/global achievement indexing exists.
const ACHIEVEMENT_TIER_UNLOCK_PCT = Object.freeze({
  bronze: 62, silver: 34, gold: 15, platinum: 6, diamond: 2,
});

export function achievementRarityPct(achievement) {
  if (!achievement) return 100;
  const base = ACHIEVEMENT_TIER_UNLOCK_PCT[achievement.tier] ?? 40;
  // Nudge by difficulty so two same-tier achievements still order deterministically.
  const diffNudge = { easy: 4, medium: 0, hard: -3, expert: -5 }[achievement.difficulty] ?? 0;
  return Math.max(1, Math.min(99, base + diffNudge));
}

function formatSurvival(totalSeconds) {
  const s = Math.max(0, Math.round(Number(totalSeconds) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

function formatScoreValue(score) {
  return Math.max(0, Math.round(Number(score) || 0)).toLocaleString();
}

export function buildProfileExperienceV2Model(state, wallet, { selectedGameId = 'lester-blaster', sessionLimit = 12 } = {}) {
  const snapshot = buildPlayerArcadeSnapshot(state, wallet);
  const profile = ensureProfile(state, wallet);
  const selectedGame = getGame(selectedGameId);
  const officialSessions = [...(snapshot.officialSessions ?? [])]
    .sort((a, b) => (b.sequenceNumber ?? 0) - (a.sequenceNumber ?? 0) || String(b.syncedAt ?? '').localeCompare(String(a.syncedAt ?? '')));
  const settlementsBySessionId = new Map((snapshot.settlements ?? []).map((settlement) => [settlement.sessionId, settlement]));
  const sessionFeedRows = officialSessions.slice(0, sessionLimit).map((session) => {
    const game = getGame(session.gameId);
    const score = Math.max(0, Math.round(Number(session.score ?? session.runStats?.score ?? 0) || 0));
    const row = {
      gameId: session.gameId,
      wallet: profile.wallet,
      sessionId: session.sessionId,
      urlSessionId: session.urlSessionId,
      score,
      runStats: { ...(session.runStats ?? {}) },
      recordedAt: session.syncedAt ?? session.recordedAt ?? null,
      settlementTxHash: session.settlement?.primaryTxHash ?? settlementsBySessionId.get(session.sessionId)?.primaryTxHash ?? null,
      settlementSimulatedTxHash: session.settlement?.primarySimulatedTxHash ?? settlementsBySessionId.get(session.sessionId)?.primarySimulatedTxHash ?? null,
    };
    const trust = leaderboardRowTrust(state, session.gameId, row);
    const detail = leaderboardDetailFor(state, session.gameId, row);
    return {
      ...row,
      gameTitle: game.title,
      scoreLabel: formatScoreValue(score),
      survivalLabel: formatSurvival(row.runStats.surviveSeconds ?? row.runStats.elapsedSeconds ?? 0),
      kills: row.runStats.kills ?? 0,
      trust,
      detailHref: detail.detailHref,
      urlSessionId: detail.urlSessionId,
      actions: { viewSession: detail.detailHref, inspectTrust: trust.flags.length > 0 },
    };
  });

  const unlockedAchievements = (snapshot.achievements ?? []).filter((achievement) => achievement.unlocked);
  const lockedAchievements = (snapshot.achievements ?? []).filter((achievement) => !achievement.unlocked);
  const rareAchievement = unlockedAchievements
    .map((achievement) => ({ ...achievement, rarityPct: achievementRarityPct(achievement) }))
    .sort((a, b) => a.rarityPct - b.rarityPct || a.title.localeCompare(b.title))[0] ?? null;
  const achievementGroups = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'mythic'].map((tier) => {
    const entries = (snapshot.achievements ?? []).filter((achievement) => (achievement.tier ?? 'bronze') === tier);
    return {
      id: tier,
      label: tier[0].toUpperCase() + tier.slice(1),
      total: entries.length,
      unlocked: entries.filter((achievement) => achievement.unlocked).length,
      badges: entries.map((achievement) => ({
        id: achievement.id,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.unlocked ? (achievement.icon ?? '🏅') : '🔒',
        iconSrc: achievement.iconSrc,
        tierBadgeSrc: achievement.tierBadgeSrc,
        unlockTypeIconSrc: achievement.unlockTypeIconSrc,
        tier: achievement.tier,
        unlocked: achievement.unlocked,
        rarityPct: achievementRarityPct(achievement),
      })),
    };
  }).filter((group) => group.total > 0);

  const gameCollection = ARCADE_GAMES.map((game) => {
    const progress = snapshot.progress?.[game.id] ?? createEmptyGameProgress(game.id);
    const bestScore = Math.max(progress.bestPaidScore ?? 0, progress.bestFreeScore ?? 0);
    const totalRuns = (progress.paidRuns ?? 0) + (progress.freeRuns ?? 0);
    return {
      id: game.id,
      title: game.title,
      status: game.status,
      playable: game.status === 'playable',
      played: totalRuns > 0,
      totalRuns,
      rankedRuns: progress.paidRuns ?? 0,
      bestScore,
      bestScoreLabel: formatScoreValue(bestScore),
      longestRunLabel: formatSurvival(progress.longestRunSeconds ?? 0),
      routePath: `/play/${gameSlugFor(game.id)}`,
    };
  });
  const characterCollection = LESTER_BLASTER_CHARACTER_ROSTER.map((character) => {
    const unlocked = Boolean(profile.unlocks?.characters?.[character.id] ?? profile.unlocks?.characters?.[character.legacyId]);
    return {
      id: character.id,
      legacyId: character.legacyId,
      title: character.title,
      role: character.role,
      portraitAsset: character.portraitAsset,
      unlocked,
      selected: snapshot.profile.selectedCharacterId === character.id || snapshot.profile.selectedCharacterId === character.legacyId,
      unlock: character.unlock,
      unlockDescription: character.unlockDescription ?? (unlocked ? 'Unlocked' : 'Locked'),
    };
  });

  const totalRankedRuns = officialSessions.length;
  const settledRuns = sessionFeedRows.filter((row) => row.trust.verdict === 'settled' || row.settlementTxHash).length;
  const bestScore = Math.max(...Object.values(snapshot.progress ?? {}).map((progress) => Math.max(progress.bestPaidScore ?? 0, progress.bestFreeScore ?? 0)), 0);
  const selectedProgress = snapshot.progress?.[selectedGame.id] ?? createEmptyGameProgress(selectedGame.id);

  return {
    profile: {
      ...snapshot.profile,
      walletShort: `${profile.wallet.slice(0, 8)}…${profile.wallet.slice(-6)}`,
      joinedLabel: snapshot.profile.joinedAt ? new Date(snapshot.profile.joinedAt).toISOString().slice(0, 10) : 'unknown',
    },
    selectedGame: {
      id: selectedGame.id,
      title: selectedGame.title,
      bestScore: Math.max(selectedProgress.bestPaidScore ?? 0, selectedProgress.bestFreeScore ?? 0),
      bestScoreLabel: formatScoreValue(Math.max(selectedProgress.bestPaidScore ?? 0, selectedProgress.bestFreeScore ?? 0)),
    },
    privacy: {
      current: profile.preferences?.profileVisibility ?? 'public',
      options: [
        { id: 'public', label: 'Public', copy: 'Show display name, avatar, trophies, ranked runs, and public score links.' },
        { id: 'unlisted', label: 'Unlisted', copy: 'Keep the profile shareable by direct link, but out of future public discovery.' },
        { id: 'private', label: 'Private', copy: 'Only show wallet-owned data locally after connecting this wallet.' },
      ],
      walletLocked: true,
    },
    editing: {
      username: { enabled: true, minLength: 3, maxLength: 18, value: snapshot.profile.usernameSet ? snapshot.profile.handle : '' },
      avatar: { enabled: true, maxBytes: 2 * 1024 * 1024, acceptedTypes: ['image/jpeg', 'image/png'], requiredPixels: 150 },
      privacy: { enabled: true, field: 'preferences.profileVisibility' },
    },
    trophyRoom: {
      summary: {
        totalRankedRuns,
        totalFreeRuns: snapshot.profile.totalFreeRuns ?? 0,
        settledRuns,
        achievementsUnlocked: unlockedAchievements.length,
        achievementsTotal: (snapshot.achievements ?? []).length,
        bestScore,
      },
      cards: [
        { id: 'best-score', label: 'Best Score', value: formatScoreValue(bestScore), tone: bestScore > 0 ? 'gold' : 'muted' },
        { id: 'ranked-runs', label: 'Ranked Runs', value: String(totalRankedRuns), tone: totalRankedRuns > 0 ? 'silver' : 'muted' },
        { id: 'settled-receipts', label: 'Settled Receipts', value: String(settledRuns), tone: settledRuns > 0 ? 'verified' : 'muted' },
        { id: 'rare-achievement', label: 'Rarest Badge', value: rareAchievement?.title ?? 'Locked', tier: rareAchievement?.tier ?? null, icon: rareAchievement?.icon ?? '🔒', iconSrc: rareAchievement?.iconSrc ?? null, rarityPct: rareAchievement?.rarityPct ?? null },
      ],
    },
    sessionFeed: {
      rows: sessionFeedRows,
      emptyCopy: 'Ranked game-over submissions appear here with score, trust state, and session detail links.',
    },
    achievements: {
      summary: { total: (snapshot.achievements ?? []).length, unlocked: unlockedAchievements.length, locked: lockedAchievements.length },
      groups: achievementGroups,
      recent: unlockedAchievements.slice(-6).reverse().map((achievement) => ({
        id: achievement.id,
        title: achievement.title,
        tier: achievement.tier,
        icon: achievement.icon,
        iconSrc: achievement.iconSrc,
        rarityPct: achievementRarityPct(achievement),
      })),
    },
    collection: {
      games: gameCollection,
      characters: characterCollection,
      unlockCounts: {
        gamesPlayed: gameCollection.filter((game) => game.played).length,
        charactersUnlocked: characterCollection.filter((character) => character.unlocked).length,
      },
    },
  };
}

/**
 * Game-specific stats breakdown for the Profile/Leaderboard module.
 * For Hard Money Heroes: leaderboard rank, per-enemy-type and boss kills (with
 * readable titles), power-ups grabbed, longest survival (m:ss), and the player's
 * "top achievement" chosen by rarity (rarest unlocked).
 */
export function buildHardMoneyHeroesStatsModule(state, wallet, gameId = 'lester-blaster') {
  const profile = ensureProfile(state, wallet);
  const progress = profile.progress?.[gameId] ?? createEmptyGameProgress(gameId);

  // Leaderboard rank among all high scores for this game.
  const board = (state.leaderboards?.[gameId] ?? []).slice().sort((a, b) => b.score - a.score);
  const rankIndex = board.findIndex((entry) => entry.wallet === profile.wallet);
  const rank = rankIndex >= 0 ? rankIndex + 1 : null;
  const bestScore = Math.max(progress.bestPaidScore ?? 0, progress.bestFreeScore ?? 0);

  // Per-enemy-type kills, resolved to readable titles. Boss keys are prefixed.
  const enemyTitleById = Object.fromEntries(LESTER_BLASTER_ENEMY_CATALOG.map((e) => [e.id, e.title]));
  const bossTitleById = Object.fromEntries((LESTER_BLASTER_BOSS_SYSTEM.bosses ?? []).map((b) => [b.id, b.title]));
  const killsByType = progress.enemyKillsByType ?? {};
  const enemyBreakdown = [];
  const bossBreakdown = [];
  for (const [key, count] of Object.entries(killsByType)) {
    if (key.startsWith('boss:')) {
      const bid = key.slice(5);
      bossBreakdown.push({ id: bid, title: bossTitleById[bid] ?? 'Boss', kills: count });
    } else {
      enemyBreakdown.push({ id: key, title: enemyTitleById[key] ?? key, kills: count });
    }
  }
  enemyBreakdown.sort((a, b) => b.kills - a.kills);
  bossBreakdown.sort((a, b) => b.kills - a.kills);

  // Top achievement by rarity: rarest (lowest unlock %) the player has unlocked.
  const unlockedAchievements = Object.values(ACHIEVEMENTS)
    .filter((a) => profile.achievements.includes(a.id))
    .map((a) => ({ ...a, rarityPct: achievementRarityPct(a) }))
    .sort((a, b) => a.rarityPct - b.rarityPct);
  const topAchievement = unlockedAchievements[0] ?? null;

  return {
    gameId,
    gameTitle: getGame(gameId).title,
    rank,
    totalRanked: board.length,
    bestScore,
    totalKills: progress.totalKills ?? 0,
    enemyBreakdown,
    bossBreakdown,
    bossKills: progress.bossKills ?? 0,
    powerUpsGrabbed: progress.cumulativePowerUps ?? 0,
    longestSurvivalSeconds: progress.longestRunSeconds ?? 0,
    longestSurvivalLabel: formatSurvival(progress.longestRunSeconds ?? 0),
    topAchievement: topAchievement ? {
      id: topAchievement.id, title: topAchievement.title, description: topAchievement.description,
      tier: topAchievement.tier, icon: topAchievement.icon, iconSrc: topAchievement.iconSrc, rarityPct: topAchievement.rarityPct,
    } : null,
    achievementsUnlocked: unlockedAchievements.length,
    achievementsTotal: Object.values(ACHIEVEMENTS).length,
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

// District-biased enemy spawn tables (best practice for readable, thematic levels)
export const DISTRICT_ENEMY_BIAS = Object.freeze({
  DOWNTOWN: { coverShooter: 0.5, meleeRusher: 0.3, flyerHarasser: 0.2 },
  INDUSTRIAL: { coverShooter: 0.6, armoredPressure: 0.3, turret: 0.1 },
  CITY_PARK: { flyerHarasser: 0.5, meleeRusher: 0.3, status: 0.2 },
  FOREST_WILDERNESS: { meleeRusher: 0.4, flyerHarasser: 0.4, control: 0.2 },
  BEACH_AREA: { meleeRusher: 0.5, flyerHarasser: 0.3, status: 0.2 },
  COMMERCIAL: { coverShooter: 0.4, meleeRusher: 0.3, economy: 0.3 }
});

export function getBiasedEnemyRoles(districtId) {
  return DISTRICT_ENEMY_BIAS[districtId?.toUpperCase()] || { coverShooter: 0.4, meleeRusher: 0.4, flyerHarasser: 0.2 };
}

// --- Extraction scoring (quarter-arcade target-time system) -----------------
//
// The quarter-arcade vision: every level has a target time. Clearing under
// target is the mastery axis; the extraction score folds base score, time
// bonus, no-damage play, and combos into one comparable number with a letter
// grade. Assist-on runs are scored on a reduced multiplier so Assist-Off
// boards stay meaningful (per build-risk review v2.1).
export const HMH_LEVEL_TARGETS = Object.freeze({
  1: Object.freeze({ level: 1, title: 'Crypto Wasteland', targetSeconds: 300, masterySeconds: 270, brief: 'Handcrafted badlands opener with optional POI pressure and a ~5 minute clear target.' }),
  2: Object.freeze({ level: 2, title: 'The Tower', targetSeconds: 360, masterySeconds: 324, brief: 'Vertical ascent, 6-minute target, real pressure begins.' }),
  3: Object.freeze({ level: 3, title: 'The Getaway', targetSeconds: 480, masterySeconds: 432, brief: 'Auto-scroll escape, 8-minute target, most players lose here.' }),
  4: Object.freeze({ level: 4, title: 'The Mempool Abyss', targetSeconds: 600, masterySeconds: 540, brief: 'Near-impossible 10-minute finale. Mastery = consistent sub-9:00.' }),
});

export function getHmhLevelTarget(level = 1) {
  const key = Math.min(4, Math.max(1, Math.round(Number(level) || 1)));
  return HMH_LEVEL_TARGETS[key];
}

export function calculateExtractionScore({
  baseScore = 0,
  elapsedSeconds = 0,
  level = 1,
  targetSeconds = null,
  masterySeconds = null,
  cleared = false,
  noDamageSeconds = 0,
  maxCombo = 0,
  deaths = 0,
  assistOn = false,
} = {}) {
  const target = getHmhLevelTarget(level);
  const safeTarget = Math.max(1, Math.round(Number(targetSeconds ?? target.targetSeconds) || target.targetSeconds));
  const safeMastery = Math.max(1, Math.round(Number(masterySeconds ?? target.masterySeconds) || Math.round(safeTarget * 0.9)));
  const safeElapsed = Math.max(0, Number(elapsedSeconds) || 0);
  const safeBase = Math.max(0, Math.round(Number(baseScore) || 0));
  const safeDeaths = Math.max(0, Math.round(Number(deaths) || 0));

  const breakdown = {
    base: safeBase,
    // Clearing pays a flat bonus scaled to the level's target. At 5x target
    // seconds this always exceeds the failed-run survival cap (4x target), so
    // a clear ALWAYS outscores dying at the wall with the same base score.
    clearBonus: cleared ? safeTarget * 5 : 0,
    // Clearing under target is the mastery axis: every second under target pays.
    timeBonus: cleared ? Math.max(0, Math.round(safeTarget - safeElapsed)) * 25 : 0,
    // Failed runs still earn survival credit toward the target (capped there, so
    // dying at 90% of target beats dying instantly but never beats clearing).
    survival: cleared ? 0 : Math.round(Math.min(safeElapsed, safeTarget)) * 4,
    noDamage: Math.max(0, Math.round(Number(noDamageSeconds) || 0)) * 12,
    combo: Math.max(0, Math.round(Number(maxCombo) || 0)) * 40,
    deathPenalty: -safeDeaths * 500,
  };

  let total = Math.max(0, Object.values(breakdown).reduce((sum, value) => sum + value, 0));
  if (assistOn) total = Math.floor(total * 0.8);

  const grade = cleared
    ? (safeElapsed <= safeMastery ? 'S' : safeElapsed <= safeTarget ? 'A' : 'B')
    : (safeElapsed >= safeTarget * 0.6 ? 'C' : 'D');

  return Object.freeze({
    total,
    grade,
    cleared: Boolean(cleared),
    assistOn: Boolean(assistOn),
    targetSeconds: safeTarget,
    masterySeconds: safeMastery,
    // Positive = finished under target; negative = over target / died early.
    timeDeltaSeconds: Math.round(safeTarget - safeElapsed),
    breakdown: Object.freeze(breakdown),
  });
}
