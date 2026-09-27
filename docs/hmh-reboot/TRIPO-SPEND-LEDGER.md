# Tripo spend ledger

Every Tripo task this repository's art work fires, with its input, settings,
credit charge and output checksum. Balances are read from `tripo balance`
non-interactively before the first spend and after every batch. The owner's
cap for the 2026-09-26 art wave is 2,000 credits.

Rules carried from the wave brief: never spend on a subject before its concept
passed casting (`docs/hmh-reboot/design/CASTING-DECISIONS-20260926.md`), inspect
every image and render before the next spend, one image-to-model candidate per
subject first, and log the task id, input hash, settings, charge and output hash.

Concept images and Tripo downloads live outside Git in
`C:/Users/just_/lesters-arcade-vault/wip-20260925/design/concepts/<subject>/`.
Only the adopted source model is committed (Git LFS).

## Balance checkpoints

| When | Balance | Frozen | Note |
|---|---:|---:|---|
| 2026-09-26 wave start (`tripo balance --json`) | 5,920 | 0 | matches the 2026-09-25 concept-run closing balance |
| after the three Liquidator head variants | 5,905 | 0 | 15 credits |
| after the T-pose body composition | 5,900 | 0 | 5 credits, image rejected (see row 4) |
| after the Liquidator image-to-model + rig-check + rig | 5,835 | 0 | 40 + 0 + 25 credits |
| 2026-09-26 `liquidator-pilot` resume (`tripo balance --json`) | 5,835 | 0 | no Tripo task fired during the Blender, atlas, QA and adoption steps; the gavel is authored Blender primitives, not a prop generation |

Wave running total: **85 credits** of the 2,000-credit cap (5,920 to 5,835).

## Art wave 1 (branch `fable/hmh-art-wave1`)

### The Liquidator (build priority 1)

| # | Task id | Type | Input | Settings | Credits | Output SHA-256 | Result |
|---|---|---|---|---|---:|---|---|
| 1 | `dde877c0-2cef-479e-aa3e-ae2aedf7cbb4` | text_to_image | `redo/head-1-receiver.prompt.txt` (1,789 chars; STYLE + BODY + head 1 "the Receiver" + AVOID) | seedream_v4 default, no template | 5 | `b723992b1b970b3f7d1284dac9286fd46e36d8ba7f8822a346909e6592efd80d` (2048x2048) | **pass**, adopted as the image-to-model input |
| 2 | `b16d0e4a-962a-4505-8965-a9215f764bc1` | text_to_image | `redo/head-2-chairman.prompt.txt` (1,794 chars; head 2 "the Chairman") | seedream_v4 default | 5 | `1c6ea584da6918f8cdd014b1ec35e860b22d7c076a53707738b979f0653cb769` | face original; body drifted gaunt and narrow-shouldered, no tie, no plate: fails the 4.3 body |
| 3 | `79368321-5588-4eaa-bb47-8672bc8bfef1` | text_to_image | `redo/head-3-butcher.prompt.txt` (1,786 chars; head 3 "the Butcher") | seedream_v4 default | 5 | `ee80b7929956b21a9bbb57b55c951813384048f1411fbd9883eb0b74046c097a` | face original but adds an unrequested forehead bandage and cheek scar, a black tie and a cartoon grin; dark hair cap is the Tollkeeper/Lockkeeper head value |
| 4 | `8dd7065f-8f12-4a85-963e-192fb6cfda06` | text_to_image | `redo/body-tpose-head1.prompt.txt` (1,799 chars; head 1 + gold cuff/plate corrections) | seedream_v4, `template=t_pose` | 5 | `9f5c261cfba65643ddb1b69cf061335e0f304e26f44b91ce4aa77ba4e84576c2` | **rejected**: the `t_pose` template strips the costume to a base body (leather tank top and trousers). Never use it for a dressed character |
| 5 | `16708afe-1614-4c44-9814-7965ea9301e7` | image_to_model | task 1 image (`b723992b...`, uploaded as JPEG by the CLI) | `tripo make --for game-pc`: v3.1-20260211, texture, pbr, texture_quality detailed, geometry_quality standard, no face limit | 40 | primary `tripo_pbr_model` GLB `2dcd93fdbf292229822388c8fca2ef521765bc8ee5aeaf3026b8423f0eab11cb` (51,617,812 bytes; 771,758 vertices, 1,492,864 faces, three 4096 textures) | **pass** on the four-view turntable: crown spikes and LED band, amber square spectacles, auction tags, flat epaulettes, red lapels, belt plate, gloves and boots all survive; face reads as head 1 |
| 6 | `4661128a-e7cd-4d5b-b2a2-9f5ca9836cb6` | animate_prerigcheck | task 5 | chained via `--then rig-check` | 0 | none | riggable |
| 7 | `4a9a82fd-fa03-4129-8285-31809ce9765b` | animate_rig | task 5 | `rig:spec=mixamo,out_format=glb`, rig model v2.5-20260210 | 25 | rigged GLB `d3909ffce9a35472e97d9ffeb24f835d63659c0fe1523399b1c9c4e456d7c999` (67,067,176 bytes; 46 bones, no actions) | usable skin weights; bone names are Tripo-generic (`tripo::Root`, `tripo::1_Left_Limb_N`, `bone_N`) despite `spec=mixamo`, quaternion mode, a 2 m bone-shape Icosphere object, +X facing. Mapped to the HMH semantic names by geometry in `build-hmh-tripo-native-derivative.py` |

