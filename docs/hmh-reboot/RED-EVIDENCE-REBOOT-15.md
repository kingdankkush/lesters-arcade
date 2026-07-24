# RED evidence: reboot-15

## Intentional contract failure

Command:

```text
node --test tests/hmh-reboot-world-production-art.test.mjs
```

Initial result: exit `1`.

The test runner failed with `ERR_MODULE_NOT_FOUND` because `apps/hmh-reboot/src/world-production-art.mjs` did not exist. This established the contract before implementation for six district materials, blocker and landmark kits, complete interaction coverage, deterministic bounded particles, tick-derived shader states, projection-only authority, and runtime integration.

Full output was retained during implementation at `.tmp/hmh-reboot-world-production-art-red.log`.

## Visual RED blocker

A clean 390 × 844 production-mode browser capture showed the full desktop combat status clipped off both mobile viewport edges. The runtime was changed to a centered two-line compact mobile status. A rebuilt clean capture verified that both lines fit without overlapping the session panel, minimap, or touch controls.

## Browser-smoke reliability blocker

The mobile smoke originally sampled `enemyDeathVisuals` after later dash and layout checks. Because the production death projection intentionally lasts only 30 simulation ticks, this was timing-dependent. The smoke now observes and records the death projection immediately after the grenade event, then performs later checks independently. This preserves the requirement without extending presentation lifetime or changing authoritative retirement.
