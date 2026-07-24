# RED evidence: reboot-17

## Intentional contract failure

Command:

```text
node --test tests/hmh-reboot-performance-profile.test.mjs
```

Initial result: exit `1`.

The test runner failed with `ERR_MODULE_NOT_FOUND` for `apps/hmh-reboot/src/runtime-performance.mjs`. There were no deterministic desktop/mobile render profiles, no in-place effect compactor, and no dedicated browser performance gate.

## Incremental RED

After the pure profile and compaction module existed, four tests passed and the runtime-integration test remained RED because `smoke:hmh:performance` and `scripts/hmh-reboot-performance-browser-smoke.mjs` did not exist.

The first browser measurement passed frame and heap limits but rendered zero particles at the opening spawn. That was vacuous evidence. The harness was moved to an evidence-safe authored hazard tour and now requires nonzero particle work plus nonzero active enemies with a lower animated count.

## GREEN

The contract became GREEN only after:

- desktop, mobile, and reduced-motion projection profiles were immutable and input-validated;
- Pixi resolution and antialias settings consumed the profile;
- world, enemy, projectile, death, and combat-effect projection used inclusive culling;
- expired visual events compacted in place;
- mobile particles were bounded at six per visible hazard;
- the real browser gate enforced bundle, frame-tail, long-task, heap, culling, particle, and error budgets;
- deterministic subsystem soaks and combat/cockpit/embedded browser regressions passed.
