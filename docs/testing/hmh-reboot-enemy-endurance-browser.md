# HMH Reboot 100+ Enemy Browser Endurance

- Status: **PASS**
- Runtime: `hmh-reboot`
- Active-body target: 128
- Duration: 30s per profile, serial desktop then mobile

## desktop

- Status: **PASS**
- Viewport: 1440×900
- Median FPS: 142.86
- P95 frame: 13.9 ms
- P99 frame: 14 ms
- Bodies: 128–128
- Animated-enemy peak: 64
- Threat peak: 497/640
- Token maxima: melee 6/6, ranged 5/5, area 4/4, support 2/2
- Projectile/effect peaks: 1/12
- Safety steps/tick peak: 128
- Collision/traversal peaks: 1/0
- Simulation advance: 1786 ticks; dropped 0 ms
- Catch-up saturation: 0.00%
- Long tasks: 0; max 0 ms
- Retained heap growth: 13561741 bytes
- Console/network issues: 0/0
- Screenshot: `docs/testing/VISUAL_BASELINES/current/enemy-endurance/hmh-reboot-enemy-endurance-desktop.png`
- Failures: none

## mobile

- Status: **PASS**
- Viewport: 390×844
- Median FPS: 142.86
- P95 frame: 14 ms
- P99 frame: 20.9 ms
- Bodies: 128–128
- Animated-enemy peak: 64
- Threat peak: 497/640
- Token maxima: melee 6/6, ranged 5/5, area 4/4, support 2/2
- Projectile/effect peaks: 1/12
- Safety steps/tick peak: 128
- Collision/traversal peaks: 2/0
- Simulation advance: 1807 ticks; dropped 0 ms
- Catch-up saturation: 0.00%
- Long tasks: 0; max 0 ms
- Retained heap growth: -5449918 bytes
- Console/network issues: 0/0
- Screenshot: `docs/testing/VISUAL_BASELINES/current/enemy-endurance/hmh-reboot-enemy-endurance-mobile.png`
- Failures: none
