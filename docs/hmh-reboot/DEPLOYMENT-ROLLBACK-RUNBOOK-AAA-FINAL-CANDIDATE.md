# Hard Money Heroes Reboot Deployment and Rollback Runbook

Status: `LOCAL RUNBOOK · ALL REMOTE ACTIONS REQUIRE EXPLICIT APPROVAL`

Certified source commit: `8842077c16e6725997ca8e64a61cecb139d67a9e`

Expected preview/production HMH bundle:

- SHA-256: `d9d738fb2211a1ac59d306008acc5ede5cf65508c4f053c5313ebbe75e33a8ce`
- Bytes: `1,010,293`

## Safety boundaries

- Push plus preview deployment is one explicit approval gate because the Vercel Git integration may deploy immediately after a branch push.
- Production promotion is a separate explicit approval gate.
- Never use `vercel --prod` for this release path. Promote the verified immutable preview instead.
- Do not request a wallet, signature, transaction, LitVM operation, contract operation, or settlement change.
- Keep `SETTLEMENT_LIVE=false`.
- Do not rewrite history or migrate CDN assets during this release.

## Phase 0: restore deployment authentication

The Vercel project is linked locally, but the Vercel CLI and authenticated session are currently absent.

1. Install the official Vercel CLI from `https://vercel.com/docs/cli`.
2. Authenticate:

```bash
vercel login
vercel whoami
```

3. Confirm the linked project:

```bash
vercel project inspect lesters-arcade
```

Do not deploy while establishing authentication.

## Phase 1: local pre-push verification

Run from the repository root:

```bash
git branch --show-current
git status --short --branch
git rev-parse 8842077c16e6725997ca8e64a61cecb139d67a9e
git merge-base --is-ancestor 8842077c16e6725997ca8e64a61cecb139d67a9e HEAD
export PATH="$USERPROFILE/.foundry/bin:$PATH"
npm run vercel:build
npm run contracts:test
sha256sum apps/portal/dist/hmh-reboot/game.js
wc -c < apps/portal/dist/hmh-reboot/game.js
git status --short --branch
```

Required results:

- Branch is `reboot/hmh-aaa-continuous`.
- Certified source commit is an ancestor of release HEAD.
- Deploy build and `17/17` Foundry tests pass.
- Bundle hash and bytes equal the values at the top of this runbook.
- No generated or uncommitted drift remains.

## Gate A: request push and preview authorization

Before any push, state exactly:

- branch and release HEAD;
- 15 source commits ahead of the remote baseline plus documentation-only certification commit;
- Vercel Git integration may create a preview automatically;
- production will not be promoted;
- wallets, LitVM, contracts, and settlement will remain untouched.

Proceed only after an explicit approval covering both push and preview deployment.

## Phase 2: push and identify the immutable preview

After Gate A approval:

```bash
git push origin reboot/hmh-aaa-continuous
```

Inspect GitHub/Vercel deployment records for the pushed release HEAD:

```bash
gh api "repos/kingdankkush/lesters-arcade/deployments?sha=$(git rev-parse HEAD)&per_page=20"
vercel ls --yes
```

Record:

- release HEAD;
- Vercel deployment ID;
- immutable preview URL;
- creation time and deployment status.

Do not use the production alias for preview testing.

## Phase 3: preview verification

Set the immutable preview origin:

```bash
export PREVIEW_ORIGIN="https://<immutable-preview-host>"
```

Verify the route and artifact:

```bash
python -c "import urllib.request,hashlib; u='$PREVIEW_ORIGIN/hmh-reboot/index.html'; d=urllib.request.urlopen(u,timeout=30).read(); print('HTML',len(d),hashlib.sha256(d).hexdigest())"
python -c "import urllib.request,hashlib; u='$PREVIEW_ORIGIN/dist/hmh-reboot/game.js'; r=urllib.request.urlopen(u,timeout=60); d=r.read(); print('BUNDLE',len(d),hashlib.sha256(d).hexdigest()); print('CSP',r.headers.get('content-security-policy')); print('CACHE',r.headers.get('cache-control'))"
```

