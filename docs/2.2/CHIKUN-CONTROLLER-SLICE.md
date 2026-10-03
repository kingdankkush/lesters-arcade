# Chikun controller input — October 3

Lazy standard-gamepad support maps A, right trigger and D-pad up to the same
existing jump action; holding them supplies the existing course-v2 glide
boolean. Start pauses/resumes. A resumes the native pause menu or activates
the visible results restart button. Keyboard and touch paths remain intact.
One standard controller owns input; repeated held controls, new connection,
controller replacement, focus loss and restart latch rather than injecting
extra presses. One reusable sample object avoids per-frame adapter arrays.

The adapter has no course, simulation, RNG, clock or evidence authority. Main
queues the existing flap/glide inputs. No new replay schema or course version
is needed. The RED missing-module tests became four passing behavior cases;
current v6 and historical v5 equivalent keyboard/controller schedules produce
byte-identical canonical replay evidence and terminal results. The wider
adapter/runtime/identity/evidence suite passes 22 cases.

Independent review reproduced a gap when blur stops RAF before any disabled
sample. Main now resets synchronously on blur and hidden visibility; held
controls after focus regain must be released before a new press. Actual local
Chrome at desktop and phone viewports passed a synthetic standard-pad run:
A upward impulse, Start pause/resume, paused tick freeze, and held A through
blur with zero disabled RAF samples remaining paused. This exercises the real
main lifecycle and native pause menu; it is not physical-controller testing.

Evidence: root `outputs/22-forest-lod-cover-routes/review.json`, scenes
`chikun-controller-desktop` and `chikun-controller-phone`. Browser/controller
hardware compatibility, haptics and typed deaths remain open. No production
deployment occurred.
