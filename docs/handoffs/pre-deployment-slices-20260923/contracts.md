# Slice brief: contracts (wave 1, parallel with index and chikun-tune → achievements)

**Worktree:** `C:/Users/just_/lesters-arcade-wt/contracts`, branch `fable/pd-contracts`, base = the integration-branch commit that adds the contract doc on top of `06ebe4ca` (or `06ebe4ca` itself).

**Read first:**
- contract `docs/handoffs/pre-deployment-interface-contract-20260922.md` (if it is missing from your worktree, read `C:/Users/just_/lesters-arcade-fable0916/docs/handoffs/pre-deployment-interface-contract-20260922.md`) §1 (A19, A20, A21, A27, A28), §2.1, §8 (all), §9.1, §9.2 (the env names), §10, §11 (rules 12-13), §13 (the runbook your tools serve);
- guide §5.14 items 1-6 (minus the full E2E), §7 and §1.1-§1.2.

**Hard safety rule:** no transaction on LiteForge. No reading the vault file. No `--broadcast`. Everything runs against the in-process Hardhat chain or is a dry plan.

## Goal

1. Make deployment reproducible and the portal address source generated.
2. Port the Foundry `SecurityBaseline.t.sol` suite to Hardhat and `node:test`.
3. Add the owner's dev-wallet confirmation page and the phase-2 NFT definition script (written, never run).
4. Provide a local-chain deploy harness that the rehearsal slice extends.
5. Provide the operator and secret tooling the runbook (contract §13) needs, so the deploy session never improvises key-handling code: operator actions, Vercel secret piping, live cron calls. All written and tested locally, never run against LiteForge or Vercel here.

## Acceptance criteria

1. **`hardhat.config.js`** at the repo root configures the in-process EDR network with `chainId: 4441` (A21).
   - `const { provider } = await (await import('hardhat')).default.network.connect()` from the repo root returns `eth_chainId = 0x1159`.
   - No Solidity compile or download happens, and no network access is needed. A test proves both, offline.
   - Add `.gitignore` entries for any Hardhat cache directory it creates.
2. **`scripts/lib/local-chain.mjs`** exports:
   - `startLocalChain()` → `{ eip1193, provider /* ethers BrowserProvider or JsonRpcProvider-compatible */, wallets /* named fixture Wallets: operator, verifier, relayer, developer, platformVault, player1, player2, attacker */, setBalance, impersonate, increaseTime, mine, snapshot, revert, close }`. Wallets derive from the public Hardhat test mnemonic, and each is funded with `hardhat_setBalance`.
   - `deployLocalSuite({ provider, wallets, config })` deploys, **in the same order and with the same wiring as `scripts/deploy-contracts.mjs`**, the five-contract suite and the three collections, using the committed `contracts/artifacts/*.json`. It returns a record with the same shape as `contracts/deployment-record.hardened.json` (§8.1, including `blocks`, `startBlock` and `deployTxHashes`). Collections deploy **empty**: no `defineAchievement` call (D15).
   - `activateLocalGames({ provider, record, developer, operator })`: `confirmDevWallet(gameId32)` from the developer for each game, then `setPlayable(gameId32, true)` from the operator.
   - A parity test asserts that the sequence of wiring calls in `deployLocalSuite` matches the calls `scripts/deploy-contracts.mjs` makes: text-scan for each call's literal, e.g. `registry.setMinter(await scores.getAddress(), true)`.
3. **`tests/contracts-security-baseline.test.mjs`** ports all 34 cases of `contracts/test/SecurityBaseline.t.sol` (table in the contracts map §1.4; setup at `:60-101`), with one `test()` per Foundry case and the **same names** minus the `test` prefix.
   - Use `evm_snapshot` / `evm_revert` between cases, so the file runs in under 60 s.
   - Sign attestation digests with `new ethers.SigningKey(pk).sign(await scores.attestationDigest(run)).serialized`, using fixture keys for the verifier.
   - String reverts are `err.reason`; custom errors are `err.revert?.name` (`Soulbound`, OZ `ERC721NonexistentToken`).
   - No skips, even if Hardhat were missing (the gate forbids them).
