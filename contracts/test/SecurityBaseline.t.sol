// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {PaymentRouter} from "../src/PaymentRouter.sol";
import {ArcadePaymentRouter} from "../src/ArcadePaymentRouter.sol";
import {SessionLedger} from "../src/SessionLedger.sol";
import {GameRegistry} from "../src/GameRegistry.sol";
import {ScoreSubmissionRegistry} from "../src/ScoreSubmissionRegistry.sol";
import {PlayerProfileRegistry} from "../src/PlayerProfileRegistry.sol";
import {AchievementRegistry} from "../src/AchievementRegistry.sol";
import {TournamentPool} from "../src/TournamentPool.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function expectRevert() external;
    function expectRevert(bytes calldata revertData) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function deal(address account, uint256 newBalance) external;
}

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "BALANCE");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "BALANCE");
        require(allowance[from][msg.sender] >= amount, "ALLOWANCE");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract SecurityBaselineTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant PLAYER_PK = 0xA11CE;
    uint256 private constant DEV_SIGNER_PK = 0xD00D;
    address private operator = address(0x1111);
    address private attacker = address(0xBEEF);
    bytes32 private gameId = keccak256(abi.encodePacked("hard-money-heroes"));

    MockERC20 private token;
    GameRegistry private registry;

    receive() external payable {}

    function setUp() public {
        token = new MockERC20();
        registry = new GameRegistry(operator);
        vm.prank(operator);
        registry.registerGame(
            "hard-money-heroes", "Hard Money Heroes", vm.addr(DEV_SIGNER_PK), 6000, 2000, 1000, 1000, 0
        );
        vm.prank(vm.addr(DEV_SIGNER_PK));
        registry.confirmDevWallet(gameId);
        vm.prank(operator);
        registry.setPlayable(gameId, true);
    }

    function testGameCannotBecomePlayableBeforeDevWalletConfirms() public {
        GameRegistry fresh = new GameRegistry(operator);
        bytes32 freshGameId = keccak256(abi.encodePacked("fresh-game"));

        vm.prank(operator);
        fresh.registerGame("fresh-game", "Fresh Game", vm.addr(DEV_SIGNER_PK), 6000, 2000, 1000, 1000, 0);

        vm.prank(operator);
        vm.expectRevert(bytes("Dev wallet unconfirmed"));
        fresh.setPlayable(freshGameId, true);
    }

    function testUnauthorizedSetDefaultVaultsReverts() public {
        PaymentRouter router = new PaymentRouter(address(registry), operator, address(token));

        vm.prank(attacker);
        vm.expectRevert();
        router.setDefaultVaults(address(0x1), address(0x2), address(0x3), address(0x4));
    }

    function testArcadePaymentRouterEntryFeeDisabledByDefault() public {
        ArcadePaymentRouter router = new ArcadePaymentRouter(address(registry), operator, address(token));
        address player = vm.addr(PLAYER_PK);
        token.mint(player, 100);

        vm.startPrank(player);
        token.approve(address(router), 100);
        vm.expectRevert(bytes("ENTRY_FEE_DISABLED"));
        router.startPaidSession(keccak256(abi.encodePacked("paid-session")), gameId, 100);
        vm.stopPrank();
    }

    function testNonPlayerCannotCloseSessionEvenWithValidSignature() public {
        address player = vm.addr(PLAYER_PK);
        SessionLedger ledger = new SessionLedger(address(registry), address(0xCAFE), address(token));
        token.mint(player, 100);

        vm.startPrank(player);
        token.approve(address(ledger), 100);
        bytes32 sessionId = ledger.openSession(gameId, 100);
        vm.stopPrank();

        SessionLedger.Session memory sess = ledger.getSession(sessionId);
        bytes32 structHash = keccak256(
            abi.encode(
                ledger.SESSION_TYPEHASH(),
                sess.gameId,
                sess.player,
                sess.openedAt,
                uint256(12345),
                uint256(12),
                uint256(90)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", ledger.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DEV_SIGNER_PK, digest);

        vm.prank(attacker);
        vm.expectRevert(bytes("Not the session owner"));
        ledger.closeSession(sessionId, 12345, 12, 90, v, r, s);
    }

    function testPlayerCannotCloseSessionWithRandomSigner() public {
        address player = vm.addr(PLAYER_PK);
        SessionLedger ledger = new SessionLedger(address(registry), address(0xCAFE), address(token));
        token.mint(player, 100);

        vm.startPrank(player);
        token.approve(address(ledger), 100);
        bytes32 sessionId = ledger.openSession(gameId, 100);
        vm.stopPrank();

        SessionLedger.Session memory sess = ledger.getSession(sessionId);
        bytes32 structHash = keccak256(
            abi.encode(
                ledger.SESSION_TYPEHASH(),
                sess.gameId,
                sess.player,
                sess.openedAt,
                uint256(12345),
                uint256(12),
                uint256(90)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", ledger.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD5A11, digest);

        vm.prank(player);
        vm.expectRevert(bytes("Unauthorized signer"));
        ledger.closeSession(sessionId, 12345, 12, 90, v, r, s);
    }

    function testScoreSubmissionRejectsOutOfBoundsScore() public {
        ScoreSubmissionRegistry scores = new ScoreSubmissionRegistry(address(registry));
        bytes32[] memory achievements = new bytes32[](0);

        vm.expectRevert();
        scores.submitSession(
            keccak256(abi.encodePacked("session-1")),
            gameId,
            type(uint256).max,
            type(uint64).max,
            type(uint64).max,
            type(uint64).max,
            bytes32(0),
            achievements
        );
    }

    function testScoreSubmissionRejectsUnplayableGameAndTooManyAchievements() public {
        ScoreSubmissionRegistry scores = new ScoreSubmissionRegistry(address(registry));
        bytes32[] memory achievements = new bytes32[](33);

        vm.expectRevert(bytes("TOO_MANY_ACHIEVEMENTS"));
        scores.submitSession(
            keccak256(abi.encodePacked("session-too-many")), gameId, 100, 1, 1, 60, bytes32(0), achievements
        );

        bytes32 missingGameId = keccak256(abi.encodePacked("missing-game"));
        bytes32[] memory none = new bytes32[](0);
        vm.expectRevert(bytes("GAME_NOT_PLAYABLE"));
        scores.submitSession(
            keccak256(abi.encodePacked("session-missing")), missingGameId, 100, 1, 1, 60, bytes32(0), none
        );
    }

    function testPaymentRouterSessionLedgerCanOnlyBeSetOnce() public {
        PaymentRouter router = new PaymentRouter(address(registry), operator, address(token));
        address firstLedger = address(0xCAFE);
        address secondLedger = address(0xB0B0);

        vm.prank(operator);
        router.setSessionLedger(firstLedger);

        vm.prank(operator);
        vm.expectRevert(bytes("ALREADY_SET"));
        router.setSessionLedger(secondLedger);
    }

    function testPaymentRouterOperatorTransferRequiresPendingOperatorAccept() public {
        PaymentRouter router = new PaymentRouter(address(registry), operator, address(token));
        address nextOperator = address(0x2222);

        vm.prank(operator);
        router.transferOperator(nextOperator);

        vm.prank(attacker);
        vm.expectRevert(bytes("Only pending operator"));
        router.acceptOperator();

        vm.prank(nextOperator);
        router.acceptOperator();

        assert(router.operator() == nextOperator);
        assert(router.pendingOperator() == address(0));
    }

    function testSessionLedgerSettleBeforeCloseReverts() public {
        address player = vm.addr(PLAYER_PK);
        PaymentRouter router = new PaymentRouter(address(registry), operator, address(token));
        SessionLedger ledger = new SessionLedger(address(registry), address(router), address(token));
        vm.prank(operator);
        router.setSessionLedger(address(ledger));

        token.mint(player, 100);
        vm.startPrank(player);
        token.approve(address(ledger), 100);
        bytes32 sessionId = ledger.openSession(gameId, 100);
        vm.expectRevert(bytes("Not closed yet"));
        ledger.settle(sessionId);
        vm.stopPrank();
    }

    function testSessionLedgerSettleAtomicallyRoutesVaultBalancesAndLeavesRouterEmpty() public {
        address player = vm.addr(PLAYER_PK);
        address devVault = vm.addr(DEV_SIGNER_PK);
        address platformVault = address(0x2000);
        address liquidityVault = address(0x3000);
        address treasuryVault = address(0x4000);
        uint256 entryFee = 1000;

        PaymentRouter router = new PaymentRouter(address(registry), operator, address(token));
        SessionLedger ledger = new SessionLedger(address(registry), address(router), address(token));
        vm.startPrank(operator);
        router.setSessionLedger(address(ledger));
        router.setDefaultVaults(devVault, platformVault, liquidityVault, treasuryVault);
        vm.stopPrank();

        token.mint(player, entryFee);
        vm.startPrank(player);
        token.approve(address(ledger), entryFee);
        bytes32 sessionId = ledger.openSession(gameId, entryFee);
        vm.stopPrank();

        SessionLedger.Session memory sess = ledger.getSession(sessionId);
        bytes32 structHash = keccak256(
            abi.encode(
                ledger.SESSION_TYPEHASH(),
                sess.gameId,
                sess.player,
                sess.openedAt,
                uint256(98765),
                uint256(44),
                uint256(180)
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", ledger.DOMAIN_SEPARATOR(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(DEV_SIGNER_PK, digest);

        vm.startPrank(player);
        ledger.closeSession(sessionId, 98765, 44, 180, v, r, s);
        ledger.settle(sessionId);
        vm.expectRevert(bytes("Already settled"));
        ledger.settle(sessionId);
        vm.stopPrank();

        assert(token.balanceOf(devVault) == 600);
        assert(token.balanceOf(platformVault) == 200);
        assert(token.balanceOf(liquidityVault) == 100);
        assert(token.balanceOf(treasuryVault) == 100);
        assert(token.balanceOf(address(router)) == 0);
        assert(token.balanceOf(address(ledger)) == 0);
    }

    function testPlayerProfileRegistryNormalizesHandles() public {
        PlayerProfileRegistry profiles = new PlayerProfileRegistry();
        address alice = address(0xA11CE);
        address bob = address(0xB0B);

        vm.prank(alice);
        profiles.registerProfile(" Alice  Hero ", "avatar://alice");

        vm.prank(bob);
        vm.expectRevert(bytes("Handle taken"));
        profiles.registerProfile("alice hero", "avatar://bob");
    }

    function testPlayerProfileRegistryRejectsBadHandles() public {
        PlayerProfileRegistry profiles = new PlayerProfileRegistry();

        vm.expectRevert(bytes("Handle too short"));
        profiles.registerProfile("ab", "avatar://short");

        vm.expectRevert(bytes("Handle too long"));
        profiles.registerProfile("abcdefghijklmnopqrs", "avatar://long");

        vm.expectRevert(bytes("Invalid handle char"));
        profiles.registerProfile("bad/slash", "avatar://bad");
    }

    function testAchievementRegistryRejectsZeroLedger() public {
        vm.expectRevert(bytes("Invalid ledger"));
        new AchievementRegistry(address(0));
    }

    function testTournamentPrizePoolCanBeWithdrawnByOwner() public {
        TournamentPool pool = new TournamentPool();
        bytes32 tournamentId = keccak256(abi.encodePacked("daily-open"));
        pool.createTournament(tournamentId, gameId, "Daily Open", 1, 2);

        vm.deal(address(this), 1 ether);
        pool.fundTournament{value: 1 ether}(tournamentId);

        uint256 beforeBalance = address(this).balance;
        pool.withdrawTournamentPrize(tournamentId, payable(address(this)), 0.4 ether);

        assert(address(this).balance == beforeBalance + 0.4 ether);
        (,,,,, uint256 prizePool,) = pool.tournaments(tournamentId);
        assert(prizePool == 0.6 ether);
    }
}
