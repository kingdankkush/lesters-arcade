# HMH AAA Cycle 001 Preview Verification

Generated: `2026-07-24T15:47:12Z`

Status: **PREVIEW VERIFIED; PRODUCTION APPROVAL PENDING**

## Source and deployment

- Source commit: `821a97715ff49627cd628d24cc7e2a3066e1382c`
- Branch: `reboot/hmh-aaa-continuous`
- Deployment: `dpl_CZoPtPy5uriibhEmpcrnZPsEpD26`
- Target: preview
- Status: Ready
- URL: `https://lesters-arcade-b7n6b9h1f-justin-agent-projects.vercel.app`
- Protection: Vercel SSO
- Verification: authenticated `vercel curl`; protection was not disabled

This deployment supersedes `dpl_5prnSaryWWHWzd1gEBhr2S26yk2e`, whose hidden portal gallery referenced four missing retired generated HMH assets.

## Linux CI

Vercel passed the full deployment pipeline:

- Generated assets: PASS
- Exact release suite: PASS, 1,616 total / 1,564 pass / exact 52 accepted failures
- Syntax: PASS, 319 JS + 40 Python
- Contract structure: PASS
- Build: PASS

## Exact artifact verification

| Artifact | Bytes | SHA-256 | Result |
|---|---:|---|---|
| Portal index with preview toolbar removed | 37,092 | `06465ce0e247a3d07c27e384ad845fc2feb2e77a1cf4d5e26d044f607d682184` | exact |
| HMH index | 4,365 | `10a373bccbf59ecfa6a1ec382d91bd9e6b35f0888eb8d2b921b3be67344b0bb1` | exact |
| HMH game bundle | 962,113 | `bde4d3e5b9df49760c5944c0d0c84b020656f071eccb48732db8bcdcb604d847` | exact |
| Portal main after required generator | 1,246,613 | `df9c811971dfec7ba7b88e2cf4b4c20d216faeffbf814f613daf7f791926ae81` | exact |
| Service worker | 3,508 | `8146ed967e426c70d9dc439494168c85be32892720fec8e9794347a10d6b504a` | exact |

Vercel appends one preview-only feedback-toolbar script to the portal index. Removing that deployment-ID-bearing line produces an exact source match.

## Production gallery correction

The obsolete Lester draft, isometric environment, enemy wave, and boss silhouette references were removed. The portal now references the approved production contact sheets:

| Character | SHA-256 | Hosted result |
|---|---|---|
| Lester | `93923817cb7afc7d91655e04892de1bf505f7ace031bf87ef238328c75211a96` | 200 `image/png` |
| Lilly | `b6d0efd1db242a153878fed4cef91574ca4a8b505deef137292bb3a3c495d578` | 200 `image/png` |
| Lit Commando | `cbd9ee8247e2c30cbb4198e49ef699a37bde9c670f6d2e4df3ef0596b7a57062` | 200 `image/png` |
| Lit Valkyrie | `d8abc900f2f566774c74adb9f321fb4c123c40377192fa0c0e9118bec14becf2` | 200 `image/png` |

All four decode at `1470x2024`. Static-reference, browser, and visual reviews pass with zero errors, no corruption, and no proxy art.

## Hosted headers

- Parent CSP: no `unsafe-eval`; `frame-ancestors 'none'`.
- HMH child CSP: scoped `unsafe-eval`; `frame-ancestors 'self'`.
- HMH index: `text/html; charset=utf-8`.
- Game and service worker: `application/javascript; charset=utf-8`.
- Hosted analytics: `200 application/javascript`, 2,495 bytes.

## Browser evidence

- Exact HMH source: Chrome 5/5 profiles.
- Exact HMH source: Edge 5/5 profiles.
- Controller browser evidence: `+99.12 x`, `0 y`, zero errors.
- Preview is SSO-protected, so authenticated artifact/header verification was used without weakening security.

## Boundaries

- Production remains `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`.
- Rollback `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk` is Ready.
- Production promotion is not authorized.
- LitVM remains HALT-gated; no transaction or deployment occurred.
