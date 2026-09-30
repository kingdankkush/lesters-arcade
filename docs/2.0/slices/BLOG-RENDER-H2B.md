# H2b — static articles and a private editorial preview

`scripts/lib/blog-render.mjs` renders the supported Markdown subset into escaped,
script-free article HTML. Paragraphs, H2/H3/H4, flat bullets, quotes, fenced code,
strong/code spans and HTTPS/local links are supported. Raw HTML becomes text.
Blank headings and unclosed fences fail. Heading anchors are unique even when
authored titles collide with generated suffixes. Metadata and link attributes
are escaped; unsupported Markdown remains plain text rather than executable HTML.

Articles reuse the portal design tokens, current public guide shell, logo and
small `apps/portal/blog/article.css` addition. The page has one H1, native section
links, a keyboard skip link and related reading. Preview is explicitly labelled
unpublished, noindex/nofollow and has no canonical URL. Public rendering requires
the exact visible record from a genuine immutable `buildBlogIndex` result. The
private WeakSet brand is build-process-local; serialized/cloned indexes must be
rebuilt from source rather than treated as trusted publication input.

## Verification

Initial RED10 missing-renderer checks preceded implementation. Independent review
then reproduced a forged publication index and an empty heading as two separate
real RED1 failures. Both were fixed; final24 tests (12 content and12 renderer) and
the identical24 isolated checks pass. The latter have no Git, dependency or PATH
requirement. Source children20364/31136 closed0/null and were independently absent.

The actual renderer, draft copy and three stylesheets were served from a local
HTTP preview into installed Chrome with JavaScript disabled. Four browser case
groups cover keyboard skip-link focus, real section-link navigation, logo/assets,
44px TOC links, reduced motion and contained1440/414/320px layouts. Seven original
captures include1242×2688 phone pixels. Root inspected them and the metrics: body
text16px, no horizontal overflow, valid targets and no script elements. This is
a Windows phone viewport proxy, not a physical iPhone performance test. Related
reading/public metadata are source-tested; the current browser draft has no
related cards and does not certify those screens.

Browser attempt01 failed at a syntax error in the check script before execution;
Node39092 closed and was independently absent. Its exact retained lock was released
only after confirming no browser output directory existed and the failure was
at parsing. That failure and separate closure follow-up remain intact. Corrected
attempt02 passed; Node22280 and Chrome29408 closed0/null and were independently
absent, the HTTP endpoint refused a connection and the exact marker was released.
All source, public-page and build pins stayed exact. See
[the complete receipt](../receipts/blog-render-h2b/receipt.json).

## Remaining publication work

No default builder, route, sitemap, service worker, game bundle or version changed.
No full build, HMH visual gate or release gate ran for this unimported static-blog
slice. The private browser preview is not a live blog. The three-game introduction
in `docs/2.0/editorial/three-games-one-arcade.md` is an editorial draft, not an
approved launch article. Claims draw from the current game discovery copy and
controls; they require final release fact checking before publication.

Next: static index/category/feed builder, shared navigation and route integration,
article media/OG metadata, the five final reviewed articles, public related-card
browser coverage and release SEO/link/accessibility checks. Keep publication in
the owner's combined update and do not post social drafts on their behalf.
