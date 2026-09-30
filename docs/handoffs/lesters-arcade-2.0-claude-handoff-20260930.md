# Lester's Arcade 2.0 — Claude takeover handoff

Prepared September 30, 2026. Owner requested a deliberate stop and transfer to Claude. This is a continuation guide, not a release receipt or a claim that the overhaul is finished.

## 1. Start here

Continue the full visual overhaul of Hard Money Heroes (HMH), Chikun's Escape and STACKED, plus achievements, unlockables and supporting site/blog work. The owner explicitly chose **full scope, release later**, rather than shipping a smaller completed subset. Finish integration, art, animation, polish, optimization and verification before publishing. Prioritize visible, high-impact delivery; the owner has spent substantial usage and does not want repeated broad audits, speculative harnesses or endless prototype iterations.

The latest product batch is committed locally as **`1ad8881e0`**, on **`codex/visual-overhaul-200-20260929`**, in:

`C:\Users\just_\lesters-arcade-wt\visual-overhaul-200`

The preceding substantial batch is `012c35811fdc7be6a1b74788c32052efde85cf91`. This handoff will have its own subsequent documentation commit. Obtain the current full HEAD with Git rather than treating the content checkpoint as the branch's final HEAD.

**Nothing from this turn was deployed or pushed.** Code and assets are in the local Git worktree, not embedded in this Markdown file. A Claude agent on this machine can use that checkout; a remote agent needs the repository and its LFS objects separately. Do not start again from production and lose the accumulated overhaul branch.

Read this handoff, then:

1. `AGENTS.md`, current README release section and its referenced release receipt.
2. `docs/handoffs/lesters-arcade-2.0-visual-overhaul-handoff-20260929.md` — original full scope and exact release process.
3. `docs/handoffs/lesters-arcade-status-and-roadmap-20260927.md`.
4. `docs/hmh-reboot/REFERENCE-CHARACTER-MODELS.md`.
5. `docs/2.0/PROGRESS.md`, `RELEASE-CHECKLIST.md`, and only the owning slice documents for your next task.
6. `docs/2.0/ACHIEVEMENTS-UNLOCKABLES-SITE-BLOG-PLAN.md` and `docs/art/ART-DIRECTION-2.0.md`.

AGENTS also identifies the Web3 guide, jackpot operations, historical HMH rollout, AAA roadmap and compatibility contracts. Observe their boundaries, but do not turn historical completed cycles into a new work queue. Older release numbers in AGENTS are historical; verify current truth.

## 2. Verified baseline and ownership

Last refresh: **2026-09-30 20:34:56 UTC**.

| Item | Observed state |
|---|---|
| Remote integration | `origin/fable/master-list-20260916` = `04366747f79d281af4fd18992f9ccfd857153b5c` after fetch |
| Overhaul ancestry before latest batch | 0 commits behind / 84 ahead of that remote; latest product batch adds one |
| Public health | `https://lestersarcade.io/api/health`: healthy, version **1.9.4**, paused false, degraded false |
| Public service worker | `lesters-arcade-v64-share-warm` |
| Local integration checkout | `C:\Users\just_\lesters-arcade-fable0916`, local branch HEAD `28a69f02856d9e112744e2d2daea504d29f65412`; differs from refreshed remote |
| Existing release checkout | `C:\Users\just_\lesters-arcade-wt\rc-190`, `fable/share-warm-194`, HEAD `04366747` |

Do not move, reset or edit another session's checkout. Check whether **“Lester's Arcade pre-deployment tasks”** is running and coordinate before shipping. It was not found in the latest available 50-chat listing; that is **not proof it is stopped**.

All agents used for the latest batch finished. Owned preview servers/Chrome and heavy jobs were closed; the final exact heavy-lock marker was removed. Recheck processes/locks on takeover, since another session may subsequently start work.

Preserve these lane worktrees:

