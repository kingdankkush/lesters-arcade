# RED evidence: reboot-16

## Intentional contract failure

Command:

```text
node --test tests/hmh-reboot-progression-ui-adapters.test.mjs
```

Initial result: exit `1`.

The runner failed with `ERR_MODULE_NOT_FOUND` for `apps/hmh-reboot/src/run-progression.mjs`. At that point there was no deterministic score/XP reducer, bounded upgrade catalog, score-result adapter, or cockpit markup.

## Incremental RED

After the progression and adapter modules were implemented, four reducer/adapter tests passed and the cockpit contract remained RED because `apps/portal/hmh-reboot/index.html` did not contain `#hmhRunScore`, menu/music/profile controls, or distinct pause and upgrade panels.

## GREEN

The contract became GREEN only after:

- six bounded upgrades and deterministic three-choice selection existed;
- duplicate retirement IDs and invalid public inputs failed closed;
- score-result checksums were deterministic and protocol-shaped;
- adapters contained no wallet or settlement authority;
- the page exposed accessible run, audio, profile, pause, and upgrade controls;
- responsive liquid-glass styles and reduced-motion handling were present;
- the live runtime exported real score, XP, level, max health, and score-result payloads.
