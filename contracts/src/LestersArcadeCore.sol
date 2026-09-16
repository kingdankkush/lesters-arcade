// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title LestersArcadeCore
/// @notice Immutable address book for one deployed Lester's Arcade contract set (2026-09 native-fee design).
/// @dev    Not part of the hardened deployment; the deploy script records addresses in
///         contracts/deployment-record.hardened.json instead. Kept as an optional on-chain
///         composition record that a front end can read a whole suite from with one call.
contract LestersArcadeCore {
    address public immutable playerProfiles;
    address public immutable gameRegistry;
    address public immutable rankedEntry;
    address public immutable scoreSubmissions;
    address public immutable achievements;

    event ArcadeCoreDeployed(
        address playerProfiles,
        address gameRegistry,
        address rankedEntry,
        address scoreSubmissions,
        address achievements
    );

    constructor(
        address _playerProfiles,
        address _gameRegistry,
        address _rankedEntry,
        address _scoreSubmissions,
        address _achievements
    ) {
        require(_playerProfiles != address(0), "Invalid profiles");
        require(_gameRegistry != address(0), "Invalid registry");
        require(_rankedEntry != address(0), "Invalid ranked entry");
        require(_scoreSubmissions != address(0), "Invalid scores");
        require(_achievements != address(0), "Invalid achievements");
        playerProfiles = _playerProfiles;
        gameRegistry = _gameRegistry;
        rankedEntry = _rankedEntry;
        scoreSubmissions = _scoreSubmissions;
        achievements = _achievements;
        emit ArcadeCoreDeployed(_playerProfiles, _gameRegistry, _rankedEntry, _scoreSubmissions, _achievements);
    }

    function addresses()
        external
        view
        returns (address profiles, address registry, address entry, address scores, address achievementRegistry)
    {
        return (playerProfiles, gameRegistry, rankedEntry, scoreSubmissions, achievements);
    }
}
