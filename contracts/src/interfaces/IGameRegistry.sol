// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IGameRegistry
/// @notice Read surface of GameRegistry consumed by ArcadeRankedEntry and ScoreSubmissionRegistry.
/// @dev The Game struct layout MUST match GameRegistry.Game exactly (ABI-decoded from getGame).
interface IGameRegistry {
    struct Game {
        bytes32 gameId;
        string title;
        address devWallet;
        uint16 devBps;
        uint16 platformBps;
        uint16 liquidityBps;
        uint16 treasuryBps;
        uint256 entryFeeWei;
        bool devWalletConfirmed;
        bool playable;
        bool exists;
        uint256 registeredAt;
    }

    function getGame(bytes32 gameId) external view returns (Game memory);
}
