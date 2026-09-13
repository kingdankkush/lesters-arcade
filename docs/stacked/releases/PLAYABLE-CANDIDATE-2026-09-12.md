# STACKED playable candidate, September 12

User direction: continue implementation and publish completed, verified website work. No paid entry, contracts, transactions, online settlement or online-versus service is authorized.

Implementation branch: codex/stacked-playable-release. Isolated workspace in lo/work/stacked-release. Base b0ee9046; current production lineage must be integrated before deployment. Original recovery worktrees remain untouched.

Implemented: corrected deterministic S04 evidence/replay recovery; parent-owned iframe/worker verification; cabinet and Free/Ranked mode selection; starting levels 1–15 in Free; keyboard/touch/gamepad input; pause, resume, exit, fresh runs, Free placement undo; responsive Pixi board, hold/next/ghost; six music-reactive epoch palettes with ambient fallback; optional game sounds; persistent projection preferences; local Ranked replay verification and storage transaction; canonical STACKED score tie-breaks.

Prior candidate browser proof: desktop 1440×1000 and emulated mobile 390×844 passed Free select/start/pause/resume/input/terminal verification/restart/exit, zero browser errors. These are automated Chrome checks, not human-device acceptance. Changes after those captures require a fresh run.

Review fixes: cancelling verification on teardown, cumulative Ranked pause accounting, cancelling countdown on blur, and not rerouting music until AudioContext is running. Four fixes pass targeted regression tests and independent source-only follow-up review.

Not yet certified or public: all S22 gates, human-device acceptance, long-running real-device performance, complete planned achievement/profile/leaderboard UI, accepted remapping/gesture controls, thermal governor, per-track beat maps and full visual polish. Registry remains coming-soon with developer-only entry. Local Ranked is not an online leaderboard and awards no funds.

Preserve HMH/Chikun behavior and current deployed ancestry. Do not treat this checkpoint or source review as final release acceptance.
