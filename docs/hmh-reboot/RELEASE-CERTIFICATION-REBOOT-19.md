# Reboot 19 Release Certification

Generated: 2026-07-24T05:12:59Z
Branch: `reboot/hmh-topdown-2_5d`
Parent: `890500292024e6561dbe9f101a1d633fa95dd517`
Verdict: **PASS**

The structured source of truth is `RELEASE-CERTIFICATION-REBOOT-19.json`.

## Certified release scope

This packet certifies the public portal, Hard Money Heroes Free mode, and the truthful local Ranked-preview flow. It does **not** claim that real-value or on-chain Ranked settlement is live. The UI remains fail-closed and explicitly says that local Ranked evidence is saved without sending a transaction.

## Aggregate gates

- Release suite: **1,604 tests; 1,552 passes; exactly 52 ledger-matched legacy failures; 0 unexpected failures**.
- One previous legacy VFX failure became a real pass after canonical combat VFX restoration; the retirement ledger was reduced from 53 to 52 rather than re-breaking the test.
- Syntax: **319 JavaScript modules and 40 Python scripts**.
- Active reboot asset QA: **PASS**.
- HMH security: **5/5**, zero findings.
- Third-party sandbox security: **3/3**.
- Web3 settlement source audit: **9/9**.
- Contract structure: **PASS**.
- Strict repository health: **PASS**.
- CDN/file-budget gate: **PASS**.
- Production build: **PASS**.

## Gameplay and integration corrections

The revised candidate adds and verifies:

- one canonical portal lifecycle for child state, pause, game-over, score result, achievement, and adapter teardown;
- exact-once game-over submission and rejection of duplicate or mismatched results;
- canonical parent session seed use in Ranked;
- fresh tracked sessions for Free and Ranked replay;
- authored opening roster containing Bagholder Rusher and Forkrunner;
- 120-tick movement hold and 480-tick attack grace;
- opening-only health variants that allow a readable first defeat before full pressure begins;
- actor-origin-to-muzzle collision sweep for point-blank shots;
- click-to-focus keyboard restoration;
- one-second stale-pointer expiry so automatic targeting can reacquire enemies;
- durable Ranked-preview session-feed restoration after reload.

A signed browser run using an ephemeral EVM key completed with score 325, two kills, and 32 seconds survived. The matching wallet profile persisted one Ranked preview, XP 25, best score 325, two kills, latest session ID, achievements, and run history. The active checkpoint cleared. Reopening the app and reconnecting the same wallet restored Profile and Scores views.

## Browser and responsive certification

Google Chrome and Microsoft Edge each passed:

1. Desktop `1440x900`
2. Ultrawide `1920x800`
3. Tablet landscape `1024x768`
4. Mobile portrait `390x844`
5. Mobile landscape `844x390`

The final clean certification reports show exact anchor reproduction in all ten browser/profile combinations: zero changed pixels and zero channel delta.

Evidence:

- `.hermes/evidence/hmh-reboot-19-release/chrome/report.json`
- `.hermes/evidence/hmh-reboot-19-release/edge/report.json`

The gate loads the actual production bundle, rejects Vercel Authentication content, checks one canvas and three upgrade choices, checks root overflow and element bounds, keeps all eight touch targets in mobile/tablet viewports, performs real keyboard movement, verifies pause/resume against the authoritative tick, and rejects page/console errors.

All four production hero browser smokes passed:

- Lit Commando
- Lit Valkyrie
- Lester Original
- Lilly

Cockpit desktop and mobile smokes also passed with no browser errors.

## Performance and payload

- Child bundle: `961,934 / 1,050,000` bytes.
- HTML: `4,365` bytes.
- CSS: `10,245` bytes.
- Desktop p95/p99: `7.0 / 7.1 ms`.
- Mobile p95/p99: `7.0 / 7.1 ms`.
- Desktop heap delta: `12,679,156` bytes.
- Mobile heap delta: `5,376,477` bytes.
- Browser errors: `0`.

## Active asset and visual certification

`npm run assets:qa:hmh-reboot` passed with four active projection-only production atlases, 168 frames each, and 2,569,321 total bytes.

The delayed generic asset audit mixed retired isometric/Wave assertions with the active reboot roster. Its claim that those missing files block the reboot is rejected by the authoritative active-roster gate and exact legacy retirement policy.

Final visual review found:

- no blank or missing layers;
- no clipping or safe-area blocker;
- complete touch-control geometry;
- readable route, minimap, HUD, projectiles, human hero, and human enemy silhouettes;
- no animal, mech, drone, or abstract production actor substituted for a canon human identity;
- no debug contamination.

## Web3 boundary

`design:web3-audit` passed 9/9. `design:web3-live` remains **PARTIAL, 3/4**:

Passed:

- deterministic replay verification;
- local-cache leaderboard read fallback;
- durable profile persistence.

Blocked:

- on-chain registry/economy activation;
- production GameRegistry cabinet approval;
- production-approved SplitConfig/economy settings;
- legal, brand, and economy approval for real-value launch.

No transaction was sent during certification. The app may launch only with its current truthful local Ranked-preview copy. A live on-chain Ranked claim remains prohibited until a separately authorized contract/economy release passes.

## Production CSP and first-cutover rollback

The first immutable preview, `dpl_75Y49Gu9x1NsRG3VWxjnT67dv6YG`, matched the certified local HTML, bundle, service worker, key art, and combat VFX byte-for-byte. The first custom-domain cutover then exposed a production-only blocker: PixiJS 8.19.0 rejected the child document's strict `script-src 'self'` policy because its runtime program generation requires `unsafe-eval` unless the separate internal adapter graph is bundled.

The public domain was immediately returned to rollback deployment `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk` before further work. The main arcade homepage was reverified with HTTP 200.

The correction permits `unsafe-eval` only on `/hmh-reboot/*`. The child still allows scripts only from `'self'`, rejects `unsafe-inline`, uses `frame-ancestors 'self'`, and has no wallet or settlement authority. The parent portal and every non-HMH route continue to reject `unsafe-eval` and use `frame-ancestors 'none'`. `tests/hmh-reboot-shell.test.mjs` fails closed if this boundary changes. Security remains 5/5 with zero findings, and the sandbox suite remains 3/3.

## Hosted preview boundary

The corrected exact packet must be committed, deployed, and verified in a real browser under Vercel's production headers before re-promotion. Artifact equality alone is not sufficient. The custom domain remains on the preserved rollback deployment until that live-CSP browser gate passes.
