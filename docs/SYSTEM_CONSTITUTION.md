# The 1 & 9 Apparel PSEO Engine — System Constitution

**Companion volume to:** `docs/DATABASE_MANUAL.md` (the *what*; this document is the *why*)
**Status:** Version 2 — Architectural Constitution
**Scope:** Philosophy, principles, lifecycle, lock classification, golden rules, risk analysis, honest verdict.
**Ground truth:** every claim here is anchored in the live audited system (Supabase project `1 & 9 SEO`, repo `19bayltd/1and9-neww-mdsir`). Where the current implementation *violates* its own philosophy, this document says so explicitly rather than pretending otherwise.

---

# PART 1 — System Philosophy

## 1.1 Why this architecture was designed

The business problem is asymmetric: **one factory, thousands of buyer intents.** A Bangladesh apparel manufacturer sells the same core capability (custom garment production) to thousands of distinct searchers — "custom t-shirt manufacturer usa", "hoodie manufacturer for gyms", "private label t-shirt manufacturer". Each intent deserves its own page, but no team can hand-build and hand-maintain thousands of pages.

The classical solutions all fail at one end:

- **Hand-written pages** (WordPress-style): quality is high, but 50 pages is the practical ceiling, and consistency decays with every edit.
- **Pure template interpolation** ("{product} manufacturer in {country}" with a for-loop): infinite scale, but every page is the same page. Google classifies this as scaled content abuse; users bounce.
- **CMS page builders:** content and presentation entangle; there is no machine-readable model of *what a page means*, so nothing can be automated later.

This system takes a fourth path: **model the meaning, not the page.** A page is not a document; it is a *derivation* — a keyword decomposed into entities, entities wired into a page row, content attached as ordered blocks, and satellites (products, FAQs, links, country assets) resolved at render time by one deterministic function. The page you see in a browser is a pure projection of database state.

## 1.2 What problems it solves

1. **The duplication problem.** Meaning lives once (entities, FAQ pool, product attributes) and is referenced everywhere. There is no second copy to drift out of sync.
2. **The consistency problem.** Every page is rendered by the same RPC and the same component mapper. A bug fixed once is fixed on every page, past and future.
3. **The scale problem.** Adding a page is adding *rows*, not code. The marginal cost of page #10,000 is the same as page #10.
4. **The audit problem.** Because the page is a projection of data, every question about the site ("which pages have no FAQs?", "which links point at drafts?") is a SQL query, not a crawl.
5. **The team problem.** Editors touch rows. Developers touch components. SEO strategists touch keywords and links. The RPC contract is the border between them; nobody can break another discipline's work by accident — *provided the contract is respected.*

## 1.3 Why deterministic instead of dynamic

"Dynamic" here means render-time variability: randomized section orders, rotating testimonials, A/B copy that changes per request, "smart" product pickers that reorder on every load. This system deliberately rejects all of it.

**A page's output is a pure function of its database rows.** Same rows in, same HTML out — every request, every crawler visit, every cache fill. This is enforced structurally, not by discipline:

- The render RPCs are declared `STABLE` (Postgres-level promise of no side effects and consistent results within a statement).
- Every collection has an explicit, database-enforced order (`display_order` columns with **unique constraints per scope** — a shuffled order is not just discouraged, it is unrepresentable).
- The frontend contains zero randomness and zero page-specific conditionals; it maps `block_key` → component and sorts by the RPC's `sort_order`.

## 1.4 Why determinism is better for large-scale SEO

1. **Google's index is a cache of your determinism.** Googlebot samples a URL occasionally and extrapolates. If two crawls of the same URL differ (different links, different order, different FAQ set), the extrapolation degrades: link equity flows to links that vanish, snippets are built from text that no longer exists, and trust in the URL's stability drops. Deterministic pages make every crawl a confirmation instead of a contradiction.
2. **Internal link graphs only work if they hold still.** PageRank-style authority flows across the link graph *as it existed at crawl time*. A graph that reshuffles per render is a graph Google can never finish measuring.
3. **Rich results demand consistency.** FAQ schema that doesn't match rendered FAQs — or changes between crawls — is a manual-action pattern. Here, schema is generated from the *same array* the page renders, minus explicitly excluded rows. It cannot diverge.
4. **Caching becomes trivial and safe.** A deterministic page can be cached at any layer (ISR, CDN, edge) with zero correctness risk. At 100,000 pages, caching is not an optimization — it is the architecture. Determinism is what makes it free.
5. **Debugging becomes reproduction.** "Page X looks wrong" is always reproducible, because nothing depends on time, session, or chance.

## 1.5 The guiding principles, from first principles

