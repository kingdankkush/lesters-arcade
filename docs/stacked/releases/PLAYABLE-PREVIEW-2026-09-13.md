# STACKED playable preview — September 13

This is a developer-playable candidate, not the complete S22 public launch.
Branch: `codex/stacked-playable-release`, including production source `1a8d4f42`.
The owner's request is to continue the game and publish completed, verified work.
Exact production promotion and recorded physical-device acceptance remain gated.
Paid entry, funds, settlement and online multiplayer remain disabled.

## Completed in this continuation

- Sixteen Free practice medals in the cabinet results screen, stored only under
  `stacked-free-medals-v1`. Assisted and Ranked runs never touch the shelf.
  Single-run thresholds stay single-run; repeated terminal delivery is idempotent
  within the bounded recent-session window. Storage failure is disclosed.
- Keyboard-accessible start, results and pause dialog; focus stays inside the
  open dialog, Space activates buttons, and gameplay regains focus on resume.
- Results place Play again and Back to arcade before optional settings and the
  expandable medal list. Disclosure targets are at least 44 pixels high.
- Ranked storage uses one atomic full snapshot, with exact readback. No fallback
  removes other games' avatars or boards to make room. Quota rejection leaves
  both the prior durable save and live state untouched.
- The profile feed and session links read the durable STACKED archive after
  reload. Records remain labelled local previews, never online receipts.
- Release checks match the new cache marker and the HMH/STACKED render guard.
  The security sweep now includes the STACKED child source.

## Verification

The first cloud candidate, `dpl_61BuCxVztwZ2S9aTSdSsv4MrszWz` / source `5db0e019`,
failed four release assertions: two stale cache assertions, one old render-guard
shape and the README cache marker. All four were reproduced and corrected;
the retirement ledger and test requirements were not weakened.

Actual Chrome Free flow passed at 1440×1000, 390×844, 320×740, 768×1024 and
1024×768: cabinet → mode art → settings → Space start → pause/frozen tick →
resume → keyboard or touch input → natural terminal → parent replay verification
→ medal persistence → preference persistence → restart → exit. All five reported
live audio data and zero browser errors, with no document overflow. Known
first-party same-origin iframe sandbox warnings remain; this is not a claim of
an untrusted third-party security boundary. Screenshots were inspected locally.

Measured initial STACKED JavaScript: 563,443 bytes, including 28,143 entry bytes,
496,615 vendor bytes and 38,685 shared bytes. Caps remain 29,000 / 607,000.
HMH initial JavaScript, including shared chunks, remains 1,041,489 bytes under
its unchanged 1,048,576-byte cap. No dependency changes; npm audit: zero findings.
Syntax: 587 JavaScript modules and 86 Python scripts passed.

Independent review reproduced the original quota/history bugs. A separate
follow-up cleared the fixes and Free isolation, with 77 passing Node tests plus
quota/readback, 60-run reload and cross-game/wallet probes. This is not a
physical-device or real-wallet certificate. Fresh cloud certification is next.

## Still open

The cabinet remains coming-soon publicly, with entry behind `?devCabinets=1`.
Remaining work includes full game-scoped Ranked achievements and badge art,
complete STACKED profile/leaderboard columns, remapping and accepted handling
settings, advanced touch/gamepad controls, thermal/performance governors,
projection-firewall and long-browser-soak gates, richer epoch visuals and
physical-device playtests. Local Ranked is a zero-fee unshared prototype;
real-wallet end-to-end verification remains unproven. Do not call this preview
completion of the original game plan or flip the public cabinet on its evidence.
