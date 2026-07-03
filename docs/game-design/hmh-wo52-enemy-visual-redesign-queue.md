# WO-52 — Enemy Visual Redesign Queue + Top-5 Exposure HALT

**Status:** HALT awaiting Justin top-5 contact-sheet approval.  
**Rule:** Do not generate, commit, or integrate a full enemy art redesign batch until Justin approves the top-5 exposure sheet below.

## Contact sheet

- Artifact: `docs/game-design/assets/hmh-wo52-top5-enemy-exposure-contact-sheet.png`
- Builder: `python scripts/build-hmh-wo52-enemy-contact-sheet.py`
- Source policy: current runtime/completion art only; no PixelLab, ComfyUI, or paid generation used.

## Top-5 exposure targets

| Rank | Enemy | Current actor shown | Why exposed | Approval question |
|---:|---|---|---|---|
| 1 | Claim-Jumper | `claim-jumper` | High-priority ranged human; current runtime kit is partial and needs a full outlaw silhouette pass. | Approve as direction, reject, or regenerate concept variants? |
| 2 | Coyote Pack Runner | `coyote-pack-runner` | Early melee pack pressure appears often; lunge tell must read in dust/noir lighting. | Is the animal silhouette strong enough? |
| 3 | Wild Boar | `wild-boar` | Charger counterplay depends on hoof-scrape and head-down commitment. | Does it read distinct from coyote at 1x? |
| 4 | Rattlesnake | `rattlesnake` | Low-profile ambusher can disappear against ground/noir treatment. | Does coil/rattle read clearly enough? |
| 5 | Buzzard | `crypto-bro-rusher` proxy | Current exposure sheet intentionally shows proxy-like art because buzzard needs a true flyer silhouette. | Generate true buzzard variants or defer flyer redesign? |

## Required decision before full batch

Justin must choose one of these outcomes for each top-5 row:

1. **Approve current direction** — proceed to a small approved redesign batch for that enemy.
2. **Reject direction** — rewrite the brief before any generation.
3. **Defer** — keep current runtime/proxy art for now and do not spend generation credits.

Until that happens:

- `fullBatchAllowed: false`
- `approvalState: HALT_AWAITING_JUSTIN_TOP5_CONTACT_SHEET_APPROVAL`
- no enemy replacement art is integrated into runtime
- no credit-spending generation is started
