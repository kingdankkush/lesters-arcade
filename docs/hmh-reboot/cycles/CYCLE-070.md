# HMH AAA Continuous Improvement Cycle 070

Date: `2026-09-01`
Status: `PAUSE SOUNDTRACK TRANSPORT CERTIFIED · PREVIEW VERIFIED · PRODUCTION LIVE`
Branch: `hermes/hmh-cycle-070-gameplay-ui-music`
Base: `origin/main @ a17c37cd`
Runtime commit: `200757e2092b4632903affde91df53a1b56ad72a`

## Bounded slice

Restore Lester's Arcade's portal-owned soundtrack controls during Hard Money Heroes gameplay without adding a competing music owner to the HMH child runtime. The shared player remains hidden during active combat and becomes a pause-only sidecar on desktop or a collapsible drawer/launcher on portrait mobile.

## Contract

- The portal remains the sole playlist and HTML audio owner.
- Active HMH gameplay never shows the soundtrack deck.
- Paused gameplay exposes play/pause, previous/next, shuffle, mute, seek, volume, elapsed time, duration, and queue.
- Music enabled and volume remain synchronized with versioned HMH player settings.
- User volume is clamped to `[0, 1]` and multiplied by context gain: gameplay `0.55`, game over `0.26`, menu/default `0.38`.
- Desktop pause geometry keeps the deck outside the primary pause panel.
- Portrait mobile uses a 44 px music launcher and a contained expanded drawer; collapse restores direct access to pause actions.
- Seek and volume range controls expose at least 44 px pointer/touch targets.
- The local E2E media server supports byte-range responses so real MP3 seeking is exercised rather than mocked.

## Changed source

- `apps/portal/src/arcade-music-transport.mjs`
- `apps/portal/main.js`
- `apps/portal/index.html`
- `apps/portal/styles.css`
- `scripts/hmh-reboot-portal-e2e.mjs`
- `package.json`
- `tests/arcade-music-transport.test.mjs`
- `tests/arcade-core.test.mjs`
- `scripts/pixellab-hmh-aaa-quality-wave.py`
- `apps/portal/sw.js`
- `scripts/smoke-portal-flow.mjs`
- `scripts/smoke-portal-interactions.mjs`
- `tests/hmh-load-speed.test.mjs`
- `tests/hmh-reboot-shell.test.mjs`
- `README.md`
- `tests/hmh-reboot-portal-e2e-contract.test.mjs` (exercised, unchanged)

## Verification

| Gate | Result |
|---|---|
| transport helpers | 3/3 PASS |
| focused portal/lifecycle/E2E contracts | 14/14 PASS |
| syntax | PASS: 361 JavaScript modules + 49 Python scripts |
| release retirement gate | PASS: 2,282 tests; 2,231 passed; 51 expected legacy failures; 0 unexpected |
| production build | PASS |
| HMH initial JS | `948.5 KB / 1.00 MB`; `76.9 KB` headroom |
| visual regression | PASS: 12/12 scenes unchanged; zero changed cells |
| release browser certification | PASS: desktop, ultrawide, tablet landscape, mobile portrait, mobile landscape |
| mobile controls | PASS: 4/4 device profiles |
| production asset QA | PASS: hero, selector, enemy/boss roster, and prop atlases within aggregate budgets |
| performance smoke | PASS: desktop/mobile p95 `7 ms`; no runtime long tasks or errors |
| network/console audit | PASS: 4/4 clean/warm scenarios; 0 HTTP, request, console, or page errors |
| security | PASS: static audit 5/5 with 0 findings; third-party sandbox 3/3 |
| Web3 read-only | source audit PASS 9/9; live readiness intentionally PARTIAL 3/4 with on-chain registry/economy approval blocked |
| contract boundary | structure check PASS; `forge test` unavailable on this Windows host; no contract files changed |
| portal source/interaction smokes | PASS |
| desktop portal E2E | 7/7 implemented flows PASS; console/page errors 0 |
| portrait mobile portal E2E | 7/7 implemented flows PASS; console/page errors 0 |
| desktop soundtrack proof | active hidden; paused visible; menu overlap `0`; 8 controls; volume `0.42 -> 0.231`; real MP3 seek to `~67.42 / 134.84s`; next track changed title |
| mobile soundtrack proof | 8 controls contained; expanded drawer tested; collapsed launcher <=64 px and placed in the top-right safe area |
| visual review | desktop sidecar and mobile expanded/collapsed captures reviewed; no release-blocking collision found |

