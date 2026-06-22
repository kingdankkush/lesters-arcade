// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ScoreSubmissionRegistry
/// @notice Permissionless, player-signed ranked-run ledger for Lester's Arcade
///         on LitVM LiteForge. Each player submits their OWN completed ranked
///         session in a SINGLE transaction (one wallet confirmation) and pays
///         the zkLTC gas. The full run — score, kills, max combo, survival
///         time, boss kill, and unlocked achievements — is stored on-chain and
///         emitted as an event so the global leaderboard and per-player profile
///         history can be read back directly (storage) or via logs (events).
/// @dev    Static-site friendly: there is no trusted backend. Anti-cheat is a
///         later layer (EIP-712 adapter signature); for the testnet MVP any
///         connected wallet can record its own run against msg.sender.
contract ScoreSubmissionRegistry {
    struct ScoreRecord {
        bytes32 sessionId;
        address player;
        bytes32 gameId;
        uint256 score;
        uint64 kills;
        uint64 maxCombo;
        uint64 survivalSeconds;
        bytes32 bossId;       // 0x0 if no boss defeated
        uint64 submittedAt;   // block.timestamp
        bool exists;
    }

    // sessionId => full record
    mapping(bytes32 => ScoreRecord) public scoresBySession;
    // player => list of their session ids (profile history)
    mapping(address => bytes32[]) private _playerSessions;
    // player => achievements unlocked in a given session (parallel to events)
    mapping(bytes32 => bytes32[]) private _sessionAchievements;
    // global ordered list of every session id (global leaderboard source)
    bytes32[] private _allSessions;

    event ScoreSubmitted(
        bytes32 indexed sessionId,
        address indexed player,
        bytes32 indexed gameId,
        uint256 score,
        uint64 kills,
        uint64 maxCombo,
        uint64 survivalSeconds,
        bytes32 bossId
    );
    event AchievementUnlocked(
        address indexed player,
        bytes32 indexed achievementId,
        bytes32 indexed sessionId
    );

    /// @notice Record a completed ranked run for msg.sender. One call, one fee.
    /// @param sessionId      Unique id for this run (game-session-NNNNNNNNN hash).
    /// @param gameId         keccak/bytes32 id of the cabinet (e.g. hard-money-heroes).
    /// @param score          Final score.
    /// @param kills          Total kills.
    /// @param maxCombo       Highest combo reached.
    /// @param survivalSeconds Elapsed survival time in seconds.
    /// @param bossId         Defeated boss id, or bytes32(0) if none.
    /// @param achievements   Achievement ids unlocked this run (may be empty).
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
        require(sessionId != bytes32(0), "EMPTY_SESSION_ID");
        require(gameId != bytes32(0), "EMPTY_GAME_ID");
        require(!scoresBySession[sessionId].exists, "SESSION_EXISTS");

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
            exists: true
        });

        _playerSessions[msg.sender].push(sessionId);
        _allSessions.push(sessionId);

        emit ScoreSubmitted(
            sessionId,
            msg.sender,
            gameId,
            score,
            kills,
            maxCombo,
            survivalSeconds,
            bossId
        );

        uint256 len = achievements.length;
        for (uint256 i = 0; i < len; i++) {
            bytes32 achievementId = achievements[i];
            if (achievementId == bytes32(0)) continue;
            _sessionAchievements[sessionId].push(achievementId);
            emit AchievementUnlocked(msg.sender, achievementId, sessionId);
        }
    }

    // ----------------------- gas-free read paths -----------------------------

    function getSession(bytes32 sessionId) external view returns (ScoreRecord memory) {
        return scoresBySession[sessionId];
    }

    function getSessionAchievements(bytes32 sessionId) external view returns (bytes32[] memory) {
        return _sessionAchievements[sessionId];
    }

    function playerSessionCount(address player) external view returns (uint256) {
        return _playerSessions[player].length;
    }

    /// @notice Paginated player history (newest-last). Use offset/limit to page.
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

    /// @notice Paginated global feed (submission order). The client sorts by
    ///         score to build the global leaderboard. Bounded by limit so a
    ///         single read never runs out of gas as the ledger grows.
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
