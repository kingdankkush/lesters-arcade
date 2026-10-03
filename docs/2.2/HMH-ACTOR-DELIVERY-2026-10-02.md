# HMH actor delivery — October 2, 2026 candidate

This bounded presentation slice makes the existing 3D library reachable from ordinary child URLs. It does not complete master-list item 1 or certify phone performance.

## Implemented

- Lazy actor controller now starts by default. Desktop defaults to medium (24 actors); phones default to low (8). High is an explicit desktop choice (64). `actor3dPilot=0` or `actor3dQuality=sprites` skips the optional chunk. Save-data / at most two reported CPU threads retains sprites unless explicitly opted in. Unsupported WebGL and decode/draw/context failures retain or restore sprites.
- Low-tier hero delivery now uses separate gzip GLBs with static embedded WebP textures. All four are below 1,500,000 downloaded bytes; exact original geometry, rig and all 80 clips remain intact. Bases are 512 px for Commando/Lester and 448 px for Lilly/Valkyrie, with 128 px normal/material maps. Medium/high retain existing at-most-1K source images. This is a texture/download tier, not a mesh LOD.
- The lazy downloader bounds both compressed reads and inflated output, validates the exact asset byte ledger, handles already HTTP-decompressed GLBs, cancels failed/aborted owned readers, and retries the original asset on unavailable/unsupported gzip. Missing WebP browser support retains the existing sprite fallback. The decoder validates static single-frame WebP dimensions before allocation and rejects extended/animated containers and unrelated required extensions.
- Existing library clips now project actual long-gun fire and reload progress, strafe and back-pedal movement, lever/button/valve interactions. Channel gestures use the operating clock rather than the sprite's clamped reach clock. Standing idle now reaches each hero's existing four fidgets; fidgets cannot replace reloads.
- A stale cover clip cannot override terminal death. Cover / mantle / drop / land and district-boss projections already existed and remain wired. All twelve exact enemy ids and all three district boss ids already had lazy model registration.

No simulation, input, randomness, collision, scores, evidence, versions, contracts or release files changed. Source GLBs and their historical export receipts remain unchanged.

## Verification

Three new behavioral cases first failed for the absent policy, absent event selector and missing strafing. The initial focused controller/model/library run passed 51 cases. Controller/delivery/projection/library/ten-area wiring passed 65 cases. The final controller/delivery/library rerun passed 37 cases after adding the full channel clock and reload/fidget guard. Main parses. The actual backend test witnesses 512 × 256 startup and late archetype decode for a 1024 × 512 source plus failure/late-load cleanup.

The derived asset cases initially failed because the decoder rejected WebP and the abort path had not canceled its reader. A malformed-container case also failed before tightening the single-frame header checks. The final focused delivery/download/controller/model run passes 47/47 cases. Four asset cases prove original source hashes unchanged, byte budgets/hash receipts, exact geometry/nodes/skins/clips, all 80 poses at three sampled clocks, and texture dimensions. Loader cases cover compressed and HTTP-decoded bytes, unsupported/corrupt/over-inflated asset fallback, and abort cleanup.

Root owns combined builds, real-browser review, visual gate and commits. Those were not run by this lane. Review ordinary no-query gameplay, real low-tier WebP decode for every hero, explicit sprite opt-out, long-gun reload/fire, tall/short cover, interactions, district bosses and context fallback before acceptance.

## Measured source composition

Bytes below count unique binary buffer views by category; remaining bytes include other buffer data/alignment.

| Hero | GLB total | Embedded PNGs | Geometry | Animation | JSON |
|---|---:|---:|---:|---:|---:|
| Lit Commando | 8,656,592 | 6,486,737 | 1,274,334 | 317,192 | 576,872 |
| Lilly | 8,415,092 | 5,648,677 | 1,902,842 | 335,228 | 526,760 |
| Lit Valkyrie | 8,888,720 | 6,251,408 | 1,830,002 | 312,580 | 493,268 |
| Lester Original | 8,278,220 | 5,872,115 | 1,678,442 | 304,232 | 421,972 |

All four contain 80 clips. The library has no dedicated `walk` clip. Mere clip availability does not mean every action is triggered in gameplay or final-quality deformation has been accepted.

The current decoder reads embedded uncompressed GLB after bounded transport inflation, allows `EXT_texture_webp` only, supports embedded PNG/static WebP and requires float32 position/normal/UV/weights. Meshopt-compressed exports cannot be dropped into this decoder unchanged.

