// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "./interfaces/IERC20.sol";

/// @title PaymentRouter
/// @author Lester's Arcade Core
/// @notice Receives forwarded entry-fee tokens from SessionLedger and splits
///         them according to the game's on-chain fee split (dev / platform /
///         liquidity / treasury). Each destination is a whitelisted vault
///         address registered via operator config.
/// @dev    Gas reserve from settlement flows through the platform share to
///         pay for subsequent on-chain writes (profile updates, achievements,
///         etc.) — the platform acts as a self-funding gas bank.
contract PaymentRouter {
    struct SplitDestinations {
        address devVault;          // from GameRegistry.games[gameId].devWallet
        address platformVault;
        address liquidityVault;
        address treasuryVault;
    }

    address public gameRegistry;
    address public sessionLedger;
    address public token;           // USDC on LitVM
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

    modifier onlyLedger() {
        require(msg.sender == sessionLedger, "Only SessionLedger");
        _;
    }

    constructor(address _gameRegistry, address _sessionLedger, address _token) {
        gameRegistry = _gameRegistry;
        sessionLedger = _sessionLedger;
        token = _token;
    }

    /// @notice Set the default vault addresses (operator config).
    function setDefaultVaults(
        address devVault,
        address platformVault,
        address liquidityVault,
        address treasuryVault
    ) external {
        // TODO: restrict to operator via owner modifier
        defaults = SplitDestinations(devVault, platformVault, liquidityVault, treasuryVault);
    }

    /// @notice Receive tokens and split them. Forwarded from SessionLedger after
    ///         session close. Reads the game's fee split from GameRegistry.
    /// @param gameId   The game's keccak identifier.
    /// @param player   Wallet that paid the entry fee (for event logging).
    /// @param amount   Total token amount held by this contract for the session.
    function splitAndDisburse(
        bytes32 gameId,
        address player,
        uint256 amount
    ) external onlyLedger {
        // TODO: call GameRegistry.getGame(gameId) to read dev/platform/liquidity/treasury bps
        //       For the skeleton, use a placeholder default of 60/20/10/10.
        (uint16 devBps, uint16 platformBps, uint16 liquidityBps, uint16 treasuryBps) = (6000, 2000, 1000, 1000);

        uint256 devShare       = (amount * devBps)       / 10_000;
        uint256 platformShare  = (amount * platformBps)  / 10_000;
        uint256 liquidityShare = (amount * liquidityBps) / 10_000;
        uint256 treasuryShare  = (amount * treasuryBps)  / 10_000;

        // Disburse to registered vault addresses.
        if (devShare > 0) IERC20(token).transfer(defaults.devVault, devShare);
        if (platformShare > 0) IERC20(token).transfer(defaults.platformVault, platformShare);
        if (liquidityShare > 0) IERC20(token).transfer(defaults.liquidityVault, liquidityShare);
        if (treasuryShare > 0) IERC20(token).transfer(defaults.treasuryVault, treasuryShare);

        emit Split(gameId, player, amount, devShare, platformShare, liquidityShare, treasuryShare);
    }
}
