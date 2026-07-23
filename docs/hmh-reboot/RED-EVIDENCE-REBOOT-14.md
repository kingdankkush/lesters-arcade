# Reboot 14 retained TDD RED evidence

Date: 2026-07-23

Initial command:

```text
node --test tests/hmh-reboot-enemy-production-art.test.mjs
```

Initial result:

```text
Error [ERR_MODULE_NOT_FOUND]: Cannot find module apps/hmh-reboot/src/enemy-production-art.mjs
tests 1
pass 0
fail 1
```

The RED contract required:

1. Six canonical human/zombie production families.
2. Complete idle, run, tell, attack, hit, and death visual states.
3. Elite aura, crown, and outline treatment.
4. Dedicated three-phase Liquidator production art.
5. Projection-only integration into the real runtime.
6. Honest production telemetry.

After the production module was introduced, three legacy phase-gate tests remained RED because they still required `productionComplete` and `eliteEnabled` to be false and required normal-mode insertion to fail. Those tests were intentionally advanced only after the new production contract passed.

Visual browser review later caught a second real blocker: the old prototype-marker rotation made upright enemy sprites appear to lie sideways. The whole-body rotation was removed, evidence was regenerated, and upright desktop/mobile visuals passed before certification.
