# F2b: Optional STACKED Free daily challenge

Status: local source and actual browser checks pass. The feature is off by
default and has not shipped. Use the unique `?stackedDaily=daily-v1` preview
switch, enter STACKED, and check “Play today’s daily challenge” before Free Mode.
Ordinary Free and Ranked keep their existing seeds and behavior.

The parent derives the day's seed from `stacked-daily-v1|stacked|YYYY-MM-DD`
using FNV-1a32 (zero normalized to one), bound to the issued session's UTC date.
It updates its own canonical seed before mounting the child, freezes daily
identity in the host and forces Level 1 in both child initialization and replay.
The child receives only optional, exact-validated date/best display metadata;
it never derives or substitutes the seed. Ranked, paid, malformed or ambiguous
preview requests cannot enable a daily run. Old init messages remain accepted.

The existing real replay Worker and canonical-claim comparison must succeed
before the parent writes a best to `stacked-daily-best-v1`. Day/build/season
identities stay separate. At most 32 records are retained, including an older
run that finishes after newer days. Independent review caught and fixed a draft
that could discard that older result despite reporting it saved. An assisted
Undo run never submits evidence, so it cannot update the daily best. Closing
the cabinet during verification cancels completion before any daily write.
Storage denial, malformed data and quota failure leave play/retry available.
There is no Ranked daily board, fee, prize, ghost or new earning rule here.

The launch checkbox has a native label and keeps the starting-level selector
disabled while checked. The start/results panel displays the UTC day and local
best. Long panels have an explicit viewport height and scroll internally.
Existing Free medals and sharing retain their existing behavior.

## Checked

- Genuine preimplementation RED: 14 failures and two rejection controls across
  16 cases. Then 16/16 GREEN and the same 16/16 in an exact import-closure copy
  with no Git, no node_modules and empty PATH. No skips/cancellations.
- 63/63 related tests pass, including old bridge, lifecycle, tutorial, settings,
  input and menu cases. Parent source parse and fresh build pass.
- Final actual Chrome attempt passes all 16 cases: desktop and touch completion,
  Level 1 despite a selected Level 15, same-day retries, real Worker verification,
  midnight crossing and next-day retry, default/bad/duplicate switches, unavailable
  storage, actual keyboard Undo and exit during pending verification. The built
  Worker reproduces the exact existing 432,000-tick fixture tuple.
- Seven original desktop/phone images reviewed at widths 320, 414, 768, 1024 and
  1440. Horizontal and vertical panel containment and 44px action targets pass.
  The 414 view uses touch, DPR 3 and reduced motion on Windows Chrome; it is not
  a physical iPhone. The long result shelf remains scrollable.
- HMH initial/shared JavaScript: 1,039,992 B (8,584 B headroom). STACKED:
  580,438 B (26,562 B headroom). Simulation, SIC1, game contracts, server verifier
  and Worker source are unchanged. This is not release-gate certification.

The first browser attempt passed thirteen cases, then failed because its test
clicked the hidden desktop Undo button. That failure and all evidence remain.
The corrected test uses the actual U key. Original screenshot review prompted
the small panel-height fix, so a new build and full browser attempt were run.
An intermediate continuation named 02 was prepared but never run.

First build/test/browser children 52296/7660/46892/6168 and Chrome10608 closed;
browser child exited 1 for the recorded harness failure. Final children
13892/8228/7024/20296 and Chrome17784 closed with 0/no signal. All were observed
absent; both HTTP servers closed and exact owned markers were released. Source
and served-file identities are retained in the compressed receipts. Source
RED child51388 and GREEN3892/44872 also closed and were observed absent.

First impression review: I read this as a Free daily version of the existing
STACKED cabinet. The title, day/best strip and Start button lead the layout;
the result puts score and retry first. Verdict: clear. Each area has a purpose;
the existing long settings/medal shelf scrolls on phones. The parent date uses
the session issue time rather than a live countdown that could mislabel a run.

No HMH render code changed, so this DOM/parent feature does not require another
HMH visual suite. Physical iPhone checks, the 60-minute soak, owner playtest,
full release gate and publication remain open. Axe/Impeccable were not run;
they are not installed in the prepared workspace. No packages or credits used.