4. **The generated address module** (A19, §8.1):
   - `scripts/generate-litvm-addresses.mjs` writes `apps/portal/src/generated/litvm-addresses.mjs`:
     - with `--predicted` (the default when no hardened record exists): from `contracts/deploy-config.testnet.json` `deployer` and `ethers.getCreateAddress` for nonces 0..6, `status:'predicted'`, `startBlock:null`;
     - otherwise from `contracts/deployment-record.hardened.json`, `status:'deployed'`.
   - Output is deterministic: lowercase addresses, a stable key order, a banner comment. It exports a pure `renderLitvmAddressModule(input) → string` for tests.
   - Commit the predicted module. Its addresses must equal the table in §8.1.
   - **Tests on the committed module pass for either status.** After runbook step 3 the module is regenerated with `status:'deployed'`. A test may assert "predicted and equal to the §8.1 table" **or** "deployed and consistent with `contracts/deployment-record.hardened.json`", never "predicted" alone; otherwise step 3's commit breaks the build.
5. **`scripts/deploy-contracts.mjs`:**
   - the record gains `blocks`, `startBlock` and `deployTxHashes` (§8.1), read from each contract's `deploymentTransaction()` receipt;
   - after writing the record, it calls the generator's exported writer, so a broadcast also regenerates the portal module;
   - **every literal pinned by `tests/deploy-contracts-security.test.mjs` stays byte-identical** (see the contracts map §1.5). Add code; do not restructure.
   - The dry run is unchanged. It still needs the live RPC; do not run it.
6. **`apps/portal/src/settlement.mjs`** builds `LITVM_CONTRACT_ADDRESSES` from `LITVM_DEPLOYMENT` with exactly the §8.1 key set. The legacy June keys are removed.
   - `SETTLEMENT_LIVE` and `HOSTED_PROFILE_SYNC` **stay `false`** as literal exports.
   - Add the invariant test "SETTLEMENT_LIVE implies HOSTED_PROFILE_SYNC and a deployed address module" (§9.1).
   - `apps/portal/src/litvm-chain-client.mjs`:
     - addresses from `LITVM_CONTRACT_ADDRESSES` as today, but `fetchPlayerAchievements` uses only `achievementRegistries[gameId]` (drop the legacy fallback at `:387`);
     - `pickReadProvider` (`:98-104`) **always** returns `new ethers.JsonRpcProvider(LITVM_LITEFORGE_NETWORK.rpcUrls.http, 4441)` for reads (guide §5.2 item 6), and ignores the wallet provider;
     - write paths keep using the wallet provider;
     - keep the function names `scoreContractAddress`, `readRankedContractGate`, `submitRankedSession`, `isBytes32Hex` and `toBytes32Id`: `tests/litvm-ranked-contract-gate.test.mjs` extracts them by name with acorn.
7. **Test and script updates:**
   - `tests/litvm-ranked-contract-gate.test.mjs` `:62-65` compares `LITVM_CONTRACT_ADDRESSES.gameRegistry` with the generated module (not the June record), and still asserts `SETTLEMENT_LIVE === false`.
   - `scripts/hmh-web3-settlement-audit.mjs` check `safe-ranked-live-gate` requires, when `SETTLEMENT_LIVE`, that `LITVM_DEPLOYMENT.status === 'deployed'` and all §8.1 addresses are non-null. Leave the other checks; ranked-client changes them in wave 3.
   - `scripts/hmh-web3-live-readiness.mjs` reads addresses from the generated module (today it reads a nonexistent `.splitConfig`).
   - `tests/settlement.test.mjs`: update any key-set assertions, and keep the flag and reserve pins.
