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

// The Chikun Weekly Jackpot (design §A.13-§A.15): every view, send and event
// the jackpot server uses (keeper, indexer, reconcile, health, review gate).
const JACKPOT_RULES_TUPLE = '(uint64 fromWeek, uint64 maxSurvivalSeconds, bool adminClearOnly, uint128 minPaidWei, uint128 maxPrizeWei, uint128 minFundWei, uint256 maxScore, bytes32 seasonId, bytes32 altSeasonId)';
export const WEEKLY_JACKPOT_ABI = Object.freeze([
  'function admin() view returns (address)',
  'function keeper() view returns (address)',
  'function operator() view returns (address)',
  'function paused() view returns (bool)',
  'function adminPaused() view returns (bool)',
  'function operatorPaused() view returns (bool)',
  'function token() view returns (address)',
  'function gameId() view returns (bytes32)',
  'function firstWeek() view returns (uint64)',
  'function endAfterWeek() view returns (uint64)',
  'function currentWeek() view returns (uint64)',
  'function weekOf(uint64 ts) pure returns (uint64)',
  'function weekBounds(uint64 week) view returns (uint64 start, uint64 close, uint64 settleCutoff, uint64 candidateUntil, uint64 payoutAt)',
  'function potOf(uint64 week) view returns (uint256 funded, uint256 carriedIn, uint256 total)',
  'function weekState(uint64 week) view returns (uint8 status, bool held, uint8 count, address winner, bytes32 winningSession, uint256 prize, uint256 unclaimed, uint64 finalizedAt, uint32 extension)',
  'function candidatesOf(uint64 week) view returns ((bytes32 sessionId, address player, uint64 submittedAt, uint64 score)[] list)',
  'function leaderOf(uint64 week) view returns (bytes32 sessionId, address player, uint256 score, uint8 review)',
  `function rulesFor(uint64 week) view returns (${JACKPOT_RULES_TUPLE})`,
  'function rulesCount() view returns (uint256)',
  `function rulesAt(uint256 index) view returns (${JACKPOT_RULES_TUPLE})`,
  'function checkEligibility(bytes32 sessionId) view returns (bool ok, uint64 week, string reason)',
  'function reviewOf(bytes32) view returns (uint8)',
  'function reviewReason(bytes32) view returns (bytes32)',
  'function adminReviewed(bytes32) view returns (bool)',
  'function wasListed(bytes32) view returns (bool)',
  'function staffEver(address) view returns (bool)',
  'function blocked(address) view returns (bool)',
  'function walletDisqualified(uint64, address) view returns (bool)',
  'function submitCandidate(bytes32 sessionId)',
  'function clear(bytes32 sessionId)',
  'function flag(bytes32 sessionId, bytes32 reason)',
  'function finalize(uint64 week)',
  'event Funded(uint64 indexed week, address indexed funder, uint256 amount)',
  'event RolledOver(uint64 indexed fromWeek, uint64 indexed toWeek, uint256 amount)',
  'event CapExcessCarried(uint64 indexed fromWeek, uint64 indexed toWeek, uint256 amount)',
  'event CandidateSubmitted(uint64 indexed week, bytes32 indexed sessionId, address indexed player, uint256 score, uint64 submittedAt, address submitter, uint8 rank)',
  'event CandidateRemoved(uint64 indexed week, bytes32 indexed sessionId, bytes32 reason)',
  'event CandidateSkipped(uint64 indexed week, bytes32 indexed sessionId, bytes32 reason)',
  'event LeaderChanged(uint64 indexed week, bytes32 indexed sessionId, address indexed player, uint256 score)',
  'event Cleared(bytes32 indexed sessionId, address indexed by)',
  'event Flagged(uint64 indexed week, bytes32 indexed sessionId, bytes32 reason, address indexed by)',
  'event Disqualified(uint64 indexed week, bytes32 indexed sessionId, address indexed player, bool wholeWalletForWeek, bytes32 reason)',
  'event Reinstated(uint64 indexed week, bytes32 indexed sessionId)',
  'event WalletBlocked(address indexed wallet, bool blocked, bytes32 reason)',
  'event WeekHeld(uint64 indexed week, bytes32 reason)',
  'event WeekReleased(uint64 indexed week)',
  'event WeekExtended(uint64 indexed week, uint32 totalExtensionSeconds)',
  'event Finalized(uint64 indexed week, address indexed winner, bytes32 indexed sessionId, uint256 score, uint256 prize)',
  'event PrizeTransferFailed(uint64 indexed week, address indexed winner, uint256 amount)',
  'event PrizeClaimed(uint64 indexed week, address indexed winner, address to, uint256 amount)',
  'event UnclaimedRecycled(uint64 indexed week, uint64 indexed toWeek, uint256 amount)',
  'event RulesScheduled(uint64 indexed fromWeek, bytes32 seasonId, bytes32 altSeasonId, uint128 minPaidWei, uint64 maxSurvivalSeconds, uint256 maxScore, uint128 maxPrizeWei, uint128 minFundWei, bool adminClearOnly)',
  'event KeeperUpdated(address indexed keeper)',
  'event AdminTransferred(address indexed previous, address indexed current)',
  'event OperatorTransferred(address indexed previous, address indexed current)',
  'event Paused(address by, bool isOperator)',
  'event Unpaused(address by, bool isOperator)',
  'event EndScheduled(uint64 lastWeek)',
  'event EndCancelled()',
  'event RefundedAfterEnd(uint64 indexed week, address indexed funder, uint256 amount)',
]);

// The prize token reads (tCHIKUN or any ERC-20 with metadata).
export const ERC20_READ_ABI = Object.freeze([
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
]);

