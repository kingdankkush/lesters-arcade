# F2c: local two-player input boundary

Status: source and private browser probe pass. This is the controls foundation,
not a finished versus mode. It has no production importer or portal entry yet.

The new local input router composes two existing solo input adapters. Each gets
one immutable device claim and independent automatic shift state. Supported
claims are split keyboard clusters, the current default solo keyboard plus a
standard gamepad, or two standard gamepads. Duplicate pad indices and overlapping
keyboard layouts are rejected before listeners attach. The documented versus
controller layout is A/drop, B/clockwise, X/counterclockwise, Y/180 and LB/hold.
Solo bindings are not modified. Custom remapping and a device selection UI are
still future integration work.

The router reads one gamepad snapshot per tick and binds each pad by index/id.
A disconnect event is latched even if the same controller model reconnects
between polls. Any claimed-pad loss clears both streams before another match
step; a new router/device-selection step is required. Unclaimed controllers do
not interrupt the match. Pause, blur and focus into a control clear both inputs.
Activation requires neutral controller release; held menu/start buttons cannot
leak into play. Destroy removes all listeners and cannot be reactivated.

Independent Character review identified the same-model reconnect and already-held
focus cases before implementation. The final 17 behavioral tests first all
failed against the missing module, then passed along with the identical isolated
import-closure copy (no Git, node_modules or PATH tools). The existing input,
automatic-shift, match and adversarial match cases give 51 focused passes.
Two actual matches driven by the same routed stream preserve identical state
at each fixed tick. No simulation, attack table, evidence, verifier, Worker or
solo entry source changed. No new runtime import of the attack table was added.

A separately bundled private Chrome probe used the actual existing match and
Pixi board renderer. Seven cases pass: separate native keyboard drops, simultaneous
directions, Escape pause, native editable focus and resume, zero storage/messages,
landscape framing with portrait pause, and page-exit disposal. Three original
PNGs were reviewed at 1440×900, 896×414 and 414×896. Both desktop boards are clear;
the small landscape labels are too small for final play, and the portrait helper
leaves a large empty region with controls below the fold. Those probe visuals
are not product UI and are not approved versus layouts. No physical gamepad or
iPhone was tested; gamepad behavior is source-fixture coverage only.

RED child5028 exited1. GREEN19720/46168, related43660, private build33296,
browser18996 and Chrome39568 closed normally with0/no signal and were each
observed absent. HTTP closed and owned markers were released/observed absent.
Source and probe-build identities remained exact. No full production build or
release gate was run for this unimported source module. Last measured production
budgets remain the F2b values, not a new certification. No HMH render change.

The next versus slice must add local-only entry, device selection, two-board
layout/results and a bounded driver using the existing match. It must explicitly
pause rather than step zero masks after input loss. It must never send two-player
results/evidence to the parent, alter Ranked solo replay or grant solo rewards.
Keep the initial screen accessible and explain keyboard ghosting when split
keyboard is chosen. Physical controllers and owner playtest remain open.
