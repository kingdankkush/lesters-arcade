# Lester's Arcade repository instructions

## Read order

Before changing code, read:

1. `docs/handoffs/2026-07-29-hmh-cycle-031-hermes-handoff.md` — **current**; carries certified Cycle 031, the measured actor-scale parity brief, subsequent game priorities, full gates, and pipeline traps
2. `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`
3. `docs/hmh-reboot/cycles/CYCLE-031.md`
4. `docs/handoffs/2026-07-29-hmh-cycle-030-hermes-handoff.md`
5. `docs/hmh-reboot/cycles/CYCLE-030.md`
6. `docs/hmh-reboot/cycles/CYCLE-029.md`
7. `docs/handoffs/2026-07-28-hmh-cycle-028-claude-handoff.md`
8. `docs/handoffs/2026-07-28-hmh-cycle-027-claude-handoff.md`
9. `docs/handoffs/2026-07-27-hmh-cycle-026-hermes-handoff.md`
10. `docs/handoffs/2026-07-27-hmh-cycle-021-production-claude-handoff.md`
11. `docs/handoffs/2026-07-25-hmh-art-pipeline-hermes-handoff.md`
12. `docs/handoffs/2026-07-24-lesters-arcade-chikun-to-hmh-reboot-fable-handoff.md`
13. `.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md`
14. `docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md`
15. Latest `docs/hmh-reboot/RELEASE-CERTIFICATION-*.md`
16. Latest `docs/hmh-reboot/PREVIEW-VERIFICATION-*.md`
17. `docs/hmh-reboot/COMPATIBILITY.json`

Older June 2026 HMH handoffs describe a superseded Canvas/isometric/procedural direction. They are historical context, not active implementation authority.

## Current game direction

Hard Money Heroes is a deterministic PixiJS `8.19.0` top-down 2.5D authored roguelike run-and-gun.

Preserve:

- Fixed 60 Hz simulation.
- Maximum four catch-up steps.
- Game alias `hmh`.
- Game ID `lester-blaster`.
- Profile `wo71`.
- Save schema `2`.
- Bridge `hmh-bridge/v1`.
- Maximum bridge message size `65,536` bytes.
- Parent authority for wallets, profiles, leaderboards, analytics, canonical sessions, official completion, and settlement.
- Free Mode isolation from Ranked progress.
- Same-seed deterministic behavior and replay integrity.
- Current production and rollback until explicit promotion approval.

Active HMH actors must visibly read as human survivors or zombies. Do not use animal, vehicle, robot, mech, or abstract actor proxies. Do not reactivate retired generated/isometric actor art.

Playable characters must follow `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`: reference-faithful detailed Blender models, ordinary enemies at comparable human scale, and hitbox changes isolated into measured deterministic gameplay cycles.

Chikun's Escape remains a Coming Soon development cabinet. Its deterministic parent replay and SDK boundary must remain intact. Do not make it public playable without full production and browser certification.

## Git and deployment safety

- Work on `reboot/hmh-aaa-continuous` or a new branch from it.
- Do not push ordinary work directly to `main`.
- Do not rewrite or discard unrelated working-tree changes.
- Do not promote a Vercel deployment without explicit approval for that exact deployment.
- Do not deploy contracts, send transactions, change authority, or enable real settlement without a separate explicit HALT approval.
- Do not expose private keys, API credentials, or verifier secrets.

Current certified continuation and production baseline at the time of this instruction:

- Continuation branch: `reboot/hmh-aaa-continuous`
- Cycle 029 Lilly source: `3784080bf0aa79cad7cbe1c7b13a9b6f9c094109`
- Cycle 029 exact commit patch SHA-256: `9c7d2acbc9f6b5d3e2390f94b5ccc3561a9dab7d959e390d927f5e508e496132`
- Cycle 030 Lit Commando source: `d5a860d491739184a35e61fe9fd5f88c1c65743b`
- Cycle 030 exact commit patch SHA-256: `38d5588b47d24067167c0749b7c36753bd350491a8aa7a10407d92161ea34950`
- Cycle 031 Lit Valkyrie source: `45d1a25e48f0ba7f094efc0199ebb4675d8ac614`
- Cycle 031 exact commit patch SHA-256: `a3be6886f105f98be6cec7eb0ca80fed6348e4080fa31b85f856d950e2914c36`
- Production source remains Cycle 021: `a81f1c8f830f3339ebb568de166c108e58f695d3`
- Production deployment remains https://lesters-arcade-gsbj7uxer-justin-agent-projects.vercel.app
- `SETTLEMENT_LIVE=false`

Re-read live Git and deployment state before acting. Do not assume these values remain current in a later session.

## Runtime authority

The HMH child may own input, deterministic simulation, movement, collision, elevation, combat, AI, progression, and render projection.

The HMH child must not:

- Request wallets.
- Request signatures.
- Send transactions.
- Write parent persistence.
- Grant official achievements or Ranked status.
- Calculate or authorize settlement.
- Replace the parent-provided session identity or seed.

Art, interpolation, particles, shaders, audio, animation LOD, and quality tiers are projection-only. They may not change collision, damage, AI, spawning, RNG, progression, evidence, or results.

## Render-layer visual verification

For any render-layer change:

- Run `npm run visual:reboot` and inspect both the screenshots and machine-readable comparison metrics. Do not rely on screenshots alone.
- Verify the ground plane, prop grounding, depth sorting, collision-to-art alignment, actor readability, UI containment, and desktop/mobile framing.
- Use `npm run visual:reboot:accept` only after the visual change is intentional and reviewed.
- Commit the approved baseline update under `docs/testing/VISUAL_BASELINES/` with the source change that requires it.

## Implementation discipline

- Select one bounded vertical slice from the earliest incomplete master-plan phase.
- Audit current source, tests, runtime behavior, active art, and performance first.
- Write RED behavioral coverage before a fix or feature.
- Implement the smallest coherent deterministic change.
- Exercise the actual browser/runtime path.
- Inspect full-resolution desktop and mobile evidence.
- Measure before optimizing.
- Keep generated/runtime artifacts and docs consistent.
- Do not treat a plan, stub, static audit, synthetic wallet, or simulated receipt as a finished feature.

Any runtime, asset, routing, CSP, service-worker, or release-harness change creates a new candidate and requires fresh certification.

## Working commands

Use npm on this Windows checkout:

```bash
npm install
npm run check
npm run test:release
npm run build
npm run assets:qa:hmh-reboot
npm run design:security-audit
npm run design:third-party-security
npm run design:web3-audit
npm run design:web3-live
npm run repo:health:strict
npm run repo:cdn-gate
npm run docs:links
```

`pnpm run build` is blocked on this machine by a parent user-level package-manager declaration. `npm run build` is the verified repository path.

Serve locally from `apps/portal`, not `apps/portal/dist`:

```bash
cd apps/portal
python -m http.server 8791 --bind 127.0.0.1
```

Portal URL: `http://127.0.0.1:8791/`

HMH URL: `http://127.0.0.1:8791/hmh-reboot/index.html`

## Web3 truth

- `SETTLEMENT_LIVE` is false.
- Local canonical sessions, profiles, cadence leaderboards, and simulated settlement exist.
- June legacy contracts contain bytecode but do not match the current hardened score ABI.
- Hardened predicted contracts are undeployed.
- The browser consumes a verifier attestation but does not produce a trusted attestation.
- Real wallet, hardened contract, score readback, profile readback, and leaderboard ingestion remain unproven end to end.

Never describe local/simulated or source-only Web3 behavior as live settlement.
