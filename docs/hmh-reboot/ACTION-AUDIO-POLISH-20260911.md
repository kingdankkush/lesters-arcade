# HMH action audio candidate — 2026-09-11

The child now uses 28 original, locally authored PCM sound effects. The eight
weapons have an immediate attack and distinct pressure, mechanical or electrical
bodies. Grenade handling and detonation are separate, as are enemy and player
impacts, health, ammunition, slow time, berserk, ordinary pickups and upgrade
choices. The reload start plays magazine handling; the final chamber sound is
triggered by the authoritative `weapon:reload-complete` event when ammunition
returns. Sounds never control reload timing or other simulation state.

The existing category priorities, cooldowns, 16-voice child cap, boss-warning
ducking, volume settings, pause handling and rejected-playback cleanup remain in
effect. Weapon input gains now account for the category attenuation that made
the earlier mix especially quiet. The output ceiling remains 0.16.

All 28 WAVs total **989,954 bytes**, use 44.1 kHz mono PCM and regenerate exactly
from the repository's standard-library Python recipe. The manifest records the
complete recipe, runtime cue, byte hash and measured PCM for every file. No
external recordings or paid assets were used; existing sourced UI/boss/footstep
files retain their existing license and routes.

The [source checkpoint](../qa/hmh-action-audio-20260911.json) records the initial
three failing regressions and **48/48** passing focused checks after correction.
Pistol body RMS over 15–75 ms rose from **0.033819 to 0.413968**; its routed
whole-sample RMS rose from **0.006498 to 0.040069**. These are waveform and mix
measurements, not perceptual loudness units or a listening score.

The actual-sample audit caught excessive reconstruction overshoot in an early
candidate. Filtering the saturation output before normalization corrected it.
Final maximum PCM peak is **0.779968**; the four-times windowed-sinc reconstruction
estimate is **0.827153**. A dense 154-event combat mix peaks at **0.224930**, uses
at most **7 of 16 voices** and produces no clipped samples or unknown-cue refusals.

Regenerate and inspect with:

```text
python scripts/build-hmh-weapon-sfx.py --verify-reproducible
node scripts/hmh-action-audio-audit.mjs
node --test tests/hmh-reboot-action-sfx.test.mjs
```

The audit writes `report.json`, `action-sfx-audition.wav` and
`action-combat-mix.wav` under `.tmp/hmh-action-audio/`. The audition uses actual
routed volume with no normalization. The report lists its cue order. Unlike the
older fallback-tone audition, these files contain the samples selected by the
real child audio player.

This is a source-tested candidate awaiting the combined release checks. It does
not certify listening preference, music masking on every playlist track,
physical-device audio, or the final AAA sound direction. Per-weapon reload and
impact variants, additional terrain footsteps and final boss/ambient work remain
open. Consult the final release receipt for current publication status.
