Historical README header retained as evidence. Superseded by the verified playable release.

# Lester's Arcade

A retro Litecoin and LitVM arcade portal with deterministic child games, wallet-bound profiles, canonical game sessions, cadence leaderboards, achievements, and approval-gated Web3 publishing.

**Repository:** https://github.com/kingdankkush/Lesters-Arcade

**Production:** https://lestersarcade.io

**Certified production source:** `5d28dfb69c721465a925df2a9142a8848e52d44f` (`hermes/hmh-cycle-080-corpse-audio`). Cycle 080 adds bounded enemy-corpse and combat-audio lifetime cleanup while preserving the live STACKED/security release and existing gameplay systems/art.

**Verified runtime release deployment:** `dpl_HskTDVZr72FVDUD7zHnZTHRCtmCx`

**Immutable runtime release:** https://lesters-arcade-cjqehxa53-justin-agent-projects.vercel.app

**Retained rollback:** `dpl_3vyy1XDPsCAveFDhvm1uvYyFmMPs` (STACKED/security source `65dd4522edcc6158f61e3dafbe6188d7be4e11bb`)

> **Cycle 080 is live:** enemy corpses expire after 2,000 ms or 120 fixed ticks, with a 24-graphic cap and bounded fade. Expired combat voices stop/reset before removal. Cycle 079 pacing and Tripo gameplay art are not included. [Release certificate](docs/hmh-reboot/RELEASE-CERTIFICATION-AAA-CYCLE-080.json).

**Production cache marker:** `lesters-arcade-v33-hmh-playable-update`

This is the **pending playable candidate's source marker, not a claim that it is live**. It includes the reconciled native hero/world/control work and parent profile/challenge changes. The current release session observed production deployment `dpl_DBodNtqBWjYzT87FcwgTLCRJy3xs`; the Cycle 080 certificate and deployment identities above are retained historical evidence, not this candidate's acceptance. Exact new source/build/Preview/production identities will be recorded after verification. Human playtests and unfinished AAA art remain open with explicit owner approval to ship the verified playable update. [Preserved polish backlog](docs/handoffs/hmh-playable-release-and-polish-backlog.md).

> **Cycle 077 is live:** all four latest textured Tripo hero turntables, with unchanged gameplay IDs/stats and unlock rules. New gameplay rigs/animations remain unfinished. [Release scope](docs/hmh-reboot/cycles/CYCLE-077.md).

> **Current release handoff:** [Cycle 080 release and withheld work](docs/handoffs/hmh-cycle-080-hermes-handoff.md). The [Cycle 077 handoff](docs/handoffs/2026-09-06-hmh-cycle-077-hermes-handoff.md) is historical selector-source context, not the current production or rollback boundary.

> Production was verified by 35 exact public artifact hashes, custom-domain deployment-ID read-back, real-input corpse expiry on the public site, four selector-to-gameplay profiles, and four clean/warm network scenarios. The clean-host ledger covers 2,702 tests: 2,651 passed and 51 existing accepted retirement failures, with no unexpected failures. Two 12-scene visual runs passed. This later documentation-only publication does not change the deployed runtime boundary.

> `SETTLEMENT_LIVE=false` remains mandatory; LitVM contracts, wallets, signatures, transactions, and settlement changes require separate explicit HALT approval.
