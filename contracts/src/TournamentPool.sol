// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title TournamentPool
/// @notice Tournament records and prize-pool accounting shell for Lester's Arcade.
contract TournamentPool {
    struct Tournament {
        bytes32 tournamentId;
        bytes32 gameId;
        string title;
        uint256 startsAt;
        uint256 endsAt;
        uint256 prizePool;
        bool exists;
    }

    address public owner;
    mapping(bytes32 => Tournament) public tournaments;

    event TournamentCreated(bytes32 indexed tournamentId, bytes32 indexed gameId, string title, uint256 startsAt, uint256 endsAt);
    event TournamentFunded(bytes32 indexed tournamentId, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "ONLY_OWNER");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function createTournament(
        bytes32 tournamentId,
        bytes32 gameId,
        string calldata title,
        uint256 startsAt,
        uint256 endsAt
    ) external onlyOwner {
        require(tournamentId != bytes32(0), "EMPTY_TOURNAMENT_ID");
        require(gameId != bytes32(0), "EMPTY_GAME_ID");
        require(!tournaments[tournamentId].exists, "TOURNAMENT_EXISTS");
        require(endsAt > startsAt, "BAD_WINDOW");

        tournaments[tournamentId] = Tournament({
            tournamentId: tournamentId,
            gameId: gameId,
            title: title,
            startsAt: startsAt,
            endsAt: endsAt,
            prizePool: 0,
            exists: true
        });

        emit TournamentCreated(tournamentId, gameId, title, startsAt, endsAt);
    }

    function fundTournament(bytes32 tournamentId) external payable {
        require(tournaments[tournamentId].exists, "TOURNAMENT_MISSING");
        require(msg.value > 0, "EMPTY_VALUE");

        tournaments[tournamentId].prizePool += msg.value;
        emit TournamentFunded(tournamentId, msg.value);
    }
}
