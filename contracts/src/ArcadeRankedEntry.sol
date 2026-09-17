// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IGameRegistry} from "./interfaces/IGameRegistry.sol";

/// @title ArcadeRankedEntry
/// @author Lester's Arcade Core
/// @notice Native-token (zkLTC) Ranked Mode entry desk. A player opens a ranked session by paying exactly
///         `game.entryFeeWei + settlementGasReserveWei` in the chain's native token:
///         - the flat `entryFeeWei` (0.1 zkLTC) is split immediately by the game's registry-defined bps to
///           the dev wallet and the platform/liquidity/treasury vaults;
///         - the `settlementGasReserveWei` (operator-set, default 0) is forwarded whole to `relayerVault`,
///           which funds the relayer that settles the run (score, session data, soulbound achievements)
///           on chain on the player's behalf.
/// @dev    Replaces the June 2026 ERC-20/USDC ArcadePaymentRouter, PaymentRouter and SessionLedger.
///         WO-118 intent preserved: the caller controls NO token address, NO amount and NO split; all come
///         from GameRegistry and operator-set values only. No funds are ever held by this contract.
contract ArcadeRankedEntry is ReentrancyGuard {
    struct PaidSession {
        address player;
        bytes32 gameId;
        uint256 amountWei;
        uint64 openedAt;
        bool exists;
    }

    uint256 private constant BPS_DENOMINATOR = 10_000;

    address public immutable gameRegistry;
    address public operator;
    address public pendingOperator;
    address public platformVault;
    address public liquidityVault;
    address public treasuryVault;
    /// @notice Receives the settlement gas reserve of every paid session (funds the settlement relayer).
    address public relayerVault;
    /// @notice Extra native amount, on top of the game's flat entry fee, that funds relayer settlement.
    uint256 public settlementGasReserveWei;
    bool public entryFeeEnabled = true;

    mapping(bytes32 => PaidSession) public paidSessions;

    event RankedSessionOpened(bytes32 indexed sessionId, address indexed player, bytes32 indexed gameId, uint256 amountWei);
    event RevenueRouted(
        bytes32 indexed sessionId,
        uint256 devAmount,
        uint256 platformAmount,
        uint256 liquidityAmount,
        uint256 treasuryAmount
    );
    event SettlementReserveForwarded(bytes32 indexed sessionId, address indexed relayerVault, uint256 amountWei);
    event PlatformVaultsUpdated(address indexed platformVault, address indexed liquidityVault, address indexed treasuryVault);
    event RelayerVaultUpdated(address indexed relayerVault);
    event SettlementGasReserveUpdated(uint256 settlementGasReserveWei);
    event EntryFeeEnabledUpdated(bool enabled);
    event OperatorTransferStarted(address indexed currentOperator, address indexed pendingOperator);
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);

    modifier onlyOperator() {
        require(msg.sender == operator, "Only platform operator");
        _;
    }

    constructor(address _gameRegistry, address _operator) {
        require(_gameRegistry != address(0), "Invalid registry");
        require(_operator != address(0), "Invalid operator");
        gameRegistry = _gameRegistry;
        operator = _operator;
    }

    // ---------------------------------------------------------------------
    // Operator administration
    // ---------------------------------------------------------------------

    function setPlatformVaults(address _platformVault, address _liquidityVault, address _treasuryVault)
        external
        onlyOperator
    {
        platformVault = _platformVault;
        liquidityVault = _liquidityVault;
        treasuryVault = _treasuryVault;
        emit PlatformVaultsUpdated(_platformVault, _liquidityVault, _treasuryVault);
    }

    /// @notice Set the vault that receives the settlement gas reserve (the relayer's funding wallet).
    /// @dev address(0) is only valid while settlementGasReserveWei == 0.
    function setRelayerVault(address _relayerVault) external onlyOperator {
        require(_relayerVault != address(0) || settlementGasReserveWei == 0, "RELAYER_VAULT_REQUIRED");
        relayerVault = _relayerVault;
        emit RelayerVaultUpdated(_relayerVault);
    }

    /// @notice Set the settlement gas reserve added on top of every game's flat entry fee.
    /// @dev A non-zero reserve requires relayerVault to be set first so no reserve can be stranded.
    function setSettlementGasReserve(uint256 _settlementGasReserveWei) external onlyOperator {
        require(_settlementGasReserveWei == 0 || relayerVault != address(0), "RELAYER_VAULT_UNSET");
        settlementGasReserveWei = _settlementGasReserveWei;
        emit SettlementGasReserveUpdated(_settlementGasReserveWei);
    }

    /// @notice Toggle fee collection. When disabled, openSession requires msg.value == 0 (free ranked:
    ///         neither the flat fee nor the settlement gas reserve is collected).
    function setEntryFeeEnabled(bool enabled) external onlyOperator {
        entryFeeEnabled = enabled;
        emit EntryFeeEnabledUpdated(enabled);
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
    // Ranked entry
    // ---------------------------------------------------------------------

    /// @notice Open a Ranked session for `gameId`, paying exactly `quoteEntry(gameId).totalWei`
    ///         (= game.entryFeeWei + settlementGasReserveWei) in the native token.
    /// @dev The session id is caller-chosen but must be unique; ScoreSubmissionRegistry later binds the
    ///      verified run to (sessionId, player, gameId) via isPaid. The reserve is forwarded to
    ///      relayerVault first, then the flat fee is split by the game's bps.
    function openSession(bytes32 sessionId, bytes32 gameId) external payable nonReentrant {
        require(sessionId != bytes32(0), "EMPTY_SESSION_ID");
        require(!paidSessions[sessionId].exists, "SESSION_EXISTS");

        IGameRegistry.Game memory game = IGameRegistry(gameRegistry).getGame(gameId);
        require(game.exists, "GAME_NOT_REGISTERED");
        require(game.playable, "GAME_NOT_PLAYABLE");
        require(game.devWalletConfirmed, "DEV_WALLET_UNCONFIRMED");

        uint256 reserveWei = 0;
        if (entryFeeEnabled) {
            reserveWei = settlementGasReserveWei;
            require(msg.value == game.entryFeeWei + reserveWei, "WRONG_ENTRY_FEE");
            if (reserveWei > 0) require(relayerVault != address(0), "RELAYER_VAULT_UNSET");
        } else {
            require(msg.value == 0, "ENTRY_FEE_DISABLED");
        }

        paidSessions[sessionId] = PaidSession({
            player: msg.sender,
            gameId: gameId,
            amountWei: msg.value,
            openedAt: uint64(block.timestamp),
            exists: true
        });
        emit RankedSessionOpened(sessionId, msg.sender, gameId, msg.value);

        if (reserveWei > 0) {
            _pay(relayerVault, reserveWei);
            emit SettlementReserveForwarded(sessionId, relayerVault, reserveWei);
        }

        uint256 flatFee = msg.value - reserveWei;
        if (flatFee > 0) {
            _route(sessionId, game, flatFee);
        } else {
            emit RevenueRouted(sessionId, 0, 0, 0, 0);
        }
    }

    function _route(bytes32 sessionId, IGameRegistry.Game memory game, uint256 amount) private {
        uint256 platformAmount = (amount * game.platformBps) / BPS_DENOMINATOR;
        uint256 liquidityAmount = (amount * game.liquidityBps) / BPS_DENOMINATOR;
        uint256 treasuryAmount = (amount * game.treasuryBps) / BPS_DENOMINATOR;
        // Dev share = bps share + rounding dust + any share whose vault is unset.
        uint256 devAmount = amount - platformAmount - liquidityAmount - treasuryAmount;

        if (platformVault == address(0)) {
            devAmount += platformAmount;
            platformAmount = 0;
        }
        if (liquidityVault == address(0)) {
            devAmount += liquidityAmount;
            liquidityAmount = 0;
        }
        if (treasuryVault == address(0)) {
            devAmount += treasuryAmount;
            treasuryAmount = 0;
        }

        _pay(platformVault, platformAmount);
        _pay(liquidityVault, liquidityAmount);
        _pay(treasuryVault, treasuryAmount);
        _pay(game.devWallet, devAmount);

        emit RevenueRouted(sessionId, devAmount, platformAmount, liquidityAmount, treasuryAmount);
    }

    function _pay(address to, uint256 amount) private {
        if (amount == 0) return;
        (bool ok, ) = to.call{value: amount}("");
        require(ok, "PAYOUT_FAILED");
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    function isPaid(bytes32 sessionId, address player, bytes32 gameId) external view returns (bool) {
        PaidSession storage session = paidSessions[sessionId];
        return session.exists && session.player == player && session.gameId == gameId;
    }

    function getPaidSession(bytes32 sessionId) external view returns (PaidSession memory) {
        return paidSessions[sessionId];
    }

    /// @notice Exact native amount openSession requires for `gameId` right now, and its two parts.
    /// @dev Returns (0, 0, 0) while entryFeeEnabled is false (free ranked). Reverts for unknown games.
    function quoteEntry(bytes32 gameId)
        external
        view
        returns (uint256 entryFeeWei, uint256 settlementGasReserveWei_, uint256 totalWei)
    {
        IGameRegistry.Game memory game = IGameRegistry(gameRegistry).getGame(gameId);
        require(game.exists, "GAME_NOT_REGISTERED");
        if (!entryFeeEnabled) return (0, 0, 0);
        entryFeeWei = game.entryFeeWei;
        settlementGasReserveWei_ = settlementGasReserveWei;
        totalWei = entryFeeWei + settlementGasReserveWei_;
    }
}
