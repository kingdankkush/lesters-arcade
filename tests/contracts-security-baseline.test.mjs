// Hardhat port of contracts/test/SecurityBaseline.t.sol (Foundry is not installed, so the forge suite
// never ran; guide §5.14 item 6). One test() per Foundry case, same name minus the `test` prefix.
// Same setUp (:60-101): two registered and activated games, vaults, the 0.02 zkLTC reserve of the
// baseline, per-game collections with one defined achievement each, and an allow-listed relayer.
// Runs on the in-process chain (chainId 4441, offline) with evm_snapshot / evm_revert between cases.
//
// vm.prank(x) -> a fixture wallet (or an impersonated address for the score registry);
// vm.expectRevert(bytes("X")) -> err.reason === 'X'; custom errors -> the decoded revert name;
// vm.sign -> new ethers.SigningKey(pk).sign(await scores.attestationDigest(run)).serialized;
// vm.warp -> evm_increaseTime.
import test, { after, afterEach, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { ethers } from 'ethers';
import { loadArtifact, localWalletKeys, startLocalChain } from '../scripts/lib/local-chain.mjs';

const ENTRY_FEE = ethers.parseEther('0.1');
const GAS_RESERVE = ethers.parseEther('0.02');
const ENTRY_TOTAL = ENTRY_FEE + GAS_RESERVE;
const BAD_SIGNER_PK = ethers.zeroPadValue('0x0bad5a11', 32);
const TREASURY_VAULT = '0x0000000000000000000000000000000000003000';
const RELAYER_VAULT = '0x0000000000000000000000000000000000004000';
const gameId = ethers.id('lester-blaster');
const otherGameId = ethers.id('chikun');
const achievementFirstBlood = ethers.id('first-blood');
const achievementEggRun = ethers.id('egg-run');

let chain;
let snapshotId;
let operator; let attacker; let relayer; let player; let devWallet; let player2;
let platformVault;
let registry; let entry; let scores; let achievements; let otherAchievements;
const verifierKey = localWalletKeys().verifier;

async function deployContract(name, args, signer = operator) {
  const artifact = loadArtifact(name);
  const contract = await new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer).deploy(...args);
  await contract.waitForDeployment();
  return contract;
}

async function send(promise) {
  return (await promise).wait();
}

function revertNameOf(error, contract) {
  if (error?.revert?.name) return error.revert.name;
  const data = typeof error?.data === 'string' ? error.data : null;
  if (!data || !contract) return null;
  try {
    return contract.interface.parseError(data)?.name ?? null;
  } catch {
    return null;
  }
}

// vm.expectRevert(bytes(reason)) or vm.expectRevert(Custom.selector) (custom + contract).
async function expectRevert(action, { reason, custom, contract } = {}) {
  let caught = null;
  try {
    await (typeof action === 'function' ? action() : action);
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `expected a revert${reason ? ` with "${reason}"` : ''}${custom ? ` with ${custom}()` : ''}`);
  if (reason !== undefined) assert.equal(caught.reason, reason, `revert reason: ${caught.shortMessage ?? caught.message}`);
  if (custom !== undefined) assert.equal(revertNameOf(caught, contract), custom, `custom error: ${caught.shortMessage ?? caught.message}`);
  return caught;
}

const balanceOf = (address) => chain.provider.getBalance(address);

async function runFor(sessionId, forGameId, unlocked) {
  const now = await chain.latestTimestamp();
  return {
    sessionId,
    gameId: forGameId,
    player: player.address,
    score: 12345n,
    kills: 12n,
    maxCombo: 7n,
    survivalSeconds: 90n,
    bossId: ethers.id('rug-pull-baron'),
    envelopeHash: ethers.id('canonical-envelope'),
    runtimeId: ethers.id('hmh-runtime-1'),
    seasonId: ethers.id('season-1'),
    deadline: BigInt(now + 3600),
    achievementsHash: ethers.solidityPackedKeccak256(['bytes32[]'], [unlocked]),
  };
}
const run = (sessionId, unlocked) => runFor(sessionId, gameId, unlocked);

