# Cycle 080 — Bounded corpse and audio lifetime cleanup

Status: isolated release candidate, not yet production-certified.

## Included
- Enemy corpse presentation expires at 2,000 monotonic milliseconds or 120 simulation ticks, whichever comes first; final 200 ms fade and 24-graphic cap. Oldest graphics are disposed before admitting another. Authoritative enemy retirement, health, score and collision remain unchanged.
- Expired combat-audio voices stop and reset the real audio element before pool reuse/removal.
- Returning-player HTML and service-worker cache tokens advance together.

## Excluded
Cycle 079 exploration/surge pacing, movement/weapon balance and delayed-attack policy remain isolated and unpublished. Its independent review still flags automatic Burner defeat-spread selection and burn-refresh origin handling. New Tripo gameplay heroes/enemies/weapons/world assets remain private candidates; texture budgets are unchanged. This release does not add live 3D ragdolls or new damage/gore systems.

## Preservation and evidence
- Based on the live STACKED/security source plus its documentation handoff. No STACKED, dependency, wallet, bridge, settlement or actor-ID changes.
- Original corpse RED and real audio expiry RED/GREEN evidence is retained in the local source workstreams. Parent isolated contract re-run: 36 passed, zero failures before syntax-registry closure.
- Exact staged-source review, clean no-Git pointer-only host build, public artifact parity and browser verification are required before promotion. The final release certificate will record those results and the rollback deployment.
