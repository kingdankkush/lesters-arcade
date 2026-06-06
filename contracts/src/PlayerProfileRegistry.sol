// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PlayerProfileRegistry
/// @notice Wallet-based identity shell for Lester's Arcade players.
contract PlayerProfileRegistry {
    struct PlayerProfile {
        string handle;
        string metadataURI;
        uint256 createdAt;
        bool exists;
    }

    mapping(address => PlayerProfile) public profiles;

    event ProfileCreated(address indexed player, string handle, string metadataURI);
    event ProfileUpdated(address indexed player, string handle, string metadataURI);

    function createProfile(string calldata handle, string calldata metadataURI) external {
        require(!profiles[msg.sender].exists, "PROFILE_EXISTS");
        require(bytes(handle).length > 0, "EMPTY_HANDLE");

        profiles[msg.sender] = PlayerProfile({
            handle: handle,
            metadataURI: metadataURI,
            createdAt: block.timestamp,
            exists: true
        });

        emit ProfileCreated(msg.sender, handle, metadataURI);
    }

    function updateProfile(string calldata handle, string calldata metadataURI) external {
        require(profiles[msg.sender].exists, "PROFILE_MISSING");
        require(bytes(handle).length > 0, "EMPTY_HANDLE");

        profiles[msg.sender].handle = handle;
        profiles[msg.sender].metadataURI = metadataURI;

        emit ProfileUpdated(msg.sender, handle, metadataURI);
    }
}