async function sign(privateKey, verifiedRun) {
  return new ethers.SigningKey(privateKey).sign(await scores.attestationDigest(verifiedRun)).serialized;
}

async function openPaidFor(sessionId, forGameId) {
  await send(entry.connect(player).openSession(sessionId, forGameId, { value: ENTRY_TOTAL }));
}
const openPaid = (sessionId) => openPaidFor(sessionId, gameId);

// Foundry's vm.prank(address(scores)): the score registry is the collections' minter.
async function asScoreRegistry() {
  return chain.impersonate(await scores.getAddress());
}

before(async () => {
  chain = await startLocalChain();
  ({ operator, attacker, relayer, player1: player, developer: devWallet, player2 } = chain.wallets);
  platformVault = chain.wallets.platformVault.address;

  registry = await deployContract('GameRegistry', [operator.address]);
  entry = await deployContract('ArcadeRankedEntry', [await registry.getAddress(), operator.address]);
  scores = await deployContract('ScoreSubmissionRegistry', [await registry.getAddress(), await entry.getAddress(), chain.wallets.verifier.address, operator.address]);
  achievements = await deployContract('AchievementRegistry', [operator.address, 'Hard Money Heroes Achievements', 'HMHACH', 'https://lestersarcade.io/achievements/lester-blaster/']);
  otherAchievements = await deployContract('AchievementRegistry', [operator.address, "Chikun's Escape Achievements", 'CHKACH', 'https://lestersarcade.io/achievements/chikun/']);

  // Owner decision 2026-09-16: 85% developer / 15% treasury for every game.
  await send(registry.registerGame('lester-blaster', 'Hard Money Heroes', devWallet.address, 8500, 0, 0, 1500, ENTRY_FEE));
  await send(registry.registerGame('chikun', "Chikun's Escape", devWallet.address, 8500, 0, 0, 1500, ENTRY_FEE));
  await send(entry.setPlatformVaults(platformVault, ethers.ZeroAddress, TREASURY_VAULT));
  await send(entry.setRelayerVault(RELAYER_VAULT));
  await send(entry.setSettlementGasReserve(GAS_RESERVE));
  await send(achievements.setMinter(await scores.getAddress(), true));
  await send(otherAchievements.setMinter(await scores.getAddress(), true));
  await send(achievements.defineAchievement(achievementFirstBlood, gameId, 'First Blood', 'combat', 'first-blood.json'));
  await send(otherAchievements.defineAchievement(achievementEggRun, otherGameId, 'Egg Run', 'escape', 'egg-run.json'));
  await send(scores.setAchievementRegistry(gameId, await achievements.getAddress()));
  await send(scores.setAchievementRegistry(otherGameId, await otherAchievements.getAddress()));
  await send(scores.setRelayer(relayer.address, true));

  await send(registry.connect(devWallet).confirmDevWallet(gameId));
  await send(registry.connect(devWallet).confirmDevWallet(otherGameId));
  await send(registry.setPlayable(gameId, true));
  await send(registry.setPlayable(otherGameId, true));

  await chain.setBalance(player.address, ethers.parseEther('10'));
});

beforeEach(async () => {
  snapshotId = await chain.snapshot();
});

afterEach(async () => {
  await chain.revert(snapshotId);
});

after(async () => {
  await chain?.close();
});

// ------------------------------------------------------------------
// GameRegistry
// ------------------------------------------------------------------

test('GameCannotBecomePlayableBeforeDevWalletConfirms', async () => {
  const fresh = await deployContract('GameRegistry', [operator.address]);
  const freshGameId = ethers.id('fresh-game');
  await send(fresh.registerGame('fresh-game', 'Fresh Game', devWallet.address, 8500, 0, 0, 1500, ENTRY_FEE));
  await expectRevert(() => fresh.setPlayable(freshGameId, true), { reason: 'Dev wallet unconfirmed' });
});

test('OnlyOperatorCanSetEntryFee', async () => {
  await expectRevert(() => registry.connect(attacker).setEntryFee(gameId, 1), { reason: 'Only platform operator' });
  await send(registry.setEntryFee(gameId, 2n * ENTRY_FEE));
  assert.equal((await registry.getGame(gameId)).entryFeeWei, 2n * ENTRY_FEE);
});

