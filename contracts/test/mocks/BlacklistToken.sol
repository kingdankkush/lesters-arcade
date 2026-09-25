// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TEST MOCK ONLY (tests/weekly-jackpot-*.test.mjs, rehearsal R9). Any transfer from or to a
///         blacklisted address reverts, like USDC/USDT freezes.
contract BlacklistToken is ERC20 {
    mapping(address => bool) public blacklisted;

    constructor() ERC20("Blacklist Mock", "BLKMOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setBlacklisted(address account, bool isBlacklisted) external {
        blacklisted[account] = isBlacklisted;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!blacklisted[from] && !blacklisted[to], "BLACKLISTED");
        super._update(from, to, value);
    }
}
