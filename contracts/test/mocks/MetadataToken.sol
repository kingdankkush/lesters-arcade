// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TEST MOCK ONLY (tests/jackpot-deploy-tooling.test.mjs). A plain ERC-20 with any name, symbol and
///         decimals, so the deploy script's --token checks can meet metadata the jackpot record refuses (an
///         over-long or non-ASCII name, a symbol outside the Neon pattern, decimals above 36).
contract MetadataToken is ERC20 {
    uint8 private immutable _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
