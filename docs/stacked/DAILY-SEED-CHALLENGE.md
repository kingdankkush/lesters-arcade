# STACKED daily seed challenge — original design and current checkpoint

Original proposal written for 1.9.0; it did not ship then. The optional Free-only 2.0 implementation is now checked locally: [F2b checkpoint](../2.0/slices/STACKED-F2B-DAILY.md). It remains off by default. The ghost and any Ranked daily board below remain future design; ordinary Free and Ranked seeds are unchanged.

## What it is

Once a UTC day, every player gets the same STACKED piece bag and the same ledger (garbage) holes. A run on the daily seed is an ordinary run, with its score set against everyone else's on that day. The deterministic sim already guarantees that the same seed and inputs give the same result tuple, so the daily run needs no new game rules.

## Why it fits STACKED

- The sim is seed-pure: `createSeededSubstreams(seed, ['bag', 'garbage', 'zone'])` in `apps/portal/src/stacked-sim.mjs` derives every random draw from the one uint32 seed.
- Every Ranked run is already replayed from its SIC1 evidence on the server (`server/verify/stacked.mjs`) and in the verify worker, so a daily leaderboard entry can be proven the same way.
- Chikun already ships the same pattern (`apps/portal/src/chikun-daily-challenge.mjs`): a parent-owned seed from the UTC day, a same-seed local ghost and a seek-safe replay viewer, all projection-only.

## Seed derivation (parent-owned)

The parent derives the seed and hands it to the child in `portal:init` `session.seed`, exactly as it does today. The child never computes or replaces it (AGENTS.md runtime authority).

```text
dayKey = UTC date of the session start, "YYYY-MM-DD"
seed   = fnv1a32("stacked-daily-v1|stacked|" + dayKey)
```

This mirrors `deriveChikunDailySeed` with a STACKED-specific version tag, so the two cabinets never share a day's seed. A seed of 0 is normalized to 1 by the sim, as for any seed. Changing the derivation means bumping the version tag, which moves every future day to new seeds without touching past evidence.

## Modes

| | Free daily | Ranked daily |
| --- | --- | --- |
| Seed | Parent daily seed | Parent daily seed, bound into the canonical session like any Ranked seed |
| Evidence | Recorded, kept on the device | SIC1 evidence replayed by the server before any write |
| Result | Local best per day and a same-seed ghost | Parent-owned daily board; needs its own approval (see below) |
| Undo | Allowed, marks the run assisted and unranked, as today | Not offered, as today |

Free stays isolated from Ranked progress: a Free daily run writes only device-local data, under its own key.

## Ghost (optional, projection-only)

Replaying the day's best local evidence with `replayStackedRun` gives the full tick stream, so a ghost can show the best run's stack height or score line beside the live board. Like the Chikun ghost it reads replayed snapshots only and must never feed input, collision, garbage, RNG or the result.

## Invariants it must keep

- Fixed 60 Hz simulation, at most four catch-up steps, same-seed determinism.
- The parent owns the seed, session identity, leaderboards and settlement; the child only plays the seed it is given.
- The result tuple, SIC1 codec, contracts and `STACKED_SEASON_ID` do not change, so existing evidence keeps verifying.
- No paid entry, prize or settlement is attached to the daily board. Enabling any of them needs a separate explicit approval.

## Open decisions before building it

1. Whether the daily board is Free-only (device-local bests), or also a parent-owned Ranked board. A Ranked board needs the parent leaderboard and server verification wired for a per-day key, plus owner approval.
2. What counts as the day: the UTC date when the parent issues the session (proposed), so a run that crosses midnight stays on the day it started.
3. Whether a player may retry the daily seed without limit (proposed for Free) or only once (common for Ranked daily modes).
4. Where the entry sits in the one STACKED menu without crowding the mode tiles on small phones.

## Suggested slices

1. Parent: `stacked-daily-challenge.mjs` with `utcDayKey`, the seed derivation and `bindStackedDailyChallenge(session)`, with RED tests that pin the derivation for fixed dates.
2. Portal: a Free "Daily" entry that binds the daily seed; a same-seed determinism test that replays one evidence file on two days' sessions and shows only the seed changes.
3. Child: a daily label in the HUD and a local per-day best, stored under a new versioned key.
4. Later, and only with approval: the ghost, and a parent-owned daily board.
