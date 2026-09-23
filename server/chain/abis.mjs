// Human-readable ABI fragments for every contract function and event the
// server uses (contract §8.2-§8.5). tests/chain-abis.test.mjs proves each
// fragment exists, with the same inputs and outputs, in
// contracts/artifacts/<Name>.json, so a contract change cannot drift silently.

const VERIFIED_RUN_TUPLE = '(bytes32 sessionId, bytes32 gameId, address player, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 envelopeHash, bytes32 runtimeId, bytes32 seasonId, uint64 deadline, bytes32 achievementsHash)';
const SESSION_TUPLE = '(bytes32 sessionId, address player, bytes32 gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 runtimeId, bytes32 seasonId, uint64 submittedAt, bool verified, bool exists)';

export const SCORE_REGISTRY_ABI = Object.freeze([
  `function submitVerifiedSession(${VERIFIED_RUN_TUPLE} run, bytes32[] achievements, bytes signature)`,
  `function attestationDigest(${VERIFIED_RUN_TUPLE} run) view returns (bytes32)`,
  `function getSession(bytes32 sessionId) view returns (${SESSION_TUPLE})`,
  'function sessionEnvelopeHash(bytes32) view returns (bytes32)',
  'function getSessionAchievements(bytes32 sessionId) view returns (bytes32[])',
  'function relayers(address) view returns (bool)',
  'function rankedEntry() view returns (address)',
  'function trustedVerifier() view returns (address)',
  'function achievementRegistryByGame(bytes32) view returns (address)',
  'function achievementsHashOf(bytes32[] achievements) pure returns (bytes32)',
  'function domainSeparator() view returns (bytes32)',
  'function MAX_SCORE() view returns (uint256)',
  'event ScoreSubmitted(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 score, uint64 kills, uint64 maxCombo, uint64 survivalSeconds, bytes32 bossId, bytes32 runtimeId, bytes32 seasonId)',
  'event SessionSubmitted(bytes32 indexed sessionId, bool verified)',
]);

export const RANKED_ENTRY_ABI = Object.freeze([
  'function getPaidSession(bytes32 sessionId) view returns ((address player, bytes32 gameId, uint256 amountWei, uint64 openedAt, bool exists))',
  'function isPaid(bytes32 sessionId, address player, bytes32 gameId) view returns (bool)',
  'function quoteEntry(bytes32 gameId) view returns (uint256 entryFeeWei, uint256 settlementGasReserveWei_, uint256 totalWei)',
  'function settlementGasReserveWei() view returns (uint256)',
  'function entryFeeEnabled() view returns (bool)',
  'event RankedSessionOpened(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 amountWei)',
]);

export const PROFILE_REGISTRY_ABI = Object.freeze([
  'function getProfile(address wallet) view returns ((bytes32 handle, string displayName, string avatarUri, uint256 createdAt, uint256 lastUpdated, bool exists))',
  'function handleOwners(bytes32) view returns (address)',
  'event ProfileCreated(address indexed wallet, bytes32 indexed handle, string displayName)',
  'event ProfileUpdated(address indexed wallet, string displayName, string avatarUri)',
  'event HandleReserved(address indexed wallet, bytes32 indexed handle)',
]);

export const ACHIEVEMENT_REGISTRY_ABI = Object.freeze([
  'function tokenIdFor(address wallet, bytes32 achievementId) pure returns (uint256)',
  'function hasUnlocked(address wallet, bytes32 achievementId) view returns (bool)',
  'function minters(address) view returns (bool)',
  'function getAchievement(bytes32 id) view returns ((bytes32 id, bytes32 gameId, string title, string category, string tokenUriPath, bool exists))',
  'event AchievementUnlocked(address indexed wallet, bytes32 indexed achievementId, bytes32 indexed sessionId, uint256 tokenId)',
]);

export const GAME_REGISTRY_ABI = Object.freeze([
  'function getGame(bytes32 gameId) view returns ((bytes32 gameId, string title, address devWallet, uint16 devBps, uint16 platformBps, uint16 liquidityBps, uint16 treasuryBps, uint256 entryFeeWei, bool devWalletConfirmed, bool playable, bool exists, uint256 registeredAt))',
]);

// Keyed by artifact name (contracts/artifacts/<Name>.json).
export const SERVER_ABIS = Object.freeze({
  ScoreSubmissionRegistry: SCORE_REGISTRY_ABI,
  ArcadeRankedEntry: RANKED_ENTRY_ABI,
  PlayerProfileRegistry: PROFILE_REGISTRY_ABI,
  AchievementRegistry: ACHIEVEMENT_REGISTRY_ABI,
  GameRegistry: GAME_REGISTRY_ABI,
});

// topic0 values from contract §8.2-§8.5.
export const EVENT_TOPICS = Object.freeze({
  ScoreSubmitted: '0x73ec57c5e363c24b83733fedeed6265c15e32920f276b11eec2f92ef9a673bdf',
  SessionSubmitted: '0xc558944acf0a60aaa447720c7d7854875dd95d6576e6f10d3a582b1553ca4ca5',
  RankedSessionOpened: '0x14f46b8cebfe91f0708e999826c93785fc98cc35cb8c7c5a53ecbf99aaaf1207',
  ProfileCreated: '0x4e7a7e66fe87642c23aa0ec0360ed3051eaf7f243bfa32bf99e390acf608fb4c',
  ProfileUpdated: '0x6eb3a1c6a4675ba92d44e090515b1ceea358f26565d2854df0c99c3f5eaf9850',
  AchievementUnlocked: '0xa63e9940f858e00a63db1b55555c7b25e93c8fd9a85e1e9e21fd0fff4a2dc22e',
});
