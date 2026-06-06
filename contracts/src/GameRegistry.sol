// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GameRegistry
/// @notice Registry of official Lester's Arcade cabinets and developer economics.
contract GameRegistry {
    struct RevenueSplitBps {
        uint16 infrastructure;
        uint16 developer;
        uint16 tournament;
        uint16 community;
    }

    struct Game {
        bytes32 gameId;
        string title;
        string metadataURI;
        address developer;
        uint256 entryFee;
        bool active;
        bool exists;
    }

    address public owner;
    mapping(bytes32 => Game) public games;
    mapping(bytes32 => RevenueSplitBps) public revenueSplitBps;

    event GameRegistered(bytes32 indexed gameId, string title, address indexed developer, uint256 entryFee);
    event GameStatusChanged(bytes32 indexed gameId, bool active);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerGame(
        bytes32 gameId,
        string calldata title,
        string calldata metadataURI,
        address developer,
        uint256 entryFee,
        RevenueSplitBps calldata split
    ) external onlyOwner {
        require(gameId != bytes32(0), "EMPTY_GAME_ID");
        require(!games[gameId].exists, "GAME_EXISTS");
        require(developer != address(0), "EMPTY_DEVELOPER");
        require(_totalBps(split) == 10_000, "BAD_SPLIT");

        games[gameId] = Game({
            gameId: gameId,
            title: title,
            metadataURI: metadataURI,
            developer: developer,
            entryFee: entryFee,
            active: true,
            exists: true
        });
        revenueSplitBps[gameId] = split;

        emit GameRegistered(gameId, title, developer, entryFee);
    }

    function setGameStatus(bytes32 gameId, bool active) external onlyOwner {
        require(games[gameId].exists, "GAME_MISSING");
        games[gameId].active = active;
        emit GameStatusChanged(gameId, active);
    }

    function _totalBps(RevenueSplitBps calldata split) private pure returns (uint16) {
        return split.infrastructure + split.developer + split.tournament + split.community;
    }
}
