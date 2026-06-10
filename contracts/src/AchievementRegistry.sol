// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AchievementRegistry
/// @author Lester's Arcade Core
/// @notice Parent-defined milestone tracking across all cabinets. Each
///         achievement has a unique id, a title, a category, and a minted
///         NFT (soulbound or transferable per game preference). Players
///         unlock achievements through cross-game play; cabinets submit the
///         unlock via submitGameRun() adapter normalization.
/// @dev    Achievement NFTs are ERC-721-ish (simplified for LitVM deployment).
contract AchievementRegistry {
    struct Achievement {
        bytes32 id;
        string title;
        string description;
        string category;        // "combat", "exploration", "social", "economy"
        uint256 unlockedAt;
        bool exists;
    }

    mapping(bytes32 => Achievement) public achievements;      // id => Achievement definition
    mapping(address => mapping(bytes32 => uint256)) public unlockedAt; // wallet => achievementId => block.timestamp
    bytes32[] public achievementIds;
    address public sessionLedger;  // authorized submitter

    event AchievementDefined(bytes32 indexed id, string title, string category);
    event AchievementUnlocked(address indexed wallet, bytes32 indexed achievementId, uint256 when);

    modifier onlyLedger() {
        require(msg.sender == sessionLedger, "Only SessionLedger");
        _;
    }

    constructor(address _sessionLedger) {
        sessionLedger = _sessionLedger;
    }

    /// @notice Define a new achievement. Operator call via SessionLedger adapter.
    function defineAchievement(
        bytes32 id,
        string calldata title,
        string calldata description,
        string calldata category
    ) external onlyLedger {
        require(!achievements[id].exists, "Already defined");
        achievements[id] = Achievement({
            id: id,
            title: title,
            description: description,
            category: category,
            unlockedAt: 0,
            exists: true
        });
        achievementIds.push(id);
        emit AchievementDefined(id, title, category);
    }

    /// @notice Mark an achievement unlocked for a wallet. Idempotent — can be
    ///         called multiple times but only the first unlock is recorded.
    function unlockFor(address wallet, bytes32 achievementId) external onlyLedger {
        require(achievements[achievementId].exists, "Unknown achievement");
        if (unlockedAt[wallet][achievementId] == 0) {
            unlockedAt[wallet][achievementId] = block.timestamp;
            emit AchievementUnlocked(wallet, achievementId, block.timestamp);
        }
    }

    /// @notice Check if a wallet has unlocked a given achievement.
    function hasUnlocked(address wallet, bytes32 achievementId) external view returns (bool) {
        return unlockedAt[wallet][achievementId] != 0;
    }

    /// @notice Total defined achievements (for UI progress display).
    function achievementCount() external view returns (uint256) {
        return achievementIds.length;
    }
}
