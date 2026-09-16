// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAchievementMinter
/// @notice Mint surface of AchievementRegistry consumed by ScoreSubmissionRegistry.
interface IAchievementMinter {
    /// @notice Mint the soulbound achievement token for `player` if not already held.
    /// @return minted false (without reverting) when the achievement is undefined or already held.
    function mintFor(address player, bytes32 achievementId, bytes32 sessionId) external returns (bool minted);
}
