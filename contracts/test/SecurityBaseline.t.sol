// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {GameRegistry} from "../src/GameRegistry.sol";
import {ArcadeRankedEntry} from "../src/ArcadeRankedEntry.sol";
import {AchievementRegistry} from "../src/AchievementRegistry.sol";
import {ScoreSubmissionRegistry} from "../src/ScoreSubmissionRegistry.sol";
import {PlayerProfileRegistry} from "../src/PlayerProfileRegistry.sol";

interface Vm {
    function addr(uint256 privateKey) external returns (address);
    function prank(address msgSender) external;
    function startPrank(address msgSender) external;
    function stopPrank() external;
    function expectRevert() external;
    function expectRevert(bytes calldata revertData) external;
    function expectRevert(bytes4 revertData) external;
    function sign(uint256 privateKey, bytes32 digest) external returns (uint8 v, bytes32 r, bytes32 s);
    function deal(address account, uint256 newBalance) external;
    function warp(uint256 newTimestamp) external;
}

/// @notice Forge security baseline for the 2026-09 native-fee / EIP-712 / soulbound contract set, with the
///         2026-09-16 owner decisions: fee = flat entry fee + settlement gas reserve (exact msg.value),
///         85/15 developer/treasury split, one soulbound achievement collection per game, relayer-settled
///         scores.
/// @dev    Run with `forge test` (foundry). Not runnable in the solc-js-only CI image.
contract SecurityBaselineTest {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    uint256 private constant PLAYER_PK = 0xA11CE;
    uint256 private constant VERIFIER_PK = 0xD00D;
    uint256 private constant DEV_WALLET_PK = 0xDE7;
    uint256 private constant ENTRY_FEE = 0.1 ether;
    uint256 private constant GAS_RESERVE = 0.02 ether;
    uint256 private constant ENTRY_TOTAL = ENTRY_FEE + GAS_RESERVE;

    address private operator = address(0x1111);
    address private attacker = address(0xBEEF);
    address private relayer = address(0x5E1A);
    address private platformVault = address(0x2000);
    address private treasuryVault = address(0x3000);
    address private relayerVault = address(0x4000);
    bytes32 private gameId = keccak256(abi.encodePacked("lester-blaster"));
    bytes32 private otherGameId = keccak256(abi.encodePacked("chikun"));
    bytes32 private achievementFirstBlood = keccak256("first-blood");
    bytes32 private achievementEggRun = keccak256("egg-run");

    GameRegistry private registry;
    ArcadeRankedEntry private entry;
    AchievementRegistry private achievements;
    AchievementRegistry private otherAchievements;
    ScoreSubmissionRegistry private scores;
    address private player;
    address private verifier;
    address private devWallet;

    receive() external payable {}

    function setUp() public {
        player = vm.addr(PLAYER_PK);
        verifier = vm.addr(VERIFIER_PK);
        devWallet = vm.addr(DEV_WALLET_PK);

        registry = new GameRegistry(operator);
        entry = new ArcadeRankedEntry(address(registry), operator);
        scores = new ScoreSubmissionRegistry(address(registry), address(entry), verifier, operator);
        achievements = new AchievementRegistry(
            operator, "Hard Money Heroes Achievements", "HMHACH", "https://lestersarcade.io/achievements/lester-blaster/"
        );
        otherAchievements = new AchievementRegistry(
            operator, "Chikun's Escape Achievements", "CHKACH", "https://lestersarcade.io/achievements/chikun/"
        );

        vm.startPrank(operator);
        // Owner decision 2026-09-16: 85% developer / 15% treasury for every game.
        registry.registerGame("lester-blaster", "Hard Money Heroes", devWallet, 8500, 0, 0, 1500, ENTRY_FEE);
        registry.registerGame("chikun", "Chikun's Escape", devWallet, 8500, 0, 0, 1500, ENTRY_FEE);
        entry.setPlatformVaults(platformVault, address(0), treasuryVault);
        entry.setRelayerVault(relayerVault);
        entry.setSettlementGasReserve(GAS_RESERVE);
        achievements.setMinter(address(scores), true);
        otherAchievements.setMinter(address(scores), true);
        achievements.defineAchievement(achievementFirstBlood, gameId, "First Blood", "combat", "first-blood.json");
        otherAchievements.defineAchievement(achievementEggRun, otherGameId, "Egg Run", "escape", "egg-run.json");
        scores.setAchievementRegistry(gameId, address(achievements));
        scores.setAchievementRegistry(otherGameId, address(otherAchievements));
        scores.setRelayer(relayer, true);
        vm.stopPrank();

        vm.startPrank(devWallet);
        registry.confirmDevWallet(gameId);
        registry.confirmDevWallet(otherGameId);
        vm.stopPrank();
        vm.startPrank(operator);
        registry.setPlayable(gameId, true);
        registry.setPlayable(otherGameId, true);
        vm.stopPrank();

        vm.deal(player, 10 ether);
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function _run(bytes32 sessionId, bytes32[] memory unlocked)
        private
        view
        returns (ScoreSubmissionRegistry.VerifiedRun memory)
    {
        return _runFor(sessionId, gameId, unlocked);
    }

    function _runFor(bytes32 sessionId, bytes32 forGameId, bytes32[] memory unlocked)
        private
        view
        returns (ScoreSubmissionRegistry.VerifiedRun memory)
    {
        return ScoreSubmissionRegistry.VerifiedRun({
            sessionId: sessionId,
            gameId: forGameId,
            player: player,
            score: 12345,
            kills: 12,
            maxCombo: 7,
            survivalSeconds: 90,
            bossId: keccak256("rug-pull-baron"),
            envelopeHash: keccak256("canonical-envelope"),
            runtimeId: keccak256("hmh-runtime-1"),
            seasonId: keccak256("season-1"),
            deadline: uint64(block.timestamp + 1 hours),
            achievementsHash: keccak256(abi.encodePacked(unlocked))
        });
    }

    function _sign(uint256 pk, ScoreSubmissionRegistry.VerifiedRun memory run) private returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, scores.attestationDigest(run));
        return abi.encodePacked(r, s, v);
    }

    function _openPaid(bytes32 sessionId) private {
        _openPaidFor(sessionId, gameId);
    }

    function _openPaidFor(bytes32 sessionId, bytes32 forGameId) private {
        vm.prank(player);
        entry.openSession{value: ENTRY_TOTAL}(sessionId, forGameId);
    }

    // ------------------------------------------------------------------
    // GameRegistry
    // ------------------------------------------------------------------

    function testGameCannotBecomePlayableBeforeDevWalletConfirms() public {
        GameRegistry fresh = new GameRegistry(operator);
        bytes32 freshGameId = keccak256(abi.encodePacked("fresh-game"));

        vm.prank(operator);
        fresh.registerGame("fresh-game", "Fresh Game", devWallet, 8500, 0, 0, 1500, ENTRY_FEE);

        vm.prank(operator);
        vm.expectRevert(bytes("Dev wallet unconfirmed"));
        fresh.setPlayable(freshGameId, true);
    }

    function testOnlyOperatorCanSetEntryFee() public {
        vm.prank(attacker);
        vm.expectRevert(bytes("Only platform operator"));
        registry.setEntryFee(gameId, 1);

        vm.prank(operator);
        registry.setEntryFee(gameId, 2 * ENTRY_FEE);
        assert(registry.getGame(gameId).entryFeeWei == 2 * ENTRY_FEE);
    }

    // ------------------------------------------------------------------
    // ArcadeRankedEntry
    // ------------------------------------------------------------------

    function testQuoteEntryIsFlatFeePlusSettlementReserve() public view {
        (uint256 fee, uint256 reserve, uint256 total) = entry.quoteEntry(gameId);
        assert(fee == ENTRY_FEE && reserve == GAS_RESERVE && total == ENTRY_TOTAL);
    }

    function testQuoteEntryRevertsForUnknownGame() public {
        vm.expectRevert(bytes("GAME_NOT_REGISTERED"));
        entry.quoteEntry(keccak256("nope"));
    }

    function testExactTotalOpensSessionSplits85_15AndForwardsReserve() public {
        bytes32 sessionId = keccak256("paid-1");
        uint256 devBefore = devWallet.balance;
        uint256 platformBefore = platformVault.balance;
        uint256 treasuryBefore = treasuryVault.balance;
        uint256 relayerVaultBefore = relayerVault.balance;

        _openPaid(sessionId);

        assert(entry.isPaid(sessionId, player, gameId));
        assert(!entry.isPaid(sessionId, attacker, gameId));
        // Flat 0.1 fee: 85% developer, 15% treasury, 0% platform.
        assert(devWallet.balance == devBefore + 0.085 ether);
        assert(treasuryVault.balance == treasuryBefore + 0.015 ether);
        assert(platformVault.balance == platformBefore);
        // Reserve goes whole to the relayer vault; the flat split never touches it.
        assert(relayerVault.balance == relayerVaultBefore + GAS_RESERVE);
        assert(address(entry).balance == 0);
        ArcadeRankedEntry.PaidSession memory paid = entry.getPaidSession(sessionId);
        assert(paid.amountWei == ENTRY_TOTAL && paid.player == player);
    }

    function testWrongTotalReverts() public {
        // Flat fee alone (missing the reserve) is not enough.
        vm.prank(player);
        vm.expectRevert(bytes("WRONG_ENTRY_FEE"));
        entry.openSession{value: ENTRY_FEE}(keccak256("flat-only"), gameId);

        vm.prank(player);
        vm.expectRevert(bytes("WRONG_ENTRY_FEE"));
        entry.openSession{value: ENTRY_TOTAL - 1}(keccak256("under"), gameId);

        vm.prank(player);
        vm.expectRevert(bytes("WRONG_ENTRY_FEE"));
        entry.openSession{value: ENTRY_TOTAL + 1}(keccak256("over"), gameId);

        vm.prank(player);
        vm.expectRevert(bytes("WRONG_ENTRY_FEE"));
        entry.openSession(keccak256("zero"), gameId);
    }

    function testZeroReserveMeansFlatFeeOnly() public {
        vm.prank(operator);
        entry.setSettlementGasReserve(0);
        uint256 relayerVaultBefore = relayerVault.balance;

        (,, uint256 total) = entry.quoteEntry(gameId);
        assert(total == ENTRY_FEE);

        vm.prank(player);
        vm.expectRevert(bytes("WRONG_ENTRY_FEE"));
        entry.openSession{value: ENTRY_TOTAL}(keccak256("with-reserve"), gameId);

        vm.prank(player);
        entry.openSession{value: ENTRY_FEE}(keccak256("flat"), gameId);
        assert(entry.isPaid(keccak256("flat"), player, gameId));
        assert(relayerVault.balance == relayerVaultBefore);
    }

    function testReserveRequiresRelayerVault() public {
        ArcadeRankedEntry fresh = new ArcadeRankedEntry(address(registry), operator);

        vm.prank(operator);
        vm.expectRevert(bytes("RELAYER_VAULT_UNSET"));
        fresh.setSettlementGasReserve(GAS_RESERVE);

        vm.startPrank(operator);
        fresh.setRelayerVault(relayerVault);
        fresh.setSettlementGasReserve(GAS_RESERVE);
        vm.expectRevert(bytes("RELAYER_VAULT_REQUIRED"));
        fresh.setRelayerVault(address(0));
        vm.stopPrank();
        assert(fresh.relayerVault() == relayerVault && fresh.settlementGasReserveWei() == GAS_RESERVE);
    }

    function testOnlyOperatorCanSetReserveAndRelayerVault() public {
        vm.prank(attacker);
        vm.expectRevert(bytes("Only platform operator"));
        entry.setSettlementGasReserve(1);

        vm.prank(attacker);
        vm.expectRevert(bytes("Only platform operator"));
        entry.setRelayerVault(attacker);
    }

    function testSessionReuseReverts() public {
        bytes32 sessionId = keccak256("reuse");
        _openPaid(sessionId);

        vm.prank(player);
        vm.expectRevert(bytes("SESSION_EXISTS"));
        entry.openSession{value: ENTRY_TOTAL}(sessionId, gameId);

        vm.deal(attacker, 1 ether);
        vm.prank(attacker);
        vm.expectRevert(bytes("SESSION_EXISTS"));
        entry.openSession{value: ENTRY_TOTAL}(sessionId, gameId);
    }

    function testEntryFeeDisabledRequiresZeroValue() public {
        vm.prank(operator);
        entry.setEntryFeeEnabled(false);

        vm.prank(player);
        vm.expectRevert(bytes("ENTRY_FEE_DISABLED"));
        entry.openSession{value: ENTRY_TOTAL}(keccak256("free-paid"), gameId);

        (uint256 fee, uint256 reserve, uint256 total) = entry.quoteEntry(gameId);
        assert(fee == 0 && reserve == 0 && total == 0);

        vm.prank(player);
        entry.openSession(keccak256("free"), gameId);
        assert(entry.isPaid(keccak256("free"), player, gameId));
    }

    function testUnauthorizedVaultChangeReverts() public {
        vm.prank(attacker);
        vm.expectRevert(bytes("Only platform operator"));
        entry.setPlatformVaults(attacker, attacker, attacker);
    }

    // ------------------------------------------------------------------
    // ScoreSubmissionRegistry
    // ------------------------------------------------------------------

    function testVerifiedSubmissionRecordsScoreAndMintsSoulboundAchievement() public {
        bytes32 sessionId = keccak256("verified-1");
        _openPaid(sessionId);
        bytes32[] memory unlocked = new bytes32[](1);
        unlocked[0] = achievementFirstBlood;
        ScoreSubmissionRegistry.VerifiedRun memory run = _run(sessionId, unlocked);
        bytes memory sig = _sign(VERIFIER_PK, run);

        vm.prank(player);
        scores.submitVerifiedSession(run, unlocked, sig);

        ScoreSubmissionRegistry.ScoreRecord memory record = scores.getSession(sessionId);
        assert(record.verified && record.exists && record.player == player);
        assert(scores.sessionEnvelopeHash(sessionId) == run.envelopeHash);
        assert(scores.bestScore(gameId, player) == 12345);
        assert(scores.bestSeasonScore(gameId, run.seasonId, player) == 12345);
        assert(achievements.hasUnlocked(player, achievementFirstBlood));
        assert(achievements.ownerOf(achievements.tokenIdFor(player, achievementFirstBlood)) == player);
        assert(scores.getSessionAchievements(sessionId).length == 1);
    }

    function testAchievementsMintThroughTheGamesOwnRegistry() public {
        // A Chikun run mints in the Chikun collection only.
        bytes32 chikunSession = keccak256("chikun-1");
        _openPaidFor(chikunSession, otherGameId);
        bytes32[] memory unlocked = new bytes32[](1);
        unlocked[0] = achievementEggRun;
        ScoreSubmissionRegistry.VerifiedRun memory run = _runFor(chikunSession, otherGameId, unlocked);
        vm.prank(player);
        scores.submitVerifiedSession(run, unlocked, _sign(VERIFIER_PK, run));
        assert(otherAchievements.hasUnlocked(player, achievementEggRun));
        assert(!achievements.hasUnlocked(player, achievementEggRun));
        assert(achievements.balanceOf(player) == 0 && otherAchievements.balanceOf(player) == 1);

        // The same id attested for an HMH run does not mint: it is undefined in the HMH collection, and the
        // HMH registry never consults the Chikun one. The score still settles.
        bytes32 hmhSession = keccak256("hmh-1");
        _openPaid(hmhSession);
        ScoreSubmissionRegistry.VerifiedRun memory hmhRun = _run(hmhSession, unlocked);
        vm.prank(player);
        scores.submitVerifiedSession(hmhRun, unlocked, _sign(VERIFIER_PK, hmhRun));
        assert(scores.getSession(hmhSession).exists);
        assert(scores.getSessionAchievements(hmhSession).length == 1);
        assert(achievements.balanceOf(player) == 0 && otherAchievements.balanceOf(player) == 1);
    }

    function testUnsetAchievementRegistrySkipsMintingButSettlesScore() public {
        vm.prank(operator);
        scores.setAchievementRegistry(gameId, address(0));
        assert(scores.achievementRegistryByGame(gameId) == address(0));

        bytes32 sessionId = keccak256("no-registry");
        _openPaid(sessionId);
        bytes32[] memory unlocked = new bytes32[](1);
        unlocked[0] = achievementFirstBlood;
        ScoreSubmissionRegistry.VerifiedRun memory run = _run(sessionId, unlocked);
        vm.prank(player);
        scores.submitVerifiedSession(run, unlocked, _sign(VERIFIER_PK, run));

        assert(scores.getSession(sessionId).verified);
        assert(scores.getSessionAchievements(sessionId).length == 1);
        assert(!achievements.hasUnlocked(player, achievementFirstBlood));
    }

    function testOnlyOperatorCanRouteAchievementRegistries() public {
        vm.prank(attacker);
        vm.expectRevert(bytes("Only platform operator"));
        scores.setAchievementRegistry(gameId, attacker);

        vm.prank(operator);
        vm.expectRevert(bytes("EMPTY_GAME_ID"));
        scores.setAchievementRegistry(bytes32(0), address(achievements));
    }

    function testUnpaidSessionCannotSubmitWhenFeeIsSet() public {
        bytes32[] memory none = new bytes32[](0);
        ScoreSubmissionRegistry.VerifiedRun memory run = _run(keccak256("unpaid"), none);
        bytes memory sig = _sign(VERIFIER_PK, run);

        vm.prank(player);
        vm.expectRevert(bytes("SESSION_NOT_PAID"));
        scores.submitVerifiedSession(run, none, sig);
    }

    function testBadSignerReverts() public {
        bytes32 sessionId = keccak256("forged");
        _openPaid(sessionId);
        bytes32[] memory none = new bytes32[](0);
        ScoreSubmissionRegistry.VerifiedRun memory run = _run(sessionId, none);
        bytes memory sig = _sign(0xBAD5A11, run);

        vm.prank(player);
        vm.expectRevert(bytes("INVALID_ATTESTATION"));
        scores.submitVerifiedSession(run, none, sig);
    }

    function testExpiredDeadlineReverts() public {
        bytes32 sessionId = keccak256("expired");
        _openPaid(sessionId);
        bytes32[] memory none = new bytes32[](0);
        ScoreSubmissionRegistry.VerifiedRun memory run = _run(sessionId, none);
        bytes memory sig = _sign(VERIFIER_PK, run);

        vm.warp(run.deadline + 1);
        vm.prank(player);
        vm.expectRevert(bytes("ATTESTATION_EXPIRED"));
        scores.submitVerifiedSession(run, none, sig);
    }

    function testAchievementsHashMismatchReverts() public {
        bytes32 sessionId = keccak256("hash-mismatch");
        _openPaid(sessionId);
        bytes32[] memory attested = new bytes32[](1);
        attested[0] = achievementFirstBlood;
        ScoreSubmissionRegistry.VerifiedRun memory run = _run(sessionId, attested);
        bytes memory sig = _sign(VERIFIER_PK, run);

        bytes32[] memory tampered = new bytes32[](2);
        tampered[0] = achievementFirstBlood;
        tampered[1] = keccak256("not-attested");

        vm.prank(player);
        vm.expectRevert(bytes("ACHIEVEMENTS_HASH_MISMATCH"));
        scores.submitVerifiedSession(run, tampered, sig);
    }

    function testTamperedScoreRevertsAsInvalidAttestation() public {
        bytes32 sessionId = keccak256("tampered-score");
        _openPaid(sessionId);
        bytes32[] memory none = new bytes32[](0);
        ScoreSubmissionRegistry.VerifiedRun memory run = _run(sessionId, none);
        bytes memory sig = _sign(VERIFIER_PK, run);
        run.score = 999_999;

        vm.prank(player);
        vm.expectRevert(bytes("INVALID_ATTESTATION"));
        scores.submitVerifiedSession(run, none, sig);
    }

    function testRelayerCanSubmitForPlayerButStrangerCannot() public {
        bytes32 sessionId = keccak256("relayed");
        _openPaid(sessionId);
        bytes32[] memory none = new bytes32[](0);
        ScoreSubmissionRegistry.VerifiedRun memory run = _run(sessionId, none);
        bytes memory sig = _sign(VERIFIER_PK, run);

        assert(scores.relayers(relayer) && !scores.relayers(attacker));

        vm.prank(attacker);
        vm.expectRevert(bytes("NOT_PLAYER_OR_RELAYER"));
        scores.submitVerifiedSession(run, none, sig);

        // Relayer path: nothing but the attestation. No value is attached (function is non-payable) and the
        // relayer's gas is funded by the settlement reserve forwarded to relayerVault at entry.
        vm.prank(relayer);
        scores.submitVerifiedSession(run, none, sig);
        assert(scores.getSession(sessionId).player == player);
        assert(scores.playerSessionCount(player) == 1);
    }

    function testSessionCannotBeSettledTwice() public {
        bytes32 sessionId = keccak256("double-settle");
        _openPaid(sessionId);
        bytes32[] memory none = new bytes32[](0);
        ScoreSubmissionRegistry.VerifiedRun memory run = _run(sessionId, none);
        bytes memory sig = _sign(VERIFIER_PK, run);

        vm.prank(player);
        scores.submitVerifiedSession(run, none, sig);

        vm.prank(player);
        vm.expectRevert(bytes("SESSION_EXISTS"));
        scores.submitVerifiedSession(run, none, sig);
    }

    function testOutOfBoundsScoreRejectedEvenWhenAttested() public {
        bytes32 sessionId = keccak256("oob");
        _openPaid(sessionId);
        bytes32[] memory none = new bytes32[](0);
        ScoreSubmissionRegistry.VerifiedRun memory run = _run(sessionId, none);
        run.score = scores.MAX_SCORE() + 1;
        bytes memory sig = _sign(VERIFIER_PK, run);

        vm.prank(player);
        vm.expectRevert(bytes("SCORE_OUT_OF_BOUNDS"));
        scores.submitVerifiedSession(run, none, sig);
    }

    // ------------------------------------------------------------------
    // AchievementRegistry (soulbound)
    // ------------------------------------------------------------------

    function testSoulboundTransferReverts() public {
        vm.prank(address(scores));
        assert(achievements.mintFor(player, achievementFirstBlood, keccak256("s")));
        uint256 tokenId = achievements.tokenIdFor(player, achievementFirstBlood);
        assert(achievements.locked(tokenId));
        assert(achievements.supportsInterface(0xb45a3c0e));

        vm.prank(player);
        vm.expectRevert(AchievementRegistry.Soulbound.selector);
        achievements.transferFrom(player, attacker, tokenId);

        vm.prank(player);
        vm.expectRevert(AchievementRegistry.Soulbound.selector);
        achievements.safeTransferFrom(player, attacker, tokenId);
    }

    function testDoubleMintReturnsFalseWithoutRevert() public {
        vm.startPrank(address(scores));
        assert(achievements.mintFor(player, achievementFirstBlood, keccak256("s1")));
        assert(!achievements.mintFor(player, achievementFirstBlood, keccak256("s2")));
        assert(!achievements.mintFor(player, keccak256("undefined-achievement"), keccak256("s3")));
        vm.stopPrank();
        assert(achievements.balanceOf(player) == 1);
    }

    function testOnlyMinterCanMint() public {
        vm.prank(attacker);
        vm.expectRevert(bytes("Only minter"));
        achievements.mintFor(attacker, achievementFirstBlood, keccak256("x"));
    }

    function testRevokeBurnsAndClearsUnlock() public {
        vm.prank(address(scores));
        achievements.mintFor(player, achievementFirstBlood, keccak256("s"));
        uint256 tokenId = achievements.tokenIdFor(player, achievementFirstBlood);

        vm.prank(attacker);
        vm.expectRevert(bytes("Only platform operator"));
        achievements.revoke(tokenId, "nope");

        vm.prank(operator);
        achievements.revoke(tokenId, "fraudulent run");

        assert(!achievements.hasUnlocked(player, achievementFirstBlood));
        assert(achievements.balanceOf(player) == 0);
        vm.expectRevert();
        achievements.ownerOf(tokenId);
    }

    function testOwnerCanBurnOwnToken() public {
        vm.prank(address(scores));
        achievements.mintFor(player, achievementFirstBlood, keccak256("s"));
        uint256 tokenId = achievements.tokenIdFor(player, achievementFirstBlood);

        vm.prank(attacker);
        vm.expectRevert(bytes("Only token owner"));
        achievements.burn(tokenId);

        vm.prank(player);
        achievements.burn(tokenId);
        assert(!achievements.hasUnlocked(player, achievementFirstBlood));
    }

    function testTokenUriComposesBaseAndPath() public {
        vm.prank(address(scores));
        achievements.mintFor(player, achievementFirstBlood, keccak256("s"));
        uint256 tokenId = achievements.tokenIdFor(player, achievementFirstBlood);
        assert(
            keccak256(bytes(achievements.tokenURI(tokenId)))
                == keccak256(bytes("https://lestersarcade.io/achievements/lester-blaster/first-blood.json"))
        );
    }

    function testEachCollectionCarriesItsOwnNameAndSymbol() public view {
        assert(keccak256(bytes(achievements.name())) == keccak256(bytes("Hard Money Heroes Achievements")));
        assert(keccak256(bytes(achievements.symbol())) == keccak256(bytes("HMHACH")));
        assert(keccak256(bytes(otherAchievements.name())) == keccak256(bytes("Chikun's Escape Achievements")));
        assert(keccak256(bytes(otherAchievements.symbol())) == keccak256(bytes("CHKACH")));
    }

    function testCollectionRejectsEmptyNameOrSymbol() public {
        vm.expectRevert(bytes("EMPTY_NAME"));
        new AchievementRegistry(operator, "", "X", "https://lestersarcade.io/achievements/x/");
        vm.expectRevert(bytes("EMPTY_SYMBOL"));
        new AchievementRegistry(operator, "X", "", "https://lestersarcade.io/achievements/x/");
    }

    // ------------------------------------------------------------------
    // PlayerProfileRegistry (unchanged contract)
    // ------------------------------------------------------------------

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
}
