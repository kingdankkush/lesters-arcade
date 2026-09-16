// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IArcadeRankedEntry
/// @notice Read surface of ArcadeRankedEntry consumed by ScoreSubmissionRegistry.
interface IArcadeRankedEntry {
    /// @return true when `sessionId` was opened by `player` for `gameId` with the required native entry fee.
    function isPaid(bytes32 sessionId, address player, bytes32 gameId) external view returns (bool);
}
