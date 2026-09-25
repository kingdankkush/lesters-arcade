// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TEST MOCK ONLY (tests/weekly-jackpot-lifecycle.test.mjs). Charges the SENDER an extra
///         `senderFeeBps` on every transfer (burned from the sender on top of the amount), so a contract that
///         sends X loses more than X. The recipient receives the full amount.
contract SenderFeeToken is ERC20 {
    uint256 public senderFeeBps;

    constructor(uint256 senderFeeBps_) ERC20("Sender Fee Mock", "SFEEMOCK") {
        senderFeeBps = senderFeeBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setSenderFeeBps(uint256 senderFeeBps_) external {
        senderFeeBps = senderFeeBps_;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (from != address(0) && to != address(0) && senderFeeBps > 0) {
            super._update(from, address(0), (value * senderFeeBps) / 10_000);
        }
    }
}