8. **Owner page.** `apps/portal/owner/confirm-dev-wallet.html` has a `<meta name="robots" content="noindex">` and loads `./confirm-dev-wallet.mjs` as a module (no inline script). `confirm-dev-wallet.mjs` uses plain `window.ethereum` and the vendored ethers (`/vendor/ethers.min.js`, same origin, CSP-safe):
   1. `eth_requestAccounts`;
   2. switch or add chain 4441, with one clear explanation first;
   3. refuse unless the account is `0x07cec6fc49caf6528f2f2f796042629cd3f48b26` (case-insensitive), with a plain message;
   4. **gate on on-chain facts, not only the module status:** refuse unless `eth_getCode(addresses.gameRegistry)` over the public RPC is non-empty and `getGame(gameId32).exists` is true for every game. This works with a `deployed` module and also with the `predicted` module once the contracts exist at the predicted addresses;
   5. for each of the three games, read `getGame(gameId32).devWalletConfirmed` over the public RPC and skip games that are already confirmed;
   6. send `confirmDevWallet(gameId32)` (selector `0x33cf3157`), one per click, with the explorer link shown per transaction;
   7. show a summary that tells the owner the operator now activates the games (runbook step 5).

   Export a pure `buildConfirmCalls(deployment)` returning `[{ gameId, gameId32, to, data }]` for tests. The page must pass the portal CSP (`script-src 'self'`), and styles are inline only.

   **Where the owner opens it** (runbook step 4): production still serves 1.7.0 then, which has no owner page. From the step-3 commit the deploy session serves `apps/portal` locally (`python -m http.server 8791 --directory apps/portal`) and the owner opens `http://127.0.0.1:8791/owner/confirm-dev-wallet.html` in MetaMask or Rabby. Document this in `docs/web3/contract-overhaul-20260916.md`, and add a check that the page loads and passes its gate from a local static server against the local chain with the module regenerated as `deployed` (a Node test with a fake `window.ethereum` backed by the local chain is enough).
9. **Phase-2 script, written but never run.** `scripts/define-nft-achievements.mjs`:
   - exports `planNftDefinitions({ catalog /* [{gameId, id, title, category}] */, deployment, relayer, includeRelayerMinter })`, returning the ordered calls `defineAchievement(ethers.id(id), gameId32, title, category, '<id>.json')` per collection, plus optionally `setMinter(relayer, true)`;
   - its CLI does a dry run by default, getting the catalog with a dynamic `import('../apps/portal/src/achievements/index.mjs')` (`nftAchievementIds` and `catalogFor`; the achievements slice creates it in parallel);
   - broadcasting needs `--broadcast`, `LITVM_DEFINE_CONFIRM=DEFINE_NFT_ACHIEVEMENTS_4441`, and an operator key from an env var **name** given by the operator. Never read the vault, and never print or log the key.
   - Tests use a fixture catalog and the local chain: define, then `mintFor` from a minter succeeds, and the token URI is `baseTokenUri + '<id>.json'`.
10. **Docs.** Update `docs/web3/contract-overhaul-20260916.md`:
    - the reserve is 0.0001 zkLTC;
    - addresses come from `npm run contracts:addresses` (generated module), not hand edits;
    - keys are read from the vault inside the command, without echo;
    - owner-page usage and local hosting (acceptance 8);
    - the phase-2 define script;
    - the Vercel env table with the **new names** (`RANKED_VERIFIER_PRIVATE_KEY`, `RANKED_RELAYER_PRIVATE_KEY`, `RANKED_SCORE_REGISTRY_ADDRESS`), `CRON_SECRET`, `NEON_DATABASE_URL`, `SESSION_SECRET` (rotated at step 6, distinct per environment), `RPC_URL`, `SETTLEMENT_PAUSED`, `RANKED_MIN_PAID_WEI`, and the rule that the legacy names are never set (A28);
    - the emergency stops of contract §13, with the exact `operator-actions.mjs` commands, and the warning that `setEntryFeeEnabled(false)` is never a stop.
