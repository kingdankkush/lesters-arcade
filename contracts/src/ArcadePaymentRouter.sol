// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IArcadeRouterToken {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

interface IArcadeRouterGameRegistry {
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

/// @title ArcadePaymentRouter
/// @notice Handles paid-mode arcade credits using registry-derived routing only.
contract ArcadePaymentRouter is ReentrancyGuard {
    struct PlatformVaults {
        address platformVault;
        address liquidityVault;
        address treasuryVault;
    }

    mapping(bytes32 => bool) public paidSessions;
    address public immutable gameRegistry;
    address public immutable allowedPaymentToken;
    address public operator;
    address public pendingOperator;
    bool public entryFeeEnabled;
    PlatformVaults public platformVaults;

    event PaidSessionStarted(
        bytes32 indexed sessionId,
        address indexed player,
        bytes32 indexed gameId,
        address paymentToken,
        uint256 amount
    );
    event RevenueRouted(
        bytes32 indexed sessionId,
        address indexed devWallet,
        uint256 devAmount,
        uint256 platformAmount,
        uint256 liquidityAmount,
        uint256 treasuryAmount
    );
    event EntryFeeEnabledChanged(bool enabled);
    event PlatformVaultsUpdated(address platformVault, address liquidityVault, address treasuryVault);
    event OperatorTransferStarted(address indexed currentOperator, address indexed pendingOperator);
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);

    modifier onlyOperator() {
        require(msg.sender == operator, "Only operator");
        _;
    }

    constructor(address _gameRegistry, address _operator, address _allowedPaymentToken) {
        require(_gameRegistry != address(0), "Invalid registry");
        require(_operator != address(0), "Invalid operator");
        require(_allowedPaymentToken != address(0), "Invalid token");
        gameRegistry = _gameRegistry;
        operator = _operator;
        allowedPaymentToken = _allowedPaymentToken;
        entryFeeEnabled = false;
    }

    function setEntryFeeEnabled(bool enabled) external onlyOperator {
        entryFeeEnabled = enabled;
        emit EntryFeeEnabledChanged(enabled);
    }

    function setPlatformVaults(address platformVault, address liquidityVault, address treasuryVault) external onlyOperator {
        require(platformVault != address(0), "Invalid platform vault");
        require(liquidityVault != address(0), "Invalid liquidity vault");
        require(treasuryVault != address(0), "Invalid treasury vault");
        platformVaults = PlatformVaults(platformVault, liquidityVault, treasuryVault);
        emit PlatformVaultsUpdated(platformVault, liquidityVault, treasuryVault);
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

    /// @notice Pull a Ranked entry fee and route it using only trusted registry/config values.
    function startPaidSession(bytes32 sessionId, bytes32 gameId, uint256 amount) external nonReentrant {
        require(entryFeeEnabled, "ENTRY_FEE_DISABLED");
        require(sessionId != bytes32(0), "EMPTY_SESSION_ID");
        require(gameId != bytes32(0), "EMPTY_GAME_ID");
        require(!paidSessions[sessionId], "SESSION_EXISTS");
        require(amount > 0, "EMPTY_AMOUNT");
        require(platformVaults.platformVault != address(0), "VAULTS_UNSET");
        require(platformVaults.liquidityVault != address(0), "VAULTS_UNSET");
        require(platformVaults.treasuryVault != address(0), "VAULTS_UNSET");

        IArcadeRouterGameRegistry.Game memory game = IArcadeRouterGameRegistry(gameRegistry).getGame(gameId);
        require(game.exists && game.playable, "GAME_NOT_PLAYABLE");
        require(game.devWallet != address(0), "INVALID_DEV_WALLET");
        require(game.devBps + game.platformBps + game.liquidityBps + game.treasuryBps == 10_000, "BAD_SPLIT");

        paidSessions[sessionId] = true;
        IArcadeRouterToken token = IArcadeRouterToken(allowedPaymentToken);
        require(token.transferFrom(msg.sender, address(this), amount), "PAYMENT_FAILED");

        uint256 devAmount = (amount * game.devBps) / 10_000;
        uint256 platformAmount = (amount * game.platformBps) / 10_000;
        uint256 liquidityAmount = (amount * game.liquidityBps) / 10_000;
        uint256 treasuryAmount = amount - devAmount - platformAmount - liquidityAmount;

        emit PaidSessionStarted(sessionId, msg.sender, gameId, allowedPaymentToken, amount);
        emit RevenueRouted(sessionId, game.devWallet, devAmount, platformAmount, liquidityAmount, treasuryAmount);

        if (devAmount > 0) require(token.transfer(game.devWallet, devAmount), "DEV_ROUTE_FAILED");
        if (platformAmount > 0) require(token.transfer(platformVaults.platformVault, platformAmount), "PLATFORM_ROUTE_FAILED");
        if (liquidityAmount > 0) require(token.transfer(platformVaults.liquidityVault, liquidityAmount), "LIQUIDITY_ROUTE_FAILED");
        if (treasuryAmount > 0) require(token.transfer(platformVaults.treasuryVault, treasuryAmount), "TREASURY_ROUTE_FAILED");
    }
}
