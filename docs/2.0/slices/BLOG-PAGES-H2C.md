# H2c — static journal discovery and Atom

`scripts/lib/blog-pages.mjs` builds an immutable in-memory output manifest for the
journal index, three category pages, Atom feed and visible articles. It requires
the genuine publication snapshot from H2a. Drafts and future posts stay absent;
routes derive only from validated slugs and fixed categories. Output is stable
across input order and independent of the host clock. The builder is pure: an
error produces no partially written files.

Native category and article links work without JavaScript. The shared guide shell
uses responsive cards, visible current-category state, 44px links, an empty state
and keyboard skip links. Articles link back to the journal and advertise its feed.
Atom includes absolute identities, author, dates and escaped text summaries.
Invalid XML scalars fail explicitly, including lone UTF-16 surrogates and
U+FFFE/U+FFFF; valid supplementary Unicode remains intact.

## Checked

Initial12 RED failures preceded implementation. World independent review found
the XML validity gap; a separate genuine RED1 reproduced it before the fix.
Final37 source tests plus the identical37 in a no-Git/no-dependency copy pass.
The installed Chrome preview exercises the actual generated index, categories,
articles, related links and empty state at1440,414 and320px with JavaScript off.
It also fetches the actual Atom response and parses it with the native XML parser.
Root reviewed original screenshots and containment,44px target,16px body-text,
current-category and canonical metrics. All owned children closed and were
independently absent; HTTP closed and the exact owned marker was released.
See [the receipt](../receipts/blog-pages-h2c/receipt.json).

## Still open

This browser content is explicitly labelled layout fixtures, not final articles.
Phone-size captures are Windows proxies, not iPhone device evidence. No default
build, public route, sitemap, game bundle, version or deployment changed. Static
output installation/routing, full site navigation, media/OG images, five reviewed
articles and final release SEO/accessibility/link checks remain. No full release
gate or HMH visual gate was run for this unimported site-only module.