| Lane | Worktree suffix under `C:\Users\just_\lesters-arcade-wt\` | Latest recorded HEAD |
|---|---|---|
| Art | `200-art-slice` | `b68078009379aa145cf5595f094956681ccc3db4` |
| Characters | `200-character-pilot` | `7605440234fa268ccfb85ac6983f6d96808f83bd` |
| World | `200-world-w0` | `ffc9a91b9a0f550e9d60effea53d7c6db8b4ae66` |
| Chikun polish | `200-chikun-polish` | `dd2e5163065bc78ea89b90c7392abe246470fd1b` |
| STACKED replay | `200-stacked-replay` | `96af6f3e708bd62820264e3f91470b78e36d69af` |

Do not blindly merge every lane branch. Much has already been gathered selectively. Art has known unrelated copied pointer/fade edits: inspect before touching. Its `5a5c13f79` is a copied baseline, not new work to gather.

## 3. Non-negotiable contracts and owner decisions

- HMH simulation is deterministic 60 Hz, maximum four catch-up steps. Presentation randomness never consumes simulation RNG. Rendering, animation, lighting, sound, gore and camera must not alter collisions, AI, damage, spawning, score or evidence.
- HMH alias `hmh`, game ID `lester-blaster`, profile `wo71`, save schema 2, bridge `hmh-bridge/v1`, message limit 65,536 bytes. Parent owns wallets, persistence, official completion, achievements and settlement.
- Gameplay changes get separate tested slices and independent verifier review. New map/rules require run-version dispatch; old runs must continue verifying. Chikun/STACKED replay exactly; HMH verifies plausibility.
- All HMH actors visibly human survivors or zombies; follow reference models. Reuse source assets first. No new paid generation occurred in this batch. Check casting board/Tripo balance before credit spend; do not touch credentials or `~/.tripo`.
- Do not touch contracts, transactions, fees, jackpot, authority, settlement flags, keys, vault secrets or Vercel secrets. Testnet verification is not real-money settlement.
- Never push to main or bypass hooks. Commit footer: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Only change SITE_VERSION/GAME_VERSION/cache marker in the release commit. Tests cannot depend on Git or personal archive paths; Vercel has no `.git`.
- Owner approved the recommended prototypes: tall cover 60% reduction; short cover 40%; Full gore default with Off/Reduced and clean shares; enemy grunts/deaths and footsteps, silent heroes; Chikun power-ups, chase and fork lanes. Keep current jukebox and measure before balance retuning.
- Owner approved judgment on rewards: two additional HMH trophy achievements, three completion trophies, per-game Ranked rarity, twelve rewards, Early Supporter badge, optional gyro off by default. These approvals are scope, not evidence of implementation.
- Owner's phone is **iPhone XS Max, Chrome**. iOS unknown. Desktop Chrome phone framing is not a physical-device performance result.
- Art bible/vertical slice, 3D phone performance, playable ten-area greybox and final release acceptance remain meaningful checkpoints. General praise is not evidence these passed.
- Owner has repeatedly authorized publishing the completed full update. Latest request is to pause and hand over, not deploy this incomplete candidate. Confirm the final candidate is covered by release approval and follow the exact release procedure.

## 4. Implemented work — preserve and build on it

### HMH characters and rendering

Four heroes have optional native skinned glTF presentation: Lit Commando, Lilly, Lit Valkyrie and Lester Original, nine clips each. Selected hero loads rather than loading all heroes. Non-pistol/interaction poses retain sprite fallback where needed. Current body/weapon cosmetic tints and damage flashes are preserved, with softened fill and ground-contact shadows.

Lilly GLB 7,860,780 bytes / 27,496 triangles / 24 joints; Valkyrie 8,360,540 / 27,494 / 22; Lester 7,829,828 / 27,496 / 22. These are reused models, not completion of the requested full action sets or texture quality tiers.

Latest batch adds **Forkrunner, Liquidator Agent, Whale Enforcer, Gas Bomber and Validator Cultist**, alongside the existing Rusher. Six native clips each; native rig, body textures and tangents. Derived hood/visor/respirator fits were corrected to the actual bowed head. GLBs range 3.09–6.40 MB and 13,772–24,914 triangles. Native reimport receipts cover 30 sampled poses each. Liquidator boss also has earlier optional native work, including corrected skin vertices.

Exact visible ordinary archetypes lazy-load serially; pending/failed assets retain sprites. Disposal releases owned resources and late images. Texture/model resources remain retained until session disposal: phone memory still needs measurement. Quality actor caps low 8 / medium 24 / high 64 exist; they **are not completed low/medium/high texture tiers**.

Files: `apps/hmh-reboot/src/actor-3d-{controller,pixi}.mjs`, `main.mjs`; runtime assets under `apps/portal/assets/generated/hmh-actor-3d-pilot/`; receipts under `docs/2.0/receipts/`.

Try actual optional roster:
`/hmh-reboot/index.html?evidenceSafe=1&telemetry=1&rosterPreview=1&actor3dPilot=1`.
Desktop and phone framing both showed hero plus six enemies, all five new assets HTTP 200, no page errors. This is not the 60-enemy performance gate or final AAA character approval. Costume shapes and zombie anatomy still need art polish.

**Producer integration warning:** root gathered runtime/assets/tests/receipts, but the updated exporter/inspector/path helper remain in character commit `7605440234`. Its producer patch did not apply to root's older exporter because preceding hero producer changes differ. It was not forced. Reconcile `scripts/hmh-blender/export-hmh-actor-glb-pilot.py`, `scripts/inspect-hmh-actor-glb-pilot.mjs`, `scripts/lib/hmh_actor_pilot_paths.py`, and `tests/hmh-actor-pilot-paths.test.py` before further exports. Never replace root runtime files wholesale from that lane.

### HMH world

Ten distinct greyboxes, roads, area briefs, layout checks and dormant geometry exist for the continuous 20,000 × 14,000 map. Private connected Pixi traversal supports touch, navigation, authored collision/elevation and viewport prop residency. A Meadows relay objective is playable. The roughly thirty-mission expansion and public new-world integration are not complete.

Area names: MWEB Meadows, Litecoin City, Halving Farms, Silver Coast, Scrypt Bayou, Hashwood River, Hollow Pines, Ledger Ridge, Fork Fortress, Rugpull Woods.

Private build: `node scripts/build-hmh-world-v2-local.mjs`.
Private loopback entry: `/dist/hmh-world-v2-local/index.html?mode=free&world=world-v2-local`; choose an inspection area, then Begin. Do not accidentally publish this private build as the finished world. Old default map/verifier remain intact. W3a–W3e owning slice docs describe compatibility, dormant geometry, local runtime, connected scene and residency.

Meadows has recovered ground/farmhouse/foliage target art (`artTarget=meadows-v1`), three atlas pages: 2,011,940 encoded / 11,010,048 decoded bytes. Additional grass detail: 38,228 encoded / 262,144 decoded bytes; 103 grass cards and five grit patches. It is not final accepted full-area art.

Rugpull Woods latest pass reuses fourteen images, 850,143 encoded / 5,242,880 decoded bytes: 140 trees, 240 low plants, three stumps, ten dressed existing solids, thirty painted trail segments. Trails narrowed to 58/44 units; opaque union mask removes overlapping shoulders; hard-edged litter polygons removed after actual visual rejection. Collision, navigation, elevation and objective authority unchanged. **Center still sparse; 256px camp cards become visibly soft near 300px display size. Needs authored replacement and further art direction.** See `docs/2.0/slices/ART-WOODS.md`.

Earlier default-off legacy-map streaming (`areaStreaming=1`) bounds page leases at 16 MiB with two loads and a 15,728,640-byte reservation. That legacy map is 12,000 × 4,800; this does not prove new 20k-world performance. Earlier objective-pointer overlap and prop-fade painted-bounds fixes are committed.

### Chikun

Positive pickup feedback and corrected eight-frame eagle animation are integrated. Existing replay/daily features remain. New course two is a **private Free preview**, via portal `/?course=2` → Guest → Chikun Free.

Implemented: shield absorbs one obstacle/chase hit, magnet lasts 480 ticks with 180-unit radius, held feather charge caps descent at 1.3 through one gap, upper five-coin trellis/lower safe route, seeded tractor/hawk chase once per lap (120-tick warning, 600 active). Falling below the course remains fatal. Middle coin identity is preserved to prevent duplicate payouts.

New evidence is `chikun-input-evidence-v7`, with flap deltas and held-input toggle deltas, combined 12,000 transition cap. Strict input parsing and canonical termination implemented. Replay file import/export and seek/reset support held input. Existing versions 1–6 frozen, default remains v6. `createChikunRuntime`/`replayChikunRun` support v7; do not assume the old general `simulateChikunRun` entry handles it.

Host and child both require explicitly unranked Free preview. No result submission, daily ghost/best write or score share. Honest labels distinguish preview. Current parent/server **reject v7 as official**. Official version dispatch, comprehensive balance and final obstacle/chase art remain open.

Independent review found and fixed transition overflow, doubled middle coin, shield hit counting as near miss/flawless, held keys stuck after toolbar focus, and mixed daily/share labels. Read `docs/2.0/slices/CHIKUN-COURSE-TWO.md` before changing these rules. Files: portal `chikun-course-v2*.mjs`, cabinet/host; Chikun `course-v2-view.mjs`, main, replay-file/viewer.

### STACKED

Living Matrix/forward-flight/portal journey is implemented and enabled; fixed music-world choices remain. Matrix silver heads/green trails and slow glyph changes improved; reduced motion static. Hidden particle geometry skips work while live audio continues. A measured isolated 601-frame CPU benchmark improved 56.3 → 5.10 ms total, **excluding GPU/text upload and phone FPS**.

Free first-use tutorial, UTC daily challenge/local best, local two-player versus menu, results/rematch, input ownership, landing guides and audio/volume/cleanup exist. Versus is local Free only. Results show score, practice best and eight statistics including pieces, spins and all-clears. No colour-matching or solo gameplay rewrite.

Replay optimization: a real 432,000-tick legal run verified exactly with local maximum 195.2793 ms after S0e. S0f structural hostile-input bound is 1,296,028 bytes under 1,302,000 cap; fresh decode p50/max 30.5746/31.2152 ms, early rejection 44.7284/48.2720 ms. The sentinel case terminates early; it is **not the longest legal game**. Worst surviving legal replay and production API headroom still need proof. See `STACKED-S0*`, `STACKED-F1*`, `STACKED-F2*` slice documents.

### Achievements, rewards and site

Read-only per-game Ranked rarity endpoint `/api/achievements/stats?game=...` uses verified-player denominators, matching earning wallet/session/game, excludes chain mismatch/excluded wallets, and shows “Early” below twenty players. Thresholds: Common ≥50%, Uncommon ≥20%, Rare ≥5%, Epic ≥1%, Legendary below 1%. Five-minute cache/stale period; failure no-store; aggregate response has no wallet details. Fixture verification is not proof of live production integration.

Collection filters/showcase/progress/detail UI exists, including tier, ownership and remaining counts. Focused lazy detail card supports bounded ±35° drag tilt, keyboard/focus, reduced motion, safe touch close and static grid fallback. Existing art is reused; finished trophy 3D art is not implied.

Twelve replacement rewards are implemented with existing earning gates:

| Game | Reward | Gate |
|---|---|---|
| HMH | Silver Sentinel body finish | `score-10000` |
| HMH | Blood Moon body finish | `enemy-reaper-250` |
| HMH | Ion Pulse weapon finish | `hash-rail-specialist` |
| HMH | Sunforge weapon finish | `grenade-century` |
| Chikun | Aurora coat | `chikun-reach-coast` |
| Chikun | Comet Wake trail | `chikun-close-call` |
| Chikun | Flight Goggles | `chikun-first-flight` |
| Chikun | Prospector Helmet/lamp | `chikun-survive-4m` |
| STACKED | Arcade Prism | `stacked-first-line` |
| STACKED | Polar Circuit | `stacked-level-10` |
| STACKED | Emberglass | `stacked-halvings-3` |
| STACKED | Midnight Aurora scene grade | `stacked-survive-7m` |

HMH finishes are tints, not new costume meshes. Its preview honestly says reference. Chikun Locker and game share the hat painter; STACKED shares actual palettes, with scene grade over a reference backdrop. The original downloaded reward definitions were unavailable; these are the approved best-judgment package, not an exact recovered transcription.

Twenty-five Classic cosmetic IDs remain inspectable with earned history but cannot be re-equipped. Retired selected slots fall back safely. Same-wallet fresh reads, concurrent new choices and failed-save retries covered. Lester/Lilly character unlocks unchanged. No new server earning authority added. No real-wallet migration was executed.

Earlier catalogue intake: 124 available achievements (44 HMH, 40 Chikun, 40 STACKED), HMH 57 total rows including thirteen unavailable future rows, thirteen existing trophy/NFT candidates (3/5/5). Re-audit catalogue before adding approved new trophy gates; these are dated inventory counts, not proof of all intended new art/features.

Five authored Markdown guides exist under `content/blog/`: choose-your-first-cabinet; hard-money-heroes-find-your-exit; chikun-escape-read-the-course; stacked-build-room-to-breathe; what-a-verified-run-means. Static builder provides index/category/Atom/sitemap/llms/OG and clean route support with explicit publication cutoff. Dated September 30, not live. No final 2.0 release announcement yet. Preview banners improved. Do not publish claims beyond implemented behavior.

## 5. Verification truth at pause

| Check | Result / scope |
|---|---|
| Latest actor controller/model/assets | 47/47 pass in root; earlier lane manifest failure resolved here |
| Reward/migration/bridge/parity focused tests | 56 pass |
| Woods scene/runtime | 34/34 reported by art lane; actual integrated views inspected |
| New Chikun core | 5 pass, including max transitions and live/replay parity |
| Course + host + server focused suite | 19 pass; existing v6 fixtures and v7 rejection |
| Earlier Chikun replay/evidence coverage | 20 existing cases pass |
| Final combined build | Pass; HMH initial/shared **1,041,883 B**, cap 1,048,576, spare **6,693 B**; STACKED **581,120 B**, cap 607,000 |
| Final actual game browser run | Eight desktop/414px-phone-framed scenes pass: roster, Woods center/camp, Chikun; no page errors |
| Reward browser review | All twelve desktop and three phone previews loaded; no overflow, page errors or non-read network writes; unearned equip disabled. Final archive-label assertion failed due uppercase CSS `ARCHIVED LOOK` vs expected `Archived look`; do not report whole run passed |
| Repository strict health | **FAIL**: tracked 878 MB before staging new assets; working 914 MB; cap 350 MB. Final staged total larger; remeasure |
| Full `vercel:build`, `visual:reboot`, three-game Ranked E2E | **Not run for this latest combined batch** |
| Physical XS Max FPS/memory and 30/60-minute soaks | **Not done** |

Latest whitespace check passed. No failed release checks were bypassed. Earlier browser waits failed because frozen animation frames conflicted with frame-polled readiness; timed polling fixed that review. A phone check initially ran before bridge init; explicit readiness fixed it. Initial Woods images were substantively rejected and improved; final art still unaccepted.

Evidence remains locally under:
`C:\Users\just_\Documents\Codex\2026-09-29\you-are-taking-over-as-lead\outputs\`

- `woods-course-review/review.json` and `roster-{desktop,phone}.png`, `woods-{desktop,phone}.png`, `woods-camp-{desktop,phone}.png`, `course-shield-{desktop,phone}.png`, `course-route-{desktop,phone}.png`.
- `replacement-rewards-review/`: review JSON plus desktop coat/trail/goggles/palette/reference and phone helmet/palette/scene originals.
- `hmh-ordinary-enemy-batch-20260930/`: native enemy fit renders.

These are local evidence, not all committed or available remotely. Original screenshots retain native resolution even if a viewer preview resizes them. Browser phone frames used Windows Chrome, roughly 414×896 at DPR 3. Never relabel those as iPhone measurements.

## 6. Remaining full-scope work register

No defensible percentage-complete estimate is available: foundational code, prototype art and final accepted assets have very different costs. Treat the following as the remaining acceptance queue, not an assertion nothing has been started.

### A. World and terrain — highest visible priority

- [ ] Final art bible and target-quality in-game slice accepted by owner. Existing draft and target patches need acceptance, not another restart.
- [ ] Owner plays ten-area connected greybox; resolve actual layout/route/readability issues before area production art.
- [ ] Finish all ten areas and connecting roads with authored terrain, ground transitions, cliffs, foliage, water, buildings and logically placed varied props. Complete planned asset kit and per-area palette/material/light direction.
- [ ] Replace blurry stretched camp/source cards; improve Meadows/Woods depth, ground variation, plant distribution, landmarks and density. Do not hide weak art behind effects.
- [ ] Build objective spaces and boss arenas, safe approaches, cover, sightlines, elevation, secrets and readable entrances/exits; about thirty objectives including camps, bridge, lock and fortress staging.
- [ ] One-data-file Litecoin City branding: top ten specified LitVM projects plus Lite Strategy, Luxxfolio, Canary Capital, Grayscale and Litescribe; official quality logos where available, names otherwise.
- [ ] Complete true 20k×14k streamed world integration, memory/frame-time/nav-build measurements, versioned verifier map table and old-run compatibility. Private walking scene is insufficient.

### B. Heroes, enemies and bosses

- [ ] Reconcile native exporter producer code from character lane; preserve reproducible sources and manifests.
- [ ] Optimize rigs/topology/materials and create actual low/medium/high texture tiers. Check device texture residency, skeleton updates and LOD behavior without changing simulation.
- [ ] Finish all heroes' full clips: movement starts/stops/strafe/back/turn/pivot/slopes; dodge/dash/stumble/knockdown/get-up/stun/fall/land; cover enter/idle/shuffle/peek/fire/blind-fire/reload/hit/leave; interactions, doors/levers/valves/buttons/pickups; climb/mantle/vault/drop; water/hazard reactions; per-class weapon fire/recoil/reload/swap; melee combo/finisher; grenade throws; directional damage/deaths; spawn/victory/level-up/multikill.
- [ ] Four funny idle fidgets per hero, after idle delay, instantly interruptible and presentation-only.
- [ ] Tall back-to-wall and short kneeling cover, movement-only entry/peek/fire/exit and traversal need separately versioned/tested gameplay. Guide targets include 24-unit snap, six-tick entry, four-tick away exit; verify complete contract before implementing.
- [ ] Polish six ordinary native models beyond rough costume geometry. Expand to idle variants, charge, tell/attack, hit/stagger/knockback, multiple deaths/gore, spawn/taunt.
- [ ] Six additional enemies: Rug Puller, Pump-and-Dump Bloater, Tollkeeper, HODL Revenant, Money Printer, Oracle Marksman.
- [ ] Finish bosses Liquidator, Rug Pull Baron, 51% Foreman and Lockkeeper: rigs, phase/action sets, supers, readable tells, stagger/death and arena interaction. Only Liquidator has the current optional native pilot.
- [ ] AI approach slots, cover/flanking, suppress/grenade, retreat/regroup, telegraphs, elites, mission/pathing/stuck behavior and balance. Isolate gameplay and independently review verifier impact.

### C. Combat, VFX, sound and accessibility

- [ ] Complete eight weapons (Settler/Pistol, Block Breaker, Hashstorm, Hash Rail, Lightning Ledger, Bear Market Burner, Forked Standard, Launcher Rig), knife and Satoshi Frag: grips/models, muzzle/equip/reload clips, sound and measured balance.
- [ ] Finish every power-up's model, pickup/activation, timer and visual feedback: Time Dilation, Berserk Candle, Nuke, Bonus Life, health/ammo/silver/caches, Scrypt grenade cache and Genesis Seal; separate balance changes from presentation.
- [ ] Final muzzle/casings/tracers, dash trails, melee arcs, decals, blood/pools/gibs/crumples, explosions/smoke/scorch, lighting/camera/audio; Full/Reduced/Off gore; gore-free share cards.
- [ ] Readability, reduced motion, colour-blind cues, flash limits and audio settings throughout. Keep current jukebox unless owner approves a music change.

### D. Chikun

- [ ] Final obstacle art and continuously looping obstacle animation, character action quality, obstacle-specific death animation and positive pickups.
- [ ] Course-two complete power-up/chase/fork playtesting and difficulty tuning; currently shield/route path visually checked, not full long-run mechanic acceptance.
- [ ] Finish chase/trellis/power-up art beyond vector prototypes; verify magnet and held feather across replays, restart, pause, focus and phone input.
- [ ] Official version-based parent/server replay dispatch and bounded validation for v7 while freezing all older versions; remove preview restrictions only after certification and release decision.
- [ ] Audit guide's additional course goals/progression recommendations; do not assume they already exist.
- [ ] Chikun original-art commercial-use/modification/hosting/redistribution rights remain pending in AGENTS; resolve as appropriate. No creator revenue routing or contract changes are authorized by this handoff.

### E. STACKED

- [ ] Final visualizer quality/BPM cycle/portal continuity/forward motion and performance; finish feel, settings and accessibility polish.
- [ ] Usability/edge-case finish for already-built local versus, daily, tutorial and results. Keep gameplay; no colour-matching.
- [ ] Longest legal replay under 250 ms with exact parity and realistic server headroom, not just an early-rejected hostile input.
- [ ] Physical XS Max Chrome 60-minute soak, stable memory/input/audio and temperature behavior.

### F. Achievements, unlockables and site

- [ ] Finish all badge art/six-tier presentation and focused model viewer/fallback, without loading every model in the grid.
- [ ] Finish original trophy candidates plus approved two HMH and three game-completion trophies; establish exact earning criteria and verified authority. New geometry/art/metadata/animations are not complete just because catalogue entries exist.
- [ ] Early Supporter badge and optional gyro off by default: audit implementation status, complete if absent, test on phone.
- [ ] Validate all twelve rewards actually equipped in their games through authorized test profiles; complete final art quality and real persistence integration. Preserve Classic history and character unlocks.
- [ ] Confirm rarity endpoint/profile integration, empty/error/loading states, showcase and clean sharing with real test data. No wallet leakage. Soulbound minting is deferred.
- [ ] Finish site icons/cabinet images/favicon/apple icons/navigation/responsive/accessibility/SEO and final visual consistency; inspect current state rather than recreate existing work.
- [ ] Author accurate 2.0 announcement and final OG/share art, verify all five guide pages in final build. No social posting or outreach is authorized.

### G. Repository, performance and release blockers

- [ ] Source-art archive migration: strict repository health currently fails severely. See `docs/2.0/SOURCE-ART-ARCHIVE.md` and `receipts/tracked-art-inventory-20260929.json`. It is a plan/inventory, not completed migration.
- [ ] Copy and verify source archives before removing tracked sources; update portable tests and reference map, keep runtime assets in LFS. Do not blindly delete frames/models that build/tests use. `docs/cleanup/asset-reference-map.json` was missing at latest health check.
- [ ] Recompute final repository budget: original proposed source removal projected ~332 MB before newest runtime additions; it is not a current passing result.
- [ ] Prove HMH mid-phone 30 FPS with 60 enemies + boss + 20 effects + gore + grenades; boss fight, streaming and thirty-minute flat-memory run. Add/finish bounded release smokes as required by original scope, avoiding redundant harness work.
- [ ] Run full release gate and `visual:reboot` metrics/screenshots on final candidate, independent gameplay/verifier review, and local Ranked E2E for all three games.
- [ ] Physical owner playtest and unresolved art/greybox/performance acceptance, then final approved publication and live verification.

## 7. Efficient continuation order

1. Verify local clean branch, LFS objects, latest remote/live markers and any competing session. Read current owning slices rather than replaying all history.
2. Preserve the current integrated product checkpoint. Resolve producer source discrepancy once; avoid wholesale lane merges.
3. Assign bounded parallel work only where useful: world art/layout; character rigs/animations; reward/site art or Chikun final visuals. Keep a single integration owner and one shared heavy job at a time.
4. First deliver visible improvements to one accepted area and character set, then extend proven art choices across areas. Use existing reference assets, native sources and budget tiers.
5. Complete versioned world/course authority and remaining gameplay independently from art. Review determinism and old-run parity once per coherent change.
6. Resolve repository size before final certification; measure actual phone performance early enough to fix memory/LOD rather than discover it at promotion.
7. Final combined build/checks, owner acceptance, release. Update progress/checklist with precise completed and skipped items.

Do not claim completion based on number of commits, green unit tests, static previews or a percentage guessed from task counts. Report visible deliverables and remaining acceptance blockers plainly.

## 8. Local tools, evidence and resources

Workspace helpers under `C:\Users\just_\Documents\Codex\2026-09-29\you-are-taking-over-as-lead\work\`:

- `review-woods-course.mjs`: bounded combined actual-game review; `--skip-build` supported.
- `owned-windows-preview-child.mjs`: owned child cleanup helper.
- `remaining-enemies-delivery.md` and `remaining-enemies-runtime.patch`: selective gather record.

Shared heavy lock: `C:\Users\just_\lesters-arcade-wt\.locks\heavy.lock`. Acquire atomically, write an owner token, close your own browser/server/native jobs before releasing **only your exact marker**. Never delete another session's lock or kill generic Node/Chrome processes.

Chrome: `C:\Program Files\Google\Chrome\Application\chrome.exe`.
Node: `C:\Program Files\nodejs\node.exe`.
Python (not on PATH): `C:\Users\just_\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe` (use `-B -X utf8`).
Playwright available in root `benchmarks/hmh-engine-bakeoff/node_modules/playwright/index.mjs`.
Root `scripts/hmh-reboot-portal-e2e.mjs` provides `startPortalStaticServer`; art lane `scripts/lib/hmh-owned-browser-close.mjs` provides owned browser close helpers. These paths are local environment details, not portable build dependencies.

User references:
`C:\Users\just_\Desktop\Projects\LestersArcade-Assets\Level References`
and `...\Enemy and Boss References`.
Planned nonsecret source archive: `...\LestersArcade-Assets\2.0\Source\`. This is art storage, not the credentials vault. No source removal/archive migration was performed in the latest batch.

Original Download attachments may no longer exist. Checked-in guide/intake records preserve scope. The Arcade Techniques Survey and patch are optional research, not authority to overwrite deterministic rules. Use useful ideas selectively.

## 9. Release sequence — do only after full readiness

Follow original brief §0.3 and current repository instructions exactly; refresh any environment-specific details first.

1. Work on the isolated overhaul/release branch, never main. Coordinate integration checkout ownership and the pre-deployment session.
2. In a release commit update `apps/portal/src/version-tracking.mjs` SITE/GAME versions, `apps/portal/sw.js` cache marker, pinned tests and README new release section. Preserve previous README release under How to play. Run `node scripts/hmh-release-facts.mjs --write`. See original guide for exact pinned test list.
3. Under shared heavy lock run **`npm run vercel:build`**. Known retired exceptions are exactly those in `LEGACY-TEST-RETIREMENT.json`; expected retirement gate count is **51**, not permission to suppress new failures. Commit generated `docs/testing/hmh-reboot-test-retirement-gate.json` as required. Do not bypass hooks or claim skipped checks passed.
4. With approval for the completed candidate, local upload `npx vercel deploy --yes`, then `npx vercel promote <preview-url> --yes`. Git-integration previews lack needed LFS content and have known failures, so do not substitute them for certified local upload. If needed, project link comes from the existing integration `.vercel/project.json`; never inspect/copy secrets.
5. Verify live service-worker marker, `/api/health` version/healthy state and changed screens. Record exact source/deployment/rollback, README and release receipt. Coordinate any integration fast-forward without moving another session's active HEAD.
6. Preserve honest testnet language. No changes to contracts, transactions, settlement, jackpot or secrets are part of this release authorization.

## 10. Next-major-update material remains preserved

`docs/2.1/SCOPE-AND-SEQUENCE.md`, `lesters-arcade-2.1-roadmap-after-visual-overhaul.md`, `hmh-arcade-cabinet-prompts.md`, source receipt and compressed originals preserve the next roadmap. Do not silently expand this already-large 2.0 finish into all of 2.1/2.2.

Potential shared cabinet/trophy reuse has constraints: poster ≤30 KB; visible idle 16-frame WebP ≤350 KB; optional interaction model ≤1 MB per cabinet; true alpha; reduced-motion poster. A 384×420×16 sequence is about 9.84 MiB decoded.

Later roadmap covers wheel/gamepad/remapping/haptics/technical health; additional modes/progression; more achievements/shares; profile sync/accessibility/boards/PWA/help. Level 2 choice (Mempool Metro, Silicon Tundra, Halving Badlands) is not decided. Fifth hero, online co-op, seasons, minting and outreach are not automatically authorized. Finish the current full release first.

---

**Takeover request:** Continue from the committed overhaul branch, preserve completed functionality, finish the remaining visible world/character/reward/course work, integrate and polish, verify honestly on the required phone and release gates, then publish the fully approved update. Update this handoff or `docs/2.0/PROGRESS.md` as work advances.