// Keyed by artifact name (contracts/artifacts/<Name>.json).
export const SERVER_ABIS = Object.freeze({
  ScoreSubmissionRegistry: SCORE_REGISTRY_ABI,
  ArcadeRankedEntry: RANKED_ENTRY_ABI,
  PlayerProfileRegistry: PROFILE_REGISTRY_ABI,
  AchievementRegistry: ACHIEVEMENT_REGISTRY_ABI,
  GameRegistry: GAME_REGISTRY_ABI,
  WeeklyJackpot: WEEKLY_JACKPOT_ABI,
  TestChikunToken: ERC20_READ_ABI,
});

// topic0 values from contract §8.2-§8.5.
export const EVENT_TOPICS = Object.freeze({
  ScoreSubmitted: '0x73ec57c5e363c24b83733fedeed6265c15e32920f276b11eec2f92ef9a673bdf',
  SessionSubmitted: '0xc558944acf0a60aaa447720c7d7854875dd95d6576e6f10d3a582b1553ca4ca5',
  RankedSessionOpened: '0x14f46b8cebfe91f0708e999826c93785fc98cc35cb8c7c5a53ecbf99aaaf1207',
  ProfileCreated: '0x4e7a7e66fe87642c23aa0ec0360ed3051eaf7f243bfa32bf99e390acf608fb4c',
  ProfileUpdated: '0x6eb3a1c6a4675ba92d44e090515b1ceea358f26565d2854df0c99c3f5eaf9850',
  AchievementUnlocked: '0xa63e9940f858e00a63db1b55555c7b25e93c8fd9a85e1e9e21fd0fff4a2dc22e',
  // WeeklyJackpot (design §A.13).
  Funded: '0x54cacafc8154c26de7f33014871da50423ed270016a3b9b6cd2e42cdb9b84bbd',
  RolledOver: '0x6c471aabdf55d967328390ef9335ca9d37cd75ed43c7b04f857a25cdf98c1369',
  CapExcessCarried: '0x7dc0c8a923dbef7aa74748626a8a4723e2a2c50324b30802485117751b24c764',
  CandidateSubmitted: '0x85b9c74b4c30b8855115d006d7965647a8eb44378db859bd89512d6783bac002',
  CandidateRemoved: '0xdd5401346dfe25a173e5d07e139492e858c762314fcdcc5c3129dca9c5586f71',
  CandidateSkipped: '0xc5492b5ce0982306aa7a2da4bf6df08f5cab29454568d638bc3af5c3f0f02119',
  LeaderChanged: '0xcac6fdb3e8b34db5e6d0eb0cb294551ad751acba83983b505c4f1db2217668f7',
  Cleared: '0xfdd164e2e83e579758158f59a5e3253399f4de3e8e5a154f5dc03bbd5d442c39',
  Flagged: '0xfb67cf9d1fdc337bc581cfb83b90dcdcd0e3508c45cc8191ad3a1638e5d48d54',
  Disqualified: '0xafd779c84126e3aac3f3ce0c0928702108e6e59b436c8464578204e5d9d05823',
  Reinstated: '0x64e6c55db3fe5ec454bd7d6cf85b9733569e9675bf060250d23dc3ec46cf0a1a',
  WalletBlocked: '0x47a16a713765d6bdb13e1a722009ed789aab6625550a10ad2a2970edcddcabbc',
  WeekHeld: '0xfecccd9f06842c7a24ae46d47a21b86dbe3ccb1725b67994ea2b60ff87cbfd0d',
  WeekReleased: '0x95a70528d2815184fe7814da0299aaf5b3e7e1bf9a1cfda256ecf9cef908d83d',
  WeekExtended: '0x23ff9551ce72f6db2c1875063dfb9976ae8bf71e20d23bbbcb44ca6a38b7ed2f',
  Finalized: '0x3179fbc6e5c540c657be1bed4aad6f75424d4c74ba43a17495d47a3867ea61bc',
  PrizeTransferFailed: '0x263dee3f6f97f5b8e22efa4b6ebff0f1646f7e8c58f4c260d16caf3a06ef168e',
  PrizeClaimed: '0x19d042f4e88a4348a08de859d901426aa0d55e6bcdf6f0a3d05ce9d657ebe697',
  UnclaimedRecycled: '0x359e16cb5cee76816378cb6b9367696fee3fdb9d9ebd6d40cf2a88bec0d9a796',
  RulesScheduled: '0xa5f7831241407d322beeabc1106b996abf4625e1a2cb8cee0d075f08c364098d',
  KeeperUpdated: '0x0425bcd291db1d48816f2a98edc7ecaf6dd5c64b973d9e4b3b6b750763dc6c2e',
  AdminTransferred: '0xf8ccb027dfcd135e000e9d45e6cc2d662578a8825d4c45b5e32e0adf67e79ec6',
  OperatorTransferred: '0x74da04524d50c64947f5dd5381ef1a4dca5cba8ed1d816243f9e48aa0b5617ed',
  Paused: '0xe8699cf681560fd07de85543bd994263f4557bdc5179dd702f256d15fd083e1d',
  Unpaused: '0xcb4bb8bb1e41fbe4c7bffd024efe036fbb4b06b5d5bd06e2ec6a563735fcfeab',
  EndScheduled: '0x5b8f6552491526134b487c3ca9078fcffc18cfdccf4acb6c2959e198ce36a5cf',
  EndCancelled: '0x39a839de5d784146c2de6d985f307338b3215d15bd4624914a4dba46deb4634b',
  RefundedAfterEnd: '0x4f4fe31e73180a136e928d6c69d15c4a365dd27b2d37de0367020911b6f16251',
});
