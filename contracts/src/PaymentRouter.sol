// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title PaymentRouter
/// @author Lester's Arcade Core
/// @notice Receives forwarded entry-fee tokens from SessionLedger and splits
///         them according to the configured vault split.
contract PaymentRouter is ReentrancyGuard {
    struct SplitDestinations {
        address devVault;
        address platformVault;
        address liquidityVault;
        address treasuryVault;
    }

    address public immutable gameRegistry;
    address public sessionLedger;
    address public immutable token;
    address public operator;
    address public pendingOperator;
    SplitDestinations public defaults;

    event Split(
        bytes32 indexed gameId,
        address indexed player,
        uint256 total,
        uint256 devShare,
        uint256 platformShare,
        uint256 liquidityShare,
        uint256 treasuryShare
    );
    event DefaultVaultsUpdated(address devVault, address platformVault, address liquidityVault, address treasuryVault);
    event SessionLedgerSet(address indexed sessionLedger);
    event OperatorTransferStarted(address indexed currentOperator, address indexed pendingOperator);
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);

    modifier onlyLedger() {
        require(msg.sender == sessionLedger, "Only SessionLedger");
        _;
    }

    modifier onlyOperator() {
        require(msg.sender == operator, "Only operator");
        _;
    }

    constructor(address _gameRegistry, address _operator, address _token) {
        require(_gameRegistry != address(0), "Invalid registry");
        require(_operator != address(0), "Invalid operator");
        require(_token != address(0), "Invalid token");
        gameRegistry = _gameRegistry;
        operator = _operator;
        token = _token;
    }

    /// @notice One-time SessionLedger wiring. Avoids circular constructor dependencies.
    function setSessionLedger(address _sessionLedger) external onlyOperator {
        require(sessionLedger == address(0), "ALREADY_SET");
        require(_sessionLedger != address(0), "Invalid ledger");
        sessionLedger = _sessionLedger;
        emit SessionLedgerSet(_sessionLedger);
    }

    /// @notice Set default vault addresses. Operator-only and all vaults must be non-zero.
    function setDefaultVaults(
        address devVault,
        address platformVault,
        address liquidityVault,
        address treasuryVault
    ) external onlyOperator {
        require(devVault != address(0), "Invalid dev vault");
        require(platformVault != address(0), "Invalid platform vault");
        require(liquidityVault != address(0), "Invalid liquidity vault");
        require(treasuryVault != address(0), "Invalid treasury vault");
        defaults = SplitDestinations(devVault, platformVault, liquidityVault, treasuryVault);
        emit DefaultVaultsUpdated(devVault, platformVault, liquidityVault, treasuryVault);
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

    /// @notice Receive tokens and split them. Forwarded from SessionLedger after session close.
    function splitAndDisburse(
        bytes32 gameId,
        address player,
        uint256 amount
    ) external onlyLedger nonReentrant {
        require(defaults.devVault != address(0), "Vaults unset");
        require(defaults.platformVault != address(0), "Vaults unset");
        require(defaults.liquidityVault != address(0), "Vaults unset");
        require(defaults.treasuryVault != address(0), "Vaults unset");

        (uint16 devBps, uint16 platformBps, uint16 liquidityBps, uint16 treasuryBps) = (6000, 2000, 1000, 1000);

        uint256 devShare = (amount * devBps) / 10_000;
        uint256 platformShare = (amount * platformBps) / 10_000;
        uint256 liquidityShare = (amount * liquidityBps) / 10_000;
        require(devBps + platformBps + liquidityBps + treasuryBps == 10_000, "Bad split");
        uint256 treasuryShare = amount - devShare - platformShare - liquidityShare;

        emit Split(gameId, player, amount, devShare, platformShare, liquidityShare, treasuryShare);

        if (devShare > 0) require(IERC20(token).transfer(defaults.devVault, devShare), "Dev transfer failed");
        if (platformShare > 0) require(IERC20(token).transfer(defaults.platformVault, platformShare), "Platform transfer failed");
        if (liquidityShare > 0) require(IERC20(token).transfer(defaults.liquidityVault, liquidityShare), "Liquidity transfer failed");
        if (treasuryShare > 0) require(IERC20(token).transfer(defaults.treasuryVault, treasuryShare), "Treasury transfer failed");
    }
}