Prompt length: the API rejects prompts over 1,800 characters (api_code 1004,
no charge). The casting doc's full STYLE + BODY + AVOID blocks total about
3,150 characters, so the shared blocks were condensed and generic negatives
were dropped from the end of the AVOID list; the HEAD blocks were never cut.

#### Originality gate (casting doc 3.3) for task 1, head 1

Crops: `redo/head-1-receiver.crop512.png`, `.crop64.png`, `.crop20.png`
(`redo/head-1-receiver.gate-sheet.png` shows all three).

| Feature | Observed |
|---|---|
| Hairline, colour, style | bald dome with a short cropped iron-grey horseshoe above the ears |
| Brow | thick, straight, iron-grey |
| Nose | wide, flat, set crooked |
| Facial hair | none; blue-grey jaw shadow only |
| Eyewear | small square gold-rimmed amber-tinted spectacles |
| Jaw and chin | heavy jowls, thick creased neck |
| Marks | two gold auction tags at the left ear (tiny illegible print on the tags) |
| Apparent age | early sixties |
| Skin | pale, liverish, flushed across the nose and cheeks |

- Archetype check: matches at most two features of any listed stack (massive
  frame + tailored coat); the horseshoe of hair, amber square lenses, red tie
  and crown keep it off the bald-crime-lord line. Trigger count 1 (tinted
  glasses, which is 4.3's own spec item).
- Roster uniqueness: the only clean-shaven adult male in the ten picks; pale
  dome differs from the Tollkeeper and Lockkeeper dark caps; the crown band
  is the sole emissive; no hero token.
- Blind read: this workflow is non-interactive and could not put the crop in
  front of two independent sessions; the author's own read names nobody.
  Recorded as **partial**: the two-session blind read is still owed.
- Reverse-image search: no tool available in this environment; not run.
- Gameplay read: the 64 px crop is a pale dome inside a red ring; the 20 px
  crop is a pale blob with a red ring. Passes 3.3 step 7.
- Deviations from the casting body merge, accepted for the pilot: the
  riveted plate rendered as a belt buckle rather than between the lapels,
  and the cuffs rendered as red wool turn-backs rather than gold bands. Both
  are texture-level and invisible at 256 px; the crown ring, red lapels, coat
  length and boots all survive.

Body A from 2026-09-25 (`the-liquidator-a.png`) and B (`the-liquidator-b.png`)
were re-read at 2048 px before this spend: both carry the flagged face stack
and neither was fed to Tripo.

#### Originality re-check on the Tripo output (casting doc 3.3, "again to the final Tripo render")

Read at the pilot resume: task 1's `generated_image.png` (2048 px, SHA
`b723992b...` re-verified), task 7's `preview.png` and `rendered_image.webp`
(512 px), then the derivative's own 512 px preview frames at the 35 degree
camera (head crop at 3x). Tripo kept the head 1 ledger: bald dome with the
iron-grey horseshoe, small square amber spectacles, clean-shaven jowls with the
blue-grey jaw shadow, the crooked nose, the auction tags at the left ear. No
feature was added by the model pass (no stubble, no slicked hair, no aviators).
Archetype count is unchanged at two (massive frame + tailored coat) and the
author's blind read still names nobody; the two-session blind read remains
owed because this workflow is non-interactive.

