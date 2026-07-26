# HMH AAA Cycle 007 Release Certification

Generated: `2026-07-26T11:52:09Z`

Status: **LOCAL CERTIFIED · COMMIT PENDING**

## Candidate

- Branch: `reboot/hmh-aaa-continuous`
- Base commit: `807bc9434aefec1ab89623128b12777bfe73ab55`
- Source commit: pending bounded local commit
- Exact staged index: pending final staging
- Production, LitVM, settlement, and deployment boundaries: unchanged

## Certified change

Cycle 007 completes the important authored-art transition debt left by Cycle 006:

- shared 55-degree hero/enemy projection;
- warmer low-reflection enemy materials;
- authored hero dash, melee, grenade, and death clips;
- runtime-authoritative clip FPS and non-looping behavior;
- projection-only idle-facing retention;
- three authored Liquidator phase silhouettes;
- 29 Blender-authored weapons, pickup/reward icons, upgrade icons, and world props;
- deterministic district dressing, single-authority held weapons, and truthful static POI markers derived from level hooks;
- unified fail-closed hero, roster, boss, and prop asset QA.

Gameplay, deterministic evidence, portal authority, Web3, settlement, and production behavior remain unchanged.

## Test and artifact evidence

- Release ledger: `1,690 total / 1,638 passed / 52 accepted / 0 unexpected`.
- Focused Cycle 007 suite: `35/35`.
- Updated production-art contract suite: `10/10`.
- Syntax: `332` JavaScript modules + `49` Python scripts.
- HMH bundle: `992,376 / 1,050,000` bytes.
- HMH bundle SHA-256: `9f98baf9a5ffad3dbb393a064421a641d9631ccc7a5c424947cab7dac8ea1379`.
- Heroes: 4 atlases, 2,592 frames, 10,461,922 bytes.
- Enemy/boss roster: 7 atlases, 1,368 unique frames, 4,671,584 bytes.
- Props/icons/pickups: 1 atlas, 29 unique assets, 57,080 bytes.
- Blender 5.1.2 source and generated reproducibility: PASS.

## Visual evidence

All eight deterministic scenes were inspected. The localized Hashwood dressing change was accepted after correcting over-emissive stump rings. The final single-weapon/POI candidate then passed two complete visual runs with identical within-tolerance metrics and zero browser errors.

## Browser, performance, and network

- Chrome five-profile release certification: PASS.
- Portal E2E: six implemented flows PASS; zero console errors.
- Network/console audit: four scenarios PASS; no HTTP, request, console, or page failures.
- Performance: desktop/mobile p95 `7 ms / 7 ms`; bundle remains under gate.
- Reboot-native soak: the stale legacy-cabinet selector path was replaced with direct Pixi reboot telemetry; the former stress harness remains available as `test:soak:legacy` with isolated report paths.
- Thirty-minute reboot soak: PASS at 30.011 minutes and 60 samples, with 143.92 median FPS, 7 ms p95, 95,570 active ticks across one natural restart, 120 maximum enemies, 96 maximum animated enemies, live boss combat, and zero console/network issues.
- GC-stabilized steady-state retained heap growth: PASS at 27,422,415 bytes (26.72%); DOM remained 78 → 78 nodes and maximum forced-GC pause was 100.5 ms.

## Security and Web3 truth

- Security sweep: PASS 5/5, zero findings.
- Third-party sandbox: PASS 3/3.
- Web3 settlement boundary: PASS 9/9.
- Live readiness: PARTIAL 3/4. `on-chain-registry-economy` remains blocked pending cabinet, economy, legal, and brand approvals.
- `SETTLEMENT_LIVE` remains false.
- No wallet was requested, no transaction was broadcast, and no deployment occurred.

## Repository health

Raw Blender frame directories, temporary visual montages, and `.blend1` backups were removed. The runners now delete scene backups themselves. Strict repository health, CDN gate, and documentation links pass. CDN migration/history rewrite remain separate approval gates and no destructive action occurred.

## Exact-index review

All intended files will be staged and frozen with:

```bash
git diff --cached --binary | sha256sum
```

Independent reviewers must review that exact hash. Any edit invalidates the verdicts. The final frozen hash is recorded in the commit message and final handoff rather than embedded in the staged candidate itself.
