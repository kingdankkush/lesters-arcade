# F2g: local-versus sound and volume control

Local versus now reads successful board changes into the existing STACKED synth:
move, rotation, hold, drop, lock, clears, incoming rows and top-out. Both boards
share one compressed eight-voice mix and its existing cooldowns. Identical cues
within that cooldown coalesce. This is frame-level presentation feedback, not a
new simulation callback or authoritative event stream.

The setup, pause and result dialog includes one keyboard/touch Game sounds slider,
default 35%, with 0 labelled Off. Setup creates no audio device. Start/resume and
slider changes attempt playback from the user gesture. Pause, tab hiding, reset
and disposal stop voices; disposal closes the context. Mute still advances the
silent snapshot baseline, so unmuting cannot replay old actions. Audio failures
are caught. No storage, parent message, score, input, RNG, simulation, evidence,
solo/Ranked rule, version or default rollout change. The page remains opt-in Free.

Eight genuine missing-module RED failures preceded 8/8 source and the identical
isolated 8/8. Tests exercise real two-board snapshots, both players, cue priority,
duplicate/paused renders, rematch baseline, mute, invalid volume, disposal and
unavailable audio without state mutation. Character independently reviewed the
helper and lifecycle wiring with no actionable issue.

Final source/build checkpoint 12 passed 178 focused checks and the fresh build.
Browser 13 reuses its unchanged pinned source/build and passes 24 actual Chrome
cases, including native Web Audio playback on two fresh pages, pause/mute/unmute,
both real contexts closing with zero connected nodes, page cleanup, actual two-
board play/results/rematch, narrow layouts, strict Free entry and the built solo
Worker's exact 432,000-tick historical tuple. Simulated pagehide/pageshow checks
are explicitly event simulations, not proof of every native BFCache lifecycle.

Art review found a crowded slider focus ring and an incomplete narrow scroll
capture. The slider now leaves 8px below its label. The 320px capture now waits for
the scroll paint and checks both Start and the slider inside the dialog with real
hit tests. Root inspected the final original desktop control, narrow bottom and
portrait images; the earlier desktop setup/results originals also informed review. Art independently
reviewed the final targeted originals and confirmed both UI issues resolved.

Failures remain preserved: 09 and10 incorrectly expected a played audio context
on a different, navigation-reused page; 11 passed its assertions but failed visual
review of the narrow capture/focus gap; 12 passed the new visual/hit checks but hit
a navigation race after a simulated pagehide on that reused page. 13 isolates that
lifecycle check on a fresh page, proves actual playback there, then closes it.
No failed result was overwritten or relabelled.

Initial/shared budgets remain HMH 1,039,992 B and STACKED 580,861 B. Source/build,
browser 49404 and Chrome 25340 closed with expected exits; process absence, HTTP
closure and exact owned-marker release are recorded. No listening-panel mix
review, physical controller/iPhone run, long soak, full release gate or deploy.

Exact compact reports/harnesses are in ../receipts/stacked-local-audio-f2g.
That archive also retains the prior W3a root-gather proof: 146 source/fixture files
are byte-identical to the World lane's tested closure, with zero line-ending-only
differences. This is gather parity, not another test execution.