#### What the rig task actually delivered (for the roster steps)

- `animate_rig` with `spec=mixamo` returns Tripo-generic bone names
  (`tripo::Root`, `tripo::1_Left_Limb_N`, `bone_N`), 46 bones, quaternion
  rotation mode, +X facing, a 2 m `Icosphere` bone-shape mesh object, and **no
  actions**. `--then rig` therefore buys usable skin weights only; every clip
  still comes from the procedural poser. The 25 credits were worth it for this
  pilot (no auto-weighting pass to tune), but an ordinary enemy on the 14-bone
  auto-weight path can skip it.
- `tripo anim retarget` exists (preset animations onto a rigged task) and was
  not tried: its clips would not be one action per HMH state, and the roster
  contract keys every clip to the shared pose table.
- The `t_pose` text-to-image template strips costumes (row 4). Use the plain
  A-pose STYLE block and let the rig task handle the pose.

## Art wave 2b (branch `fable/hmh-art-wave2b`): the 51% Foreman and the Lockkeeper

Lane cap: 800 credits. Casting: Foreman A with B as the phase-3 dressing
reference, Lockkeeper A with the coat worn with sleeves
(`design/CASTING-DECISIONS-20260926.md` 2.7, 2.8). Vault working folders:
`concepts/fifty-one-foreman/wave2b/` and `concepts/the-lockkeeper/wave2b/`.
Every image and render below was read with the Read tool before the next
spend.

| When | Balance | Note |
|---|---:|---|
| lane launch (task brief) | 5,415 | other lanes spend from the same account concurrently |
| after this lane's six tasks (`tripo balance --json`) | 5,275 | 140 credits: 5 + 5 + 40 + 25 + 40 + 25 |
| lane close read (`tripo balance --json`) | 5,195 | the further 80 are other lanes' spend; this lane fired nothing after the six tasks |

Lane total: **140 credits** of the 800 cap.

### Pre-input hygiene (no credits)

