// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AchievementRegistry
/// @notice Defines and unlocks Lester's Arcade achievements.
contract AchievementRegistry {
    struct Achievement {
        bytes32 achievementId;
        string title;
        string metadataURI;
        bool exists;
    }

    address public owner;
    address public trustedVerifier;
    mapping(bytes32 => Achievement) public achievements;
    mapping(address => mapping(bytes32 => bool)) public unlocked;

    event AchievementDefined(bytes32 indexed achievementId, string title, string metadataURI);
    event AchievementUnlocked(address indexed player, bytes32 indexed achievementId, bytes32 indexed gameId);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    modifier onlyTrustedVerifier() {
        require(msg.sender == trustedVerifier, "ONLY_VERIFIER");
        _;
    }

    constructor(address initialVerifier) {
        owner = msg.sender;
        trustedVerifier = initialVerifier;
    }

    function defineAchievement(bytes32 achievementId, string calldata title, string calldata metadataURI) external onlyOwner {
        require(achievementId != bytes32(0), "EMPTY_ACHIEVEMENT_ID");
        require(!achievements[achievementId].exists, "ACHIEVEMENT_EXISTS");

        achievements[achievementId] = Achievement({
            achievementId: achievementId,
            title: title,
            metadataURI: metadataURI,
            exists: true
        });

        emit AchievementDefined(achievementId, title, metadataURI);
    }

    function unlockAchievement(address player, bytes32 achievementId, bytes32 gameId) external onlyTrustedVerifier {
        require(player != address(0), "EMPTY_PLAYER");
        require(achievements[achievementId].exists, "ACHIEVEMENT_MISSING");

        if (!unlocked[player][achievementId]) {
            unlocked[player][achievementId] = true;
            emit AchievementUnlocked(player, achievementId, gameId);
        }
    }
}