11. **`package.json` scripts:** `contracts:addresses` (generator) and `contracts:test:hardhat` (`node --test tests/contracts-security-baseline.test.mjs tests/local-deploy-harness.test.mjs`).
12. **Operator and secret tooling** (contract §11 rule 13). All are dry runs by default, act only with `--broadcast` or `--apply` plus a confirm phrase, read secrets only inside the process, never print them, and are tested against the local chain or fakes with fixture key files under the OS temp directory. **Never run them against LiteForge or Vercel in this slice.**
    - `scripts/lib/key-source.mjs`: `readSecret({ env, argv })` from `--key-env <NAME>` (reads `process.env[NAME]`) or `--key-file <path> --key-field <field>` (reads a JSON file and one field). It returns the value without logging it, validates the shape (0x + 64 hex for keys), and its errors never include the value or the file contents.
    - `scripts/operator-actions.mjs <action>` with actions `status` (read-only: operator nonce and balances, `quoteEntry`, `entryFeeEnabled`, `playable` and `devWalletConfirmed` per game, `relayers(relayer)`, `trustedVerifier`), `activate` (`setPlayable(id, true)` for each game whose dev wallet is confirmed; confirm phrase `ACTIVATE_GAMES_4441`), `pause-games` (`setPlayable(id, false)`; `PAUSE_GAMES_4441`), `fees-on` / `fees-off` (`setEntryFeeEnabled`; the help text warns that fees-off is not a stop), `reserve <wei>` (`setSettlementGasReserve`), `relayer-off` (`setRelayer(relayer, false)`; `RELAYER_OFF_4441`) and `rotate-verifier <address>` (`setTrustedVerifier` on the score registry; `ROTATE_VERIFIER_4441`). The address source is `LITVM_DEPLOYMENT`, which must be `deployed` for any broadcast. Tests run each action on the local chain.
    - `scripts/vercel-secrets.mjs`: plans and, with `--apply --confirm SET_PRODUCTION_SECRETS`, runs `vercel env add <NAME> production` with the value on **stdin** (spawn with piped stdio, never an argument) for `RANKED_VERIFIER_PRIVATE_KEY`, `RANKED_RELAYER_PRIVATE_KEY` and `RANKED_SCORE_REGISTRY_ADDRESS` (from `--key-file` fields and the deployment module), a fresh `CRON_SECRET` (32 random bytes, hex) that it also writes to a new file given by `--cron-secret-out <path>` (mode 0600 where supported), and a fresh `SESSION_SECRET` (`--rotate-session-secret`). It first runs `vercel env ls production` and refuses to continue if a legacy name (`VERIFIER_PRIVATE_KEY`, `RELAYER_PRIVATE_KEY`, `SCORE_REGISTRY_ADDRESS`) exists, printing only the names. The dry run prints names only. Tests inject a fake `spawn` and assert values travel only over stdin.
    - `scripts/live-cron.mjs --site <origin> --path </api/cron/…> (--secret-file <path> | --secret-env <NAME>)`: sends `Authorization: Bearer <secret>` and prints only the response's `ok`, `schemaVersion`, counts and status. Test against a local `node:http` server.

## Files

- **You own:** contract §10.2, row contracts.
- **Read-only:**
  - `contracts/src/**` (no contract changes, guide §5.14 item 5) and `contracts/artifacts/**`;
  - `contracts/deploy-config.testnet.json` (already correct);
  - `main.js`;
  - `api/**`, `server/**` (index owns `server/deployment.mjs`, which lazily imports your module);
  - `apps/portal/src/achievements/**` (parallel; dynamic import only).

## Interfaces

- **Produced:** `LITVM_DEPLOYMENT` (§8.1), consumed by index, settle, verify, the portal and rehearsal; `scripts/lib/local-chain.mjs`, consumed by settle's handler test and by rehearsal; `planNftDefinitions`, consumed by rehearsal's phase-2 script; the owner page.
- **Consumed:** artifacts, deploy config, and the catalog (lazily).

## Plan

