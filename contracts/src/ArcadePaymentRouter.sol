// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Like {
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function transfer(address to, uint256 value) external returns (bool);
}

/// @title ArcadePaymentRouter
/// @notice Handles paid-mode arcade credits and routes funds to Lester's Arcade buckets.
/// @dev Cost-first model: a settlement reserve covers the on-chain gas to write the
///      player's score/achievements/username; the dev wallet receives the largest share
///      (funding future game development + community building) plus any unused settlement
///      gas remainder; tournament and community pools get their slices.
contract ArcadePaymentRouter {
    struct SplitConfig {
        address settlementTreasury;  // funds the gas to settle scores/achievements on-chain
        address devWallet;           // largest share + unused settlement remainder
        address tournamentTreasury;
        address communityTreasury;
        uint16 settlementBps;
        uint16 devBps;
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

    event RevenueRouted(
        bytes32 indexed sessionId,
        address indexed devWallet,
        uint256 settlementAmount,
        uint256 devAmount,
        uint256 tournamentAmount,
        uint256 communityAmount
    );

    /// @notice Pull a Ranked entry fee and route it across the buckets. The dev wallet
    ///         receives its share plus the remainder of the settlement reserve not consumed
    ///         by actual settlement gas (`settlementGasUsed`).
    function startPaidSession(
        bytes32 sessionId,
        bytes32 gameId,
        IERC20Like paymentToken,
        uint256 amount,
        uint256 settlementGasUsed,
        SplitConfig calldata split
    ) external {
        require(sessionId != bytes32(0), "EMPTY_SESSION_ID");
        require(gameId != bytes32(0), "EMPTY_GAME_ID");
        require(!paidSessions[sessionId], "SESSION_EXISTS");
        require(amount > 0, "EMPTY_AMOUNT");
        require(_totalBps(split) == 10_000, "BAD_SPLIT");

        paidSessions[sessionId] = true;
        require(paymentToken.transferFrom(msg.sender, address(this), amount), "PAYMENT_FAILED");

        uint256 settlementShare = (amount * split.settlementBps) / 10_000;
        uint256 devShare = (amount * split.devBps) / 10_000;
        uint256 tournamentShare = (amount * split.tournamentBps) / 10_000;

        // Reserve only the gas actually used for settlement; the unused remainder
        // of the settlement bucket rolls into the dev wallet.
        uint256 gasReserved = settlementGasUsed < settlementShare ? settlementGasUsed : settlementShare;
        uint256 settlementRemainderToDev = settlementShare - gasReserved;
        devShare += settlementRemainderToDev;

        _route(paymentToken, split.settlementTreasury, gasReserved);
        _route(paymentToken, split.devWallet, devShare);
        _route(paymentToken, split.tournamentTreasury, tournamentShare);

        // Community gets everything left so rounding dust is never stranded.
        uint256 routed = gasReserved + devShare + tournamentShare;
        uint256 communityShare = amount - routed;
        _route(paymentToken, split.communityTreasury, communityShare);

        emit PaidSessionStarted(sessionId, msg.sender, gameId, address(paymentToken), amount);
        emit RevenueRouted(sessionId, split.devWallet, gasReserved, devShare, tournamentShare, communityShare);
    }

    function _route(IERC20Like token, address to, uint256 amount) private {
        require(to != address(0), "EMPTY_TREASURY");
        if (amount == 0) return;
        require(token.transfer(to, amount), "ROUTE_FAILED");
    }

    function _totalBps(SplitConfig calldata split) private pure returns (uint16) {
        return split.settlementBps + split.devBps + split.tournamentBps + split.communityBps;
    }
}
