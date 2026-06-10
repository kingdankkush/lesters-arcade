// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GameRegistry
/// @author Lester's Arcade Core
/// @notice Cabinet registry for Lester's Arcade. Only approved games can
///         participate in shared identity + ranked sessions. The platform
///         operator approves games that integrate the submitRun adapter.
/// @dev Fee splits are stored on-chain so PaymentRouter.sol can split entry
///      fees + settlement gas automatically when a ranked session closes.
contract GameRegistry {
    struct Game {
        bytes32 gameId;        // stable keccak identifier
        string title;          // human-readable name
        address devWallet;     // receives dev share of revenue
        uint16 devBps;         // dev cut (bps out of 10_000)
        uint16 platformBps;    // platform cut
        uint16 liquidityBps;   // liquidity pool cut
        uint16 treasuryBps;    // community treasury cut
        uint256 entryFeeMicroUsdc; // min entry fee ($0.25 = 250_000)
        bool playable;
        bool exists;
        uint256 registeredAt;
    }

    bytes32 public constant PLATFORM_OPERATOR_ROLE = keccak256("PLATFORM_OPERATOR");

    mapping(bytes32 => Game) public games;
    bytes32[] public registeredGameIds;
    address public operator;

    event GameRegistered(bytes32 indexed gameId, string title, address devWallet);
    event GameStatusChanged(bytes32 indexed gameId, bool playable);
    event FeeSplitUpdated(bytes32 indexed gameId, uint16 dev, uint16 platform, uint16 liquidity, uint16 treasury);

    modifier onlyOperator() {
        require(msg.sender == operator, "Only platform operator");
        _;
    }

    constructor(address _operator) {
        operator = _operator;
    }

    /// @notice Register a new cabinet. Operator-only.
    function registerGame(
        string calldata idString,
        string calldata title,
        address devWallet,
        uint16 devBps,
        uint16 platformBps,
        uint16 liquidityBps,
        uint16 treasuryBps,
        uint256 entryFeeMicroUsdc
    ) external onlyOperator {
        bytes32 gameId = keccak256(abi.encodePacked(idString));
        require(!games[gameId].exists, "Already registered");
        require(devBps + platformBps + liquidityBps + treasuryBps == 10_000, "Split must be 100%");
        require(devWallet != address(0), "Invalid dev wallet");

        games[gameId] = Game({
            gameId: gameId,
            title: title,
            devWallet: devWallet,
            devBps: devBps,
            platformBps: platformBps,
            liquidityBps: liquidityBps,
            treasuryBps: treasuryBps,
            entryFeeMicroUsdc: entryFeeMicroUsdc,
            playable: false,
            exists: true,
            registeredAt: block.timestamp
        });
        registeredGameIds.push(gameId);
        emit GameRegistered(gameId, title, devWallet);
    }

    /// @notice Mark a game playable (operator sign-off after integration review).
    function setPlayable(bytes32 gameId, bool playable) external onlyOperator {
        require(games[gameId].exists, "Not registered");
        games[gameId].playable = playable;
        emit GameStatusChanged(gameId, playable);
    }

    /// @notice Adjust fee split. Operator-only, still must total 10_000.
    function updateFeeSplit(
        bytes32 gameId,
        uint16 devBps,
        uint16 platformBps,
        uint16 liquidityBps,
        uint16 treasuryBps
    ) external onlyOperator {
        require(games[gameId].exists, "Not registered");
        require(devBps + platformBps + liquidityBps + treasuryBps == 10_000, "Split must be 100%");
        Game storage g = games[gameId];
        g.devBps = devBps;
        g.platformBps = platformBps;
        g.liquidityBps = liquidityBps;
        g.treasuryBps = treasuryBps;
        emit FeeSplitUpdated(gameId, devBps, platformBps, liquidityBps, treasuryBps);
    }

    /// @notice Read path for the catalog.
    function getGame(bytes32 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function registeredGameCount() external view returns (uint256) {
        return registeredGameIds.length;
    }
}