1. **Meaning before markup.** Model what a page *is* (entities, intent) before what it *says* (copy) before how it *looks* (components).
2. **One source of truth per fact.** Every fact (a product's MOQ, a country's currency, a page's canonical) lives in exactly one column of exactly one table.
3. **Derivation over duplication.** Anything that can be computed from truth (sitemaps, link groups, FAQ matches) is computed, never copied.
4. **The contract is sacred.** The RPC JSON shape is a versioned API. Producers (database) and consumers (frontend) evolve independently as long as the contract holds.
5. **Safe-by-default publishing.** New pages are born `draft` + `noindex,follow`. Visibility is an explicit, two-key decision (`status` AND `robots`), never a side effect.
6. **Structural enforcement beats convention.** Uniqueness, ordering, entity-type correctness and length limits are CHECK constraints, unique indexes and triggers — not documentation. The database refuses bad states rather than trusting people to avoid them.
7. **Degrade, never crash.** Every field in the render path is optional at the UI level. Missing data shrinks a page; it never breaks one.

---

# PART 2 — Core Principles (The Immutable Chain)

```
One keyword
  ↓  one row in seo_keywords (unique keyword, unique slug)
One page
  ↓  one row in seo_pages (unique slug; upsert-by-slug from the keyword)
One entity combination
  ↓  enforced by seo_pages_entity_combo_key (template + 6 entity FKs, NULLS NOT DISTINCT)
One content structure
  ↓  one set of blocks per page (block_key unique per page, display_order unique per page)
One render
  ↓  one RPC (get_landing_page_view), STABLE, published-only
One canonical URL
  ↓  canonical_url column, defaulted to /<slug>, emitted in metadata and sitemap
One internal link graph
  ↓  one edge table, unique (source, group, target), machine-owned auto group
One indexed page
  ↓  status='published' AND robots='index,follow' — the only gate into the sitemap
```

## Why this chain exists

Each link in the chain kills one specific failure mode of programmatic SEO:

- **One keyword → one page** kills *keyword cannibalization*: two pages competing for the same query split clicks, links and relevance signals, and Google picks the winner arbitrarily. The unique keyword and unique slug make the mapping bijective.
- **One page → one entity combination** kills *semantic duplication* — the subtler cousin of slug duplication. Two different slugs meaning "t-shirts × USA × product_country" are still duplicate content. The composite unique index makes duplicated *meaning* a constraint violation, not an editorial oversight. This is the single most valuable constraint in the database.
- **One content structure** kills *layout drift*. Every page has the same ten-section skeleton; editors vary the words, never the bones. Quality review, CRO testing and component development all assume this skeleton.
- **One render** kills *rendering forks*. If two code paths can produce a page, they will eventually disagree. (The audit found exactly this violation embryonically: the legacy `get_seo_page_render` still exists, unused. It must stay unused or die.)
- **One canonical URL** kills *self-competition through URL variants* (query params, casing, trailing slashes, alternate hosts). Every signal consolidates onto one string chosen by the database, not by whoever linked to the page.
- **One internal link graph** kills *invisible architecture*. Because every link is a row, the site's authority flow is queryable, auditable and rebuildable. Hardcoded links would make the graph invisible and unfixable at scale.
- **One indexed page** kills *accidental indexation* — the worst PSEO accident (thousands of thin drafts hitting the index at once, poisoning the domain). Two independent flags must both be flipped for a page to reach Google.

## Why it must never change

Every future feature — AI content, recommendation engines, multi-language, multi-brand — plugs into this chain as a *new producer or consumer of rows*. None of them requires bending it. The moment you allow "just this once, two pages for one keyword" or "just this page renders through a different path", you re-import the failure mode the chain was built to kill, and you re-import it at whatever scale you've reached by then. Exceptions to this chain do not stay exceptions; they become precedents.

---

# PART 3 — Database Philosophy (Table by Table)

The schema follows a strict layering: **vocabulary → intent → page → attachment → interaction.** Each table has one responsibility; the ratings reflect how load-bearing that responsibility is.

### `seo_pages` — ★★★★★ Permanent
- **Why it exists:** the system needs exactly one authoritative registry of "what URLs do we own and what do they mean." That is this table, and nothing else.
- **Single responsibility:** URL identity + meaning wiring + publish state + SEO metadata. One row = one URL, forever.
- **Belongs here:** slug, entity FKs, title/H1/meta, canonical, robots, status, priority, template, sitemap_group, timestamps.
- **Must never be stored here:** body copy (that's blocks), FAQ text (that's the pool), link lists (that's edges), product data (that's entities/attachments), images beyond a single override URL. The moment paragraphs land in `seo_pages`, the content system forks and the block architecture dies.
- **Why separated:** publish state and meaning change on different cadences than copy. Editors rewrite blocks daily; slugs and entity wiring should change almost never. Separating them means the risky table is also the quiet one.
- **Future flexibility:** new metadata (hreflang, quality scores, lock timestamps) are additive columns; nothing downstream breaks.
- **If merged (e.g., with content blocks):** every copy edit would touch the same row that controls indexation — the highest-blast-risk row in the system — and per-page section counts would become fixed columns instead of flexible rows.

### `seo_entities` — ★★★★★ Permanent
- **Why:** the shared vocabulary. Products, countries, states, industries, buyer types, materials, services — every concept the system can talk *about*, defined once.
- **Single responsibility:** name a concept, type it, slug it, decorate it (`attributes` jsonb).
- **Belongs here:** entity_type, slug, name, parent hierarchy, presentation attributes (product image/MOQ/card copy).
- **Never here:** page-specific copy, keyword phrases, per-page overrides (those live on the attachment rows precisely so the entity stays global).
- **Why one polymorphic table instead of `products`, `countries`, `industries` tables:** every consumer (pages, keywords, FAQs, templates, quote rows) needs to reference "some entity" through one FK pattern, and the trigger + composite-FK machinery enforces type correctness anyway. Fourteen allowed types in one CHECK constraint beats fourteen tables with fourteen copies of the same plumbing. The `(id, entity_type)` unique key is the trick that lets other tables enforce *typed* references against a polymorphic table.
- **If merged into pages:** the same concept would exist once per page that mentions it — the definition of the duplication this system exists to prevent.

### `seo_keywords` — ★★★★ Core
- **Why:** the demand ledger. A keyword is *captured search intent*, decomposed into entities before any page exists. It is the input queue of the whole factory.
- **Single responsibility:** phrase → slug → entity decomposition → priority → pipeline status.
- **Never here:** rendered copy, page state. A keyword is upstream of pages; it must be editable/pausable without touching a live URL.
- **Why separate from pages:** the mapping is temporal, not just logical — keywords exist *before* pages (backlog), and pages can outlive keyword strategy changes. `generate_seo_pages()` deliberately refreshes only entity wiring on re-run, never editorial fields: the separation is what makes regeneration non-destructive.
- **If merged:** re-running generation would overwrite editorial work, and the backlog (keywords without pages yet) would have nowhere to live.
- **Not ★★★★★** only because a page can technically exist without one (manual pages have `keyword_id NULL`); the render path never reads it.

### `seo_content_blocks` — ★★★★★ Permanent
- **Why:** the body of every page, as data. Ten named sections per page, ordered.
- **Single responsibility:** what each section of one page says (heading, body, CTA, image), and where it sits (`display_order`).
- **Never here:** cross-page reusable copy (that is `seo_templates`), structural HTML, component logic.
- **Why separate from pages:** sections are a *list* with order and identity — the textbook case for child rows. Unique `(page_id, block_key)` and `(page_id, display_order)` make both duplicate sections and ambiguous ordering impossible.
- **Future flexibility:** new section types cost zero migrations (new `block_key`, and the frontend's GenericBlock already renders unknown keys). This is why the vocabulary can grow forever.
- **If merged into pages:** ten nullable column-pairs per page, a schema migration for every new section, and no per-page variation in section count. Fatal.

### `seo_templates` — ★★★ Supporting (today) → ★★★★ when the v2 generator lands
- **Why:** reusable copy variants per section, optionally scoped to product/buyer/country. It exists to answer "how do 10,000 pages get *different* text?" — the anti-thin-content mechanism.
- **Never here:** page-specific final copy (that's blocks — note the provenance pointer runs blocks→templates, not the reverse).
- **Honest status:** the slot-unique structure is built and correct, but the current generator clones page 2 instead of reading this table. The table is the *designed* future; the clone is a stopgap. Do not delete the table because the stopgap ignores it.

### `seo_faqs` — ★★★★ Core
- **Why:** a *pool*, not per-page rows — the one deliberate exception to page-attachment, and the most elegant design decision in the schema. FAQs target an entity *scope* (product/country/buyer, each nullable); pages match the scope at render time.
- **What this buys:** write "What is your MOQ for t-shirts?" once; every t-shirt page — including ones created next year — shows it automatically. Content leverage grows with the page count instead of costing per page.
- **Never here:** page IDs. The moment FAQs bind to pages, every new page needs manual FAQ curation and the leverage is gone.
- **The tax it charges:** shared scope means shared sameness — 1,000 t-shirt pages show identical t-shirt FAQs unless country/buyer-scoped variants are added as you scale. The pool design is right; the pool *contents* must grow with the site.

### `seo_internal_links` — ★★★★★ Permanent
- **Why:** the site's authority topology as first-class data. See Part 7.
- **Single responsibility:** one directed, grouped, ordered edge between two pages.
- **Never here:** URLs as text (targets are FKs — broken links are structurally impossible), external links (different lifecycle, different risk), rendered anchors for drafts (render-time join filters unpublished targets).
- **If merged into pages (e.g., a jsonb column of links):** no FK integrity, no reverse queries ("who links to me?"), no atomic graph rebuilds. The graph must be a table.

### `seo_page_products` — ★★★★ Core
- **Why:** the many-to-many between pages and product entities, plus per-page presentation overrides. See Part 8.
- **Never here:** global product truth (image, MOQ live on the entity; overrides here are page-local exceptions).
- **The join-table-with-attributes pattern** (order, featured flag, overrides) is exactly right and should be the template for every future attachment (videos, reviews, certifications).

### `country_assets` — ★★★★ Core
- **Why:** country-level truth that is *not page content* — hero/meta imagery, trust badges, currency, shipping copy. One row enriches every page targeting that country, current and future.
- **Why separate from entities' jsonb:** these fields are required-when-present, CHECK-constrained (https-only, ISO currency) and structured (badge arrays). Moving them to loose jsonb would trade validation for convenience — the wrong trade for conversion-critical assets.
- **Rule it encodes:** market localization is a *country* property, never copied per page. 500 USA pages share one USA row; changing the USA hero changes 500 pages atomically.

### `quote_requests` — ★★★★★ Permanent
- **Why:** the entire commercial output of the system funnels through this one table. Every architectural dollar spent upstream is justified by rows landing here.
- **Single responsibility:** capture a lead with attribution (source page, slug, entity IDs) and a lifecycle status.
- **Never here:** anything readable by the public. It is correctly the *only* RLS-protected table (insert-only for anon) — the one place the system already practices the security posture the rest of the schema still needs.
- **Attribution is the future analytics engine:** because leads carry `source_page_id`, "which pages make money" is a query. Never accept a lead-capture path that skips attribution.

### The image system (`image_library`, `seo_page_images`) — ★★ Future (designed) / currently dormant
- **Why it exists:** the *correct* long-term design — a typed asset registry (image_key, type, section_target, alt template, dimensions) plus a page-assignment join. Separation of asset from usage is what makes CDN migration, AI generation and reuse possible (Part 10).
- **Honest status:** the live site renders images from block URLs and country assets; only the unused legacy RPC exposes assignments. Two half-systems exist. The constitution's demand: **choose one** (Part 15 marks this decision as blocking) — but the *philosophy* of the assignment design is sound and should win when the choice is made.

### The layout system (`seo_layout_variants`, `seo_layout_positions`) — ★★ Future
- **Why:** designed to let section order vary by named layout instead of per-page numbers. Nothing reads it; real order is `display_order` on blocks. Keep as the seed of Part 9's "future layouts" — or archive consciously. Its existence is harmless; its *half-existence* is the only cost (two places a developer might think order lives).

### Shipping system (`shipping_zones`, `shipping_rates`) — ★★ Future
- **Why:** freight quoting is deterministic math over zone × weight × method. Modeled as data so the future quote engine is configuration, not code. Unread today; correctly shaped; keep.

### Pricing system (`products`, `product_pricing_tiers`, `seo_products`, `seo_product_images`) — ★★ Future / ★ Optional
- **Why:** the eventual split between *marketing product* (the entity: what we say) and *logistics product* (the catalog: what it weighs, costs, ships as). `seo_page_products.product_id` already reserves the bridge. The duplicate pair (`seo_products` vs `products`) must be resolved to one before either is adopted — carrying both is how the image-system split happened.

### Future quote tables (`quote_configurations`, `quote_customization_options`, `quote_events`) — ★★ Future
- **Why:** per-page quote settings, option menus, and the conversion-event ledger. `quote_events` in particular is the future funnel analytics spine (view → start → submit) and should be the *next* table wired up, because conversion data compounds — every month it isn't collecting is a month lost forever.

### Legacy tables (gen-1/2/2.5 content & image systems) — ★ Optional → DEPRECATED
- `seo_section_blocks`, `seo_block_items`, `seo_images`, `seo_section_images`, `seo_content_library`, `seo_page_content_assignments`, `seo_image_library`, `seo_page_image_assignments`, `seo_media_assets`, `seo_page_media`.
- **Why they exist:** archaeological strata of earlier render designs. Zero RPC and zero frontend references.
- **The lesson they teach (which is why this section exists):** each generation was abandoned *without being removed*. The constitution's rule: **deprecation must be explicit** — mark, archive, then delete after review. Silent abandonment is how a 33-table schema carries 14 dead tables.

---

# PART 4 — Data Lifecycle of One SEO Page

Every stage: **Input → Process → Output → Reason → Scale note.**

1. **Keyword.** *Input:* market research phrase ("custom polo shirt manufacturer uk"). *Process:* decompose into entities, assign slug/type/intent/priority, insert into `seo_keywords`. *Output:* one active keyword row. *Reason:* capture demand as structured intent *before* committing a URL; the backlog is queryable. *Scale:* bulk keyword imports are just bulk inserts; the pipeline doesn't change shape at 10,000 keywords.
2. **Entity.** *Input:* the keyword's concepts. *Process:* ensure each exists once in `seo_entities` (create UK country entity; polo entity exists). *Output:* reusable vocabulary. *Reason:* meaning defined once, referenced forever. *Scale:* entity count grows logarithmically relative to pages (10 products × 50 countries × 5 buyers ≈ 65 entities → 2,500 possible pages).
3. **Page.** *Input:* active keywords. *Process:* `generate_seo_pages()` upserts `seo_pages` — draft, noindex, entity-wired, mechanically-seeded metadata. *Output:* a URL that exists but is invisible. *Reason:* separate *existence* from *visibility*; safe-by-default. *Scale:* one function call generates any batch size; the entity-combo unique key silently absorbs duplicate attempts.
4. **Content.** *Input:* the page skeleton + copy source. *Process:* today, clone-and-substitute from master page 2; tomorrow, composition from `seo_templates` variants; always followed by human editorial rewrite. *Output:* 10 ordered blocks. *Reason:* structure is generated (cheap, consistent); differentiation is editorial/templated (the anti-thin-content investment). *Scale:* this is the stage that decides whether 10,000 pages are an asset or a penalty. Budget here.
5. **Images.** *Input:* brand asset library. *Process:* hero image URL on the hero block; country imagery via `country_assets`; (future: typed assignments via `seo_page_images`). *Output:* a visually complete page. *Reason:* images are data so they can be swapped, audited and CDN-migrated without deploys. *Scale:* asset reuse means image count grows with *entities*, not pages.
6. **Products.** *Input:* the page's product context. *Process:* attach 6 product entities with order + one featured. *Output:* the commercial section. *Reason:* cards are references — global product updates propagate everywhere instantly. *Scale:* future recommendation generator fills this automatically (Part 8).
7. **FAQs.** *Input:* the page's entity scope. *Process:* nothing per-page — the pool matches at render. *Output:* 7–10 relevant Q&As + schema. *Reason:* zero marginal cost per page; leverage compounds. *Scale:* add scoped variants as clusters grow so siblings differentiate.
8. **Internal links.** *Input:* the page graph. *Process:* `generate_internal_links()` rebuilds auto-related (≤6, relevance-ranked); humans curate the `related_*` groups. *Output:* the page joins the authority topology. *Reason:* new pages must be *discovered* — orphan pages are invisible pages. *Scale:* hub-and-spoke rules replace flat similarity ranking past ~100 pages per cluster.
9. **RPC.** *Input:* a slug. *Process:* `get_landing_page_view` assembles page + blocks + assets + FAQs + products + links in one round trip, published-only, deterministically ordered. *Output:* one JSON contract. *Reason:* one contract = one place correctness lives. *Scale:* one indexed lookup + five small ordered scans; add caching in front, never logic behind the frontend.
10. **Frontend.** *Input:* the JSON. *Process:* map block keys → components, sort, null-guard, emit metadata and schema. *Output:* HTML. *Reason:* the frontend renders; it never decides (Part 12). *Scale:* component work amortizes over every page ever.
11. **Google.** *Input:* sitemap (published + indexable only) + crawlable HTML + consistent internal links. *Process:* crawl, index, rank. *Output:* impressions → clicks. *Reason:* the two-flag gate means Google only ever sees finished work. *Scale:* deterministic pages + stable graph = compounding trust.
12. **Lead.** *Input:* a visitor with intent. *Process:* RFQ form → insert-only `quote_requests` with full page attribution. *Output:* a lead with provenance. *Reason:* attribution turns SEO from a cost center into a measurable channel.
13. **Customer.** *Input:* the lead. *Process:* status lifecycle (`new → contacted → quoted → won/lost/spam`); future `quote_events` funnel detail. *Output:* closed business, and *data about which pages close business.*
14. **Revenue.** *Input:* won deals joined back to pages/keywords. *Process:* (future analytics) revenue-per-keyword, revenue-per-cluster. *Output:* the feedback loop — the next round of keyword investment is chosen by evidence, and the lifecycle begins again. *Reason this loop is the point:* the architecture's attribution chain (keyword → page → lead → status) is what makes the flywheel measurable end to end.

---

# PART 5 — The Deterministic Rendering Engine

**Why rendering must never randomly change.** A rendered page is a *claim* — to Google, to a returning visitor, to your own QA. Randomness turns every claim into a moving target: bugs become unreproducible, caches become correctness risks, crawl snapshots become lies. The system therefore forbids render-time chance at every layer:

- **Section order is fixed** because `display_order` is data with a unique constraint per page, and the renderer sorts by it. Order is an *editorial decision recorded in the database*, not a runtime behavior. If you want a different order, you change a number, and the change is permanent, auditable, and identical for every subsequent visitor.
- **Products are deterministic** because the card list is `ORDER BY display_order` over explicit attachment rows, with the featured card chosen by a constrained flag (max one per page), not by rotation. Merchandising is a decision, not a dice roll — and CRO on product order is only measurable if order holds still between measurements.
- **FAQs are deterministic** because scope-matching is set logic (null-or-equal on three FKs) and ordering is `display_order, priority DESC`. The same page always asks and answers the same questions in the same sequence — which is also the only way the FAQ *schema* can be permanently truthful.
- **Internal links are deterministic** because they are rows, ordered, filtered by one rule (published targets only). Even the *generated* group is deterministic: the ranking function is pure (shared-entity class, then priority, then id as final tiebreak), so regeneration over unchanged pages yields the same graph.
- **Google prefers consistency** for a mechanical reason: crawl budget. A URL whose content is stable gets crawled less often *and trusted more*; a URL that differs on every fetch demands re-verification forever. Stability converts crawl budget into indexation of *new* pages instead of re-checking old ones.

**How determinism reduces bugs.** It collapses the debugging search space. Every render is `f(rows)` — so every defect is either wrong rows (fix data, verified by a query) or a wrong function (fix component/RPC, verified by re-render). There is no third category of "it depends on when/who/how it was loaded." It also makes testing honest: one snapshot per page is a complete regression test, and staging renders are *exactly* production renders with different rows.

---

# PART 6 — Entity Philosophy

**Why entities exist.** Language is many-to-one: "tees", "t-shirts", "tshirts" are one concept. Search engines model concepts (entities in the Knowledge Graph sense); a site that models the same way can speak to that machinery precisely. `seo_entities` is the system's concept dictionary — each concept exists once, typed, slugged, decorated.

**Why keywords are not entities.** A keyword is a *sentence*; an entity is a *noun*. "custom t-shirt manufacturer usa" is a request that *contains* two entities (t-shirts, USA) plus intent (buy) plus a frame (manufacturer). Keywords are infinite and volatile (new phrasings monthly); entities are finite and stable. Storing them separately means the volatile layer (`seo_keywords`) churns freely while the stable layer (`seo_entities`) accretes slowly. Merging them would force every phrasing variant to become a fake concept — vocabulary pollution that would poison FAQ matching and link ranking.

**Why products are entities:** a product is referenced by pages, product cards, FAQs, templates, quotes and (future) pricing — the definition of a shared noun. Its presentation truth (image, MOQ, card description) lives once in `attributes` and every surface inherits it.
**Why countries are entities:** countries anchor localization (via `country_assets`), FAQ scoping, link clustering and quote attribution. One `united-states` row is the join point for all of it.
**Why industries and buyer types are entities:** they are *audience* nouns rather than *object* nouns — the axis that turns "t-shirt manufacturer" into "t-shirt manufacturer for gyms." Modeling audiences as entities is what lets the same product ladder into dozens of niche pages without new vocabulary machinery.

**Why pages reference entities instead of storing text.** Three reasons, in ascending importance: (1) *Integrity* — an FK plus type-validating trigger cannot be misspelled; a text column can. (2) *Propagation* — rename an entity, update an image, adjust an MOQ: every referencing page changes atomically. (3) *Computability* — "all pages about t-shirts" is an indexed FK scan, which is the primitive underneath FAQ matching, auto-linking, duplicate prevention and every future recommendation engine. Text would make each of those a fuzzy string hunt.

**How entities prevent duplication.** The entity-combo unique key on `seo_pages` only works *because* meaning is FKs. You cannot uniquely constrain a paragraph; you can uniquely constrain `(template, product_id, country_id, …)`. Entities are what make "this page already exists" a database fact.

**How entities make scaling easier.** Scaling is combinatorial: entities are the factors, pages are the products. 20 products × 30 countries × 6 buyer types is 3,600 candidate pages from 56 vocabulary rows. The work of expansion concentrates in the small table (define the entity well once) and the large table (pages) is generated.

**Future entity expansion.** The type CHECK already reserves `city`, `material`, `fabric`, `certification`, `customization`, `shipping_zone`, `intent`, `service` — expansion is *using* reserved types, not migrating. `parent_id` gives geographic and categorical hierarchy (city → state → country; product family trees) when pages need to inherit context upward. New types (e.g., `language`, `brand` for Part 14) are one CHECK-constraint edit — the only schema change entity growth ever requires.

---

# PART 7 — Internal Linking Philosophy

**Why links are stored separately, not hardcoded.** An internal link is a *strategic asset with a lifecycle*: it is created for a reason, points at a page whose status changes, carries anchor text that concentrates or dilutes relevance, and may need to be rebuilt wholesale when strategy changes. Hardcoded links have none of these properties — they are invisible to queries, immune to bulk repair, and they rot silently. As rows: every link is auditable (`who links to X?`), integrity-checked (FK targets), status-aware (render filters drafts), and rebuildable (the auto group is wiped and regenerated atomically).

**Why groups exist.** Links serve different masters. `auto_related` is machine-owned breadth (recall); `related_products`, `related_countries`, `related_buyer_types`, `related_guides` are human-owned precision. The `link_group` key is the *ownership boundary*: the generator may only ever touch its own group, so automation can never destroy curation. Groups are also the presentation contract — the UI titles link clusters from the group key, so a new strategic grouping is a new key, zero code.

**Why source and target are explicit.** A link is a *directed* vote: the source spends, the target receives. Modeling both ends as FKs makes the graph computable in both directions — outbound (is this page spending its ~6 slots well?) and inbound (is this page an orphan?). Inbound queries are the ones hardcoding makes impossible, and orphan detection is the single most important link audit at scale.

**Why each group exists strategically:** *Auto Related* guarantees no page is ever an island — a floor of connectivity that requires zero human minutes per page. *Related Products* funnels authority horizontally across the commercial cluster (t-shirt page ↔ hoodie page), matching how buyers actually browse. *Related Countries* connects the same product across markets, telling Google "this is one capability, many markets" rather than scattered one-offs.

**Link authority.** Authority (however Google currently computes it) flows through links and divides across them. Practical consequences encoded in this design: few links from a page beat many (the ≤6 auto cap is an authority-conservation rule, not a style choice); links from pages with more inbound weight are worth more (hence pointing curated links *at* flagship pages); anchor text transfers relevance (hence anchors default to the target's title — descriptive, varied, never one exact-match phrase repeated site-wide).

**Topical clusters.** The ranking inside `generate_internal_links` (same product first, same country second, same buyer third) is a cluster policy: pages link most tightly to their own topical family. At scale this becomes explicit hub-and-spoke — a product hub page receives links from all its country/buyer spokes and distributes back, siblings link sparingly. Clusters tell Google the site has *depth* on a topic, which lifts every page in the cluster.

**Future AI-assisted linking** slots in cleanly *because* links are rows: an AI proposer writes candidate edges (better anchors from content analysis, semantic-similarity targets, gap detection) into a staging state; rules (caps, no-drafts, no-cycles-without-purpose, anchor diversity) validate; approved edges land in their own group. The AI never touches the renderer — it only ever writes rows the same way humans do. That containment is the whole design.

**Preventing link spam.** The graph must always look *edited*, not *farmed*: cap total rendered links per page (~15–20: 6 auto + 6 product cards + a handful curated); never all-to-all within a cluster (n² edges is a farm signature — cap sibling links and route through hubs); vary anchors; never render links to unpublished or noindex pages (the RPC enforces the first); and audit reciprocity — mutual links should exist because both directions serve a reader, not because everything links everything. The strongest anti-spam property is already structural: every link must justify a `link_group`, and groups have owners.

---

# PART 8 — Product Philosophy

**Why products attach to pages instead of living inside them.** A product is a global fact; a page is a local context. `seo_page_products` is the join that lets one truth appear in many contexts — 6 t-shirt cards on the USA page, the Canada page, the gym page — while `seo_entities` holds the single definition. Update the t-shirt image once; fourteen (or fourteen thousand) cards update simultaneously. Embedded product data would mean N drifting copies and no way to ask "which pages sell t-shirts?"

**Why one product on many pages is the point.** The factory sells ~17 products into hundreds of intents. The catalog is small and stable; the contexts are large and growing. Referencing lets the small stable thing serve the large growing thing — the same asymmetry that justifies the whole entity system.

**Why Featured exists — and is constrained.** Merchandising needs a focal point; buyers need a default answer to "which one?" The featured flag is a *decision* recorded in data, and the partial unique index (max one featured per page) turns a style guideline into a law. Two featured cards is not bad taste here; it is an insert error.

**Why MOQ belongs to products (with page-level override).** MOQ is a manufacturing property of the garment — it is true about t-shirts, not about the USA page. So the default lives on the entity (`attributes.moq`) and flows everywhere, while `seo_page_products.moq` allows a deliberate page-local exception (a market-specific offer) without corrupting the global truth. The layering (override → entity default → system default 300) means the page always shows *something* defensible. Note the leverage: the minimum card MOQ also feeds the hero's "MOQ FROM" chip — one column, two surfaces, zero duplication.

**Why cards are database-driven.** Every card field (title, description, image, MOQ, CTA text, order, ribbon) resolves from rows with fallbacks. Consequences: merchandisers run the storefront without deploys; cards are auditable ("which cards lack descriptions?" is a query); and the future recommendation engine has a clean write target — it fills the same rows humans do, so automation arrives without a rendering change.

**Future recommendation engines.** The upgrade path is already shaped: a generator that selects 6 products per page by shared entity context (same product family, country demand, buyer-type affinity), ranks deterministically, writes attachment rows, and marks provenance. Later, `quote_events` data closes the loop — products that convert on similar pages get promoted. Everything downstream (RPC, cards, hero chip) is already indifferent to whether a human or a function wrote the row. That indifference is the architecture working.

---

# PART 9 — Content Philosophy

**Why content blocks exist.** A landing page is not one blob of text; it is a *sequence of jobs*: seize attention, establish relevance, prove capability, show options, build trust, explain process, segment the audience, present products, capture the lead, remove doubts. Blocks make each job a separately ownable, orderable, generatable unit of data. The block vocabulary is the persuasion sequence made explicit:

- **Hero is a block** because the page's opening claim (headline, image, first CTA) is *content* — the most-edited, most-tested content on the page — and must be editable per page without touching the H1's SEO role (the hero heading overrides `h1` for display while the column keeps its semantic job).
- **Intro is a block** because relevance-framing ("here is why this page answers your search") is per-page editorial work, distinct from the reusable capability claims that follow.
- **Manufacturing (overview) is a block** because capability proof (capacity, machinery, compliance) is where a *manufacturer* wins or loses trust — it deserves dedicated copy that can be tuned per product line.
- **Customization is a block** because "100% your brand" is the core promise of custom apparel; making it a section lets the offer evolve (new decoration methods) as data.
- **Buyer Solutions is a block** because audience segmentation ("streetwear brands / gyms / schools") is both a conversion device and an internal-linking surface — the section's cards resolve real links from the graph, so this block is where content strategy and link strategy meet.
- **RFQ is a block** because even the conversion form has content (heading, pitch, CTA label) worth tuning per market — while the form's *existence* is guaranteed by the renderer independently (the one safety-net exception, see below).
- **FAQ is a block** for its framing copy, while the Q&A pairs come from the pool — the block is the section's voice, the pool is its substance.

**Why sections must never be hardcoded.** Hardcoding any section's content into a component would (1) fork truth — some copy in the database, some in git, two deploy processes, two audit surfaces; (2) freeze variation — every page gets the same words forever; (3) break the contract — editors lose a section they believe they own. The current renderer honors this: block keys map to components, unknown keys render through a generic fallback (forward compatibility: the database may invent vocabulary the frontend hasn't learned), and missing blocks skip cleanly (graceful degradation) — with exactly one philosophical exception: the RFQ section is force-appended if absent, because *lead capture is a business invariant, not an editorial choice*. That exception is correct and should remain the only one.

**Future layouts.** Because order is data (`display_order`) and identity is data (`block_key`), layout evolution has two clean roads: per-page reordering (edit numbers — works today) and named layout variants (the dormant `seo_layout_variants`/`positions` pair, which would let "layout_b = process-first for industrial buyers" be assigned per page and A/B measured). Either road changes rows, not the renderer. What future layouts must never do is move ordering *into* components — the moment a component decides where it sits, determinism and editorial control both die.

---

# PART 10 — Image Philosophy

**Why images should be database-driven.** Images carry SEO weight (alt text, file names, dimensions), conversion weight (heroes and product shots), and operational weight (CDN paths, formats, licensing). Hardcoded image paths make all three unauditable and unswappable. As data, "which pages lack hero images," "which images are oversized," "swap every factory shot for the new shoot" are queries and updates, not code hunts. The audit's honest finding: today this philosophy is only *partially* practiced (block URLs + country assets render; the typed assignment system sits dormant) — Part 15 marks the unification as a blocking decision.

**Why hero images are different.** The hero is the largest contentful paint, the emotional first impression, and the OG/social image candidate — the single highest-leverage asset on the page. So it gets its own resolution chain (block image → page override → country asset) with layered fallbacks, because a missing hero must degrade to a designed dark band, never to a broken layout. No other image class earns a three-level fallback; that asymmetry is deliberate.

**Why section images exist as a concept.** Different sections make different visual arguments: factory floor (capability proof), customization close-ups (option evidence), quality-control shots (trust). Typing images to sections (`image_type` / `section_target` in the library design) means assignment can be validated ("a quality image belongs in the quality section") and automated ("every page needs one of each type").

**Why image assignment is separated from image assets.** The library row is the *asset* (URL, dimensions, alt template, type — facts true everywhere); the assignment row is the *usage* (this page, this section, this order, this primacy). One asset, many usages — reuse without copying, and retargeting without touching assets. This is the same join-table doctrine as products, applied to media.

**Future CDN expansion.** Because every rendered URL originates in a column, a CDN migration (or format migration to AVIF, or a signed-URL scheme) is an UPDATE over rows plus validation — zero deploys. The https-only CHECK constraints already enforce the minimum hygiene; a future `image_library`-centric world adds width/height (CLS prevention) and derived srcsets from one master URL.

**AI image generation compatibility.** An AI image pipeline is just another producer: generate per entity-context ("hero: polo shirts, UK market"), upload to storage, insert a library row with typed metadata and an alt template, then assign. Provenance (generator, prompt, model) fits in library columns; review-before-assign fits the `is_active` flag. The renderer never knows or cares that a human didn't shoot the photo — which is exactly the property that makes AI adoption safe and reversible here.

---

# PART 11 — RPC Philosophy

**Why one RPC powers one page.** `get_landing_page_view(slug)` is the system's single choke point, and choke points are where guarantees live. Because every render passes through it: the published-only rule is enforced *once*; ordering is enforced *once*; the FAQ scope algorithm exists *once*; the draft-link filter exists *once*. One network round trip assembles six tables' worth of page — no waterfall of queries, no partial page states, no chance for two fetches to see different data. If pages were assembled from multiple client queries, every rule above would be re-implemented (and eventually diverged) in every consumer.

**Why the frontend must never join tables itself.** The moment the frontend selects from `seo_content_blocks` directly, three things break permanently: (1) the schema can never change again without a frontend release — you have coupled deploy cycles; (2) business rules leak — the frontend must now know that drafts are filtered, that FAQ matching is null-or-equal on three FKs, that link targets must be published — and it *will* get one of them wrong; (3) security scoping explodes — instead of one function to reason about, every table the client touches becomes attack surface. The audit found the frontend is currently disciplined about this (RPC + one insert, nothing else). That discipline is a load-bearing wall.

**Why the RPC is the contract.** The JSON shape (`page`, `country_assets`, `content_blocks[]`, `faqs[]`, `products[]`, `internal_links{}`) is the treaty line between database evolution and frontend evolution. The database may reorganize tables, rename columns, split or merge storage — freely — as long as the emitted JSON holds shape. The frontend may redesign every component — freely — as long as it consumes the same shape. Each side moves at its own speed *because* neither sees the other's internals.

**Why changing the RPC is dangerous.** It is the one component with total blast radius: a changed field name breaks every page simultaneously; a subtly changed rule (say, the FAQ match) changes every page's content silently — the worst kind of failure, invisible until rankings move. It is also consumed by cached/ISR pages, so a breaking change can produce a fleet of pages rendered under *two different contracts* at once.

**Versioning.** The rule is: **additive changes in place; breaking changes fork.** Adding a new key to the JSON is safe (the frontend null-guards everything by design — unknown keys are ignored, missing keys degrade). Renaming, removing, or re-typing a key is a new function (`get_landing_page_view_v2`), deployed alongside the old, migrated to deliberately, with the old version retired only after zero consumers remain. The system has already lived one informal version bump (`get_seo_page_render` → `get_landing_page_view`) — and the lesson of that transition is written in the audit: *the old version was left alive, granted to the public, still leaking drafts.* Version retirement is part of versioning. An abandoned contract is not a harmless fossil; it is an unlocked side door.

**Backward compatibility disciplines:** never reuse a field name with new semantics; never change an ordering rule without treating it as a content change to every page (because it is); keep null-vs-empty conventions stable (`[]`/`{}` for collections, `null` for absent scalars — the frontend's guards are built on that grammar); and document the contract as prose (the DB manual §D.1 is that document — keep it current or the contract exists only in two codebases' assumptions).

---

# PART 12 — Frontend Philosophy

**The three-party division of labor:**

- **Database (decides):** what exists, what it means, what is visible, in what order, with what text. All business rules — publish gates, FAQ matching, link filtering, fallback coalescing (card title → entity name) — live here, because rules in the database apply to every consumer, are testable with SQL, and change without deploys.
- **RPC (translates):** turns relational truth into one render-ready JSON document per page. It is the *only* reader the render path is allowed. It decides nothing editorial; it enforces everything structural.
- **Frontend (renders):** maps data to components, sorts by given order, guards nulls, emits metadata and schema, and captures the one write (RFQ insert). It holds *presentation* opinions (typography, layout geometry, icons, brand constants like the yellow accent) and *zero* content opinions.

**Why the frontend should only render.** Every business rule placed in the frontend is a rule that: exists per-consumer (a future mobile app or second brand re-implements it — differently), ships on deploy cycles (content people wait on release trains), and hides from audit (you cannot SQL-query a React conditional). The current codebase's own comments state the doctrine — "No page-specific copy is hardcoded"; "no invented items" — and the audit verified it holds: unknown blocks render generically, missing data skips, every field is optional at the type level. The one hardcoded list (buyer-segment labels in BuyerSolutions) is presentation vocabulary resolving *real* links from data — at the boundary, but on the right side of it. It should eventually migrate to data; it must never grow siblings.

**Why business logic stays in the database.** Beyond the reasons above, one structural argument: the database is the only tier that sees *all* pages at once. Rules that need global context — uniqueness, cross-page linking, duplicate prevention, sitemap membership — are only enforceable where the whole set lives. A frontend can validate one page; only the database can validate the *site*.

**Why styling remains independent.** The reverse boundary matters equally: the database must never emit HTML, CSS classes, hex colors, or component names. The day a block body contains `<div class="...">`, the content is married to one frontend forever, and the multi-brand/multi-frontend future (Part 14) is dead. Content is prose + structured fields; the frontend owns 100% of appearance. This is what makes a full redesign a frontend-only project — the 2026 UI rebuild in the repo's history touched zero database rows, which is precisely the proof the boundary works.

---

# PART 13 — Scaling Philosophy

The invariant across every scale level: **the data model does not change.** Pages are rows; the chain of Part 2 holds at 100 and at 100,000. What changes is the *machinery around* the model — generation quality, caching, and operational tooling. Scaling this system means feeding it, not rebuilding it.

**100 pages — the craft era.**
*Bottlenecks:* human editorial throughput; nothing technical. *What changes:* nothing — current per-request rendering and manual curation are correct at this size. *Priorities:* fix the publish-blockers found in the audit (product-card 404 targets, `/quote` CTAs, nested guide slug, canonical host, security lock), and establish the editorial QA habit (the manual's §N checklist), because habits formed at 100 pages are the ones that survive at 10,000. *What never changes:* one keyword → one page; draft-by-default.

**1,000 pages — the differentiation era.**
*Bottlenecks:* content quality, not compute. The clone-based generator becomes the #1 risk: a thousand near-identical pages is a scaled-content-abuse profile. *What changes:* the content generator must become template/variant-driven (`seo_templates`) with editorial spot-checking; FAQ pool needs scoped variants per cluster; internal linking shifts from flat similarity to hub-and-spoke. *What stays:* the RPC, the frontend, the schema — untouched. *What never changes:* every page passes QA before `index,follow`.

**10,000 pages — the infrastructure era.**
*Bottlenecks:* anything O(N) per request. The audit named them: the sitemap group route currently fetches *all* pages and filters in application code; sitemap chunk-2 URLs 404; uncached SSR on every page view. *What changes:* parameterized sitemap queries, chunk-aware routing, and a caching layer (ISR/edge) in front of the RPC — which determinism makes safe and cheap. Generators need batch discipline (the full-rebuild link generator gets slow; the guide-pairs-with-everything clause needs bounding). *What stays:* the RPC contract (caching wraps it, never replaces it). *What never changes:* deterministic output — it is now the thing your entire cache correctness rests on.

**50,000 pages — the operations era.**
*Bottlenecks:* human oversight itself. No team reads 50,000 pages; quality must become *measured* (content scoring, similarity detection, orphan detection, link audits as scheduled jobs writing to tables). *What changes:* publishing becomes gated by automated QA (a page cannot flip to `index,follow` below a quality threshold); generators become queued/batched jobs with progress tracking rather than single function calls; the link graph needs periodic pruning policy, not just growth. Database load is still modest (50k rows is small for Postgres; the indexes already in place — covering published/sitemap indexes, partial entity indexes — were designed for this), but *operational* load without tooling is fatal. *What never changes:* the two-flag publish gate — at this scale it is the only thing standing between a bad batch and a domain-wide penalty.

**100,000 pages — the platform era.**
*Bottlenecks:* the long tail's economics. At 100k pages the marginal page must be *provably* non-thin or it subtracts from the whole domain (Google evaluates site-wide quality). Crawl budget becomes a managed resource: sitemap freshness, priority signaling, and pruning of zero-traffic pages matter as much as creation. *What changes:* an explicit page-lifecycle policy (create → measure → improve-or-archive), materialized sitemap/reporting tables, read replicas if RPC volume demands, and possibly partitioning of the largest satellite tables (`seo_internal_links` at ~600k rows is still fine; the *candidate generation* joins are what need re-engineering). Multi-brand/multi-domain pressure (Part 14) likely arrives before 100k on one domain does — the same engine serving three domains × 30k pages is the more realistic shape. *What never changes:* the chain (Part 2), the contract (Part 11), the boundary (Part 12). If those three survive, 100k pages is an operations problem, not an architecture problem — and operations problems are solvable with money and jobs queues. Architecture problems are not.

---

# PART 14 — Future Expansion (Without Breaking Anything)

The test for every expansion below is the same: **does it add producers/consumers of rows, or does it demand new physics?** Everything on this list is the former.

- **New countries:** one entity row + one `country_assets` row + keywords. The render path already localizes (hero, badges, currency, shipping text) from the country FK. Zero code.
- **New products:** one entity row with `attributes` (image, MOQ, card description) + keywords + attachment rows. Cards, FAQ scoping, link clustering follow automatically.
- **New industries / buyer types:** entity rows on the audience axis; templates and FAQs scoped to them; the Buyer Solutions surface already resolves matching links. The highest-leverage cheap expansion available.
- **New layouts:** per-page reordering works today (edit `display_order`); named variants have a dormant, already-built home (`seo_layout_variants`/`positions`). Either way: rows, not renderers.
- **AI content:** AI is a *writer into existing slots* — template variants, block copy, FAQ pool entries, meta descriptions — behind draft status and human review. The draft/publish gate was built for exactly this: machine speed at generation, human judgment at visibility. AI must never write directly to published pages or bypass the QA gate; with that rule held, AI is a productivity multiplier with zero architectural cost.
- **AI images:** producers into the image library + assignment pattern (Part 10). Provenance columns, review via `is_active`.
- **Shipping calculator:** the zone/rate tables exist; a calculator is one new read-RPC over them plus a frontend widget. It touches nothing in the render path.
- **Pricing calculator:** same shape — pricing tiers + product logistics data feed a quote-math RPC. The `product_id` bridge on `seo_page_products` already reserves the join from marketing card to logistics truth. (Prerequisite: collapse the duplicate product-catalog tables to one, *before* adoption.)
- **Reviews / Videos:** textbook new satellites: an assets table + a page-attachment join with order/featured semantics — copy the `seo_page_products` pattern verbatim. Additive RPC keys (`reviews[]`, `videos[]`); old frontend ignores them until components ship.
- **Admin panel:** a service-role application writing the same rows humans write by SQL today. Because all rules are database-enforced (constraints, triggers), the panel can be thin — it cannot corrupt what the schema refuses. Prerequisite: the security lock (Part 15), so the panel is the *only* write path.
- **CRM:** `quote_requests` already carries lifecycle status + attribution; a CRM either reads it directly or syncs on it. The `quote_events` table is the activity-log spine waiting to be used.
- **Analytics / conversion tracking:** wire `quote_events` (view → start → submit), join to pages/keywords, and the revenue-per-keyword loop of Part 4 closes. This is the highest-ROI unbuilt feature in the system.
- **Multiple languages:** the honest one — this is the *largest* planned-for-but-not-yet-shaped expansion. The clean path: language as a page dimension (locale column or a `language` entity type folded into the combo uniqueness), translated block/FAQ/template rows per locale page, hreflang emitted from page relations. The chain survives (one keyword *in one language* → one page); but retrofitting locale into the combo key and slug strategy is real migration work. Decide the URL scheme (subdirectory strongly preferred) *before* the first non-English page, not after.
- **Multiple brands / domains:** add a `brand` dimension (entity or column) to pages, brand-scoped assets, and a per-brand frontend consuming the same RPC with a brand filter; canonical host becomes per-brand data (which also fixes today's hardcoded-host wart). The content/styling separation (Part 12) is what makes N frontends on one engine possible.
- **Marketplace integrations:** exporters, not renderers — feed generators (Google Merchant, etc.) reading product entities + logistics catalog, exactly like the sitemap reads pages. Same pattern: published truth → deterministic feed.

---

# PART 15 — System Lock Classification

| Component | Class | Rationale |
|---|---|---|
| The Part 2 chain (keyword→page→combo→render→canonical→index) | **LOCKED** | The identity of the system. Breaking any link re-imports a fatal PSEO failure mode at current scale. |
| `seo_pages` slug uniqueness + entity-combo unique key | **LOCKED** | The duplicate firewall. Relaxing it cannot be undone once dupes exist — de-duplicating a live index costs months of rankings. |
| Draft + noindex publish gate (two-flag visibility) | **LOCKED** | The only barrier between a bad batch and domain-wide index poisoning. Any tool that "publishes automatically" violates the constitution. |
| `get_landing_page_view` JSON contract | **LOCKED** (additive-only) | Total blast radius (Part 11). Breaking changes require a versioned fork + migration + retirement. |
| Deterministic ordering (`display_order` + unique constraints, STABLE RPCs) | **LOCKED** | Cache correctness, crawl trust and debuggability all rest on it. |
| Frontend renders-only / DB decides / RPC-only reads boundary | **LOCKED** | The multi-brand, redesign-safe, team-parallel future depends on this wall. |
| RFQ insert-only write path with attribution | **LOCKED** | The revenue pipe. Any lead capture without `source_page_id` attribution destroys the measurement loop. |
| Entity type-validation triggers + composite typed FKs | **LOCKED** | Silent type corruption (a "country" that's a product) poisons FAQ matching and linking invisibly. |
| `seo_entities`, `seo_content_blocks`, `seo_internal_links`, `seo_faqs` (pool semantics), `seo_page_products`, `country_assets`, `seo_keywords`, `quote_requests` | **CORE** | Schema evolves additively; semantics (scope-matching, group ownership, join-with-overrides) do not. |
| Block vocabulary (the 10 keys) | **CORE / EXTENDABLE** | Add keys freely (GenericBlock absorbs them); renaming or repurposing existing keys is a contract change. |
| `link_group` vocabulary; generator-owns-`auto_related` rule | **CORE** | New groups are free; automation touching curated groups is forbidden. |
| `seo_templates` + variant-driven generation | **EXTENDABLE** | The designated replacement for the clone generator. Build here. |
| Image system (`image_library` + `seo_page_images`) | **EXTENDABLE — blocking decision required** | Two half-systems exist (block URLs vs assignments). Choose one before scale doubles the wiring cost of every page. The assignment design should win. |
| Layout system (`seo_layout_variants`/`positions`) | **OPTIONAL** | Adopt deliberately for layout experimentation, or archive deliberately. Half-existence is its only harm. |
| Quote engine satellites (`quote_configurations`, `quote_customization_options`, `quote_events`, shipping, pricing) | **OPTIONAL → EXTENDABLE** | Roadmap tables. `quote_events` should be promoted first (analytics compounds). |
| `products` vs `seo_products` duplicate catalogs | **OPTIONAL — must collapse to one** | Carrying both repeats the image-system mistake. |
| `get_seo_page_render` | **DEPRECATED** | Unused, leaks drafts, publicly executable. Revoke, then remove after review. |
| Gen-1/2/2.5 content & image tables (10 tables) | **DEPRECATED** | Zero references. Archive → delete after review. Their continued presence is the schema's largest source of confusion. |
| Current `generate_content_blocks` (page-2 clone) | **DEPRECATED-in-place** | Acceptable stopgap at 9 pages; forbidden as the engine of 1,000. Its replacement (template-driven) is the roadmap's #1 item. |
| Public write grants + generator EXECUTE for anon | **DEPRECATED (emergency)** | Not architecture — an unlocked door. The constitution is void where anyone on the internet can edit the constitution's subject matter. Lock first. |

**Why the LOCKED items are dangerous to change, in one sentence each:** the chain is the system's identity; the unique keys are irreversible once violated; the publish gate is the last line before Google; the RPC contract has total blast radius; determinism is what caches and crawlers trust; the tier boundary is what makes every future frontend possible; the RFQ path is the money; the type triggers are what keep "meaning" meaning anything.

---

# PART 16 — The Golden Rules

**Identity & uniqueness**
1. One keyword, one page, one slug — forever bijective.
2. Never duplicate an entity concept under a second slug.
3. Never duplicate an entity combination under the same template (the DB enforces it; never weaken the constraint).
4. Never reuse a slug for different meaning — slugs are permanent commitments; retired meaning gets a redirect, not a recycled slug.
5. Never create a page without entity wiring (an orphan page can't match FAQs, links, or assets).
6. Keep the template vocabulary tight — `product_country` and `country_product` style forks are duplication with extra steps.

**Content**
7. Never hardcode page content in the frontend — all copy is rows.
8. Never store HTML/CSS/component names in database content.
9. Never let a generator overwrite editorial fields on re-run (upserts refresh wiring only).
10. Never publish generated copy without human or scored QA — generation creates drafts, judgment creates pages.
11. Every page keeps the shared section skeleton; vary words, not bones.
12. New sections get new `block_key`s; existing keys are never repurposed.
13. Section order lives in `display_order` and nowhere else.

**Products & FAQs**
14. Never hardcode products — cards resolve from attachment rows + entity attributes.
15. Product truth lives on the entity; page rows hold only deliberate local overrides.
16. Exactly one featured product per page (law, not preference).
17. Never hardcode FAQs; never bind FAQs to page IDs — scope them to entities.
18. Grow scoped FAQ variants as clusters grow; a pool that stops growing becomes duplicate content.
19. FAQ schema is always a subset of rendered FAQs (`include_in_schema`), never a different set.

**Linking**
20. Never hardcode internal links; every link is a row with source, target, group, order.
21. Never link to unpublished or noindex pages (the RPC filters; never bypass it).
22. Automation owns `auto_related` only; it never touches curated groups.
23. Cap rendered links per page (~15–20); authority divides.
24. No all-to-all linking inside clusters; hub-and-spoke past ~10 pages per cluster.
25. Vary anchors; never one exact-match anchor repeated site-wide.
26. No page ships as an orphan — inbound links are part of publishing.
27. Circular links are allowed only as deliberate hub↔spoke pairs, never as accidental all-to-all cycles.

**Rendering & contract**
28. Never bypass the RPC — the frontend reads exactly one function and writes exactly one table.
29. Never break deterministic rendering: no randomness, no time-dependent output, no per-request variation.
30. RPC changes are additive; breaking changes are versioned forks with planned retirement.
31. Retire old RPC versions — an abandoned contract is an unlocked side door.
32. Null-grammar is stable: `[]`/`{}` for empty collections, null for absent scalars.
33. The frontend null-guards every field, skips missing sections, and generically renders unknown keys — degradation is designed, never accidental.
34. The RFQ section is the only force-rendered section; it stays the only exception.

**Publishing & visibility**
35. Every page is born `draft` + `noindex,follow`; visibility is two explicit flips.
36. Nothing enters the sitemap except published + `index,follow` + valid single-segment slug.
37. One canonical host, defined in one place, everywhere (sitemap, metadata, env).
38. `robots` and `status` are decisions, never side effects of tooling.
39. A page flips to indexable only after passing the QA checklist (DB manual §N) — publish is a query result.

**Data integrity & security**
40. Never remove or merge a table without architectural review against this constitution.
41. Deprecation is explicit: mark → archive → delete after review. Never silently abandon (the 14 dead tables are the cautionary tale).
42. Never weaken a CHECK constraint, unique index, or validation trigger to "make an insert work" — the insert is wrong, not the constraint.
43. The anon role reads published truth and inserts leads — nothing else, ever.
44. Generators and admin functions are service-role-only, always.
45. Every lead carries attribution; every future write path preserves it.
46. Secrets and the service key never appear in frontend code or client bundles (currently honored — keep it absolute).

**Evolution**
47. New features are new rows/tables/RPC keys — producers and consumers — never modifications to the chain, the contract, or the boundary.
48. AI systems write drafts through the same gates humans use; no AI writes to published state.
49. Copy the `seo_page_products` join pattern for every future page attachment (reviews, videos, certifications).
50. When in doubt, model the meaning first, the copy second, the pixels last — the founding principle outranks every convenience.

---

# PART 17 — Architectural Decisions (Why This, Not That)

**D1. Database-driven pages vs. static site generation from files.**
*Chosen:* rows + runtime RPC. *Alternative:* markdown/MDX files built at deploy. *Pros of chosen:* content ops without deploys; queryable audits; automation writes SQL not git; one source of truth for 6 data families per page. *Cons:* runtime dependency on the DB; caching must be added (files get it free); security surface (as the audit proved). *Tradeoff accepted because* the site's content is *relational* (entities, graphs, pools) — files can't enforce a link graph or an entity-combo constraint. *Long-term:* correct at every scale; the cons are solvable (cache, lock), the alternative's cons (no relations) are not.

**D2. One polymorphic entity table vs. per-type tables.**
*Chosen:* `seo_entities` + type CHECK + composite typed FKs + triggers. *Alternative:* `products`, `countries`, … as separate tables. *Pros:* one FK pattern for every consumer; new types without migrations; uniform slugs/attributes. *Cons:* type safety needs the trigger/composite-FK machinery (more exotic than plain FKs); `attributes` jsonb is schema-less (product image/MOQ live unvalidated). *Tradeoff:* flexibility over rigidity at the vocabulary layer, rigidity over flexibility at the relationship layer — exactly where each belongs. *Long-term:* the jsonb corner will eventually want promotion to real columns for the hottest fields (MOQ); that's additive.

**D3. Pool-based FAQs vs. per-page FAQs.**
*Chosen:* entity-scoped pool matched at render. *Alternative:* `page_faqs` join rows. *Pros:* zero marginal FAQ cost per page; future pages inherit; one edit fixes every page. *Cons:* cluster-wide sameness; less per-page control; scope-ordering coordination (the NULLS-NOT-DISTINCT ordering keys). *Tradeoff:* leverage over precision — correct for a system whose whole thesis is leverage. Per-page pinning can be added later as an *additional* scope without breaking the pool.

**D4. Render-time assembly (RPC) vs. pre-materialized page JSON.**
*Chosen:* assemble on read, STABLE function. *Alternative:* a `page_render_cache` table rebuilt on write. *Pros:* always-fresh, no invalidation logic, no stale-cache bug class. *Cons:* per-request compute (six subqueries), which at high traffic demands an HTTP-layer cache anyway. *Tradeoff:* correctness-first; performance is buyable later (ISR/edge) precisely because determinism makes cached output trustworthy. *Long-term:* at 100k pages a materialized layer may return as an *optimization behind the same contract* — the decision to keep assembly logic in one STABLE function is what keeps that door open.

**D5. Draft-by-default + separate robots flag vs. single publish boolean.**
*Chosen:* two independent gates (`status`, `robots`). *Alternative:* one `is_live` flag. *Pros:* enables the real editorial states — live-but-staging (published+noindex, in use today), indexable, archived-but-resolving. *Cons:* two flags can confuse ("why isn't my published page in the sitemap?" — by design). *Tradeoff:* operational nuance over simplicity, because indexation mistakes are the most expensive mistakes in PSEO. The confusion cost is paid in documentation (this document); the alternative's cost is paid in rankings.

**D6. Machine-owned + human-owned link groups vs. one merged link set.**
*Chosen:* group-partitioned ownership; generator wipes only its group. *Alternative:* one list with an `is_manual` flag, or full manual curation. *Pros:* automation can never destroy curation; both evolve independently; presentation groups fall out free. *Cons:* the same target can appear in two groups (harmless duplication on the page — visible in the audit); flat generation logic is crude. *Tradeoff:* safety of curation over minimality. *Long-term:* the crude ranking gets replaced (hub-and-spoke, AI-assisted) *inside* the owned group without renegotiating the ownership boundary — which is the sign of a good boundary.

**D7. Clone-based content seeding vs. template composition (interim decision).**
*Chosen (interim):* clone page 2 with string substitution. *Alternative (designed, pending):* compose from `seo_templates` variants. *Pros of the clone:* shipped in a day; guarantees structural completeness; fine at 9 pages. *Cons:* near-duplicate copy; brittle string-replace anchored to one page's exact phrasing; hardcoded master ID. *Tradeoff:* speed-to-launch over scale-readiness — *acceptable only because it was paired with the draft gate*, which keeps the mediocre output out of the index. *Long-term:* this is technical debt with a due date of ~page 50. The templates table is the paid-off design waiting to be used.

**D8. Anon-key direct-to-Supabase frontend vs. API middle tier.**
*Chosen:* Next.js talks to Supabase directly with the anon key. *Alternative:* a backend API in front. *Pros:* one less tier; Supabase RLS/grants *can* express the whole policy (read RPC, insert leads); lower latency and ops burden. *Cons:* the policy must actually be configured — and today it is not (RLS off, write grants open). The architecture's security model is sound *only when enforced at the database*, which makes the current unlocked state a critical, if fixable, contradiction. *Tradeoff:* simplicity for discipline. *Long-term:* correct choice for this team size, *contingent on the Part 15 lock being executed*.

**D9. Sitemaps as RPC-driven routes vs. build-time sitemap files.**
*Chosen:* live RPCs behind force-dynamic routes. *Pros:* sitemap truth equals database truth at every request; publish → visible without rebuild. *Cons:* O(N) route work today (application-side group filtering; chunk gap). *Tradeoff:* freshness over efficiency, with efficiency recoverable by parameterizing the query — the right order to pay the costs in.

---

# PART 18 — Risk Analysis (If Someone Accidentally Changes…)

**`seo_pages`** — *Blast:* total. A slug edit breaks the live URL (404), orphans its inbound internal links at render, strands the indexed URL in Google, and de-syncs the keyword mapping. A status/robots flip either vanishes a page (drops from RPC + sitemap; inbound links to it silently disappear from every source page — a graph-wide content change) or exposes a draft to the index. Entity FK edits silently re-scope FAQs and future links — the page *looks* fine and means something else. *Severity:* CRITICAL. *Recovery:* single-row fixes are trivial **if noticed fast** (restore slug/status, request re-crawl — days of ranking wobble); unnoticed slug or meaning drift discovered weeks later costs a re-earned indexation cycle (months). Bulk damage (the open-grants scenario: anyone can `UPDATE seo_pages`) without backups is catastrophic — this is why the lock and PITR backups are the constitution's emergency items.

**`seo_entities`** — *Blast:* wide and *silent*. Editing an entity edits every page referencing it at next render: rename "T-Shirts" → wrong card titles and anchors everywhere; change `attributes.image_url` → every card image; delete is FK-blocked (good) but deactivation/type-drift corrupts matching. The nastiest case is a *plausible* wrong edit (MOQ 300→30) that no error will ever flag. *Severity:* HIGH. *Recovery:* easy to fix (one row), hard to *detect* — the argument for an entity-change audit log before scale.

**`seo_internal_links`** — *Blast:* the authority graph. Accidental deletion of curated groups loses irreplaceable editorial strategy (auto_related regenerates; `related_*` does not). Spam insertion renders immediately on published pages (link-graph vandalism). *Severity:* MEDIUM-HIGH (site keeps rendering — pages just lose their sidebars and equity flow). *Recovery:* auto group = re-run generator (minutes); curated groups = backup restore or re-curation (days). The graph is also the least *noticed* asset — schedule diff audits.

**`seo_keywords`** — *Blast:* delayed-fuse. Nothing visible changes at once (render never reads it). Damage detonates at the *next generator run*: an edited keyword slug spawns a duplicate page or upsert-captures an existing one; edited entity wiring silently rewires a live page's meaning. *Severity:* MEDIUM (today), HIGH once generation runs on schedule. *Recovery:* easy if caught pre-run (fix the row); post-run it becomes the `seo_pages` scenario. Rule: diff keyword changes before every generator execution.

**The RPC (`get_landing_page_view`)** — *Blast:* every page simultaneously, in one of two modes. *Loud mode:* renamed/removed key → the null-guarded frontend doesn't crash, it *silently omits* — every page loses its products, or its FAQs, at once (arguably worse than crashing: no error, just sitewide thinning). *Silent mode:* an edited rule (FAQ match, link filter, ordering) → every page's content changes with no visual "error" at all; discovered via rankings weeks later. *Severity:* CRITICAL — highest in the system. *Recovery:* the fix is one `CREATE OR REPLACE` (minutes) **if the prior definition is in version control**; the constitution therefore requires RPC definitions to live in migration files, not only in the database. Cached pages rendered under the broken contract need revalidation.

**Frontend adapter (`landing.ts`, `PSEOPageRenderer`, `[slug]/page.tsx`)** — *Blast:* every page, but *loudly* — build failures and visible breakage are caught in deploy previews. The dangerous edits are the quiet ones: a changed `block_key` mapping (a section stops matching → falls to GenericBlock → styling regression sitewide), a broken null-guard (one missing field now crashes pages that lack it — the subset failure), or metadata emission bugs (canonical/robots wrong on every page — invisible in the UI, expensive in the index). *Severity:* HIGH but the most *recoverable* — git revert + redeploy (minutes), no data touched. *Standing defense:* snapshot-test one representative page per template against the live contract.

**`seo_content_blocks`** — *Blast:* per-page and visible, which makes it the *safest* table to touch — exactly why editors are allowed here and only here. Worst realistic accidents: bulk UPDATE without WHERE (all 90 bodies overwritten — backup restore territory); deleting a page's `rfq` block (the renderer's safety net catches it — form still renders); reordering collisions (unique constraint refuses — the schema defends itself); broken CTA/image URLs (CHECK constraints catch malformed ones; well-formed-but-404 ones degrade gracefully). *Severity:* LOW-MEDIUM per page, MEDIUM in bulk. *Recovery:* single blocks re-write in minutes; bulk damage needs point-in-time restore — which is why **PITR backups are not optional infrastructure** for a system whose entire product is rows.

**Cross-cutting truth:** in every scenario above, the difference between "minutes" and "months" of recovery is (1) whether writes were locked to trusted actors, (2) whether backups exist, (3) how fast the change was *noticed*. The architecture is unusually recoverable — everything is rows — but only for teams that can restore rows. Lock, back up, and monitor: the three practices this constitution treats as constitutional, not operational.

---

# PART 19 — Executive Blueprint

## 19.1 One-page executive summary

**What this is.** The 1 & 9 Apparel PSEO Engine is a database-driven landing-page factory. Every page on the site is a set of database rows — its URL, meaning, copy, products, FAQs, images and links — projected into HTML by exactly one database function (`get_landing_page_view`) and one thin rendering frontend. No page content lives in code.

**Why it works.** (1) *Meaning is modeled:* pages are combinations of entities (product × country × buyer type), and the database physically refuses duplicate combinations and duplicate URLs — the two classic ways programmatic SEO kills itself. (2) *Rendering is deterministic:* the same rows always produce the same page, which is what makes Google trust the site, caches safe, and bugs reproducible. (3) *Visibility is gated:* every page is born invisible (draft + noindex) and must be explicitly, doubly flipped to reach Google — bad batches cannot poison the domain. (4) *Leads are attributed:* every quote request records the page that produced it, so SEO investment is measurable to revenue.

**How it scales.** Adding pages = adding rows. Keywords are decomposed into entities; generators create draft pages, seed content, and build internal links; humans (or scored QA) approve visibility. The marginal cost of a page trends toward the cost of its *differentiated copy* — everything else is automated.

**The rules that must never break:** one keyword → one page → one entity combination → one render → one canonical → one indexed URL; frontend renders but never decides; all reads go through the one RPC; automation writes drafts, never published state.

**The honest caveats (as of this audit):** the database is currently publicly writable (RLS unlocked — must be fixed before anything else); the content generator clones one master page (fine at 9 pages, thin-content risk at 1,000 — its template-driven replacement is designed and pending); two image systems half-exist (pick one); a handful of publish-blocking data bugs (product-card links, `/quote` CTAs, one nested slug, canonical host) are documented in the DB manual.

**Verdict in one line:** the architecture is sound to 100,000 pages; the current *implementation* needs its security locked, its content generator matured, and its dead tables buried — none of which requires redesign.

## 19.2 Five-page technical summary

**(i) The stack and the tiers.** Supabase Postgres 17 holds all truth. A Next.js App Router frontend (anon key only, stateless client) consumes exactly one read RPC per page and performs exactly one write (RFQ insert into `quote_requests`). Sitemaps are two more read RPCs behind dynamic routes. There is no middle tier; policy is (meant to be) enforced in the database via grants/RLS/constraints. The division of labor is constitutional: **database decides, RPC translates, frontend renders** (Part 12).

**(ii) The data model in five layers.**
- *Vocabulary:* `seo_entities` — one polymorphic table of typed concepts (product, country, state, industry, buyer_type, material, service…), slugged, with jsonb presentation attributes; typed references enforced by composite FKs + triggers.
- *Intent:* `seo_keywords` — search phrases decomposed into entity FKs, with slug, template-type, priority, pipeline status. The input queue.
- *Pages:* `seo_pages` — one row per URL: slug (unique), entity wiring (combo-unique per template), metadata (title/H1/meta, length-checked), canonical, robots (4-value CHECK), status (draft/published/archived), priority, sitemap_group. The center of gravity.
- *Attachments:* `seo_content_blocks` (10 ordered, key-unique sections per page), `seo_page_products` (ordered product cards, max one featured, per-page overrides over entity defaults), `seo_internal_links` (directed, grouped, ordered edges; FK-integral), `seo_faqs` (an entity-*scoped pool* matched at render, not page-bound), `country_assets` (one row per country: imagery, badges, currency, shipping copy).
- *Interaction:* `quote_requests` (insert-only for the public, fully attributed) plus dormant satellites for the future quote engine (`quote_events`, configurations, options, shipping zones/rates, pricing/logistics catalogs).

**(iii) The pipeline.** `generate_seo_pages()` upserts draft+noindex pages from active keywords (idempotent; editorial fields survive re-runs). `generate_content_blocks()` seeds the 10-block skeleton (currently by cloning master page 2 with substitutions — the designated technical debt; `seo_templates` is its built-but-unused replacement). `generate_internal_links()` atomically rebuilds the machine-owned `auto_related` group (≤6 links/page, deterministic relevance ranking) and never touches human-curated groups. Humans then differentiate copy, attach products, extend the FAQ pool, curate links, and flip `status` → published, `robots` → index,follow. Only then does the page enter the sitemap (`get_sitemap_index` / `get_sitemap_pages`: published + indexable only, priority-ordered, group-chunked).

**(iv) The render contract.** `get_landing_page_view(page_slug)` → one jsonb document: `page` (identity + metadata + resolved hero image), `country_assets`, `content_blocks[]` (ordered), `faqs[]` (scope-matched: each of product/country/buyer FK is null-or-equal), `products[]` (ordered, override-coalesced), `internal_links{}` (grouped, ordered, **published targets only**). Returns SQL null for missing/unpublished slugs → frontend 404s. STABLE, search-path-pinned, deterministic. The frontend (`PSEOPageRenderer`) sorts blocks by the given order, maps `block_key` → components, renders unknown keys generically, skips missing sections, force-appends only the RFQ section, and emits per-page metadata + FAQPage JSON-LD derived from the same FAQ array (subset via `include_in_schema`). Contract change policy: additive in place; breaking = versioned fork + migration + retirement (the still-alive legacy `get_seo_page_render` is the cautionary counterexample: unused, draft-leaking, deprecated).

**(v) Integrity machinery worth knowing.** Uniques: page slug; entity (type, slug); page entity-combo (NULLS NOT DISTINCT); block (page, key) and (page, order); link (source, group, target) and (source, group, order); product (page, entity), (page, order), one-featured partial; FAQ question and order per scope. CHECKs: slug shapes, meta lengths, robots/status enums, https-only URLs, MOQ/quantity positivity, FAQ text bounds. Triggers: `updated_at` maintenance (feeds sitemap lastmod) and entity-type validation on pages/products/quotes. These constraints are the system's real "business logic layer" — tooling can be thin because the schema refuses bad states.

**(vi) Security model (target vs. actual).** Target: anon = SELECT on published content via RPC + INSERT into `quote_requests`, nothing else; generators service-role-only. Actual (audited): RLS enabled only on `quote_requests`; every other table fully writable by anon; generators publicly executable. The lock plan (DB manual §K/§O) is written, unapplied, and is the single prerequisite to everything else in this document.

**(vii) Scale road.** 100 pages: fix publish-blockers, build habits. 1,000: template-driven content, scoped FAQs, hub-and-spoke links. 10,000: parameterized sitemaps, chunk routing, HTTP-layer caching (safe because deterministic). 50,000: scored QA gates, queued generators, scheduled graph audits. 100,000: lifecycle policy (measure → improve-or-archive), materialized reporting, possibly multi-domain before multi-hundred-thousand. The schema itself does not change at any level.

**(viii) Where new things go.** New market/product/audience = entity rows + assets + keywords (zero code). New section = new block_key (frontend optional). New page attachment (reviews, videos) = copy the products join pattern + additive RPC key. New machine author (AI copy, AI images, recommendations) = a producer writing draft rows through existing gates. New brand/language = a new page dimension + brand-scoped assets + another thin frontend on the same RPC — the one expansion requiring genuine (but additive) migration design, best decided before the first non-English or second-brand page.

## 19.3 The full architecture manual

Parts 1–18 and 20 of this document, together with `docs/DATABASE_MANUAL.md` (schema-level reference: every table, column, constraint, function definition, dependency map, data-quality findings, lock SQL and publishing checklist). Reading order for a new developer: 19.1 → 19.2 → DB manual §B/§D/§J → Parts 2, 11, 12, 16 of this constitution. That sequence takes a competent developer from zero to safe-to-contribute without reading either document end-to-end.

---

# PART 20 — Final Verdict

Scores are for the **architecture as designed**, with the **implementation gap** stated wherever the two diverge. No flattery; the gaps are listed even where they sting.

| Dimension | Score | Reasoning (strengths / weaknesses) |
|---|---|---|
| **Scalability** | 8/10 | *Strengths:* row-based pages, combinatorial entity model, idempotent generators, indexes already shaped for published/sitemap queries, deterministic output ready for aggressive caching. *Weaknesses:* O(N) sitemap group route, chunk-2 routing gap, full-rebuild link generator, no caching layer yet, single-segment routing ceiling. All are machinery fixes, none are model fixes — hence 8, not 6. |
| **Maintainability** | 7/10 | *Strengths:* one render path, one contract, constraint-enforced invariants, disciplined thin frontend, excellent graceful degradation. *Weaknesses:* 14 dead tables and one dead RPC actively mislead newcomers; RPC definitions not provably in migration history; magic numbers in generators (master page 2). The schema's *signal-to-noise* is the maintainability tax. |
| **Flexibility** | 8/10 | *Strengths:* new sections/groups/entities/attachments are additive by construction; GenericBlock forward-compatibility; reserved entity types; the join-pattern template. *Weaknesses:* multi-language/multi-brand need real (if additive) migration design; jsonb attributes are flexible but unvalidated. |
| **SEO readiness** | 7/10 | *Strengths:* canonical discipline, two-flag indexation gate, robots-aware sitemaps, schema-from-rendered-data, deterministic crawl surface, combo-unique anti-cannibalization — genuinely better than most commercial PSEO stacks. *Weaknesses:* current content generator produces near-duplicates (the single biggest SEO risk); product cards 404; canonical host ambiguity; FAQ sameness across clusters. Design 9, current content pipeline 5 → 7. |
| **Performance** | 6/10 | *Strengths:* one round-trip render, STABLE functions, tight indexes, small payloads. *Weaknesses:* no ISR/edge caching yet; per-request sitemap scans; unbounded `select *`-per-page patterns fine now, unmeasured at scale. Nothing hard — just unbuilt. |
| **DB normalization** | 8/10 | *Strengths:* textbook separation of vocabulary/intent/page/attachment/interaction; typed polymorphic FKs done correctly; constraint coverage far above typical. *Weaknesses:* duplicate product catalogs, dual image systems, denormalized jsonb hotspots (product attributes), legacy strata. The core is a 9; the periphery drags it. |
| **Future AI compatibility** | 9/10 | The standout. AI slots in as *producers into existing gated slots* (draft pages, template variants, pool FAQs, staged links, library images) with provenance columns and human gates already shaped. Very little in the design assumes a human author anywhere. |
| **Enterprise readiness** | 4/10 | *Weaknesses dominate:* no roles/permissions beyond one policy, no audit logging, no admin tooling (raw SQL is the CMS), no staging environment discipline visible, no automated tests against the contract, backups/PITR unverified. *Strengths:* the constraint layer is enterprise-grade even when nothing else is. This is the largest honest gap. |
| **Technical debt** | 5/10 | Explicit and *named* debt (clone generator, dead tables, legacy RPC, dual systems) — which is better than hidden debt, but it is real, and two items (generator, image decision) sit directly on the scaling path. Debt is documented with due dates in this constitution; paying it is the difference between the 8s above being real or theoretical. |
| **Security** | 2/10 (current) / 8/10 (as designed) | The uncomfortable number. Today: public write access to 32 tables and publicly executable generators — the site's entire content is editable by anyone holding the shipped anon key. The *designed* posture (RPC-mediated reads, insert-only leads, service-role tooling) is sound and the lock SQL is already written. Until it is applied, every other score is provisional. |
| **Long-term sustainability** | 8/10 | The philosophy (meaning-first, deterministic, contract-bounded, additive-evolution) is the kind that survives team turnover — *because it is now written down*. Sustainability risks are organizational (single-operator knowledge, no tests) more than architectural. |

## The final question

> **If maintained correctly, can this architecture realistically support 100,000 SEO landing pages, millions of monthly visitors, future AI content generation, future pricing and shipping engines, and multiple brands — without a complete redesign?**

**Yes — with three non-negotiable conditions. And the reasoning matters more than the yes.**

**Why yes.** Strip the system to its load-bearing decisions: pages as rows behind a unique-slug, unique-meaning registry; one deterministic render contract; a strict decide/translate/render tier boundary; visibility as an explicit two-flag gate; every future capability expressible as new producers and consumers of rows. Each of these decisions is *scale-invariant* — none of them works differently at 100,000 pages than at 9. Postgres handles 100k-row core tables and few-million-row edge tables without exotic engineering. Millions of monthly visitors are served not by the database but by caches — and deterministic rendering is precisely the property that makes caching a configuration choice rather than a correctness project. AI content, pricing engines, and shipping calculators are already-shaped extension points (Parts 10, 14): producers behind gates, satellites behind new RPCs. Multi-brand is the hardest ask, and even it decomposes into an additive dimension on pages plus brand-scoped assets plus additional thin frontends on the same contract — a significant project, not a redesign. The architecture's essential test — *"does the new requirement change the chain, the contract, or the boundary?"* — returns "no" for every item on the list.

**The three conditions, without which the answer is no:**

1. **The security lock is executed first.** An architecture whose truth is publicly writable does not have properties; it has suggestions. Every guarantee in this document — determinism, uniqueness, gated publishing — is only as real as the write-access control around it. The lock plan exists (DB manual §K/§O); it is days of work; it precedes everything.
2. **The content generator is replaced before ~page 50.** The clone-generator is the one component that actively *fights* the architecture's SEO thesis at scale. Template-variant composition (the already-built `seo_templates` slot design) plus human/scored QA is the difference between 100,000 pages being a moat and being a penalty. No caching layer or link graph can compensate for a domain Google classifies as scaled content abuse.
3. **Operations grow with the page count.** Backups/PITR verified, RPC definitions in migrations, contract snapshot tests, scheduled data-quality audits (orphans, links, duplicates), and a scored QA gate on indexation by ~10,000 pages. The architecture is unusually *recoverable* (everything is rows) but only for teams that can actually restore, diff and monitor rows.

**What would force a redesign** — the honest failure modes: allowing the chain to leak (multiple pages per meaning "just this once"); letting business rules migrate into frontends or side-channel scripts until the contract is decorative; adopting multi-language/multi-brand *ad hoc* (per-market forks instead of a designed dimension); or scaling the clone generator into the index. Note that all four are *governance* failures, not architectural ones. That is the deepest finding of this audit: **the system's ceiling is not in its schema — it is in the discipline of the people operating it.** This constitution exists to make that discipline explicit, portable, and permanent.

The design deserves to scale. Lock it, mature its content engine, bury its dead, and it will.

---

*End of Constitution. Companion reference: `docs/DATABASE_MANUAL.md`. Amendments to this document should be rare, deliberate, versioned — and should answer to Part 16 before they answer to convenience.*
