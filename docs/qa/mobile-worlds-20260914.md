# Mobile worlds gameplay update

Candidate on codex/mobile-worlds-aquatic-20260914. Publication is pending the fresh hosted release gate and public verification.

## Changes

HMH uses a rounding-safe nearest-neighbor shortlist and reused cell neighborhoods, with exact movement parity. Mobile renders at capped density 1 with 32 animated enemies and fewer atmosphere particles. Opening spawns move to 150 ticks and 20 bodies, followed by a 48-body build phase; all devices share these deterministic rules. Mobile camera zoom is multiplied by 0.8, exposing 25% more world per axis. Roads gain rounded bends and clearer lane markings inside the existing collision corridors. Native barrier art covers perimeter and angled fences; integrated timber-bridge rails remain attached to their deck. Walking and presentation stings are muted; combat, reload and world-interaction cues remain.

Chikun 0.8.0 alternates long flight passages, low canopy/storm passages and optional sky encounters. Wide waterfalls, pits, closed forests and towns interrupt ground-only play. Five deterministic pilots each complete 9,600 ticks across 28 passages. V4 evidence is current; archived V3 replay uses its original course and runtime.

STACKED restores mobile music sampling, visualizer controls and nine aquatic parametric forms. It uses 432 mobile particles and 648 desktop particles, with reduced-motion limits, music-driven swimming, burst/reform transitions, larger colorful line-clear effects and a matching 1,000ms locked-piece outline. Default piece dots are removed; opt-in accessibility uses connected line glyphs.

Site/game version 1.5.0 separates current scores while preserving historical records. The v49 cache refresh includes the previously published homepage, catalog and search improvements.

## Evidence and limits

[Performance measurements](mobile-worlds-20260914/performance-summary.json) preserve both opening gains and failed stress samples. Opening A/B at 390×844 and CPU throttle 4 improved mean frame interval from 28.05ms to 19.55ms. An artificial 128-enemy stress load still spikes, including a 100.49ms outlier and 46.00ms repeat. This does not establish physical iPhone performance or a universal 60fps guarantee. The 414×896 sample is separate. [Attempt log](mobile-worlds-20260914/optimization-attempts.json) records retained and reverted work.

STACKED's 12-second slowed mobile test kept music available, 721 simulation ticks and zero long tasks; p95 callback time was 7.6ms. Six playable browser sizes and four particle/effect layouts pass. Chikun's desktop/portrait/landscape checks pass input, pause, results, replay and retry. Native barrier renders pass exact A/B pixel repeatability with a seeded CPU Cycles recipe and remain inside the 900k/300k delivery budgets.

The repository archive-size check reports an existing 960MB versus 350MB ceiling. Runtime startup budgets pass; the CDN archive audit exits successfully with its existing approval-gated migration inventory; native source archives are not public output. No budget or retirement ledger was loosened. Settlement remains disabled. Editable source models and Git source are not publicly pushed.

Local release gate: 3,808 tests, 3,757 passed, 51 unchanged retired exceptions, zero unexpected failures. All 12 HMH visual scenes were reviewed and accepted; only mobile framing exceeded prior scene tolerance. Twenty discovery checks and seven accessibility scans pass.
