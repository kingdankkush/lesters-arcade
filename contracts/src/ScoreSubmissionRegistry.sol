// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IGameRegistry} from "./interfaces/IGameRegistry.sol";
import {IArcadeRankedEntry} from "./interfaces/IArcadeRankedEntry.sol";
import {IAchievementMinter} from "./interfaces/IAchievementMinter.sol";

/// @title ScoreSubmissionRegistry
/// @author Lester's Arcade Core
/// @notice Verified-only ranked-run ledger for Lester's Arcade on LitVM LiteForge. Every record is
///         backed by an EIP-712 attestation signed by the trusted verifier key; there is no
///         unverified submission path. Paid games require a matching ArcadeRankedEntry session, and
///         achievements attested in the run are minted as soulbound tokens during settlement through the
///         per-game AchievementRegistry (`achievementRegistryByGame[run.gameId]`, skipped when unset).
///         Settlement is callable by the player or by an operator-allowed relayer; the relayer path needs
///         nothing but the attestation (no msg.value, the function is non-payable).
/// @dev    EIP-712 domain: name "Lester's Arcade Ranked Settlement", version "2", chainId, this contract.
contract ScoreSubmissionRegistry is EIP712, ReentrancyGuard {
    uint256 public constant MAX_SCORE = 10_000_000_000;
    uint64 public constant MAX_KILLS = 100_000;
    uint64 public constant MAX_COMBO = 10_000;
    uint64 public constant MAX_SURVIVAL_SECONDS = 24 hours;
    uint256 public constant MAX_ACHIEVEMENTS_PER_SESSION = 32;

    bytes32 public constant VERIFIED_RUN_TYPEHASH = keccak256(
        "VerifiedRun(bytes32 sessionId,bytes32 gameId,address player,uint256 score,uint64 kills,uint64 maxCombo,uint64 survivalSeconds,bytes32 bossId,bytes32 envelopeHash,bytes32 runtimeId,bytes32 seasonId,uint64 deadline,bytes32 achievementsHash)"
    );

    struct VerifiedRun {
        bytes32 sessionId;
        bytes32 gameId;
        address player;
        uint256 score;
        uint64 kills;
        uint64 maxCombo;
        uint64 survivalSeconds;
        bytes32 bossId;
        bytes32 envelopeHash;
        bytes32 runtimeId;
        bytes32 seasonId;
        uint64 deadline;
        bytes32 achievementsHash;
    }

    struct ScoreRecord {
        bytes32 sessionId;
        address player;
        bytes32 gameId;
        uint256 score;
        uint64 kills;
        uint64 maxCombo;
        uint64 survivalSeconds;
        bytes32 bossId;
        bytes32 runtimeId;
        bytes32 seasonId;
        uint64 submittedAt;
        bool verified;
        bool exists;
    }

    address public immutable gameRegistry;
    address public rankedEntry;
    address public trustedVerifier;
    address public operator;
    address public pendingOperator;

    /// @notice Operator-allowed settlement relayers (may call submitVerifiedSession for any player).
    mapping(address => bool) public relayers;
    /// @notice One soulbound achievement collection per game; address(0) = no minting for that game.
    mapping(bytes32 => address) public achievementRegistryByGame;
    mapping(bytes32 => ScoreRecord) public scoresBySession;
    mapping(bytes32 => bytes32) public sessionEnvelopeHash;
    mapping(bytes32 => mapping(address => uint256)) public bestScore;
    mapping(bytes32 => mapping(bytes32 => mapping(address => uint256))) public bestSeasonScore;
    mapping(address => bytes32[]) private _playerSessions;
    mapping(bytes32 => bytes32[]) private _sessionAchievements;
    bytes32[] private _allSessions;

    event ScoreSubmitted(
        bytes32 indexed sessionId,
        address indexed player,
        bytes32 indexed gameId,
        uint256 score,
        uint64 kills,
        uint64 maxCombo,
        uint64 survivalSeconds,
        bytes32 bossId,
        bytes32 runtimeId,
        bytes32 seasonId
    );
    event SessionSubmitted(bytes32 indexed sessionId, bool verified);
    event TrustedVerifierUpdated(address indexed trustedVerifier);
    event RelayerUpdated(address indexed relayer, bool allowed);
    event RankedEntryUpdated(address indexed rankedEntry);
    event AchievementRegistryUpdated(bytes32 indexed gameId, address indexed achievementRegistry);
    event OperatorTransferStarted(address indexed currentOperator, address indexed pendingOperator);
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);

    modifier onlyOperator() {
        require(msg.sender == operator, "Only platform operator");
        _;
    }

    constructor(address _gameRegistry, address _rankedEntry, address _trustedVerifier, address _operator)
        EIP712("Lester's Arcade Ranked Settlement", "2")
    {
        require(_gameRegistry != address(0), "Invalid registry");
        require(_trustedVerifier != address(0), "Invalid verifier");
        require(_operator != address(0), "Invalid operator");
        gameRegistry = _gameRegistry;
        rankedEntry = _rankedEntry;
        trustedVerifier = _trustedVerifier;
        operator = _operator;
    }

    // ---------------------------------------------------------------------
    // Operator administration
    // ---------------------------------------------------------------------

    function setTrustedVerifier(address verifier) external onlyOperator {
        require(verifier != address(0), "Invalid verifier");
        trustedVerifier = verifier;
        emit TrustedVerifierUpdated(verifier);
    }

    function setRelayer(address relayer, bool allowed) external onlyOperator {
        require(relayer != address(0), "Invalid relayer");
        relayers[relayer] = allowed;
        emit RelayerUpdated(relayer, allowed);
    }

    /// @dev address(0) disables the paid-session check entirely (free ranked mode).
    function setRankedEntry(address _rankedEntry) external onlyOperator {
        rankedEntry = _rankedEntry;
        emit RankedEntryUpdated(_rankedEntry);
    }

    /// @notice Bind (or unbind with address(0)) the soulbound AchievementRegistry that mints for `gameId`.
    /// @dev Unset = achievements are recorded in the session but not minted (scores still settle).
    function setAchievementRegistry(bytes32 gameId, address _achievementRegistry) external onlyOperator {
        require(gameId != bytes32(0), "EMPTY_GAME_ID");
        achievementRegistryByGame[gameId] = _achievementRegistry;
        emit AchievementRegistryUpdated(gameId, _achievementRegistry);
    }

    function transferOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "Invalid operator");
        pendingOperator = newOperator;
        emit OperatorTransferStarted(operator, newOperator);
    }

    function acceptOperator() external {
        require(msg.sender == pendingOperator, "Only pending operator");
        address previous = operator;
        operator = pendingOperator;
        pendingOperator = address(0);
        emit OperatorTransferred(previous, operator);
    }

    // ---------------------------------------------------------------------
    // Attestation
    // ---------------------------------------------------------------------

    /// @notice EIP-712 digest the trusted verifier signs for `run`.
    function attestationDigest(VerifiedRun calldata run) public view returns (bytes32) {
        // abi.encode of static-typed words is plain concatenation, so splitting the encode in two
        // keeps the compiler off "stack too deep" while producing the canonical EIP-712 struct hash.
        bytes memory head = abi.encode(
            VERIFIED_RUN_TYPEHASH,
            run.sessionId,
            run.gameId,
            run.player,
            run.score,
            run.kills,
            run.maxCombo,
            run.survivalSeconds
        );
        bytes memory tail = abi.encode(
            run.bossId,
            run.envelopeHash,
            run.runtimeId,
            run.seasonId,
            run.deadline,
            run.achievementsHash
        );
        return _hashTypedDataV4(keccak256(bytes.concat(head, tail)));
    }

    /// @notice Canonical hash of an achievements list as committed in VerifiedRun.achievementsHash.
    function achievementsHashOf(bytes32[] calldata achievements) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(achievements));
    }

    // ---------------------------------------------------------------------
    // Settlement
    // ---------------------------------------------------------------------

    /// @notice Settle a verifier-attested ranked run on chain.
    /// @param run          The attested run. `run.player` is the wallet credited with the score.
    /// @param achievements Achievement ids unlocked by this run; must hash to run.achievementsHash.
    /// @param signature    65-byte ECDSA signature by `trustedVerifier` over attestationDigest(run).
    function submitVerifiedSession(VerifiedRun calldata run, bytes32[] calldata achievements, bytes calldata signature)
        external
        nonReentrant
    {
        require(msg.sender == run.player || relayers[msg.sender], "NOT_PLAYER_OR_RELAYER");
        require(block.timestamp <= run.deadline, "ATTESTATION_EXPIRED");
        require(run.envelopeHash != bytes32(0), "EMPTY_ENVELOPE_HASH");
        require(run.sessionId != bytes32(0), "EMPTY_SESSION_ID");
        require(run.gameId != bytes32(0), "EMPTY_GAME_ID");
        require(run.player != address(0), "EMPTY_PLAYER");
        require(!scoresBySession[run.sessionId].exists, "SESSION_EXISTS");
        require(achievements.length <= MAX_ACHIEVEMENTS_PER_SESSION, "TOO_MANY_ACHIEVEMENTS");
        require(keccak256(abi.encodePacked(achievements)) == run.achievementsHash, "ACHIEVEMENTS_HASH_MISMATCH");

        IGameRegistry.Game memory game = IGameRegistry(gameRegistry).getGame(run.gameId);
        require(game.exists && game.playable, "GAME_NOT_PLAYABLE");
        if (game.entryFeeWei > 0) {
            require(rankedEntry != address(0), "RANKED_ENTRY_UNSET");
            require(IArcadeRankedEntry(rankedEntry).isPaid(run.sessionId, run.player, run.gameId), "SESSION_NOT_PAID");
        }

        require(run.score <= MAX_SCORE, "SCORE_OUT_OF_BOUNDS");
        require(run.kills <= MAX_KILLS, "KILLS_OUT_OF_BOUNDS");
        require(run.maxCombo <= MAX_COMBO, "COMBO_OUT_OF_BOUNDS");
        require(run.survivalSeconds <= MAX_SURVIVAL_SECONDS, "SURVIVAL_OUT_OF_BOUNDS");

        // ECDSA.recover reverts on malformed / high-s signatures (OpenZeppelin malleability guard).
        require(ECDSA.recover(attestationDigest(run), signature) == trustedVerifier, "INVALID_ATTESTATION");

        _record(run);
        _mintAchievements(run.player, run.gameId, run.sessionId, achievements);
    }

    function _record(VerifiedRun calldata run) private {
        scoresBySession[run.sessionId] = ScoreRecord({
            sessionId: run.sessionId,
            player: run.player,
            gameId: run.gameId,
            score: run.score,
            kills: run.kills,
            maxCombo: run.maxCombo,
            survivalSeconds: run.survivalSeconds,
            bossId: run.bossId,
            runtimeId: run.runtimeId,
            seasonId: run.seasonId,
            submittedAt: uint64(block.timestamp),
            verified: true,
            exists: true
        });
        sessionEnvelopeHash[run.sessionId] = run.envelopeHash;
        _playerSessions[run.player].push(run.sessionId);
        _allSessions.push(run.sessionId);

        if (run.score > bestScore[run.gameId][run.player]) {
            bestScore[run.gameId][run.player] = run.score;
        }
        if (run.score > bestSeasonScore[run.gameId][run.seasonId][run.player]) {
            bestSeasonScore[run.gameId][run.seasonId][run.player] = run.score;
        }

        emit ScoreSubmitted(
            run.sessionId,
            run.player,
            run.gameId,
            run.score,
            run.kills,
            run.maxCombo,
            run.survivalSeconds,
            run.bossId,
            run.runtimeId,
            run.seasonId
        );
        emit SessionSubmitted(run.sessionId, true);
    }

    function _mintAchievements(address player, bytes32 gameId, bytes32 sessionId, bytes32[] calldata achievements)
        private
    {
        uint256 len = achievements.length;
        if (len == 0) return;
        address minter = achievementRegistryByGame[gameId];
        bytes32[] storage recorded = _sessionAchievements[sessionId];
        for (uint256 i = 0; i < len; i++) {
            bytes32 achievementId = achievements[i];
            if (achievementId == bytes32(0)) continue;
            recorded.push(achievementId);
            if (minter != address(0)) {
                // Returns false (no revert) for undefined or already-held achievements.
                IAchievementMinter(minter).mintFor(player, achievementId, sessionId);
            }
        }
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function getSession(bytes32 sessionId) external view returns (ScoreRecord memory) {
        return scoresBySession[sessionId];
    }

    function getSessionAchievements(bytes32 sessionId) external view returns (bytes32[] memory) {
        return _sessionAchievements[sessionId];
    }

    function playerSessionCount(address player) external view returns (uint256) {
        return _playerSessions[player].length;
    }

    function getPlayerSessions(address player, uint256 offset, uint256 limit)
        external
        view
        returns (ScoreRecord[] memory page)
    {
        bytes32[] storage ids = _playerSessions[player];
        uint256 total = ids.length;
        if (offset >= total) return new ScoreRecord[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new ScoreRecord[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = scoresBySession[ids[i]];
        }
    }

    function totalSessions() external view returns (uint256) {
        return _allSessions.length;
    }

    function getRecentSessions(uint256 offset, uint256 limit) external view returns (ScoreRecord[] memory page) {
        uint256 total = _allSessions.length;
        if (offset >= total) return new ScoreRecord[](0);
        uint256 end = offset + limit;
        if (end > total) end = total;
        page = new ScoreRecord[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            page[i - offset] = scoresBySession[_allSessions[i]];
        }
    }

    /// @notice EIP-712 domain separator (exposed for off-chain signers and tests).
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
