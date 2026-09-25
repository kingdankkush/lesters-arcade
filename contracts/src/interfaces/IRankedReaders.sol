// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IRankedScoreReader
/// @notice Read surface of the deployed ScoreSubmissionRegistry (1.8.x) consumed by WeeklyJackpot.
/// @dev ScoreRecord repeats the deployed struct field order exactly (ScoreSubmissionRegistry.sol:48-62),
///      because getSession's return value is ABI-decoded against it. Never reorder these fields.
interface IRankedScoreReader {
    struct ScoreRecord {
        bytes32 sessionId;
        address player;
        bytes32 gameId;
        uint256 score;
        uint64 kills;
        uint64 maxCombo;
        uint64 survivalSeconds;
        bytes32 bossId;
        bytes32 runtimeId;
        bytes32 seasonId;
        uint64 submittedAt;
        bool verified;
        bool exists;
    }

    function getSession(bytes32 sessionId) external view returns (ScoreRecord memory);
}

/// @title IRankedEntryReader
/// @notice Read surface of the deployed ArcadeRankedEntry (1.8.x) consumed by WeeklyJackpot.
/// @dev PaidSession repeats the deployed struct field order exactly (ArcadeRankedEntry.sol:20-26).
interface IRankedEntryReader {
    struct PaidSession {
        address player;
        bytes32 gameId;
        uint256 amountWei;
        uint64 openedAt;
        bool exists;
    }

    function getPaidSession(bytes32 sessionId) external view returns (PaidSession memory);
}