Required bundle result:

```text
BUNDLE 1010293 d9d738fb2211a1ac59d306008acc5ede5cf65508c4f053c5313ebbe75e33a8ce
```

Run browser certification against the immutable origin:

```bash
HMH_REBOOT_ORIGIN="$PREVIEW_ORIGIN" npm run certify:hmh:browser
HMH_REBOOT_ORIGIN="$PREVIEW_ORIGIN" npm run smoke:hmh:cockpit
```

Also verify:

- no HTTP, request, console, or page errors;
- route-scoped CSP permits only the required Pixi CDN path;
- cache headers match `vercel.json` intent;
- service worker update behavior does not serve the old HMH child;
- desktop, ultrawide, tablet, mobile portrait, and mobile landscape remain contained.

## Phase 4: human preview acceptance

Desktop keyboard/controller:

1. Start a Free run.
2. Test movement, aim, fire, melee, dash, grenade, weapon switching, Pause, and Restart.
3. Verify upgrade selection, current-build presentation, and setting persistence.
4. Check controller reconnect and focus behavior.
5. Check music, SFX balance, warning readability, reduced motion, reduced flash, and screen shake.

Real phone:

1. Open the immutable preview URL.
2. Test portrait and landscape rotation.
3. Test both sticks and all eight touch controls.
4. Verify HUD, minimap, warnings, upgrade choices, Pause, and Restart are unobstructed.
5. Play long enough to assess touch ergonomics, thermal behavior, audio balance, and motion comfort.

Record explicit PASS or concrete defects. Any source correction invalidates the current preview and requires rebuild, review, and a new immutable preview.

## Gate B: request production promotion authorization

Present:

- immutable preview URL and deployment ID;
- pushed release HEAD;
- observed remote bundle hash/bytes;
- preview browser/network results;
- desktop/controller and real-phone acceptance;
- current production deployment and immediate rollback target;
- confirmation that hardened Web3 remains blocked and settlement remains disabled.

Proceed only after a separate explicit production approval.

## Phase 5: promote the verified preview

Vercel documents the current command as:

```bash
vercel promote [deployment-id-or-url]
```

Promoting a Preview deployment creates a new production deployment and asks for confirmation. Do not add `--yes`; keep the interactive confirmation visible.

After promotion, record the new production deployment ID and verify:

```bash
vercel promote status lesters-arcade
```

Then repeat the remote bundle, CSP/cache, browser, and network checks against:

```text
https://lestersarcade.io
```

## Immediate rollback

Current pre-release production target:

- Deployment: `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`
- Bundle SHA-256: `2ea294b53dd8ccd21d071857695d3d2d0b461bde3f05c3158043b154810ad5d3`
- Bundle bytes: `961,934`

If production verification fails, use Vercel's documented rollback command:

```bash
vercel rollback dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9
vercel rollback status lesters-arcade
```

On Vercel Hobby, rollback is limited to the previous production deployment. Immediately after this promotion, the deployment above should be that previous production deployment. If Vercel rejects the target, stop and use the Vercel dashboard's previous-production rollback rather than improvising another deploy.

Verify the restored public artifact:

```bash
python -c "import urllib.request,hashlib; u='https://lestersarcade.io/dist/hmh-reboot/game.js'; d=urllib.request.urlopen(u,timeout=60).read(); print(len(d),hashlib.sha256(d).hexdigest())"
```

Required rollback fingerprint:

```text
961934 2ea294b53dd8ccd21d071857695d3d2d0b461bde3f05c3158043b154810ad5d3
```

Secondary durable record:

- Deployment: `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk`
- Tag: `hmh-pre-reboot-production-2026-07-23`

Do not assume Hobby can directly roll back past the immediately previous production deployment.

## Closeout truth

After either promotion or rollback, report:

- public deployment ID and release HEAD;
- public bundle hash and bytes;
- CSP/cache and browser/network status;
- rollback deployment availability;
- `SETTLEMENT_LIVE=false` status;
- hardened Web3 readiness status;
- confirmation that no wallet, signature, transaction, LitVM, or contract operation occurred.
