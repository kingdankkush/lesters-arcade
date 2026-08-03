# Lester's Arcade repository instructions

## Read order

Before changing code, read:

0. `docs/handoffs/2026-08-02-hmh-cycle-049-fable-handoff.md` — **current**; cycles 041-049 production state, verified operational facts (Vercel promote works from this environment; Security Checkpoint blocks automated production verification; never parallel browser smokes; heap-gate variance), and the prioritized objective list
1. `docs/handoffs/2026-07-30-hmh-cycle-036-hermes-handoff.md` — standing architecture boundaries, bridge contract, and Web3 truth (still authoritative for those contracts)
2. `docs/hmh-reboot/cycles/CYCLE-036.md`
3. `docs/handoffs/2026-07-29-hmh-cycle-035-hermes-handoff.md`
4. `docs/hmh-reboot/cycles/CYCLE-035.md`
5. `docs/handoffs/2026-07-29-hmh-cycle-034-hermes-handoff.md`
6. `docs/hmh-reboot/cycles/CYCLE-034.md`
7. `docs/handoffs/2026-07-29-hmh-cycle-033-hermes-handoff.md`
8. `docs/hmh-reboot/cycles/CYCLE-033.md`
9. `docs/hmh-reboot/cycles/CYCLE-032.md`
10. `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`
11. `docs/handoffs/2026-07-29-hmh-cycle-031-hermes-handoff.md`
12. `docs/hmh-reboot/cycles/CYCLE-031.md`
13. `docs/hmh-reboot/cycles/CYCLE-030.md`
14. `docs/handoffs/2026-07-28-hmh-cycle-027-claude-handoff.md`
15. `docs/handoffs/2026-07-27-hmh-cycle-026-hermes-handoff.md`
16. `docs/handoffs/2026-07-27-hmh-cycle-021-production-claude-handoff.md`
17. `docs/handoffs/2026-07-25-hmh-art-pipeline-hermes-handoff.md`
18. `docs/handoffs/2026-07-24-lesters-arcade-chikun-to-hmh-reboot-fable-handoff.md`
19. `.hermes/plans/2026-07-23_225852-hmh-aaa-continuous-improvement-master-plan.md`
20. `docs/hmh-reboot/AAA-CONTINUOUS-IMPROVEMENT.md`
21. Latest `docs/hmh-reboot/RELEASE-CERTIFICATION-*.md`
22. Latest `docs/hmh-reboot/PREVIEW-VERIFICATION-*.md`
23. `docs/hmh-reboot/COMPATIBILITY.json`

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
- Cycle 032 source: `9002681fb5e91eed62cacbb8e1679201a3ae0e1a`
- Cycle 032 exact staged patch SHA-256: `c493321316ea20687be04e2d8d4f0efadf9ab1db42e1caf842422d74b6a6907a`
- Cycle 033 source: `d59d838258f285fa568382c28eadbc2979117a92`
- Cycle 033 exact commit patch SHA-256: `e1e438b107280f5268f242d35b31a237256a1a68d198ade6ca38e4b3e6c881b9`
- Cycle 034 source: `be2712e4c617152eb3f115c5ef083e3a3a173044`
- Cycle 034 exact commit patch SHA-256: `540d71f3bcc9935fee4ee525e19b59806800430e6267207b65d55e403f220e50`
- Cycle 035 source: `0e4a0cc7dbe553196b64b5181ed5cd70d3c70e9f`
- Cycle 035 exact commit patch SHA-256: `697b72230da401d5ef686cea3145fb643c9ea274ad7116377b9dbdc166aa698f`
- Cycle 036 source: `15629ebac9e1004f2b41760aedd3e67cc406f5c3`
- Cycle 036 exact commit patch SHA-256: `5fa3e71570a20d1ca5b4166df06c041e244e9a7315645ae74f797752686847d6`
- Production branch head is the Cycle 036 closeout: `802e6cd18a537c72830224e0655617841241b548`
- Production runtime implementation boundary is Cycle 036: `15629ebac9e1004f2b41760aedd3e67cc406f5c3`
- Production deployment is `dpl_5mUEBJ6dZYaW6PANwSc1SfBnJRWo` at https://lestersarcade.io
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
