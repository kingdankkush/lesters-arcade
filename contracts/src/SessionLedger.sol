// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "./interfaces/IERC20.sol";

interface ISessionGameRegistry {
    struct Game {
        bytes32 gameId;
        string title;
        address devWallet;
        uint16 devBps;
        uint16 platformBps;
        uint16 liquidityBps;
        uint16 treasuryBps;
        uint256 entryFeeMicroUsdc;
        bool devWalletConfirmed;
        bool playable;
        bool exists;
        uint256 registeredAt;
    }

    function getGame(bytes32 gameId) external view returns (Game memory);
}

interface IPaymentRouter {
    function splitAndDisburse(bytes32 gameId, address player, uint256 amount) external;
}

/// @title SessionLedger
/// @author Lester's Arcade Core
/// @notice Creates and finalizes ranked paid-run sessions on LitVM.
contract SessionLedger is ReentrancyGuard {
    using ECDSA for bytes32;

    struct Session {
        address player;
        bytes32 gameId;
        uint256 entryFee;
        uint256 openedAt;
        uint256 closedAt;
        uint256 finalScore;
        uint256 kills;
        uint256 survivalSeconds;
        bool closed;
        bool settled;
    }

    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 public constant SESSION_TYPEHASH = keccak256(
        "SessionCommit(bytes32 gameId,address player,uint256 openedAt,uint256 finalScore,uint256 kills,uint256 survivalSeconds)"
    );
    bytes32 public immutable DOMAIN_SEPARATOR;

    address public immutable gameRegistry;
    address public immutable paymentRouter;
    address public immutable entryToken;
    uint256 public immutable chainId;
    mapping(bytes32 => Session) public sessions;
    mapping(address => uint256) public playerNonces;
    bytes32[] public sessionIds;

    event SessionOpened(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 entryFee);
    event SessionClosed(bytes32 indexed sessionId, uint256 finalScore, uint256 kills, uint256 survivalSeconds);
    event SessionSettled(bytes32 indexed sessionId);

    constructor(address _gameRegistry, address _paymentRouter, address _entryToken) {
        require(_gameRegistry != address(0), "Invalid registry");
        require(_paymentRouter != address(0), "Invalid router");
        require(_entryToken != address(0), "Invalid token");
        gameRegistry = _gameRegistry;
        paymentRouter = _paymentRouter;
        entryToken = _entryToken;
        chainId = block.chainid;
        DOMAIN_SEPARATOR = keccak256(abi.encode(
            DOMAIN_TYPEHASH,
            keccak256(bytes("Lester's Arcade Session Ledger")),
            keccak256(bytes("1")),
            chainId,
            address(this)
        ));
    }

    function openSession(bytes32 gameId, uint256 entryFee) external nonReentrant returns (bytes32 sessionId) {
        require(entryFee > 0, "Entry fee required");
        ISessionGameRegistry.Game memory game = ISessionGameRegistry(gameRegistry).getGame(gameId);
        require(game.exists && game.playable, "Game not playable");

        uint256 nonce = playerNonces[msg.sender]++;
        sessionId = keccak256(abi.encodePacked(block.chainid, address(this), msg.sender, gameId, nonce));


        sessions[sessionId] = Session({
            player: msg.sender,
            gameId: gameId,
            entryFee: entryFee,
            openedAt: block.timestamp,
            closedAt: 0,
            finalScore: 0,
            kills: 0,
            survivalSeconds: 0,
            closed: false,
            settled: false
        });
        sessionIds.push(sessionId);

        require(IERC20(entryToken).transferFrom(msg.sender, address(this), entryFee), "Entry transfer failed");

        emit SessionOpened(sessionId, msg.sender, gameId, entryFee);
    }

    function closeSession(
        bytes32 sessionId,
        uint256 finalScore,
        uint256 kills,
        uint256 survivalSeconds,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        Session storage sess = sessions[sessionId];
        require(sess.openedAt > 0, "Unknown session");
        require(msg.sender == sess.player, "Not the session owner");
        require(!sess.closed, "Already closed");

        ISessionGameRegistry.Game memory game = ISessionGameRegistry(gameRegistry).getGame(sess.gameId);
        require(game.exists && game.playable, "Game not playable");

        bytes32 structHash = keccak256(abi.encode(
            SESSION_TYPEHASH,
            sess.gameId,
            sess.player,
            sess.openedAt,
            finalScore,
            kills,
            survivalSeconds
        ));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address signer = ECDSA.recover(digest, v, r, s);
        require(signer == game.devWallet, "Unauthorized signer");

        sess.closed = true;
        sess.closedAt = block.timestamp;
        sess.finalScore = finalScore;
        sess.kills = kills;
        sess.survivalSeconds = survivalSeconds;

        emit SessionClosed(sessionId, finalScore, kills, survivalSeconds);
    }

    function settle(bytes32 sessionId) external nonReentrant {
        Session storage sess = sessions[sessionId];
        require(sess.openedAt > 0, "Unknown session");
        require(sess.closed, "Not closed yet");
        require(!sess.settled, "Already settled");

        sess.settled = true;
        emit SessionSettled(sessionId);

        require(IERC20(entryToken).transfer(paymentRouter, sess.entryFee), "Router transfer failed");
        IPaymentRouter(paymentRouter).splitAndDisburse(sess.gameId, sess.player, sess.entryFee);
    }

    function getSession(bytes32 sessionId) external view returns (Session memory) {
        return sessions[sessionId];
    }

    function sessionCount() external view returns (uint256) {
        return sessionIds.length;
    }
}
