// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TEST MOCK ONLY (tests/weekly-jackpot-lifecycle.test.mjs). A TUSD-style token with a second entry
///         point: `secondary` is another address whose balanceOf/transfer move the SAME balances, so sweeping
///         "another token" at that address would drain the prize token.
contract DoubleEntryToken is ERC20 {
    DoubleEntrySecondary public immutable secondary;

    constructor() ERC20("Double Entry Mock", "DBLMOCK") {
        secondary = new DoubleEntrySecondary(this);
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function delegateTransfer(address from, address to, uint256 value) external returns (bool) {
        require(msg.sender == address(secondary), "ONLY_SECONDARY");
        _transfer(from, to, value);
        return true;
    }
}

/// @notice The second entry point of DoubleEntryToken (TEST MOCK ONLY).
contract DoubleEntrySecondary {
    DoubleEntryToken public immutable primary;

    constructor(DoubleEntryToken primary_) {
        primary = primary_;
    }

    function totalSupply() external view returns (uint256) {
        return primary.totalSupply();
    }

    function balanceOf(address account) external view returns (uint256) {
        return primary.balanceOf(account);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        return primary.delegateTransfer(msg.sender, to, value);
    }
}