// ------------------------------------------------------------------
// ArcadeRankedEntry
// ------------------------------------------------------------------

test('QuoteEntryIsFlatFeePlusSettlementReserve', async () => {
  const [fee, reserve, total] = await entry.quoteEntry(gameId);
  assert.equal(fee, ENTRY_FEE);
  assert.equal(reserve, GAS_RESERVE);
  assert.equal(total, ENTRY_TOTAL);
});

test('QuoteEntryRevertsForUnknownGame', async () => {
  await expectRevert(() => entry.quoteEntry(ethers.id('nope')), { reason: 'GAME_NOT_REGISTERED' });
});

test('ExactTotalOpensSessionSplits85_15AndForwardsReserve', async () => {
  const sessionId = ethers.id('paid-1');
  const devBefore = await balanceOf(devWallet.address);
  const platformBefore = await balanceOf(platformVault);
  const treasuryBefore = await balanceOf(TREASURY_VAULT);
  const relayerVaultBefore = await balanceOf(RELAYER_VAULT);

  await openPaid(sessionId);

  assert.equal(await entry.isPaid(sessionId, player.address, gameId), true);
  assert.equal(await entry.isPaid(sessionId, attacker.address, gameId), false);
  // Flat 0.1 fee: 85% developer, 15% treasury, 0% platform.
  assert.equal(await balanceOf(devWallet.address), devBefore + ethers.parseEther('0.085'));
  assert.equal(await balanceOf(TREASURY_VAULT), treasuryBefore + ethers.parseEther('0.015'));
  assert.equal(await balanceOf(platformVault), platformBefore);
  // Reserve goes whole to the relayer vault; the flat split never touches it.
  assert.equal(await balanceOf(RELAYER_VAULT), relayerVaultBefore + GAS_RESERVE);
  assert.equal(await balanceOf(await entry.getAddress()), 0n);
  const paid = await entry.getPaidSession(sessionId);
  assert.equal(paid.amountWei, ENTRY_TOTAL);
  assert.equal(paid.player, player.address);
});

test('WrongTotalReverts', async () => {
  // Flat fee alone (missing the reserve) is not enough.
  await expectRevert(() => entry.connect(player).openSession(ethers.id('flat-only'), gameId, { value: ENTRY_FEE }), { reason: 'WRONG_ENTRY_FEE' });
  await expectRevert(() => entry.connect(player).openSession(ethers.id('under'), gameId, { value: ENTRY_TOTAL - 1n }), { reason: 'WRONG_ENTRY_FEE' });
  await expectRevert(() => entry.connect(player).openSession(ethers.id('over'), gameId, { value: ENTRY_TOTAL + 1n }), { reason: 'WRONG_ENTRY_FEE' });
  await expectRevert(() => entry.connect(player).openSession(ethers.id('zero'), gameId), { reason: 'WRONG_ENTRY_FEE' });
});

test('ZeroReserveMeansFlatFeeOnly', async () => {
  await send(entry.setSettlementGasReserve(0));
  const relayerVaultBefore = await balanceOf(RELAYER_VAULT);

  const [, , total] = await entry.quoteEntry(gameId);
  assert.equal(total, ENTRY_FEE);

  await expectRevert(() => entry.connect(player).openSession(ethers.id('with-reserve'), gameId, { value: ENTRY_TOTAL }), { reason: 'WRONG_ENTRY_FEE' });

  await send(entry.connect(player).openSession(ethers.id('flat'), gameId, { value: ENTRY_FEE }));
  assert.equal(await entry.isPaid(ethers.id('flat'), player.address, gameId), true);
  assert.equal(await balanceOf(RELAYER_VAULT), relayerVaultBefore);
});