1. `hardhat.config.js` and `scripts/lib/local-chain.mjs` `startLocalChain`, with a smoke test (`tests/local-deploy-harness.test.mjs`: "in-process chain runs offline on chain 4441").
2. `deployLocalSuite` and `activateLocalGames`, with tests:
   - "local suite wires registries, relayer, reserve and collections exactly like the deploy script";
   - "activation confirms dev wallets then sets games playable";
   - "quoteEntry returns fee plus reserve after activation";
   - "collections deploy empty and mintFor returns false for undefined ids".
3. The security baseline port (acceptance 3). Commit.
4. The generator and the committed predicted module; `settlement.mjs` and `litvm-chain-client.mjs` changes; test and script updates; the invariant test. Commit.
5. The `deploy-contracts.mjs` record additions and generator call, with the pinned-literal suite green. Commit.
6. The owner page and its test (`tests/owner-confirm-page.test.mjs`: "confirm calls encode confirmDevWallet for all three games"; "page is noindex, CSP-safe and module-only"; "page refuses non-owner accounts and undeployed modules", tested with a fake `window.ethereum`).
7. `define-nft-achievements.mjs` and its test (`tests/define-nft-achievements.test.mjs`).
8. The operator and secret tooling (acceptance 12) with `tests/operator-tooling.test.mjs`: "key source reads env names and JSON fields without echoing them"; "operator actions dry-run by default and need the confirm phrase"; "activate, pause-games, relayer-off and rotate-verifier change the local chain as named"; "vercel secrets travel only over stdin and legacy names block the run"; "live cron prints only status and counts". Commit.
9. Docs, package scripts, and `scripts/syntax-check.mjs` entries immediately after `"scripts/deploy-contracts.mjs",` (also register `apps/portal/owner/confirm-dev-wallet.mjs`, `hardhat.config.js` and the new scripts).

## Verification

```
node --test tests/contracts-security-baseline.test.mjs tests/local-deploy-harness.test.mjs tests/litvm-*.test.mjs tests/deploy-contracts-security.test.mjs tests/settlement.test.mjs tests/owner-confirm-page.test.mjs tests/define-nft-achievements.test.mjs tests/operator-tooling.test.mjs
npm run contracts:addresses -- --predicted && git diff --exit-code apps/portal/src/generated/litvm-addresses.mjs
npm test && npm run check && npm run contracts:check && npm run build && npm run test:release   # exactly 51
```

Browser check: serve `apps/portal` (`python -m http.server 8802 --directory apps/portal`), open `/owner/confirm-dev-wallet.html` with no wallet, and see the friendly "install a wallet" state and a clean console. With a wallet on LiteForge, the "contracts not deployed yet" refusal must show, because nothing exists at the predicted addresses before the broadcast.

## Pitfalls

- **`deploy-contracts.mjs` has top-level side effects** (it reads the config and requires the live RPC and the legacy archive). Do **not** import it from tests. The local harness is a separate module that mirrors it, and the parity test text-scans the script.
- **The deploy script must never mention `lestersArcadeCore`** (pinned), and no `console.*` line may mention `PRIVATE_KEY`.
- **The session key includes `scoreRegistryAddress`.** Predicted addresses keep preview session keys equal to the post-deploy ones, as long as the operator nonce stays at 0 (guide §1.1). Do not use the operator key.
- **Hardhat on Vercel.** `hardhat` is a devDependency that the Vercel build also installs, and `test:release` runs these tests there. They must stay offline and quick.
- **`mintFor` from a non-minter reverts the whole settlement.** The score registry is a minter by deploy. The relayer becomes one only in phase 2.
- **`isPaid` is true even for zero-fee sessions.** Tests must enable fees, as the baseline does.

## Definition of done

- Acceptance criteria 1-12 hold, and all 34 baseline cases pass on Hardhat.
- The predicted module is committed, and `SETTLEMENT_LIVE` and `HOSTED_PROFILE_SYNC` are still `false`.
- The gate shows exactly 51. Do not commit the gate JSON.
- The syntax-check entries are added.
- No chain writes outside the in-process chain.