`scripts/hmh-tripo-input-hygiene.py`: the floor
shadow is flood-matted from the image border below a band line (neutral
pixels only, stopped at luminance steps over 0.035 so steel toe caps survive,
unreached shadow islands folded in, 24 px feathered seam); the Lockkeeper's
magenta padlock lamps are hue-rotated to 348 degrees (#ff476f) inside the
bandolier box.

| Input | From (SHA-256) | Result (SHA-256) | Edits |
|---|---|---|---|
| `the-lockkeeper/wave2b/the-lockkeeper-a-input.png` | `the-lockkeeper-a.png` `9c97de1a2d6fb567d3101e60bda1c00c06dab190a9d30b21892ac63aacdb0edf` | `fb9fa9af9e0e05f577c9089172f22f186df8d0d143710cf999f3106e1d4954d1` | 943,236 shadow px matted, 4,506 lamp px retinted |
| `fifty-one-foreman/wave2b/foreman-a4-input.png` | task 2 image `b68687a35ec2722c6e9645aacc33345cb4225456fb905b40f38d4df069469e9a` | `ac2b5efc94a985ff15576c5eb2703b78ad53627d097a5bd63c3812ae48ba4631` | 727,419 shadow px matted |

### Tasks

| # | Task id | Type | Input | Settings | Credits | Output SHA-256 | Result |
|---|---|---|---|---|---:|---|---|
| 1 | `97f052bf-9f07-4a82-bbab-4957c7d66742` | text_to_image | `fifty-one-foreman/wave2b/prompt-a3.txt` (1,789 chars): prompt-a2 re-run with an upright A-pose, moustache only, short drill bit (casting 2.7 fallback, taken before any model spend because A's right arm is bent forward across the body and it carries a goatee) | seedream_v4 default | 5 | `60f60e88caf3d932f0f45d5bf097d764b1af01480b7ce6d191732a076027ab60` | **rejected**: upright, but still a goatee, and the drill became a hand-held jackhammer with the hose arcing over the head |
| 2 | `b85f546c-d16f-4f92-92f0-1271389801c2` | text_to_image | `prompt-a4.txt` (1,793 chars): right arm hanging in the A-pose with the gauntlet sheathing the forearm, hose tight down the back of the arm, "clean-shaven bare chin", "holding a jackhammer" and "chin hair" in the negatives | seedream_v4 default | 5 | `b68687a35ec2722c6e9645aacc33345cb4225456fb905b40f38d4df069469e9a` | **pass**: every 4.5 item (dented yellow hat, one amber lamp, goggles on the brim, upright riveted tank with gauge, forearm drill gauntlet with the bit past the fist, one-strap overalls, apron, brass keys, steel toes), thick grey moustache and a bare chin, clouded eyes, amber veins; adopted after the shadow matte |
| 3 | `465ddd0f-2c79-416e-a943-83760189e875` | image_to_model | Lockkeeper hygiene input `fb9fa9af...` (uploaded as JPEG by the CLI) | `tripo make --for game-pc --then rig-check,rig`: v3.1-20260211, pbr, texture_quality detailed, geometry_quality standard | 40 | `model.glb` `14b59e44e837ac7dfee5754bae77762c9ec950f108a21f66d50ee2013bc5d4e4` (50,999,028 bytes) | **pass** on the turntable preview: peaked cap, bushy beard, open oilskin over the cream cable-knit, six #ff476f padlock lamps on the bandolier, chain coil, waders, rubber boots |
| 4 | `890a7427-35cf-44f2-ac46-78dd5b313a5f` | animate_prerigcheck | task 3 | chained | 0 | none | `riggable: false, rig_type: biped`; the chain stopped before the rig (no charge) |
| 5 | `c11fd52f-2253-4e10-a1cb-746ee44175af` | animate_rig | task 3 | `tripo anim rig --rig-type biped --spec mixamo --out-format glb` (forced past the conservative pre-check) | 25 | `4df6efb409979edb28aaa1c877a92b466236478db9e503863c368a9b6eee08aa` (66,200,372 bytes; 21 bones, legs on the root, clavicles, no actions) | **pass**: usable weights through every clip in the 35 degree renders |
| 6 | `cb65f400-1cb3-4600-844e-b1fd03b69449` | image_to_model | Foreman hygiene input `ac2b5efc...` | `tripo make --for game-pc --then rig-check,rig` | 40 | not downloaded separately (the chain keeps the rig output) | **pass** on the rig preview |
| 7 | `09af1168-db38-4b73-b874-a754f232368f` | animate_prerigcheck | task 6 | chained | 0 | none | riggable |
| 8 | `2dcf6a93-29bf-4cbe-80fb-699121e74361` | animate_rig | task 6 | chained `rig` (biped, mixamo spec, glb) | 25 | `316e0cacd32bbcc0595fd776b389738f2f59967b3b616e7bc8a833084895ecb4` (66,450,376 bytes; 40 bones with fingers, legs on the root, clavicles, no actions) | **pass** |

What the forced rig taught: the pre-check refused a riggable barrel-bodied
biped (probably the chain coil and bandolier), and `anim rig --rig-type biped`
on the same model id rigged it cleanly for 25 credits. Both rigs put the legs
straight on the root with no separate hips bone, unlike the Liquidator's
46-bone rig; `build-hmh-boss-derivative.py` inserts a weightless `hips` bone
so the pelvis beat still carries the legs, and maps clavicles when present.
