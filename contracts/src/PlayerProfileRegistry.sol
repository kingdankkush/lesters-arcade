// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title PlayerProfileRegistry
/// @author Lester's Arcade Core
/// @notice Wallet-indexed parent account for every cabinet in Lester's Arcade.
///         One wallet -> one profile. Profiles are the locked identity for
///         scores, achievements, avatars, and LitVM settlement receipts.
/// @dev    Player-signed: every write is keyed to msg.sender, so a player owns
///         and pays for their own profile. No trusted operator required, which
///         is what a static-site (no backend) deployment needs.
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
        _writeProfile(displayName, avatarUri);
    }

    /// @notice Update display name and avatar. Fails if not yet registered.
    function updateProfile(string calldata displayName, string calldata avatarUri) external {
        require(profiles[msg.sender].exists, "Not registered");
        _writeProfile(displayName, avatarUri);
    }

    /// @notice Idempotent create-or-update. The runtime calls this so a player's
    ///         first ranked run can settle a profile in the same flow without a
    ///         separate registration step. Reverts only on handle collision.
    function setProfile(string calldata displayName, string calldata avatarUri) external {
        _writeProfile(displayName, avatarUri);
    }

    function _writeProfile(string calldata displayName, string calldata avatarUri) private {
        bytes32 handle = _normalizedHandle(displayName);
        if (handleOwners[handle] != address(0) && handleOwners[handle] != msg.sender) {
            revert("Handle taken");
        }

        bool firstTime = !profiles[msg.sender].exists;
        if (firstTime) {
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
            return;
        }

        bytes32 oldHandle = profiles[msg.sender].handle;
        if (oldHandle != handle) {
            delete handleOwners[oldHandle];
            handleOwners[handle] = msg.sender;
            emit HandleReserved(msg.sender, handle);
        }
        profiles[msg.sender].handle = handle;
        profiles[msg.sender].displayName = displayName;
        profiles[msg.sender].avatarUri = avatarUri;
        profiles[msg.sender].lastUpdated = block.timestamp;
        emit ProfileUpdated(msg.sender, displayName, avatarUri);
    }

    function _normalizedHandle(string calldata displayName) private pure returns (bytes32) {
        bytes memory raw = bytes(displayName);
        uint256 start = 0;
        while (start < raw.length && raw[start] == 0x20) start++;

        uint256 end = raw.length;
        while (end > start && raw[end - 1] == 0x20) end--;

        bytes memory normalized = new bytes(end - start);
        uint256 length = 0;
        bool lastWasSpace = false;
        for (uint256 i = start; i < end; i++) {
            bytes1 ch = raw[i];
            if (ch >= 0x41 && ch <= 0x5A) {
                ch = bytes1(uint8(ch) + 32);
            }

            bool valid = (ch >= 0x61 && ch <= 0x7A)
                || (ch >= 0x30 && ch <= 0x39)
                || ch == 0x20
                || ch == 0x5f
                || ch == 0x2d
                || ch == 0x2e;
            require(valid, "Invalid handle char");

            if (ch == 0x20) {
                if (lastWasSpace) continue;
                lastWasSpace = true;
            } else {
                lastWasSpace = false;
            }

            normalized[length++] = ch;
        }

        require(length >= 3, "Handle too short");
        require(length <= 18, "Handle too long");

        bytes memory compact = new bytes(length);
        for (uint256 i = 0; i < length; i++) compact[i] = normalized[i];
        return keccak256(compact);
    }

    /// @notice Gas-free read path.
    function getProfile(address wallet) external view returns (Profile memory) {
        return profiles[wallet];
    }
}
