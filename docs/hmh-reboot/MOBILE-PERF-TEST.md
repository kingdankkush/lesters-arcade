# HMH mobile performance test: iPhone XS Max, 5 minutes

Perf steps 7 and 8 (release 1.9.0) added a Graphics Quality setting (Auto / Low / Medium / High), an Auto governor, and a `?perf=1` overlay. This is the device check the owner runs on an iPhone XS Max: 414 x 896 CSS px, DPR 3, A12. It takes five minutes and needs no tools beyond the phone.

## What the overlay shows

Open any HMH session with `?perf=1` on the portal URL and a small panel appears in the top-left corner. It never takes touches, and the settings that change a result never read it.

```
58 fps  16.9 ms avg  24.1 p95     <- last 2 s of frames
enemies 41  shots 12              <- live enemies and projectiles
tier auto/mobile  fx full         <- Graphics Quality / runtime profile, effects rung
res 1.50x  621x1344  tex half     <- renderer resolution, backbuffer, texture pages
```

How to read the numbers:

- **p95** is the one to watch. At or below 20 ms is a smooth 60 Hz. From 20 to 33 ms is playable but has hitches. Above 33 ms means the game is dropping to 30 fps or lower.
- **fx** is `full` or `reduced`. Auto drops effects first when frames slow (half the fog, motes and weapon glow sprites). Only after that does it lower the resolution.
- **res** on a phone starts at 1.00x. Auto moves it to 1.50x after about 8 s of fast frames, and moves it back down for the rest of the session if 1.50x cannot hold.
- **tex** is `half` on the phone profile and on Low/Medium, `full` on High. It is fixed at launch (see step 4).

## Before you start (30 s)

1. Charge the phone above 50 %. Turn off Low Power Mode and close other apps. A warm phone throttles, so start with it cool.
2. Turn the ring/silent switch to ring and set the volume to about half.
3. In Safari, open `https://lestersarcade.io/?perf=1` (or the 1.9.0 preview URL you were sent, with `?perf=1` on the end).

## 1. Loading and first frame (30 s)

1. Pick Hard Money Heroes and start a **Free** run with any hero.
2. While the briefing loads, check that one control tip under the progress bar rotates every few seconds and is gone when "Enter Level 1" lights up.
3. **Screenshot A:** the briefing with a tip showing.
4. Tap Enter. The first seconds of play should not stall. The warm-up renders the enemy and effect art before the reveal.

## 2. Auto tier, normal play (2 min)

Play normally with Graphics quality on **Auto**, the default.

- **Screenshot B** at about 30 s: calm play, overlay visible.
- **Screenshot C** at the busiest moment you reach, when a crowd is closing in or right after a grenade. Note the `enemies` count.
- **Screenshot D** at about 2 min.

In each shot, check the p95, the `fx` value and the `res` value. On a healthy XS Max, expect `res` to reach 1.50x in calm play. `fx reduced` or a `res` drop in a crowd means the governor is working. Report it if it happens in calm play.

## 3. Tier sweep (1.5 min)

Pause the game, set **Graphics quality**, resume, play about 20 s, then take the screenshot:

| Tier | Expect | Screenshot |
| --- | --- | --- |
| Low | `tier low/low`, `res 1.00x`, no contact shadows under bodies, thin fog | E |
| Medium | `tier medium/mobile`, `res 1.00x` | F |
| High | `tier high/desktop`, `res 2.00x`. Likely the slowest; that is expected. | G |

Set it back to **Auto** when done. The setting persists, so check that it survives a page reload (`tier` in the overlay).

## 4. Texture detail on the next launch (15 s)

Texture pages and edge smoothing are chosen when the game loads. With **High** selected, reload the page. The overlay should show `tex full`. Switch back to Auto and reload: `tex half`.

## 5. Audio checks (30 s)

- Music comes from the portal's jukebox, not the game, and never plays two tracks at once.
- Weapon, hit, pickup and grenade sounds play and follow the pause-menu SFX slider.
- There are no voices and no footsteps.
- Lock the phone for 5 s and unlock it. Audio comes back, and nothing plays while locked.
- There is no crackle or dropout in the busiest fight (Screenshot C's moment).

## 6. Haptics

iPhone Safari has no vibration API, so **no rumble is expected on the XS Max**. Rumble works on Android phones and on gamepads with a rumble motor. It fires on a player hit, on death, on a grenade blast and on a boss phase change. It follows the Screen shake setting and turns off under Reduce motion.

## What to send back

- Screenshots A to G.
- For B, C and D: the p95 value, `fx`, `res` and the `enemies` count.
- Anything that felt like a stall: when it happened and what was on screen.
- The results of the audio checks, pass or fail.

## For QA and smokes (not for the device test)

- `?q=auto|low|medium|high` pins a tier on a standalone page (`/hmh-reboot/index.html?q=low`). The portal never forwards it.
- `?t=<ticks>` runs that many fixed steps with idle input before the first gameplay frame. It works only on a standalone page, which has no parent and so is never a Ranked run.
- `await window.__HMH.waitFrames(n)` resolves after `n` animation frames. It is installed on standalone pages and in evidence (`evidenceSafe=1`) sessions only.

None of these, the overlay, the governor or the tiers change a tick, a hit, a spawn or a result. `node scripts/hmh-sim-digest.mjs` gives the same combined digest before and after perf steps 7 and 8.
