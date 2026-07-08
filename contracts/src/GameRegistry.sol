// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GameRegistry
/// @author Lester's Arcade Core
/// @notice Cabinet registry for Lester's Arcade. Only approved and confirmed games can participate in shared identity + ranked sessions.
contract GameRegistry {
    struct Game {
        bytes32 gameId;
        string title;
        address devWallet;
        uint16 devBps;
        uint16 platformBps;
        uint16 liquidityBps;
        uint16 treasuryBps;
        uint256 entryFeeMicroUsdc;
        bool devWalletConfirmed;
        bool playable;
        bool exists;
        uint256 registeredAt;
    }

    bytes32 public constant PLATFORM_OPERATOR_ROLE = keccak256("PLATFORM_OPERATOR");

    mapping(bytes32 => Game) public games;
    bytes32[] public registeredGameIds;
    address public operator;
    address public pendingOperator;
    address public trustedVerifier;

    event GameRegistered(bytes32 indexed gameId, string title, address devWallet);
    event DevWalletConfirmed(bytes32 indexed gameId, address indexed devWallet);
    event GameStatusChanged(bytes32 indexed gameId, bool playable);
    event FeeSplitUpdated(bytes32 indexed gameId, uint16 dev, uint16 platform, uint16 liquidity, uint16 treasury);
    event TrustedVerifierUpdated(address indexed trustedVerifier);
    event OperatorTransferStarted(address indexed currentOperator, address indexed pendingOperator);
    event OperatorTransferred(address indexed previousOperator, address indexed newOperator);

    modifier onlyOperator() {
        require(msg.sender == operator, "Only platform operator");
        _;
    }

    constructor(address _operator) {
        require(_operator != address(0), "Invalid operator");
        operator = _operator;
        trustedVerifier = _operator;
    }

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
            devWalletConfirmed: false,
            playable: false,
            exists: true,
            registeredAt: block.timestamp
        });
        registeredGameIds.push(gameId);
        emit GameRegistered(gameId, title, devWallet);
    }

    function confirmDevWallet(bytes32 gameId) external {
        Game storage game = games[gameId];
        require(game.exists, "Not registered");
        require(msg.sender == game.devWallet, "Only dev wallet");
        game.devWalletConfirmed = true;
        emit DevWalletConfirmed(gameId, msg.sender);
    }

    function setPlayable(bytes32 gameId, bool playable) external onlyOperator {
        Game storage game = games[gameId];
        require(game.exists, "Not registered");
        if (playable) {
            require(game.devWalletConfirmed, "Dev wallet unconfirmed");
        }
        game.playable = playable;
        emit GameStatusChanged(gameId, playable);
    }

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

    function setTrustedVerifier(address verifier) external onlyOperator {
        require(verifier != address(0), "Invalid verifier");
        trustedVerifier = verifier;
        emit TrustedVerifierUpdated(verifier);
    }

    function transferOperator(address newOperator) external onlyOperator {
        require(newOperator != address(0), "Invalid operator");
        pendingOperator = newOperator;
        emit OperatorTransferStarted(operator, newOperator);
    }

    function acceptOperator() external {
        require(msg.sender == pendingOperator, "Only pending operator");
        address previous = operator;
        operator = pendingOperator;
        pendingOperator = address(0);
        emit OperatorTransferred(previous, operator);
    }

    function getGame(bytes32 gameId) external view returns (Game memory) {
        return games[gameId];
    }

    function registeredGameCount() external view returns (uint256) {
        return registeredGameIds.length;
    }
}
