// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IScoreGameRegistry {
    struct Game {
        bytes32 gameId;
        string title;
        address devWallet;
        uint16 devBps;
        uint16 platformBps;
        uint16 liquidityBps;
        uint16 treasuryBps;
        uint256 entryFeeMicroUsdc;
        bool devWalletConfirmed;
        bool playable;
        bool exists;
        uint256 registeredAt;
    }

    function getGame(bytes32 gameId) external view returns (Game memory);
}

/// @title ScoreSubmissionRegistry
/// @notice Permissionless, player-signed ranked-run ledger for Lester's Arcade on LitVM LiteForge.
contract ScoreSubmissionRegistry {
    uint256 public constant MAX_SCORE = 10_000_000_000;
    uint64 public constant MAX_KILLS = 100_000;
    uint64 public constant MAX_COMBO = 10_000;
    uint64 public constant MAX_SURVIVAL_SECONDS = 24 hours;
    uint256 public constant MAX_ACHIEVEMENTS_PER_SESSION = 32;
    uint256 private constant SECP256K1_HALF_ORDER = 0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0;

    struct ScoreRecord {
        bytes32 sessionId;
        address player;
        bytes32 gameId;
        uint256 score;
        uint64 kills;
        uint64 maxCombo;
        uint64 survivalSeconds;
        bytes32 bossId;
        uint64 submittedAt;
        bool verified;
        bool exists;
    }

    struct VerifiedRun {
        bytes32 sessionId;
        bytes32 gameId;
        uint256 score;
        uint64 kills;
        uint64 maxCombo;
        uint64 survivalSeconds;
        bytes32 bossId;
        bytes32 envelopeHash;
        uint64 deadline;
    }

    address public immutable gameRegistry;
    address public immutable trustedVerifier;

    mapping(bytes32 => ScoreRecord) public scoresBySession;
    mapping(address => bytes32[]) private _playerSessions;
    mapping(bytes32 => bytes32[]) private _sessionAchievements;
    mapping(bytes32 => bytes32) public sessionEnvelopeHash;
    bytes32[] private _allSessions;

    event ScoreSubmitted(
        bytes32 indexed sessionId,
        address indexed player,
        bytes32 indexed gameId,
        uint256 score,
        uint64 kills,
        uint64 maxCombo,
        uint64 survivalSeconds,
        bytes32 bossId,
        bool verified
    );
    event SessionSubmitted(bytes32 indexed sessionId, bool verified);
    event AchievementUnlocked(address indexed player, bytes32 indexed achievementId, bytes32 indexed sessionId);

    constructor(address _gameRegistry, address _trustedVerifier) {
        require(_gameRegistry != address(0), "Invalid registry");
        require(_trustedVerifier != address(0), "Invalid verifier");
        gameRegistry = _gameRegistry;
        trustedVerifier = _trustedVerifier;
    }

    function attestationDigest(VerifiedRun calldata run, address player, bytes32 achievementsHash)
        public view returns (bytes32)
    {
        bytes32 runHash = keccak256(abi.encode(run));
        bytes32 payload = keccak256(abi.encode(address(this), block.chainid, player, achievementsHash, runHash));
        return keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", payload));
    }

    function submitVerifiedSession(
        VerifiedRun calldata run,
        bytes32[] calldata achievements,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(block.timestamp <= run.deadline, "ATTESTATION_EXPIRED");
        require(run.envelopeHash != bytes32(0), "EMPTY_ENVELOPE_HASH");
        bytes32 digest = attestationDigest(run, msg.sender, keccak256(abi.encode(achievements)));
        require(_recover(digest, v, r, s) == trustedVerifier, "INVALID_ATTESTATION");
        sessionEnvelopeHash[run.sessionId] = run.envelopeHash;
        _submitSession(
            run.sessionId, run.gameId, run.score, run.kills, run.maxCombo,
            run.survivalSeconds, run.bossId, achievements, true
        );
    }

    function _recover(bytes32 digest, uint8 v, bytes32 r, bytes32 s) private pure returns (address) {
        require(v == 27 || v == 28, "INVALID_SIGNATURE_V");
        require(uint256(s) <= SECP256K1_HALF_ORDER, "INVALID_SIGNATURE_S");
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "INVALID_SIGNATURE");
        return signer;
    }

    function submitSession(
        bytes32 sessionId,
        bytes32 gameId,
        uint256 score,
        uint64 kills,
        uint64 maxCombo,
        uint64 survivalSeconds,
        bytes32 bossId,
        bytes32[] calldata achievements
    ) external {
        _submitSession(sessionId, gameId, score, kills, maxCombo, survivalSeconds, bossId, achievements, false);
    }

    function _submitSession(
        bytes32 sessionId,
        bytes32 gameId,
        uint256 score,
        uint64 kills,
        uint64 maxCombo,
        uint64 survivalSeconds,
        bytes32 bossId,
        bytes32[] calldata achievements,
        bool verified
    ) internal {
        require(sessionId != bytes32(0), "EMPTY_SESSION_ID");
        require(gameId != bytes32(0), "EMPTY_GAME_ID");
        require(!scoresBySession[sessionId].exists, "SESSION_EXISTS");
        IScoreGameRegistry.Game memory game = IScoreGameRegistry(gameRegistry).getGame(gameId);
        require(game.exists && game.playable, "GAME_NOT_PLAYABLE");
        require(score <= MAX_SCORE, "SCORE_OUT_OF_BOUNDS");
        require(kills <= MAX_KILLS, "KILLS_OUT_OF_BOUNDS");
        require(maxCombo <= MAX_COMBO, "COMBO_OUT_OF_BOUNDS");
        require(survivalSeconds <= MAX_SURVIVAL_SECONDS, "SURVIVAL_OUT_OF_BOUNDS");
        require(achievements.length <= MAX_ACHIEVEMENTS_PER_SESSION, "TOO_MANY_ACHIEVEMENTS");

        scoresBySession[sessionId] = ScoreRecord({
            sessionId: sessionId,
            player: msg.sender,
            gameId: gameId,
            score: score,
            kills: kills,
            maxCombo: maxCombo,
            survivalSeconds: survivalSeconds,
            bossId: bossId,
            submittedAt: uint64(block.timestamp),
            verified: verified,
            exists: true
        });

        _playerSessions[msg.sender].push(sessionId);
        _allSessions.push(sessionId);

        emit ScoreSubmitted(sessionId, msg.sender, gameId, score, kills, maxCombo, survivalSeconds, bossId, verified);
        emit SessionSubmitted(sessionId, verified);

        uint256 len = achievements.length;
        for (uint256 i = 0; i < len; i++) {
            bytes32 achievementId = achievements[i];
            if (achievementId == bytes32(0)) continue;
            _sessionAchievements[sessionId].push(achievementId);
            emit AchievementUnlocked(msg.sender, achievementId, sessionId);
        }
    }

    function getSession(bytes32 sessionId) external view returns (ScoreRecord memory) {
        return scoresBySession[sessionId];
    }

    function getSessionAchievements(bytes32 sessionId) external view returns (bytes32[] memory) {
        return _sessionAchievements[sessionId];
    }

    function playerSessionCount(address player) external view returns (uint256) {
        return _playerSessions[player].length;
    }

    function getPlayerSessions(address player, uint256 offset, uint256 limit)
        external
        view
        returns (ScoreRecord[] memory page)
    {
        bytes32[] storage ids = _playerSessions[player];
        uint256 total = ids.length;
        if (offset >= total) return new ScoreRecord[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new ScoreRecord[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = scoresBySession[ids[i]];
        }
    }

    function totalSessions() external view returns (uint256) {
        return _allSessions.length;
    }

    function getRecentSessions(uint256 offset, uint256 limit)
        external
        view
        returns (ScoreRecord[] memory page)
    {
        uint256 total = _allSessions.length;
        if (offset >= total) return new ScoreRecord[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new ScoreRecord[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = scoresBySession[_allSessions[i]];
        }
    }
}
