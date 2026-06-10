// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PlayerProfileRegistry
/// @author Lester's Arcade Core
/// @notice Wallet-indexed parent account for every cabinet in Lester's Arcade.
///         One wallet -> one profile. Profiles are the locked identity for
///         scores, achievements, avatars, and LitVM settlement receipts.
/// @dev Deployed on LitVM once the chain is live. Gas-paid by the parent
///      arcade operator (SETTLEMENT_RESERVE).
contract PlayerProfileRegistry {
    struct Profile {
        bytes32 handle;       // keccak256 of display name (on-chain, gas-light)
        string displayName;   // off-chain-readable display name
        string avatarUri;     // IPFS / Arweave URI for avatar asset
        uint256 createdAt;    // block.timestamp of first registration
        uint256 lastUpdated;  // block.timestamp of last mutation
        bool exists;
    }

    mapping(address => Profile) public profiles;
    mapping(bytes32 => address) public handleOwners; // handle collision resolution

    event ProfileCreated(address indexed wallet, bytes32 indexed handle, string displayName);
    event ProfileUpdated(address indexed wallet, string displayName, string avatarUri);
    event HandleReserved(address indexed wallet, bytes32 indexed handle);

    /// @notice Register a new profile for msg.sender. Fails if wallet already registered.
    function registerProfile(string calldata displayName, string calldata avatarUri) external {
        require(!profiles[msg.sender].exists, "Already registered");
        bytes32 handle = keccak256(abi.encodePacked(displayName));
        require(handleOwners[handle] == address(0), "Handle taken");

        profiles[msg.sender] = Profile({
            handle: handle,
            displayName: displayName,
            avatarUri: avatarUri,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            exists: true
        });
        handleOwners[handle] = msg.sender;

        emit ProfileCreated(msg.sender, handle, displayName);
        emit HandleReserved(msg.sender, handle);
    }

    /// @notice Update display name and avatar. Fails if handle collides with
    ///         another wallet's active registration.
    function updateProfile(string calldata displayName, string calldata avatarUri) external {
        require(profiles[msg.sender].exists, "Not registered");
        bytes32 handle = keccak256(abi.encodePacked(displayName));
        if (handleOwners[handle] != address(0) && handleOwners[handle] != msg.sender) {
            revert("Handle taken");
        }
        bytes32 oldHandle = profiles[msg.sender].handle;
        if (oldHandle != handle) {
            delete handleOwners[oldHandle];
            handleOwners[handle] = msg.sender;
        }
        profiles[msg.sender].handle = handle;
        profiles[msg.sender].displayName = displayName;
        profiles[msg.sender].avatarUri = avatarUri;
        profiles[msg.sender].lastUpdated = block.timestamp;
        emit ProfileUpdated(msg.sender, displayName, avatarUri);
    }

    /// @notice Gas-free read path.
    function getProfile(address wallet) external view returns (Profile memory) {
        return profiles[wallet];
    }
}
