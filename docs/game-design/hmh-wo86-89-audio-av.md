# WO-86 / WO-87 / WO-88 / WO-89 — Audio + AV Certification

**Status:** certified runtime audio/AV plan.  
**Module:** `apps/portal/src/hmh-wo86-89-audio-av.mjs`

## Scope

- WO-86: audio bakeoff policy
- WO-87: full SFX inventory mapping
- WO-88: pressure-layered score/stem plan
- WO-89: AV sync polish + 60s showcase reel plan

## Runtime decision

The game keeps the existing WebAudio synth/sample fallback as the safe runtime layer. AI or external audio candidates can be used later only if they beat the fallback in A/B review and are committed as final runtime-safe assets with provenance.

## 60 second showcase beats

| Time | Beat | Audio focus |
| --- | --- | --- |
| 00-08 | spawn-ready | base rain pulse + level-start sting |
| 08-18 | pickup-and-first-hit | pickup sparkle + enemy-hit transient |
| 18-30 | pressure-layer | combat arpeggio + weapon cadence ducking |
| 30-42 | boss-warning | boss brass hit layer + warning swell |
| 42-53 | death-burst | death burst tail + impact duck |
| 53-60 | victory-settle | victory release sting + UI confirm |

## Gates

- SFX registry validation: central `HMH_SFX_CUE_REGISTRY`
- SFX inventory mapping: WO-87 cues resolve to runtime cues or deliberate fallback cues
- Pressure stems: at least 5 stem/layer concepts
- AV sync: at least 5 sync moments
- Showcase: 6 beats covering 60 seconds
