# Input mask clarification v1 and unresolved cadence conflict

Status: clarification of the implemented encoding, **not approval of a changed simulation**. The imported contracts remain byte-preserved. This note records a contradiction that must be resolved before S-15/G-19 input acceptance.

## Physical state is not the recorded mask

- Keyboard/touch/gamepad handling lives outside the deterministic simulation.
- The input adapter expands physical held directions into committed per-tick movement pulses. The recorder stores exactly the mask handed to `step`.
- In the currently accepted implementation, moveLeft/moveRight require a rising edge (with the already specified opposing-direction takeover). Repeating the same single-direction bit does not produce another movement.
- softDrop is level-triggered. Drop/rotation/hold actions retain their specified edge detection and precedence.
- Pause/blur/hidden visibility reserve one neutral commit; resampling cannot overwrite it or rewrite a previously committed tick. A paused tick does not advance simulation time.
- All eight bits remain legal; a fabricated limit on simultaneous bit count is not part of the contract.

## Conflict requiring adjudication, not a silent workaround

Contracts §2.3 simultaneously specifies rising-edge horizontal movement and claims that ARR=1 means one cell per tick and a queued nine-column drag drains in at most nine ticks. Those claims do not follow from the accepted edge detector: a same-direction pulse requires a clearing tick before the next rising edge. The current adapter therefore has a two-tick minimum repeat spacing, including ARR=1. One-column-per-tick remains an upper bound, not an attained sustained same-direction rate.

The delivery must not claim the promised touch/ARR timings based only on the setting value. Before S-15/G-19 acceptance, explicitly choose either (a) preserve this encoding and revise the handling/touch timing promises and UI disclosure, or (b) adopt per-tick horizontal intents through a versioned simulation amendment, new golden/replay certification, and cross-device tests. Do not change the frozen action alphabet or edge interpretation implicitly while adding touch controls. No such mechanics change is made by this note.

## Table indexing

Gravity uses `[min(level, GRAVITY_LEVEL_CAP)]`, with index zero duplicating level one. Lock delay/reset tables use `[min(level, LOCK_LEVEL_CAP) - 1]`. Source comments now record both conventions; numeric exports and generated contract data are unchanged.
