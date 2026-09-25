// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TEST MOCK ONLY (tests/weekly-jackpot-lifecycle.test.mjs). A memecoin-style max-transaction
///         limit: a transfer above `maxTx` reverts unless the sender or the recipient is exempt.
contract MaxTxToken is ERC20 {
    uint256 public maxTx;
    mapping(address => bool) public exempt;

    constructor(uint256 maxTx_) ERC20("Max Tx Mock", "MAXTXMOCK") {
        maxTx = maxTx_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setMaxTx(uint256 maxTx_) external {
        maxTx = maxTx_;
    }

    function setExempt(address account, bool isExempt) external {
        exempt[account] = isExempt;
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0) && !exempt[from] && !exempt[to]) {
            require(value <= maxTx, "MAX_TX");
        }
        super._update(from, to, value);
    }
}
