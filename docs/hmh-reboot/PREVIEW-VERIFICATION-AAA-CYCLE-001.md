# HMH AAA Cycle 001 Preview Verification

Generated: `2026-07-24T15:21:22Z`

Status: **SUPERSEDED BY POST-REVIEW GALLERY CORRECTION**

This preview was superseded at `2026-07-24T15:40:48Z` after a late read-only audit found four hidden portal references to missing retired generated HMH assets. It is not a production candidate.

## Source and deployment

- Source commit: `33b7a2dd3bffe3b5142e4a6acef093e39b7ca7d3`
- Branch: `reboot/hmh-aaa-continuous`
- Deployment: `dpl_5prnSaryWWHWzd1gEBhr2S26yk2e`
- Target: preview
- Status: Ready
- URL: `https://lesters-arcade-3faaleg9u-justin-agent-projects.vercel.app`
- Protection: Vercel SSO
- Verification: authenticated `vercel curl`; protection was not disabled

## Linux CI

Vercel passed the full deployment pipeline:

- Generated assets: PASS
- Exact release suite: PASS, 1,615 total / 1,563 pass / exact 52 accepted failures
- Syntax: PASS, 319 JS + 40 Python
- Contract structure: PASS
- Build: PASS

The first preview attempt failed closed on a Windows-specific path expectation. The corrected test uses runtime `fileURLToPath` and passed Vercel Linux CI.

## Exact artifact verification

| Artifact | Bytes | SHA-256 | Result |
|---|---:|---|---|
| HMH index | 4,365 | `10a373bccbf59ecfa6a1ec382d91bd9e6b35f0888eb8d2b921b3be67344b0bb1` | exact |
| HMH game bundle | 962,113 | `bde4d3e5b9df49760c5944c0d0c84b020656f071eccb48732db8bcdcb604d847` | exact |
| Portal main after required generator | 1,246,613 | `df9c811971dfec7ba7b88e2cf4b4c20d216faeffbf814f613daf7f791926ae81` | exact |
| Service worker | 3,500 | `b6318a84880817a83be6ed3386e457c820c45790c48823bd4ed5a524a4c3205b` | exact |
| Portal index with preview toolbar removed | 36,920 | `8cf9e671714f320289bc1967ccfcac286295e61dbb691c8926ab94854505e299` | exact |

Vercel appends one preview-only feedback-toolbar script to the portal index. Removing that one deployment-ID-bearing line produces an exact source match. The HMH child index is not mutated.

## Hosted headers

- Parent CSP: no `unsafe-eval`; `frame-ancestors 'none'`.
- HMH child CSP: scoped `unsafe-eval`; `frame-ancestors 'self'`.
- HMH index: `text/html; charset=utf-8`.
- Game and service worker: `application/javascript; charset=utf-8`.
- Hosted analytics: `200 application/javascript`, 2,495 bytes.

## Browser evidence

- Exact local source: Chrome 5/5 profiles.
- Exact local source: Edge 5/5 profiles.
- Controller browser evidence: `+99.12 x`, `0 y`, zero errors.
- Preview is SSO-protected, so authenticated artifact/header verification was used without weakening security.

## Boundaries

- Production remains `dpl_AvXkk8eXSGzX4jcviDNzVSsr9ap9`.
- Rollback `dpl_3ku2fQ42yybTB5bWoZgifX9AnAPk` is Ready.
- Production promotion is not authorized.
- LitVM remains HALT-gated; no transaction or deployment occurred.
