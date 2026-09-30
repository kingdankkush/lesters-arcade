# Course two — playable private candidate

September 30, 2026. Implements the owner's approved prototype package; this is
not a released or Ranked-certified course. Normal play and official verification
still use the existing v6 course. No cabinet/site/game version changed.

Open the local portal with `?course=2`, enter as Guest and choose Chikun Free
Mode. The host forwards the switch only for explicitly unranked Free sessions;
the child independently checks the same session fields. Start/results label the
preview. It sends no result, updates no daily ghost/best, and offers no score
sharing. Input replays can be exported/imported and scrubbed locally.

Implemented rules:

- Scrypt Shield absorbs one obstacle/chase hit. That same overlapping hazard
  cannot immediately hit again. A shield hit is not a near miss or flawless pass.
  Falling below the course still ends the run.
- Coin Magnet attracts coins within 180 logical pixels for 480 simulation ticks.
- Glide Feather stores one gap charge. Holding jump while over a gap spends it
  and caps falling speed at 1.3 pixels/tick while held over that gap. Releasing
  restores ordinary falling; returning to ground ends the gap charge.
- A raised vine trellis leaves a clear lower path and a five-coin upper route.
  Its centre coin shares the ordinary obstacle coin identity and cannot pay twice.
- One seeded tractor/hawk chase per lap: 120-tick warning, then 600 active ticks.
  Both use explicit collision geometry. Their final art remains to be improved.

`chikun-input-evidence-v7` records delta-encoded flaps and held-glide toggles.
The held state starts false; each toggle changes it. The total input budget is
12,000 transitions. If both inputs request the final slot, flap wins and the
hold transition is ignored; the run ends with replayable canonical evidence.
The parser rejects extra keys, invalid seeds/ticks/deltas, over-budget streams
and any input at or after the actual terminal tick. Frozen historical runtimes
and the default v6 implementation are unchanged.

Independent review found/fixed the simultaneous final-slot overflow, doubled
middle route coin and shield-hit near-miss scoring. Integration review found/
fixed held-key release after toolbar focus, mixed daily ghost/share presentation,
and the imported-course label. Focused tests cover these boundaries, held-input
file/seek parity, official rejection of v7 and old v6 server verification.

Remaining: full magnet/feather playtesting, course difficulty/balance and final
obstacle art; official game-version-to-evidence dispatch in its release slice;
parent/server review for that dispatch; physical-phone acceptance. No current
Ranked session may opt into v7 through a URL. Do not mark this course finished or
enable it for official scores merely because its private replay tests pass.
