// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title TestChikunToken (tCHIKUN)
/// @author Lester's Arcade Core
/// @notice Testnet stand-in for the $CHIKUN prize token of the Chikun Weekly Jackpot. It has NO value:
///         the name and symbol say so, so it can never pass for the real $CHIKUN.
/// @dev A plain OZ ERC20 (18 decimals): no burn-from, no pause, no blacklist, no fees, so the jackpot's
///      testnet behaviour is honest. Only the minter mints, at most MAX_MINT_PER_CALL per call; the minter
///      role moves in two steps (transferMinter -> acceptMinter).
contract TestChikunToken is ERC20 {
    uint256 public constant MAX_MINT_PER_CALL = 10_000_000e18;

    address public minter;
    address public pendingMinter;

    event MinterTransferStarted(address indexed current, address indexed pending);
    event MinterTransferred(address indexed previous, address indexed current);

    modifier onlyMinter() {
        require(msg.sender == minter, "ONLY_MINTER");
        _;
    }

    constructor(address _minter) ERC20("Lester's Arcade Test CHIKUN (no value)", "tCHIKUN") {
        require(_minter != address(0), "ZERO_ADDRESS");
        minter = _minter;
    }

    function mint(address to, uint256 amount) external onlyMinter {
        require(amount <= MAX_MINT_PER_CALL, "MINT_CAP");
        _mint(to, amount);
    }

    function transferMinter(address next) external onlyMinter {
        require(next != address(0), "ZERO_ADDRESS");
        pendingMinter = next;
        emit MinterTransferStarted(minter, next);
    }

    function acceptMinter() external {
        require(msg.sender == pendingMinter, "ONLY_PENDING_MINTER");
        address previous = minter;
        minter = msg.sender;
        pendingMinter = address(0);
        emit MinterTransferred(previous, msg.sender);
    }
}
