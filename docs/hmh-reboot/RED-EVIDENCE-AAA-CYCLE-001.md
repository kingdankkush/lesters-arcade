# Cycle 001 RED Evidence

Generated: `2026-07-24T14:56:26Z`

## Historical local 404

A disposable full-response probe against the correct portal web root reproduced:

```text
GET /_vercel/insights/script.js
404 text/html
```

The request came from unconditional Vercel Analytics injection on localhost. It did not originate from HMH gameplay, active art, or the service worker.

Initial RED log: `.tmp/hmh-aaa-cycle-001/network-probe-correct-root.json`.

## Missing permanent observability contract

The first focused run failed because these modules did not exist:

- `apps/portal/src/vercel-analytics.mjs`
- `scripts/hmh-reboot-network-console-audit-lib.mjs`

Evidence: `.tmp/hmh-aaa-cycle-001/red-observability.log`.

Required GREEN behavior:

- deployed-host-only analytics;
- deterministic URL redaction;
- status/MIME/resource-type/redirect evidence;
- service-worker snapshots;
- fatal HTTP, request, console, and page errors.

## Media-cancellation classification

The first real warm-portal audit reported an MP3 `net::ERR_ABORTED`. Expanded evidence showed the same URL had already returned:

```text
206 audio/mpeg fromServiceWorker=true
```

This is Chrome ending a successful metadata range request, not a failed asset. A RED test required this narrow case to remain recorded but nonfatal. Aborts without a matching 200/206 audio/video response remain fatal.

Evidence:

- `.tmp/hmh-aaa-cycle-001/network-audit-media-diagnostic.log`
- `.tmp/hmh-aaa-cycle-001/red-media-cancellation-classification.log`

## Direction-dependent acceleration

The initial movement RED test compared the first four fixed ticks of cardinal and diagonal input.

Before GREEN:

- cardinal first-tick speed: `50`
- diagonal first-tick speed: `70.710678...`

Both reached the same cap, but diagonal input accelerated about 41% faster because each axis received the full acceleration delta.

Evidence: `.tmp/hmh-aaa-cycle-001/red-movement-camera.log`.

## Camera interpolation gap

The same RED run proved:

- `interpolateSpatialState` omitted velocity;
- `followCameraTarget` spread `actor` rather than `renderActor`.

This made the projection camera follow fixed-step authority while the actor was drawn at interpolated state.

Evidence: `.tmp/hmh-aaa-cycle-001/red-movement-camera.log`.

## Nondeterministic retained-memory gates

The direct projectile soak failed:

```text
heap grew by 27096360 bytes
```

The unchanged simulation with `node --expose-gc` passed with `268232` retained bytes and identical hash/counts. Enemy soak exposed the same flaw. A RED helper test required exact-script relaunch with `--expose-gc` and exit-status propagation.

Evidence:

- `.tmp/hmh-aaa-cycle-001/gates/15-projectile-soak.log`
- `.tmp/hmh-aaa-cycle-001/gates/15-projectile-soak-explicit-gc-diagnostic.log`
- `.tmp/hmh-aaa-cycle-001/red-soak-explicit-gc.log`

## Browser harness drift

The protected production deployment failed the same combat-smoke tell wait as the candidate, proving it was not a Cycle 001 regression. A 30-second probe confirmed the authored opening contains `bagholder-rusher` and `forkrunner`, matching the opening-balance contract, not all six families concurrently.

Portal smoke then identified retired generated-art 404s. Those assets were not restored. The gate was redirected to the four active production hero atlases.

Evidence:

- `.tmp/hmh-aaa-cycle-001/gates/27-combat-browser-production-baseline.log`
- `.tmp/hmh-aaa-cycle-001/combat-roster-timing.log`
- `.tmp/hmh-aaa-cycle-001/gates/30-portal-diagnostic.log`

## GREEN closure

- Observability unit tests: 6/6.
- Movement/input/dash/world/camera tests: 43/43.
- Explicit-GC helper: 3/3.
- Permanent network audit: four scenarios, zero HTTP/fatal request/console/page errors.
- Final exact release suite: 1,615 total; 1,563 passed; exact 52 accepted failures; zero unexpected.
