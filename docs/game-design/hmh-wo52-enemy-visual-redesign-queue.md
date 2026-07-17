# WO-52 — Enemy Visual Redesign Queue + Top-5 Exposure HALT

**Status:** SUPERSEDED by WO-99 approval.  
**Rule:** Justin approved PixelLab usage for the WO-99 enemy/boss canon uplift. Keep this page as historical exposure context; current runtime decisions live in `docs/game-design/hmh-wo99-enemy-canon-uplift.md`.

## Contact sheet

- Artifact: `docs/game-design/assets/hmh-wo52-top5-enemy-exposure-contact-sheet.png`
- Builder: `python scripts/build-hmh-wo52-enemy-contact-sheet.py`
- Source policy: historical current runtime/completion art only. WO-99 now allows PixelLab usage and uses repo-local generated/certified assets.

## Top-5 exposure targets

| Rank | Enemy | Current actor shown | Why exposed | Approval question |
|---:|---|---|---|---|
| 1 | Claim-Jumper | `claim-jumper` | High-priority ranged human; current runtime kit is partial and needs a full outlaw silhouette pass. | Approve as direction, reject, or regenerate concept variants? |
| 2 | Coyote Pack Runner | `coyote-pack-runner` | Early melee pack pressure appears often; lunge tell must read in dust/noir lighting. | Is the animal silhouette strong enough? |
| 3 | Wild Boar | `wild-boar` | Charger counterplay depends on hoof-scrape and head-down commitment. | Does it read distinct from coyote at 1x? |
| 4 | Rattlesnake | `rattlesnake` | Low-profile ambusher can disappear against ground/noir treatment. | Does coil/rattle read clearly enough? |
| 5 | Buzzard | `buzzard` true kit | WO-99 found and wired the real 8-direction buzzard kit instead of the old `crypto-bro-rusher` proxy. | Monitor flyer readability at 1x while boss/enemy polish continues. |

## WO-99 resolution

- `fullBatchAllowed: true`
- `approvalState: SUPERSEDED_BY_WO99_USER_APPROVED_PIXELLAB_UPLIFT`
- PixelLab subscription confirmed active with 10,000 generations remaining during WO-99.
- Runtime integration still requires manifest/test/contact-sheet coverage before any specific enemy or boss is claimed as complete.

## Human/zombie replacement wave (2026-07-17)

The live Level 1 roster now keeps legacy gameplay IDs for save, replay, telemetry, and authored-lane compatibility while replacing creature and machine silhouettes with human or zombie PixelLab actors.

| Runtime actor slot | New visual identity | Legacy IDs using it | Authored lane read |
|---|---|---|---|
| `coyote-pack-runner` | Road Zombie Runner | `coyote-pack-runner` | fast melee pack rusher; shoulder-drop pounce tell |
| `wild-boar` | Armored Zombie Brute | `wild-boar`, `gas-beast`, `gas-fee-wisp`, `liquidation-cascade-golem` | charger/tank/elite; boot scrape and lowered riot helmet |
| `buzzard` | Wasteland Raider Scout | `buzzard` | ranged harass human; held cyan scope glint |
| `rattlesnake` | Zombie Trapper | `rattlesnake`, `rug-rat` | upright ambusher/disruptor; open-trap and raised-cleaver tell |
| `scorpion-ambusher` | Mine Zombie Ambusher | `scorpion-ambusher`, `fud-goblin`, `fud-goblin-cave` | buried ambush/lobber family; hardhat lamp and raised pickaxe |
| `sybil-drone` | Masked Sybil Gunner | `sybil-drone`, `honeypot-turret` | ranged formation/trap human; mask laser and crouched burst |

### Production acceptance

- All six actors must ship `idle`, `walk`, `run`, `attack-tell`, `attack`, `hit`, `death`, and `spawn-in`.
- Every state must include all eight isometric directions with real PixelLab frames.
- Runtime actor selection uses explicit `runtimeActorKey`; legacy keyword heuristics are fallback-only.
- Human/zombie sprites use grounded foot anchors. No bird-hover, animal-body, turret, drone, goblin, beast, or golem silhouette may remain in the live Level 1 roster.
- Named Level 1 mini-bosses and the Rug Pull Baron remain readable humanoids; the Gas-Tax mini-boss uses the armored-zombie slot.
- Candidate loose PNGs are temporary. Promotion is fail-closed and packs only selected actors back into WebP atlases to preserve the 8,000-file repository ceiling.