test('ReserveRequiresRelayerVault', async () => {
  const fresh = await deployContract('ArcadeRankedEntry', [await registry.getAddress(), operator.address]);

  await expectRevert(() => fresh.setSettlementGasReserve(GAS_RESERVE), { reason: 'RELAYER_VAULT_UNSET' });

  await send(fresh.setRelayerVault(RELAYER_VAULT));
  await send(fresh.setSettlementGasReserve(GAS_RESERVE));
  await expectRevert(() => fresh.setRelayerVault(ethers.ZeroAddress), { reason: 'RELAYER_VAULT_REQUIRED' });
  assert.equal(await fresh.relayerVault(), ethers.getAddress(RELAYER_VAULT));
  assert.equal(await fresh.settlementGasReserveWei(), GAS_RESERVE);
});

test('OnlyOperatorCanSetReserveAndRelayerVault', async () => {
  await expectRevert(() => entry.connect(attacker).setSettlementGasReserve(1), { reason: 'Only platform operator' });
  await expectRevert(() => entry.connect(attacker).setRelayerVault(attacker.address), { reason: 'Only platform operator' });
});

test('SessionReuseReverts', async () => {
  const sessionId = ethers.id('reuse');
  await openPaid(sessionId);

  await expectRevert(() => entry.connect(player).openSession(sessionId, gameId, { value: ENTRY_TOTAL }), { reason: 'SESSION_EXISTS' });

  await chain.setBalance(attacker.address, ethers.parseEther('1'));
  await expectRevert(() => entry.connect(attacker).openSession(sessionId, gameId, { value: ENTRY_TOTAL }), { reason: 'SESSION_EXISTS' });
});

test('EntryFeeDisabledRequiresZeroValue', async () => {
  await send(entry.setEntryFeeEnabled(false));

  await expectRevert(() => entry.connect(player).openSession(ethers.id('free-paid'), gameId, { value: ENTRY_TOTAL }), { reason: 'ENTRY_FEE_DISABLED' });

  const [fee, reserve, total] = await entry.quoteEntry(gameId);
  assert.deepEqual([fee, reserve, total], [0n, 0n, 0n]);

  await send(entry.connect(player).openSession(ethers.id('free'), gameId));
  assert.equal(await entry.isPaid(ethers.id('free'), player.address, gameId), true);
});

test('UnauthorizedVaultChangeReverts', async () => {
  await expectRevert(() => entry.connect(attacker).setPlatformVaults(attacker.address, attacker.address, attacker.address), { reason: 'Only platform operator' });
});

// ------------------------------------------------------------------
// ScoreSubmissionRegistry
// ------------------------------------------------------------------

test('VerifiedSubmissionRecordsScoreAndMintsSoulboundAchievement', async () => {
  const sessionId = ethers.id('verified-1');
  await openPaid(sessionId);
  const unlocked = [achievementFirstBlood];
  const verifiedRun = await run(sessionId, unlocked);
  const sig = await sign(verifierKey, verifiedRun);

  await send(scores.connect(player).submitVerifiedSession(verifiedRun, unlocked, sig));

  const record = await scores.getSession(sessionId);
  assert.equal(record.verified && record.exists, true);
  assert.equal(record.player, player.address);
  assert.equal(await scores.sessionEnvelopeHash(sessionId), verifiedRun.envelopeHash);
  assert.equal(await scores.bestScore(gameId, player.address), 12345n);
  assert.equal(await scores.bestSeasonScore(gameId, verifiedRun.seasonId, player.address), 12345n);
  assert.equal(await achievements.hasUnlocked(player.address, achievementFirstBlood), true);
  assert.equal(await achievements.ownerOf(await achievements.tokenIdFor(player.address, achievementFirstBlood)), player.address);
  assert.equal((await scores.getSessionAchievements(sessionId)).length, 1);
});

