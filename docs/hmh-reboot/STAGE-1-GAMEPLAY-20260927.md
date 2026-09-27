# HMH stage 1 gameplay: the 1.9.0 release (2026-09-27)

Hard Money Heroes v0.6: cabinet `0.6.0`, run summary schema 7, shipped in site/game 1.9.0 on top of the 1.8.6 line. This is the owner-facing summary of branch `fable/hmh-gameplay`. The detail lives in `docs/hmh-reboot/design/LEVEL-1-BUILD-LEDGER.md` (per slice) and `docs/hmh-reboot/design/HMH-RUN-SUMMARY-V7-CONTRACT.md` (§16, the Ranked contract).

## What shipped

| Slice | What it is |
|---|---|
| 1. Foundations | Lazy loading for the level-up panel, card text, the boss, the objectives and the briefing (−38.6 KB of initial JS), which paid for everything below. |
| 3. Death camera and manual dodge | A 1.2 s death clip before the result. Left Shift dodges on the keyboard; touch and gamepad keep the automatic dodge. |
| 4. Mission core v2 | Machines you operate by standing still in a ring (crank, valve, lever), items you carry (the Winch Handle), secrets you walk into, gates that open. A tracker pill points at the next step. Objectives grant XP scaled to your level; each secret gives 20 silver. |
| 5. Boss kit and the reworked Liquidator | The player starts the boss. He is ready at 10:00 and starts when you ring the Closing Bell on the Margin Floor, or walk into the Dark Pool after finding the warehouse logbook (no intro there, and a win grants the Golden Parachute: one revive at 50% HP). New attack table, three phases with a Trading Halt at each threshold, a retreat ring, locks that close behind you. A defeat heals you fully, refills grenades, drops a 25-coin burst and opens his vault (the Arc Rifle cache). |
| 6. Progression release | Level-ups show two cards, and each card can be re-rolled once per offer (R or gamepad X). Card 2 follows the gun you use. Twelve new gun cards (Shotgun, Machine Gun, Railgun, Launcher: rate of fire, damage, Magazine & Salvage). Gun fixes: the Launcher fires real shells, Extra Grenade raises the maximum, crits reach every held gun, the nuke reaches about 1,100 units instead of the whole map, a cache no longer steals your active gun. |
| 6. Balance option (a) | The finite guns sustain their own trees: a Magazine & Salvage pick refills one reserve grant, and ranks 2 and 3 trickle ammo back every 15 s. |
| 7. Genesis Seal and wave-1 evolutions | A boss drops a Genesis Seal. It evolves a gun you have mastered (every card of that gun at its maximum), or banks until you master one. Five evolutions: Settler Rail (Pistol, from a panel only), Double Spend (Shotgun), Hashstorm Overdrive (Machine Gun), Moonshot (Railgun), Crypto Bomb Orbit (Launcher). |
| 8. Prisoners | Built and flagged off (see below). |
| 9. Run summary schema 7 | The child reports objectives, prisoners, bosses, evolutions and re-rolls to the parent, and Ranked verifies them. |

## What players notice

