// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title ArcadePaymentRouter
/// @notice Handles paid-mode arcade credits and routes funds to Lester's Arcade buckets.
contract ArcadePaymentRouter {
    struct SplitConfig {
        address infrastructureTreasury;
        address developerTreasury;
        address tournamentTreasury;
        address communityTreasury;
        uint16 infrastructureBps;
        uint16 developerBps;
        uint16 tournamentBps;
        uint16 communityBps;
    }

    mapping(bytes32 => bool) public paidSessions;

    event PaidSessionStarted(
        bytes32 indexed sessionId,
        address indexed player,
        bytes32 indexed gameId,
        address paymentToken,
        uint256 amount
    );

    function startPaidSession(
        bytes32 sessionId,
        bytes32 gameId,
        IERC20Like paymentToken,
        uint256 amount,
        SplitConfig calldata split
    ) external {
        require(sessionId != bytes32(0), "EMPTY_SESSION_ID");
        require(gameId != bytes32(0), "EMPTY_GAME_ID");
        require(!paidSessions[sessionId], "SESSION_EXISTS");
        require(amount > 0, "EMPTY_AMOUNT");
        require(_totalBps(split) == 10_000, "BAD_SPLIT");

        paidSessions[sessionId] = true;
        require(paymentToken.transferFrom(msg.sender, address(this), amount), "PAYMENT_FAILED");

        _route(paymentToken, split.infrastructureTreasury, (amount * split.infrastructureBps) / 10_000);
        _route(paymentToken, split.developerTreasury, (amount * split.developerBps) / 10_000);
        _route(paymentToken, split.tournamentTreasury, (amount * split.tournamentBps) / 10_000);

        uint256 routed = (amount * (split.infrastructureBps + split.developerBps + split.tournamentBps)) / 10_000;
        _route(paymentToken, split.communityTreasury, amount - routed);

        emit PaidSessionStarted(sessionId, msg.sender, gameId, address(paymentToken), amount);
    }

    function _route(IERC20Like token, address to, uint256 amount) private {
        require(to != address(0), "EMPTY_TREASURY");
        require(token.transfer(to, amount), "ROUTE_FAILED");
    }

    function _totalBps(SplitConfig calldata split) private pure returns (uint16) {
        return split.infrastructureBps + split.developerBps + split.tournamentBps + split.communityBps;
    }
}