test('AchievementsMintThroughTheGamesOwnRegistry', async () => {
  // A Chikun run mints in the Chikun collection only.
  const chikunSession = ethers.id('chikun-1');
  await openPaidFor(chikunSession, otherGameId);
  const unlocked = [achievementEggRun];
  const chikunRun = await runFor(chikunSession, otherGameId, unlocked);
  await send(scores.connect(player).submitVerifiedSession(chikunRun, unlocked, await sign(verifierKey, chikunRun)));
  assert.equal(await otherAchievements.hasUnlocked(player.address, achievementEggRun), true);
  assert.equal(await achievements.hasUnlocked(player.address, achievementEggRun), false);
  assert.equal(await achievements.balanceOf(player.address), 0n);
  assert.equal(await otherAchievements.balanceOf(player.address), 1n);

  // The same id attested for an HMH run does not mint: it is undefined in the HMH collection, and the
  // HMH registry never consults the Chikun one. The score still settles.
  const hmhSession = ethers.id('hmh-1');
  await openPaid(hmhSession);
  const hmhRun = await run(hmhSession, unlocked);
  await send(scores.connect(player).submitVerifiedSession(hmhRun, unlocked, await sign(verifierKey, hmhRun)));
  assert.equal((await scores.getSession(hmhSession)).exists, true);
  assert.equal((await scores.getSessionAchievements(hmhSession)).length, 1);
  assert.equal(await achievements.balanceOf(player.address), 0n);
  assert.equal(await otherAchievements.balanceOf(player.address), 1n);
});

test('UnsetAchievementRegistrySkipsMintingButSettlesScore', async () => {
  await send(scores.setAchievementRegistry(gameId, ethers.ZeroAddress));
  assert.equal(await scores.achievementRegistryByGame(gameId), ethers.ZeroAddress);

  const sessionId = ethers.id('no-registry');
  await openPaid(sessionId);
  const unlocked = [achievementFirstBlood];
  const verifiedRun = await run(sessionId, unlocked);
  await send(scores.connect(player).submitVerifiedSession(verifiedRun, unlocked, await sign(verifierKey, verifiedRun)));

  assert.equal((await scores.getSession(sessionId)).verified, true);
  assert.equal((await scores.getSessionAchievements(sessionId)).length, 1);
  assert.equal(await achievements.hasUnlocked(player.address, achievementFirstBlood), false);
});

test('OnlyOperatorCanRouteAchievementRegistries', async () => {
  await expectRevert(() => scores.connect(attacker).setAchievementRegistry(gameId, attacker.address), { reason: 'Only platform operator' });
  const hmhCollection = await achievements.getAddress();
  await expectRevert(() => scores.setAchievementRegistry(ethers.ZeroHash, hmhCollection), { reason: 'EMPTY_GAME_ID' });
});

test('UnpaidSessionCannotSubmitWhenFeeIsSet', async () => {
  const verifiedRun = await run(ethers.id('unpaid'), []);
  const sig = await sign(verifierKey, verifiedRun);
  await expectRevert(() => scores.connect(player).submitVerifiedSession(verifiedRun, [], sig), { reason: 'SESSION_NOT_PAID' });
});

test('BadSignerReverts', async () => {
  const sessionId = ethers.id('forged');
  await openPaid(sessionId);
  const verifiedRun = await run(sessionId, []);
  const sig = await sign(BAD_SIGNER_PK, verifiedRun);
  await expectRevert(() => scores.connect(player).submitVerifiedSession(verifiedRun, [], sig), { reason: 'INVALID_ATTESTATION' });
});

test('ExpiredDeadlineReverts', async () => {
  const sessionId = ethers.id('expired');
  await openPaid(sessionId);
  const verifiedRun = await run(sessionId, []);
  const sig = await sign(verifierKey, verifiedRun);

  // vm.warp(run.deadline + 1): move the chain clock past the deadline.
  const now = await chain.latestTimestamp();
  await chain.increaseTime(Number(verifiedRun.deadline) - now + 1);
  await chain.mine();
  assert.ok(await chain.latestTimestamp() > Number(verifiedRun.deadline));
  await expectRevert(() => scores.connect(player).submitVerifiedSession(verifiedRun, [], sig), { reason: 'ATTESTATION_EXPIRED' });
});

test('AchievementsHashMismatchReverts', async () => {
  const sessionId = ethers.id('hash-mismatch');
  await openPaid(sessionId);
  const attested = [achievementFirstBlood];
  const verifiedRun = await run(sessionId, attested);
  const sig = await sign(verifierKey, verifiedRun);
  const tampered = [achievementFirstBlood, ethers.id('not-attested')];
  await expectRevert(() => scores.connect(player).submitVerifiedSession(verifiedRun, tampered, sig), { reason: 'ACHIEVEMENTS_HASH_MISMATCH' });
});

