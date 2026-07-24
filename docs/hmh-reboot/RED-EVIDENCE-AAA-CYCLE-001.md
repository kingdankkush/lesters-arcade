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

## Preview CI cross-platform failure

The first Vercel preview build failed closed in Linux CI:

```text
unexpected failure: tests/hmh-soak-explicit-gc.test.mjs :: soak GC helper relaunches the exact script with --expose-gc and propagates status
```

The test hard-coded a Windows `fileURLToPath` result. GREEN derives the expectation with the host runtime's own `fileURLToPath`, preserving the exact behavior assertion on Windows and Linux.

Evidence:

- `.tmp/hmh-aaa-cycle-001/vercel-preview-deploy.log`
- `.tmp/hmh-aaa-cycle-001/gates/47-cross-platform-gc-helper.log`
- `.tmp/hmh-aaa-cycle-001/gates/48-post-preview-release.log`

## Late portal-gallery RED

A post-review static audit found four hidden lazy-image references in `apps/portal/index.html` that resolved to missing retired generated HMH drafts. The production app shell hid the legacy gallery, so normal viewport audits did not request them, but the source still violated the active-art and no-broken-reference contracts.

RED evidence:

```text
AssertionError: ./assets/generated/hmh-lester-hero-sprite-sheet-textfree-web.jpg resolves to a shipped file
false !== true
```

GREEN replaces all four retired references with the active Lester, Lilly, Commando, and Valkyrie production contact sheets. The new fail-closed HTML image-reference test passes, all four files return HTTP 200, decode at 1470x2024, and browser evidence records zero errors.

Evidence:

- `.tmp/hmh-aaa-cycle-001/red-lazy-portal-images.log`
- `.tmp/hmh-aaa-cycle-001/green-lazy-portal-images.log`
- `.tmp/hmh-aaa-cycle-001/gates/54-portal-production-gallery-browser.log`
- `.hermes/evidence/hmh-aaa-cycle-001/portal-gallery/report.json`
- `.hermes/evidence/hmh-aaa-cycle-001/portal-gallery/active-production-heroes.png`

## GREEN closure

- Observability unit tests: 6/6.
- Movement/input/dash/world/camera tests: 43/43.
- Explicit-GC helper: 3/3.
- Permanent network audit: four scenarios, zero HTTP/fatal request/console/page errors.
- Final exact release suite: 1,615 total; 1,563 passed; exact 52 accepted failures; zero unexpected.
