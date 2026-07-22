# HMH Engine Bakeoff

Reproducible PixiJS 8.19.0 versus Phaser 4.2.1 renderer comparison for the Hard Money Heroes top-down reboot. Both adapters use the same deterministic typed-array simulation and render identical workloads.

## Run

```bash
cd benchmarks/hmh-engine-bakeoff
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci
npm run build
npm run bench
```

The runner expects system Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`; override with `CHROME_PATH` when needed. Raw results are written to `evidence/results.json`.

## Workloads

- Normal: 150 enemies, 500 projectiles, 1,500 particles, 300 props.
- Stress: 600 enemies, 2,000 projectiles, 6,000 particles, 1,200 props.
- Desktop: 1920×1080, DPR 1.
- Mobile proxy: 390×844, DPR 2, Chrome CPU throttling 4×.
- Three repeats per engine/profile, 1 second warmup, 4 second sample.
- Vsync and browser frame-rate limiting disabled to expose throughput differences.

This is an engine-selection benchmark, not final real-device certification.
