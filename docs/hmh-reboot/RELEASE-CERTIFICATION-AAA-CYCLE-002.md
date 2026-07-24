# HMH AAA Cycle 002 Release Certification

Generated: `2026-07-24T22:24:10Z`

Status: **PREVIEW VERIFIED, PRODUCTION APPROVAL PENDING**

## Certified source

- Branch: `reboot/hmh-aaa-continuous`
- Source commit: `ab8eecdbe7ec40e3451ef8b10f58ae3095a3a170`
- Cycle baseline: `b2488667db7a634b975484d426b7f8103988a00a`
- Cumulative production-base code patch SHA-256: `67b68cd8dcaa2c8bebc48f1a4c6bfd3fd3c74f3103538390cb9d96de7d727c1a`
- Scope: `git diff --binary 68c981449f6c62936729f14ec08c4d6f6db57d66 -- apps scripts tests package.json`

## Certified change

Cycle 002 adds a bounded 100 ms live-input buffer for aggregate false-to-true fire, melee, grenade, and dash transitions. Keyboard, pointer, touch, and gamepad share the same contract. Pending actions survive render frames with zero admitted fixed steps and are acknowledged only after a frame admits one or more fixed steps. Existing reset paths clear pending actions.

The deterministic Vercel build also refreshes the tracked curated-runtime index for existing Cycle 001 portal lifecycle and analytics modules.

Simulation frequency, catch-up cap, gameplay RNG, collision, elevation, replay/session identity, persistence, bridge, Ranked, wallet, Web3, and settlement authority are unchanged.

## RED/GREEN

- Initial focused baseline: `38/38`
- RED zero-step and expiry assertions: `0/2` for the intended missing behavior
- RED pointer/touch/gamepad parity: `0/1` for the intended missing behavior
- GREEN focused input/combat suite: `75/75`
- Full release ledger: `1,619 total / 1,567 passed / 52 accepted / 0 unexpected`

See `RED-EVIDENCE-AAA-CYCLE-002.md`.

## Artifacts

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| HMH reboot game bundle | 963,568 | `33131067b0c913afce71d2c0633254c4ea5b4a3828a0483ba79cf21f52e986a1` |
| Portal main bundle | 1,246,613 | `df9c811971dfec7ba7b88e2cf4b4c20d216faeffbf814f613daf7f791926ae81` |
| Service worker | 3,508 | `8146ed967e426c70d9dc439494168c85be32892720fec8e9794347a10d6b504a` |
| HMH HTML | 4,365 | `10a373bccbf59ecfa6a1ec382d91bd9e6b35f0888eb8d2b921b3be67344b0bb1` |
| Portal HTML | 37,092 | `06465ce0e247a3d07c27e384ad845fc2feb2e77a1cf4d5e26d044f607d682184` |

The HMH bundle remains below the `1,050,000`-byte gate.

## Gate summary

- Build and contract structure: PASS
- Syntax: `319` JavaScript modules + `40` Python scripts
- Production hero atlases: `4/4`
- Security: `5/5`, zero findings
- Third-party sandbox: `3/3`
- Web3 source authority: `9/9`
- Network/console: `4/4`, zero HTTP, request, console, or page failures
- Chrome profiles: `5/5`
- Edge profiles: `5/5`
- Combat, cockpit, portal flow, and portal interaction smokes: PASS
- Desktop/mobile p95 frame time: `7 ms / 7 ms`
- Reboot combat explicit-GC soak: PASS with stable 60/30/20 FPS outcomes
- Input buffer explicit-GC soak: `260,000` cycles, `2,000`-byte retained delta, pending size `0`

## Browser action proof

Same-task down/up events produced real simulation consequences with the active Lit Commando production atlas:

- desktop pointer fire: ammo `8 -> 7`
- desktop melee tick: `33`
- desktop grenade charges: `3 -> 2`
- desktop dash ready tick: `637`
- mobile melee tick: `32`
- mobile grenade charges: `3 -> 2`
- mobile dash ready tick: `637`
- browser errors: `0`

## Memory disclosure

The experimental browser absolute threshold is not green: both untouched production and local Cycle 002 retain about 10 MB during the same 30-second held-action run. Local retained `10,154,499` bytes; production retained `10,196,991` bytes. Cycle 002 is `42,492` bytes lower and therefore introduces no measured regression, but the shared renderer/runtime slope remains open debt.

See `MEMORY-AUDIT-AAA-CYCLE-002.md`.

## Authority and deployment

- Production remains `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`.
- Durable rollback remains `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`.
- Preview `dpl_7jXSC1fjXSPtnAzEkzZx97CgTNXN` is Ready and artifact-verified.
- Preview URL: `https://lesters-arcade-ck25dqelb-justin-agent-projects.vercel.app`
- No production alias has changed.
- No LitVM transaction or deployment occurred.
- Production promotion requires explicit approval for the exact verified Cycle 002 deployment.
- LitVM activity requires separate explicit HALT approval.
