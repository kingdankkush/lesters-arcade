# Combined gameplay visual-capture correction

The 12-scene renderer gate retains its existing full-frame and enemy-crop thresholds. Captures now pause through the runtime's Escape handler in the browser turn that publishes the requested simulation tick (90, 180, 240, or 420), and assert that the frozen tick remains exact.

The opening-art readiness transition deliberately clears held gameplay input. Previously, external mouse/touch automation could apply its aim before that reset or several frames afterward. This changed which opening enemies auto-fire defeated and could leave the phone enemy-crop gate with no body on camera. The visual fixture now applies its opening aim through the existing pointer handlers immediately after artwork readiness. It never writes health, actor positions, RNG, simulation ticks, or result state. Phone gesture acceptance remains covered by the independent real-touch controls browser smoke.

The phone baseline was reviewed with both the whole frame and the per-enemy metrics. It now keeps the opening opponents alive for the intended crop comparison. Actor scale, grounding, depth order, HUD bounds and controls were inspected; no threshold was widened and no crop gate was removed.

Evidence: visual-fixed-timing.log records the first desktop timing correction. The final visual-accepted.log and visual-verified.log record the reviewed baseline and independent repeat. The earlier failed attempts remain in the local release evidence folder. A failed diagnostic attempt is not counted as a passed gate.
