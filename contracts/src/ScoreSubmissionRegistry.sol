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

    address public immutable gameRegistry;

    mapping(bytes32 => ScoreRecord) public scoresBySession;
    mapping(address => bytes32[]) private _playerSessions;
    mapping(bytes32 => bytes32[]) private _sessionAchievements;
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

    constructor(address _gameRegistry) {
        require(_gameRegistry != address(0), "Invalid registry");
        gameRegistry = _gameRegistry;
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
