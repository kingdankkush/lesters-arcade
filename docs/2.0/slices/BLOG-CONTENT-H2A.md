# H2a — deterministic blog content index

The build-only module `scripts/lib/blog-content.mjs` reads Markdown with an explicit
JSON object between `---` front-matter delimiters. It validates the exact eight
metadata keys: slug, title, summary, category, games, date, status and author.
Dates are actual calendar dates. Categories are news, guides and dev-notes;
game tags use lester-blaster, chikun and stacked, with an empty list for site-wide
articles. Status is draft or published. Content is limited to128KiB UTF-8.

`buildBlogIndex(sources,{asOf})` requires an explicit publication cutoff; it never
reads the host clock. Drafts and later-dated posts are absent from the returned
posts, category counts and related links. Duplicate slugs fail even if a duplicate
is hidden. Ordering is date descending then ASCII slug; related reading prefers
shared games then category and contains at most three other visible articles.
Returned metadata, lists and records are immutable. Unknown keys and invalid
routes fail instead of silently producing the wrong index.

Raw Markdown is retained as text, not sanitized or rendered HTML. The future
renderer must escape content and validate links; this module makes no HTML-safety
claim. JSON front matter deliberately needs no YAML parser or new dependency.

## Checked and remaining

Twelve genuine missing-module failures preceded implementation. Twelve source
checks and the identical twelve in a two-file copy with no Git, dependencies or
PATH pass. Peer review added a fourth eligible related article before RED so the
three-article cap is actually tested. Final implementation review is clear.
Children3852,18412 and4660 exited normally, were independently absent and released
only their owned shared markers. Raw output and the existing owned-child wrapper
are preserved in [the receipt](../receipts/blog-content-h2a/receipt.json).

No default builder or public route imports this module. No HTML, feed, sitemap,
public article or client bundle changed, so no browser/build/release gate was run
for this source-only slice. H2b still needs the static builder and shared page
shell, safe Markdown rendering, TOC, categories/feed and actual desktop/phone
screens. Five reviewed articles, launch facts, OG images and owner-postable social
drafts remain. Publication stays in the combined approved release.
