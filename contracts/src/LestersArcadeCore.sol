// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PlayerProfileRegistry} from "./PlayerProfileRegistry.sol";
import {GameRegistry} from "./GameRegistry.sol";
import {ArcadePaymentRouter} from "./ArcadePaymentRouter.sol";
import {ScoreSubmissionRegistry} from "./ScoreSubmissionRegistry.sol";
import {AchievementRegistry} from "./AchievementRegistry.sol";
import {TournamentPool} from "./TournamentPool.sol";

/// @title LestersArcadeCore
/// @notice Convenience composition wrapper for the Lester's Arcade MVP contract modules.
contract LestersArcadeCore {
    PlayerProfileRegistry public immutable playerProfiles;
    GameRegistry public immutable gameRegistry;
    ArcadePaymentRouter public immutable paymentRouter;
    ScoreSubmissionRegistry public immutable scoreSubmissions;
    AchievementRegistry public immutable achievements;
    TournamentPool public immutable tournaments;

    event ArcadeCoreDeployed(
        address playerProfiles,
        address gameRegistry,
        address paymentRouter,
        address scoreSubmissions,
        address achievements,
        address tournaments
    );

    constructor(address trustedVerifier) {
        playerProfiles = new PlayerProfileRegistry();
        gameRegistry = new GameRegistry(trustedVerifier);
        paymentRouter = new ArcadePaymentRouter(address(gameRegistry), trustedVerifier, trustedVerifier);
        scoreSubmissions = new ScoreSubmissionRegistry(address(gameRegistry), trustedVerifier);
        achievements = new AchievementRegistry(trustedVerifier);
        tournaments = new TournamentPool();

        emit ArcadeCoreDeployed(
            address(playerProfiles),
            address(gameRegistry),
            address(paymentRouter),
            address(scoreSubmissions),
            address(achievements),
            address(tournaments)
        );
    }
}