test('TamperedScoreRevertsAsInvalidAttestation', async () => {
  const sessionId = ethers.id('tampered-score');
  await openPaid(sessionId);
  const verifiedRun = await run(sessionId, []);
  const sig = await sign(verifierKey, verifiedRun);
  const tampered = { ...verifiedRun, score: 999_999n };
  await expectRevert(() => scores.connect(player).submitVerifiedSession(tampered, [], sig), { reason: 'INVALID_ATTESTATION' });
});

test('RelayerCanSubmitForPlayerButStrangerCannot', async () => {
  const sessionId = ethers.id('relayed');
  await openPaid(sessionId);
  const verifiedRun = await run(sessionId, []);
  const sig = await sign(verifierKey, verifiedRun);

  assert.equal(await scores.relayers(relayer.address), true);
  assert.equal(await scores.relayers(attacker.address), false);

  await expectRevert(() => scores.connect(attacker).submitVerifiedSession(verifiedRun, [], sig), { reason: 'NOT_PLAYER_OR_RELAYER' });

  // Relayer path: nothing but the attestation. No value is attached (the function is non-payable) and
  // the relayer's gas is funded by the settlement reserve forwarded to relayerVault at entry.
  await send(scores.connect(relayer).submitVerifiedSession(verifiedRun, [], sig));
  assert.equal((await scores.getSession(sessionId)).player, player.address);
  assert.equal(await scores.playerSessionCount(player.address), 1n);
});

test('SessionCannotBeSettledTwice', async () => {
  const sessionId = ethers.id('double-settle');
  await openPaid(sessionId);
  const verifiedRun = await run(sessionId, []);
  const sig = await sign(verifierKey, verifiedRun);

  await send(scores.connect(player).submitVerifiedSession(verifiedRun, [], sig));
  await expectRevert(() => scores.connect(player).submitVerifiedSession(verifiedRun, [], sig), { reason: 'SESSION_EXISTS' });
});

test('OutOfBoundsScoreRejectedEvenWhenAttested', async () => {
  const sessionId = ethers.id('oob');
  await openPaid(sessionId);
  const verifiedRun = { ...(await run(sessionId, [])), score: (await scores.MAX_SCORE()) + 1n };
  const sig = await sign(verifierKey, verifiedRun);
  await expectRevert(() => scores.connect(player).submitVerifiedSession(verifiedRun, [], sig), { reason: 'SCORE_OUT_OF_BOUNDS' });
});

// ------------------------------------------------------------------
// AchievementRegistry (soulbound)
// ------------------------------------------------------------------

test('SoulboundTransferReverts', async () => {
  const minter = achievements.connect(await asScoreRegistry());
  assert.equal(await minter.mintFor.staticCall(player.address, achievementFirstBlood, ethers.id('s')), true);
  await send(minter.mintFor(player.address, achievementFirstBlood, ethers.id('s')));
  const tokenId = await achievements.tokenIdFor(player.address, achievementFirstBlood);
  assert.equal(await achievements.locked(tokenId), true);
  assert.equal(await achievements.supportsInterface('0xb45a3c0e'), true);

  const asPlayer = achievements.connect(player);
  await expectRevert(() => asPlayer.transferFrom(player.address, attacker.address, tokenId), { custom: 'Soulbound', contract: achievements });
  await expectRevert(() => asPlayer['safeTransferFrom(address,address,uint256)'](player.address, attacker.address, tokenId), { custom: 'Soulbound', contract: achievements });
});

test('DoubleMintReturnsFalseWithoutRevert', async () => {
  const minter = achievements.connect(await asScoreRegistry());
  assert.equal(await minter.mintFor.staticCall(player.address, achievementFirstBlood, ethers.id('s1')), true);
  await send(minter.mintFor(player.address, achievementFirstBlood, ethers.id('s1')));
  assert.equal(await minter.mintFor.staticCall(player.address, achievementFirstBlood, ethers.id('s2')), false);
  await send(minter.mintFor(player.address, achievementFirstBlood, ethers.id('s2')));
  assert.equal(await minter.mintFor.staticCall(player.address, ethers.id('undefined-achievement'), ethers.id('s3')), false);
  await send(minter.mintFor(player.address, ethers.id('undefined-achievement'), ethers.id('s3')));
  assert.equal(await achievements.balanceOf(player.address), 1n);
});

