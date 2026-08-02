# HMH AAA Continuous Improvement Cycle 045

Date: `2026-08-02`
Status: `IN PROGRESS`
Branch: `reboot/hmh-aaa-continuous`
Baseline: `a9ef44a5` (Cycle 044 closeout; production promoted)

## Scope: MAP-REDO slice 5 — swarm-forgiving hurtboxes + moving-target benchmark

Owner complaint: "the gun combat is lacking in that it's hard to kill so
many enemies." Priority F1-3 executed as a measured deterministic cycle.

### 1. Hurtbox policy v2 (SIMULATION change)

`cycle-045-swarm-forgiving-ordinary-enemy-hurtbox-v2`: radius scale
`0.90 → 1.00`, minimum radius `10 → 12`, capsule half-length `8 → 9`. At the
standard 18-unit body that grows the vulnerable radius `16.2 → 18`.

Measured by the existing seeded cross-track harness (4,000 samples, 30-unit
aim error): pre-033 baseline ~0.76, Cycle 033 ~0.87, v2 gains ≥3pp over 033
with growth bounded (<0.97) and the wide-miss guard intact — a shot at the
aim-error edge still misses by 1 unit. Render scale, collision bodies, and
melee contact bounds unchanged; the vulnerable core only. Same-seed
determinism preserved within the build; pre-045 replays diverge under 045
playback as with any simulation change.

### 2. Moving-target benchmark extension (`hmh-weapon-benchmark-v2`)

48 new deterministic rows: every weapon × base/maxed × close/mid/long ×
{rusher 220 u/s, walker 116 u/s} strafe. The target carries the REAL
ordinary-enemy hurtbox profile and is tracked with a fixed 10-tick (167 ms)
reaction lag, so cross-track error equals strafe displacement over the
reaction window — the exact regime the hurtbox policy governs. Triangle-wave
strafe keeps it closed-form; double-run deepEqual guards drift; the report
records `hurtboxPolicyId` for provenance.

Baseline findings for the record (base tier @mid): pistol 0.179 vs rushers /
1.0 vs walkers (tracking pain is real but bounded); auto-miner 0.356/0.873
(spread helps against motion); launcher 1.0 (blast radius forgives); shotgun
0 at mid (role-consistent range limit). These are the reference numbers for
the future balance cycle — no weapon values changed here.

## Gates

- check 337+49 PASS; hurtbox suite 4/4 (RED-first: policy id/values and the
  ≥3pp-over-033 measurement failed against v1)
- bench:hmh:weapons v2: 24 static + 48 moving rows, double-run deepEqual
- test:release `1,840 / 1,788 / 52 / 0`
- visual regression 8/8 unchanged (evidence-safe pinned scenes unaffected)
- browser certification five profiles PASS
- combat, collectible, mobile (4 devices) smokes PASS
- performance p95 `7 / 7.1 ms`, bundle `1,039,225 / 1,050,000`, heap delta
  negative
