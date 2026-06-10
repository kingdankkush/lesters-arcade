// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title SessionLedger
/// @author Lester's Arcade Core
/// @notice Creates and finalizes ranked paid-run sessions on LitVM. Players
///         pay an entry fee at session open; the fee is held in escrow until
///         session close, at which point PlayerScore is committed and the fee
///         is forwarded to PaymentRouter.sol for split disbursement.
/// @dev    EIP-712 signature from the cabinet's adapter proves the player
///         actually played; the ledger validates it before committing score.
contract SessionLedger {
    struct Session {
        address player;
        bytes32 gameId;
        uint256 entryFee;            // micro USDC paid at open
        uint256 openedAt;
        uint256 closedAt;
        uint256 finalScore;
        uint256 kills;
        uint256 survivalSeconds;
        bool closed;
        bool settled;                // true once PaymentRouter has disbursed
    }

    // EIP-712 domain + types
    bytes32 public constant DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 public constant SESSION_TYPEHASH = keccak256(
        "SessionCommit(bytes32 gameId,address player,uint256 openedAt,uint256 finalScore,uint256 kills,uint256 survivalSeconds)"
    );
    bytes32 public DOMAIN_SEPARATOR;

    // Per-game registered adapter signers (the server-side wallet that signs commits).
    // Cabinet adapters register via GameRegistry; this contract pulls from
    // GameRegistry.getGame(gameId).devWallet as the authorized signer.
    address public gameRegistry;
    address public paymentRouter;
    address public entryToken;          // USDC on LitVM (18 or 6 decimals — matches token)
    uint256 public chainId;
    mapping(bytes32 => Session) public sessions; // sessionId => Session
    bytes32[] public sessionIds;

    event SessionOpened(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 entryFee);
    event SessionClosed(bytes32 indexed sessionId, uint256 finalScore, uint256 kills, uint256 survivalSeconds);
    event SessionSettled(bytes32 indexed sessionId);

    constructor(address _gameRegistry, address _paymentRouter, address _entryToken) {
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

    /// @notice Open a ranked session. Pulls `entryFee` of the entry token from player.
    function openSession(bytes32 gameId, uint256 entryFee) external returns (bytes32 sessionId) {
        require(entryFee > 0, "Entry fee required");
        IERC20(entryToken).transferFrom(msg.sender, address(this), entryFee);

        sessionId = keccak256(abi.encodePacked(msg.sender, gameId, block.timestamp, block.number));
        require(!sessions[sessionId].closed, "Session collision");

        sessions[sessionId] = Session({
            player: msg.sender,
            gameId: gameId,
            entryFee: entryFee,
            openedAt: block.timestamp,
            closedAt: 0,
            finalScore: 0,
            kills: 0,
            survivalSeconds: 0,
            closed: true,  // placeholder to mark the slot as allocated; flipped by closeSession
            settled: false
        });
        sessions[sessionId].closed = false;
        sessionIds.push(sessionId);

        emit SessionOpened(sessionId, msg.sender, gameId, entryFee);
    }

    /// @notice Close session with EIP-712 signed score commit from the game adapter.
    function closeSession(
        bytes32 sessionId,
        uint256 finalScore,
        uint256 kills,
        uint256 survivalSeconds,
        uint8 v, bytes32 r, bytes32 s
    ) external {
        Session storage sess = sessions[sessionId];
        require(sess.openedAt > 0, "Unknown session");
        require(!sess.closed, "Already closed");

        // Recover the adapter signer. Must match the game's registered devWallet.
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
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "Invalid signature");
        // TODO: lookup gameRegistry.games[sess.gameId].devWallet == signer
        //       (GameRegistry.sol is not yet wired — stub for the integration phase).

        sess.closed = true;
        sess.closedAt = block.timestamp;
        sess.finalScore = finalScore;
        sess.kills = kills;
        sess.survivalSeconds = survivalSeconds;

        emit SessionClosed(sessionId, finalScore, kills, survivalSeconds);
    }

    /// @notice After close, disburse the entry fee via PaymentRouter based on the
    ///         game's on-chain fee split (read from GameRegistry at settlement time).
    function settle(bytes32 sessionId) external {
        Session storage sess = sessions[sessionId];
        require(sess.closed, "Not closed yet");
        require(!sess.settled, "Already settled");

        // Forward the entry token to the payment router which splits per-game.
        IERC20(entryToken).transfer(paymentRouter, sess.entryFee);
        sess.settled = true;
        emit SessionSettled(sessionId);
    }

    function getSession(bytes32 sessionId) external view returns (Session memory) {
        return sessions[sessionId];
    }

    function sessionCount() external view returns (uint256) {
        return sessionIds.length;
    }
}
