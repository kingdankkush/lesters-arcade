// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice TEST MOCK ONLY (tests/weekly-jackpot-lifecycle.test.mjs). An ERC-777-style callback token: once
///         armed, the next non-mint transfer calls `hookTarget` with `hookData` (for example a re-entry into
///         the jackpot) and records the outcome instead of bubbling it, so a test can prove the re-entry was
///         attempted and refused while the outer call still completes. `failTransfersTo` makes transfers to
///         an address revert, so a prize can be left claim-pending and the claim path re-entered too.
contract ReentrantToken is ERC20 {
    mapping(address => bool) public failTransfersTo;
    address public hookTarget;
    bytes public hookData;
    bool public armed;
    uint256 public hookCalls;
    bool public lastHookOk;
    bytes public lastHookReturn;

    constructor() ERC20("Reentrant Mock", "REENTMOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function setFailTransfersTo(address account, bool fails) external {
        failTransfersTo[account] = fails;
    }

    function arm(address target, bytes calldata data) external {
        hookTarget = target;
        hookData = data;
        armed = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        require(!failTransfersTo[to], "TRANSFER_REFUSED");
        super._update(from, to, value);
        if (armed && from != address(0)) {
            armed = false;
            hookCalls += 1;
            (bool ok, bytes memory returned) = hookTarget.call(hookData);
            lastHookOk = ok;
            lastHookReturn = returned;
        }
    }
}