## Accepted download budget, pending visual acceptance

| Hero | Low download | Inflated GLB | Base edge | Decoded RGBA texture bytes |
|---|---:|---:|---:|---:|
| Lit Commando | 1,175,798 | 2,465,332 | 512 | 4,718,592 |
| Lilly | 1,492,144 | 2,996,836 | 448 | 3,735,552 |
| Lit Valkyrie | 1,477,679 | 2,890,224 | 448 | 3,735,552 |
| Lester Original | 1,467,566 | 2,687,348 | 512 | 4,718,592 |

Total low hero download is 5,613,187 bytes, reducing individual downloads by 82–86%. The source textures are 22,020,096 decoded RGBA bytes per hero, so these assets reduce that allocation by 79–83%. These figures exclude GPU mipmaps, geometry, animation, other actors and renderer allocations; they do not establish total memory or FPS. Medium/high downloads remain the original assets. No paid generation or Blender pass was used. The narrow generator holds the shared heavy lock for its bounded CPU export; combined browser jobs remain root-owned.

The generator, runtime registry and `low/manifest.json` record source and derived hashes. `.glb.gz` binaries have a dedicated Git LFS pattern. Original source exports/receipts remain untouched. The cheapest remaining mesh path is selectively reducing bodies toward 8–12k triangles while protecting face, hair and identifying costume/gear, with independent deformation review; transport compression alone cannot reduce geometry work.

Still open: real-browser acceptance of the new low assets; mesh LODs; dedicated walking and other untriggered actions; hero/enemy/boss reference review; animation blending/quality; resident-model memory bounds; phone FPS/thermal/long-run proof; heavy-load scenarios; user-facing Graphics Quality controls; release acceptance. Do not close master-list item 1 on this receipt.

## Native movement and enemy delivery follow-ups

The committed movement follow-up selects the existing run-start/run-stop and standing turn-left/turn-right/pivot clips from observed locomotion. Combat, reloads, cover, traversal and directional strafe/back-pedal take priority; repeated ticks hold, clock rollback/long gaps reset, and fidgets cannot interrupt an accent. The controller/delivery/library suite passed 40/40. This adds no acceleration, walk-speed tier or turn penalty; item 11's new movement rules and dedicated walk remain open.

The next zero-asset delivery slice connects native enemy corpses from the existing death-marker map. Corpses use only quality slots left after the hero, bosses and living enemies. Only visible fully opaque bodies enter the depth pass. Unknown/unready models retain sprites; fading, retirement, disposal, context loss and drawing failures restore the originals. The established 24-corpse cap, two-second lifetime, last-200-ms fade, death facing and clocks remain unchanged. This reuses existing death clips rather than exporting new bodies or consuming credits.

Ordinary enemy hit playback now traverses the existing normalized one-second clip during its six-tick hit window. Previously `/60` reached only the first tenth of the recoil. Tell/attack clocks and their precedence remain unchanged, as do all damage and knockback rules.

Four new cases first failed for truncated hit playback, missing corpse selection and missing sprite restoration. The final actor controller/delivery/library run passes 44/44; existing corpse, enemy production, creature and render-pass regressions pass 20/20, including old render-loop equivalence and stalled-simulation corpse expiry. Main parses and owned whitespace checks pass. Root still owns combined real-game acceptance, frame-time measurement and release checks. New native death variants and enemy stagger exports remain open; no new animation asset was authored in this slice.

For real-browser acceptance, `evidenceSafe=1&telemetry=1` additionally publishes `actor3dCorpseCount` and `actor3dHitCount`. Counts reflect only successful native frame rows after readiness filtering and reset on fallback; they do not count sprite-only corpse markers or unready hit models. Startup reads already initialized URL parameters directly to avoid the later telemetry flag's temporal dead zone. The new ownership case first failed for absent counts, then the controller/delivery suite passed 34/34.

Lead browser follow-up: all four optimized low hero downloads were previously
checked at the phone viewport, with no classic-asset fallback. Native enemy
hit rows were observed in the existing full-health pressure scene; ordinary
Free play separately showed native corpse playback and sprite fade handoff.
The first combined checker overconstrained crowded scenes by requiring spare
corpse slots, and stationary roster mode disables automatic fire. Original
failed receipts remain intact; `outputs/22-hmh-second/animation-observations.json`
records the independent observations. These are delivery checks, not acceptance
of final enemy animation quality, new clip sets, frame time or physical-phone
performance. Latest combined source regressions pass 88/88.
