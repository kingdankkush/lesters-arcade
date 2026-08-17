# HMH AAA Continuous Improvement Cycle 060

Date: `2026-08-17`
Status: `LOCAL PRODUCTION-DOCUMENTATION DRIFT GATE · NOT PUSHED · NOT PROMOTED`
Branch: `reboot/hmh-aaa-continuous`
Based on: `31f83b7d` (Cycle 059 Liquidator authored-cover counterplay)

## Bounded slice

Add an explicit, network-backed documentation gate that compares the cache marker recorded in `README.md` with the `CACHE_VERSION` currently served by production at `https://lestersarcade.io/sw.js`.

The existing `docs:links` command remains offline and deterministic. `docs:production` is opt-in for deployment reconciliation and certification, where a network failure must block rather than silently accept stale production facts.

## Contract

- Parse only the canonical `**Production cache marker:**` README field.
- Parse only the service worker's `CACHE_VERSION` declaration.
- Fail closed when either field is absent, the production request fails, the response is non-2xx, or the markers differ.
- Keep deployment ID and source-commit reconciliation manual because those facts are not encoded in `sw.js`.
- Allow a local service-worker URL and README path through environment variables for deterministic fixture testing.
- Do not change runtime, service worker, assets, routes, settlement, or production.

## TDD evidence

RED: `node --test tests/production-doc-drift-check.test.mjs` failed with `ERR_MODULE_NOT_FOUND` before the checker existed.

GREEN: four focused tests pass for canonical parsing, missing-field failure, matching/mismatched fixture responses, and network failure.

## Live evidence

`npm run docs:production` fetched the real production service worker and matched:

`lesters-arcade-v18-hmh-mobile-character-start`

This proves only marker parity at the time of the check. It does not prove the README deployment ID or source commit, and it does not authorize promotion.

## Verification

| Gate | Result |
|---|---|
| focused production-doc tests | 4/4 PASS |
| `npm run docs:production` | PASS, live v18 marker matched |
| `npm run docs:links` | PASS, 8 documents |
| `node --test tests/agents-policy.test.mjs` | PASS 2/2 |
| `npm run check` | PASS 346 JS + 49 Python |
| `npm run build` | PASS 942.3 KB / 1.00 MB, 83.1 KB headroom |
| `npm run test:release` | PASS 2,223 = 2,172 passed + 51 expected |
| `npm run repo:health:strict` | PASS, SHIP budget |

The first release-gate attempt in the fresh isolated worktree failed because `node_modules` and built `dist` output were absent. After `npm ci` (0 vulnerabilities) and the required `npm run build`, the full release gate passed. This was prerequisite repair, not a source rerun-until-green.

No browser or visual smoke was run: the slice changes documentation and a standalone release/documentation harness only; it does not change player-visible or runtime code.