test('OnlyMinterCanMint', async () => {
  await expectRevert(() => achievements.connect(attacker).mintFor(attacker.address, achievementFirstBlood, ethers.id('x')), { reason: 'Only minter' });
});

test('RevokeBurnsAndClearsUnlock', async () => {
  await send(achievements.connect(await asScoreRegistry()).mintFor(player.address, achievementFirstBlood, ethers.id('s')));
  const tokenId = await achievements.tokenIdFor(player.address, achievementFirstBlood);

  await expectRevert(() => achievements.connect(attacker).revoke(tokenId, 'nope'), { reason: 'Only platform operator' });

  await send(achievements.revoke(tokenId, 'fraudulent run'));

  assert.equal(await achievements.hasUnlocked(player.address, achievementFirstBlood), false);
  assert.equal(await achievements.balanceOf(player.address), 0n);
  await expectRevert(() => achievements.ownerOf(tokenId), { custom: 'ERC721NonexistentToken', contract: achievements });
});

test('OwnerCanBurnOwnToken', async () => {
  await send(achievements.connect(await asScoreRegistry()).mintFor(player.address, achievementFirstBlood, ethers.id('s')));
  const tokenId = await achievements.tokenIdFor(player.address, achievementFirstBlood);

  await expectRevert(() => achievements.connect(attacker).burn(tokenId), { reason: 'Only token owner' });

  await send(achievements.connect(player).burn(tokenId));
  assert.equal(await achievements.hasUnlocked(player.address, achievementFirstBlood), false);
});

test('TokenUriComposesBaseAndPath', async () => {
  await send(achievements.connect(await asScoreRegistry()).mintFor(player.address, achievementFirstBlood, ethers.id('s')));
  const tokenId = await achievements.tokenIdFor(player.address, achievementFirstBlood);
  assert.equal(await achievements.tokenURI(tokenId), 'https://lestersarcade.io/achievements/lester-blaster/first-blood.json');
});

test('EachCollectionCarriesItsOwnNameAndSymbol', async () => {
  assert.equal(await achievements.name(), 'Hard Money Heroes Achievements');
  assert.equal(await achievements.symbol(), 'HMHACH');
  assert.equal(await otherAchievements.name(), "Chikun's Escape Achievements");
  assert.equal(await otherAchievements.symbol(), 'CHKACH');
});

test('CollectionRejectsEmptyNameOrSymbol', async () => {
  await expectRevert(() => deployContract('AchievementRegistry', [operator.address, '', 'X', 'https://lestersarcade.io/achievements/x/']), { reason: 'EMPTY_NAME' });
  await expectRevert(() => deployContract('AchievementRegistry', [operator.address, 'X', '', 'https://lestersarcade.io/achievements/x/']), { reason: 'EMPTY_SYMBOL' });
});

// ------------------------------------------------------------------
// PlayerProfileRegistry (unchanged contract)
// ------------------------------------------------------------------

test('PlayerProfileRegistryNormalizesHandles', async () => {
  const profiles = await deployContract('PlayerProfileRegistry', []);
  const alice = player;
  const bob = player2;

  await send(profiles.connect(alice).registerProfile(' Alice  Hero ', 'avatar://alice'));
  await expectRevert(() => profiles.connect(bob).registerProfile('alice hero', 'avatar://bob'), { reason: 'Handle taken' });
});

test('PlayerProfileRegistryRejectsBadHandles', async () => {
  const profiles = await deployContract('PlayerProfileRegistry', []);
  const caller = profiles.connect(player2);

  await expectRevert(() => caller.registerProfile('ab', 'avatar://short'), { reason: 'Handle too short' });
  await expectRevert(() => caller.registerProfile('abcdefghijklmnopqrs', 'avatar://long'), { reason: 'Handle too long' });
  await expectRevert(() => caller.registerProfile('bad/slash', 'avatar://bad'), { reason: 'Invalid handle char' });
});