- Runs have a map to work: rings to stand in, a winch to find a handle for, secrets behind seals, and gates that open shortcuts. The tracker says what to do next.
- The Liquidator waits for you. At 10:00 the Closing Bell lights; you decide when to fight, and where (the open Margin Floor, or the cramped Dark Pool for the Golden Parachute).
- Every level-up is a choice between two cards with a re-roll on each, and your guns get their own trees.
- Beating the Liquidator drops a Seal that can evolve a mastered gun.
- The keyboard gets a dodge key, and death plays a short camera clip.
- Fewer sounds: the objective chime, enemy tell cues, the upgrade pick, the dash and the weapon-switch click are gone (the owner's audio list).

## Balance numbers

From the progression harness (`node scripts/hmh-progression-model.mjs`, 16 seeds × 3 policies against the 1.8.1 baseline; the gate fails only on growth above +10%):

| Median survival | 1.8.1 | 1.9.0 | Change |
|---|---|---|---|
| Pooled (the gate) | 16.85 min | 15.50 min | −8.0% |
| `seeded` | 16.34 | 15.30 | −6.3% |
| `power` | 17.57 | 15.13 | **−13.9%** (−17.1% at 48 seeds) |
| `survival` | 16.85 | 16.57 | −1.6% |

Other figures: a median of 28 offers per run (1.8.1: 30.5), median final level 29, a median of 837 kills (927), Pistol mastery in 4 of 48 runs (18). The lower quartile is still 25% short: more runs die at the start of the elite band.

Real-child corpus (the unmodified 1.9.0 child driven headless under Ranked identities, 128 runs, fourteen pilot styles): the longest run ends at 29,043 ticks (8:04), and no pilot, including two survival-first styles built to ring the bell, lived to the Liquidator's 10:00. Scripted pilots are weaker than people, so this is a floor, but it says the boss comes late for anyone who is not playing well.

Evolutions against the same gun maxed (`docs/qa/hmh-weapon-benchmark.json`): Settler Rail 0.87× the maxed Pistol single target and 2.35× on a queued pack; Double Spend 1.51× on a line; Hashstorm 2.16× on a column. Moonshot (1.00×/1.07×) and Crypto Bomb Orbit (1.03×/1.00×) miss the package's 1.25× pack target with the package's numbers.

### Open decision: the `power` policy

The gate passes with one warning: players who spend picks on gun cards first (the `power` policy) lose about 14% of their run length. Ammo is not the cause; the harness fed those guns and they stayed short, because gun cards displace the damage, crit, health and Pistol picks that pay all run. The choices:

1. Accept `power` at about −14%.
2. Option (b): weight or cap gun cards in the offer (card 2 comes from guns with ammo, so a fed gun keeps offering them).
3. Strengthen the Railgun and Machine Gun trees, which fail the package's `output60` bar with ammo to spare.

Each needs a harness re-run. The evolution tuning (Moonshot's floor or crit bonus, and measuring Bomb Orbit on a tougher pack) is a second, smaller decision.

## Ranked and the verifier

- The child emits schema 7; `server/verify/hmh.mjs` accepts schema 6 or 7, schema 7 only from a build whose game version is 1.9.0 or later by numeric compare (1.9.0, 1.9.1 and 1.10.0 pass; 1.8.9 fails). A cached 1.8.x child still sends schema 6, which verifies under a 1.8.x or a 1.9.0 build hash.
- Every v6 consistency rule is mirrored on the v7 path, the round-3 melee rules included, with the 1.9.0 child's own tables pinned in `sdk/hmh-run-contract-v7.mjs` (contract §16.8 and §16.9). The grenade supply counts boss refills and Quartermasters; the launcher counts emitted shells.
- The honest corpus: 128 runs, 123 ok, 5 flagged (the soft `kills-near-capacity`), 0 rejected, no child error. It covers objectives (658 completed), re-rolls (373) and every weapon; it has no boss fight, Seal or prisoner, which the fixtures cover.
- A maximal child summary is 21,197 B in its bridge envelope (the limit is 65,536).
- Same seed, same run: two runs of `node scripts/hmh-sim-digest.mjs` (36,000 ticks, both scenarios) give one combined digest, `f2b03b23…` (crowd `f925b467…`, director `3e46a4fb…`).
- HMH initial JS + shared: 1,038,930 B of 1,048,576 (9,646 B headroom), child entry 318,012 B of 480,000.
- The cabinet label reads "HMH v0.6". Rows with no build hash at all (chain-index rows) now read "HMH v?", since two cabinets have shipped.

## Flagged off

- **Prisoners** (`PRISONERS_LIVE_DEFAULT = false`). Six cages, four kinds (Field Medic, Quartermaster, Pawnbroker, OG Miner), dealt from the seed. They stay dark until the prisoner art exists, because a placeholder cage with no human in it breaks the "actors read as humans" rule. `?prisoners=1` shows them outside Ranked for review. Turning them on also means removing the site heal and ammo grants and building the guard crews.
- **Three district bosses** (the Rug Pull Baron, the Lockkeeper, the 51% Foreman) and the two boss-held prisoners: in the contract and the verifier, not registered in the child. Their rows stay zero.
- **Wave-2 evolutions** (Lightning Network, Burn Address, Chain Split): refused by those guns' policies and never offered.
- Placeholders until art: the Genesis Seal disc, the evolution moment (a gold burst and the pickup cue), bomblet beads, the Golden Parachute pip.

## Requests for the parent

These are outside the child and listed in full in the ledger's "Requests for the parent":

- Portal copy in `apps/portal/hmh-reboot/index.html`: name the keyboard dodge, describe standing in rings instead of "interacts automatically", mention the Closing Bell.
- Styles in `styles.css` for the re-roll strip (44 px, off the details toggle), card 2's gun chip, the evolution banner, the wheel's mastery pips and evolved ring, and the boss bar's phase markers (read `--boss-marker-1/2`). The child sets inline stopgaps.
- Recap: the new boss attack labels, the twelve gun cards and the evolution names.
- The death camera: the child sends its result 1.2 s after the defeat; the parent must not add its own 1.2 s.
- A cockpit slot for the tracker pill and the Golden Parachute pip.
- Fence or retire the legacy parent evolution system that reuses the child's evolution ids.
- Visual certification of the level-up panel at 390×844, 414×896 and 896×414 (`visual:reboot`), which has not run on this branch.
