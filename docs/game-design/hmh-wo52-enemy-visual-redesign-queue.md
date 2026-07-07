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
