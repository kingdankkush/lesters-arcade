# Cycle 001: Observability and Movement Feel

Status: **PREVIEW VERIFIED; PRODUCTION APPROVAL PENDING**

## Objective

1. Permanently identify normal-mode browser network and console failures.
2. Close the historical generic local 404.
3. Fix at most two measurable movement/camera feel defects.
4. Preserve deterministic authority, portal ownership, save/session compatibility, active art, and production rollback.

## Baseline

- Branch point: `68c981449f6c62936729f14ec08c4d6f6db57d66`
- Production: `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`
- Rollback: `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`
- Prior exact suite: 1,604 tests; 1,552 passes; 52 accepted failures.

## Changes

### Observability and 404 closure

- Reproduced `/_vercel/insights/script.js` as the historical local 404.
- Moved analytics injection to `apps/portal/src/vercel-analytics.mjs`.
- Analytics remains enabled on `lestersarcade.io`, `www.lestersarcade.io`, and `*.vercel.app`, but is skipped on localhost and `127.0.0.1`.
- Added `npm run audit:hmh:network` with clean/warm portal and HMH scenarios.
- The audit records response status, MIME, resource type, service-worker state, redirect provenance, request failures, console messages, and page errors.
- Query values are redacted in stored evidence.
- Successful 200/206 audio/video metadata cancellations are recorded separately; all other aborted requests remain fatal.

### Movement and camera feel

- Player acceleration now moves the velocity vector toward its target by magnitude rather than accelerating each axis independently.
- Cardinal and diagonal input now share the same fixed-tick acceleration envelope.
- Spatial interpolation now includes `vx`, `vy`, and `vz`.
- The projection-only camera follows `renderActor` rather than stepping ahead on authoritative actor state.

### Release-gate maintenance

- Soaks that measure retained heap now self-relaunch with explicit GC.
- The GC-helper test derives file-URL paths from the host runtime, preserving Windows/Linux CI parity.
- Combat browser smoke now matches the authored two-family opening roster and waits on stable pressure/safety evidence.
- Portal smoke now probes the four active production hero atlases instead of retired generated art.
- Portal and service-worker cache tokens are `hmh-aaa-cycle-001` / `lesters-arcade-v6-hmh-aaa-cycle-001`.

## RED evidence

See `RED-EVIDENCE-AAA-CYCLE-001.md`.

Key failures before implementation:

- Analytics script returned local HTTP 404.
- Cardinal first-tick speed was `50`; diagonal was `70.710678...`.
- Camera followed non-interpolated authority state.
- Network audit and analytics modules were missing.
- Memory-soak thresholds depended on incidental V8 GC.
- Browser smoke asserted retired opening and asset contracts.

## Verification

- Exact release suite: 1,615 total, 1,563 passed, exact 52 accepted failures, zero unexpected.
- Syntax: 319 JS modules and 40 Python scripts.
- Assets: four active production atlases, 2,569,321 bytes total.
- Security: 5/5, zero findings; sandbox 3/3.
- Web3 source boundary: 9/9; live readiness remains PARTIAL because contracts are undeployed.
- Network: four scenarios, 127 responses, zero HTTP/fatal request/console/page errors.
- Chrome: 5/5 profiles.
- Edge: 5/5 profiles.
- Desktop keyboard movement: `+75.185 x`, `0 y`.
- Mobile touch movement: `+40.637 x`, `0 y`.
- Desktop/mobile p95 frame time: `7 ms`.
- HMH bundle: 962,113 bytes, below 1,050,000-byte gate.

## Release checkpoint

Preview deployment `dpl_5prnSaryWWHWzd1gEBhr2S26yk2e` is Ready and artifact-verified. See `PREVIEW-VERIFICATION-AAA-CYCLE-001.md`. Production is unchanged and requires explicit approval for this exact candidate. LitVM remains behind a separate explicit HALT release.
