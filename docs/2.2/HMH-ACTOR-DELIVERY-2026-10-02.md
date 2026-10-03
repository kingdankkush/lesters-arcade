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
