# Lester's Arcade discovery redesign

Published branch: `codex/arcade-home-catalog-20260914`. Runtime source `6fe83eb693bda5c36cb77f995b88d244515365f8` is verified live as `dpl_6bgHFQsaZ6smUdqFNRzhc7FrsenJ`. [Release receipt](arcade-discovery-release-20260914.json).

The homepage now introduces all three active games, explains Free play and the wallet/profile flow, describes device-local scoreboards, and offers a shared jukebox and FAQ. Existing Lester/Lilly films, the brand logo, arcade illustration, and game key art supply the visual identity. Film downloads are deferred until needed; reduced-motion visitors receive still posters and explicit playback controls.

The cabinet browser uses equal visual heights and ground lines for all eighteen views across the three rotating cabinets. Bounds are measured from the existing source art. The framing preserves each source aspect ratio and leaves hero selection and gameplay geometry alone. Game entries retain Free/Ranked gating and add goals and control guides.

## Design review

Three local studies compared an editorial split, a cinema entrance, and a game-first index. The editorial split won: it makes the brand film prominent while keeping the headline and play actions readable. The throwaway studies and switcher remain in the task workspace, outside deployed output.

Desktop first impression: I understand this is a browser arcade with Free play. I notice the Lester/Lilly film, the headline, and the Browse Arcade action first. Those match the intended path into the catalog. Verdict: clear.

Phone first impression: I can read the pitch and choose Browse Arcade or Connect Wallet before the film. The navigation stays compact. Verdict: direct.

Each area has a specific job: brand/navigation, introduction/play entry, active-game previews, platform walkthrough, local-score explanation, jukebox, FAQ, final play entry, and in-flow sponsorship. The older floating ad was removed; the shared player follows the routed content so it cannot cover a cabinet. Disabled future cabinets stay distinct from the active three.

## Search and accessibility

- Five distinct public pages are readable without JavaScript: home, catalog, and three game guides. They use real links, unique titles/descriptions, canonical URLs, social cards, and shared Organization/WebSite/VideoGame identities.
- The sitemap lists public discovery pages and policies. The robots file only advertises that sitemap, preserving the prior crawler access policy.
- Profile, scoreboard, settings, and session paths receive a noindex response header. SPA metadata also updates during navigation.
- The small generated `llms.txt` is a factual reference for tools that choose to use it; it is not a ranking promise.
- Browser checks cover widths 320, 390, 768, 1024, and 1440; keyboard game entry; all eighteen cabinet frames; films; profile navigation; and the jukebox.
- Seven axe WCAG A/AA scans cover desktop/phone home and catalog plus the three game guides. All pass without violations.
- The broad design-lint scan also inspects the retained hidden game menus and their older neon styles. Those findings were reviewed against the visible redesign; they were not used to remove the games' existing presentation.

Search implementation follows [Google's JavaScript guidance](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics) and [Google's guidance for generative AI search](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide). Crawlability and factual content improve access; indexing or AI citations are not guaranteed. [OpenAI's crawler documentation](https://developers.openai.com/api/docs/bots) distinguishes search from training controls; this release adds no new bot permissions.

## Preserved boundaries

Wallet/profile/session authority remains with the parent portal. Free/Ranked separation, deterministic replay, current game versions, and download budgets are unchanged. `SETTLEMENT_LIVE=false`. The site does not promise global rankings, cloud-saved history, fees, or prizes.
