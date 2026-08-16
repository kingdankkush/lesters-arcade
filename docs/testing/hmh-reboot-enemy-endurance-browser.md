# HMH Reboot 100+ Enemy Browser Endurance

- Status: **PASS**
- Runtime: `hmh-reboot`
- Active-body target: 128
- Duration: 30s per profile, serial desktop then mobile

## desktop

- Status: **PASS**
- Viewport: 1440×900
- Median FPS: 144.93
- P95 frame: 7.1 ms
- P99 frame: 7.2 ms
- Bodies: 128–128
- Animated-enemy peak: 64
- Threat peak: 497/640
- Token maxima: melee 6/6, ranged 5/5, area 4/4, support 2/2
- Projectile/effect peaks: 1/13
- Safety steps/tick peak: 128
- Collision/traversal peaks: 3/0
- Simulation advance: 1799 ticks; dropped 0 ms
- Catch-up saturation: 0.00%
- Long tasks: 0; max 0 ms
- Retained heap growth: 25337142 bytes
- Console/network issues: 0/0
- Screenshot: `docs/testing/VISUAL_BASELINES/current/enemy-endurance/hmh-reboot-enemy-endurance-desktop.png`
- Failures: none

## mobile

- Status: **PASS**
- Viewport: 390×844
- Median FPS: 144.93
- P95 frame: 7 ms
- P99 frame: 7.1 ms
- Bodies: 128–128
- Animated-enemy peak: 64
- Threat peak: 497/640
- Token maxima: melee 6/6, ranged 5/5, area 4/4, support 2/2
- Projectile/effect peaks: 1/12
- Safety steps/tick peak: 128
- Collision/traversal peaks: 3/0
- Simulation advance: 1784 ticks; dropped 0 ms
- Catch-up saturation: 0.00%
- Long tasks: 0; max 0 ms
- Retained heap growth: 13549684 bytes
- Console/network issues: 0/0
- Screenshot: `docs/testing/VISUAL_BASELINES/current/enemy-endurance/hmh-reboot-enemy-endurance-mobile.png`
- Failures: none
