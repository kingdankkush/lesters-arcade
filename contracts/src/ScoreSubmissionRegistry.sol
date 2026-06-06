// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ScoreSubmissionRegistry
/// @notice Official score records for paid Lester's Arcade sessions.
contract ScoreSubmissionRegistry {
    struct ScoreRecord {
        bytes32 sessionId;
        address player;
        bytes32 gameId;
        uint256 score;
        uint256 submittedAt;
        bool exists;
    }

    address public owner;
    address public trustedVerifier;
    mapping(bytes32 => ScoreRecord) public scoresBySession;

    event TrustedVerifierUpdated(address indexed trustedVerifier);
    event ScoreSubmitted(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 score);

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
        emit TrustedVerifierUpdated(initialVerifier);
    }

    function setTrustedVerifier(address verifier) external onlyOwner {
        trustedVerifier = verifier;
        emit TrustedVerifierUpdated(verifier);
    }

    function submitScore(bytes32 sessionId, address player, bytes32 gameId, uint256 score) external onlyTrustedVerifier {
        require(sessionId != bytes32(0), "EMPTY_SESSION_ID");
        require(player != address(0), "EMPTY_PLAYER");
        require(gameId != bytes32(0), "EMPTY_GAME_ID");
        require(!scoresBySession[sessionId].exists, "SCORE_EXISTS");

        scoresBySession[sessionId] = ScoreRecord({
            sessionId: sessionId,
            player: player,
            gameId: gameId,
            score: score,
            submittedAt: block.timestamp,
            exists: true
        });

        emit ScoreSubmitted(sessionId, player, gameId, score);
    }
}
