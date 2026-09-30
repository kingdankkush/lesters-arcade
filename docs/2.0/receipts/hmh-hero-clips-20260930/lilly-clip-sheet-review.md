# Lilly clip contact sheet review (2026-09-30)

Sheet: `lilly-clip-contact-sheet-runtime.png` (71 library clips x t = 0.25 / 0.5 / 0.75, runtime decoder + CPU skinning, three-quarter orthographic view, floor line at y = 0).

Checked for: limb intersections, feet leaving the floor in grounded clips, flipped hands/props, mirrored variants matching, prop visibility.

| Group | Result |
|---|---|
| movement (run-start/stop, strafe-l/r, back-pedal, turn-l/r, pivot) | reads; strafe-r mirrors strafe-l; turn/pivot show the body yawing back to the heading; feet stay on the floor |
| evasion (dodge-roll, stumble, knockdown, get-up, stun, fall, land) | dodge-roll tucks into a ball and inverts mid-roll (coat fans, expected); knockdown tips back then lies flat; get-up rises through a crouch; fall keeps the airborne balance pose (height is the simulation's) |
| cover | tall idles keep the pistol at the chest and turn the head to the watched edge; short idle crouches; peek-fire-l/r lean out mirrored with the aim arms; blind-fire puts the gun arm out past the edge with the head turned away; popup rises to a half crouch |
| traversal (mantle, vault, drop) | mantle reaches overhead then knees up; vault tucks with hands down; drop lands in a squash |
| weapons | two-handed long-gun holds pose the arms around the coin blaster stand-in; reload clips move the left hand to the gun; launcher shoulders the arm |
| melee / grenade | knife visible only in melee-*; frag visible in throw-* and hidden from the release tick; finisher stabs downward with a lunge |
| damage / deaths | hit-left/right mirror; death-front ends face down, death-back and death-explode end on the back, all at floor height |
| ceremony / interaction / hazard | victory raises the pistol, level-up spreads the arms, multikill slides on the knee, interactions keep hands free (no prop) |
| Lilly fidgets | glasses/tablet, air-code, sip-coffee and coat-twirl read; the twirl completes a full root yaw with coat flare |

Findings: no flipped hands, no feet above the floor in grounded clips, no limb passing through the torso at the sampled times. First-pass authored poses; the deep crouches (cover-idle-short, pickup) put the coat through the shins, which is a cloth limitation of the rig rather than a pose error. Poses have not yet been judged in the game camera.