Evidence:

- `.hermes/evidence/portal-e2e/03-paused.png`
- `.hermes/evidence/portal-e2e-mobile/03-paused.png`
- `.hermes/evidence/portal-e2e-mobile/03b-paused-soundtrack-launcher.png`

## Release-gate recovery

The two WO119 failures were import-time compatibility failures, not compaction or rollback regressions: Python MCP 2 exports `streamable_http_client`, while the PixelLab owner script imported the older `streamablehttp_client` name. A narrow compatibility import now accepts either API and retains the same local `streamablehttp_client` call site. Both focused tests pass, and the complete retirement gate is green without expanding the expected-failure ledger.

Release cache contract for this candidate:

- portal token: `hmh-aaa-cycle-070-pause-deck`;
- service-worker namespace: `lesters-arcade-v23-hmh-pause-soundtrack`.

## Exact release and production proof

- exact staged binary-diff SHA-256: `0d4d74cbdd07ea58d5bce81fbc0cd7ebad62cad53fefc935dcda8a63fc161b93`;
- independent exact-patch review: digest matched, verdict `PASS`, blockers `[]`;
- verified Preview: `dpl_ZJy8VnfdXa3wKWEqdDpLoCPR1L9t` at https://lesters-arcade-ku4ul7bsr-justin-agent-projects.vercel.app;
- production: `dpl_HAeCyfAG6SDK5x1LruxTMix2CBmQ` at https://lesters-arcade-5eb8u80mm-justin-agent-projects.vercel.app;
- public alias: https://lestersarcade.io resolved to the production ID above;
- retained rollback: `dpl_GBtodAeLfrK7hVL3HWWaZ12RHFHs` at https://lesters-arcade-8jdteejx4-justin-agent-projects.vercel.app, still `Ready` with the prior service-worker marker;
- Preview and production bytes matched for `styles.css`, `sw.js`, `src/arcade-music-transport.mjs`, `dist/main.js`, and `dist/hmh-reboot/game.js`;
- root, HMH deep link, child shell, CSS, module, and MP3 range requests passed; the MP3 range returned HTTP 206 and `audio/mpeg`;
- clean production desktop gameplay hid the player while active, exposed the full deck on pause, changed tracks, played real audio, and preserved playback through resume;
- clean production `390 × 844` gameplay showed a contained `[318, 26, 52, 52]` launcher and a contained `[16, 26, 358, 414.8]` expanded drawer with all transport actions at least `51 × 45` px;
- desktop/mobile production sessions reported no failed resources or media errors.

## Preserved boundaries

- Fixed 60 Hz simulation and maximum four catch-up steps unchanged.
- RNG, replay, movement, collision, damage, enemy state, progression, save schema, session authority, and run-summary authority unchanged.
- Human/zombie-only actor canon unchanged.
- HMH child combat audio remains separate from the portal playlist.
- Wallet signatures, settlement, contracts, testnet/mainnet transactions, and LitVM writes were untouched. Production serves `SETTLEMENT_LIVE=false`; the website-only promotion did not authorize or perform any Web3 write.

## Next safe work

Use the source-backed Mainnet-readiness audit to select one bounded gameplay slice. Prefer a multi-system vertical seam with deterministic tests and browser evidence rather than simultaneous speculative changes across movement, combat, balance, world art, and Web3 authority.
