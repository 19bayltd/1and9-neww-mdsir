# 1 & 9 Apparel — PSEO Database & Rendering Master Manual

**Supabase project:** `1 & 9 SEO` (`sotbdgqytbatifkgbewb`, Postgres 17, ap-southeast-2)
**Frontend repo:** `19bayltd/1and9-neww-mdsir` (Next.js App Router, anon-key Supabase client only)
**Audit date:** 2026-07-08 · **Method:** live queries against `pg_catalog` / `information_schema`, live RPC source via `pg_get_functiondef`, Supabase security advisors, and full frontend source review.
**Mode:** read-only audit. Nothing in the database was modified.

---

## A. Executive Summary

The system is a **database-driven programmatic SEO (PSEO) engine**. Every landing page URL (e.g. `/custom-t-shirt-manufacturer-usa`) is a row in `seo_pages`; all copy, section order, FAQs, product cards and internal links live in satellite tables. The Next.js frontend contains **zero page-specific copy** — it calls one RPC, `get_landing_page_view(page_slug)`, and maps the returned JSON to section components. Sitemaps are likewise RPC-driven (`get_sitemap_index`, `get_sitemap_pages`). Quote submissions insert into `quote_requests` via the anon key.

**Current state (live counts):** 9 pages (3 published, 6 draft), 45 entities, 9 keywords, 90 content blocks, 60 internal links, 10 FAQs, 14 page–product rows, 2 country asset rows.

### The five things that matter most

1. **CRITICAL — the database is publicly writable.** RLS is disabled on 32 of 33 public tables, and `anon` holds full `INSERT/UPDATE/DELETE/TRUNCATE` grants on all of them. Anyone with the public anon key (shipped in the site's JS) can rewrite or truncate every SEO table, and can also execute the `generate_*` admin functions. This must be locked before any scaling (see §K and §O).
2. **The frontend renders from `get_landing_page_view`, not `get_seo_page_render`.** `get_seo_page_render` is a parallel, older render RPC that is not referenced anywhere in the repo. It also leaks draft pages (no `status` filter). Treat it as a cleanup candidate (§L).
3. **The image-assignment system (`image_library` + `seo_page_images`) is not consumed by the live site.** Hero/section images actually come from `seo_content_blocks.image_url` and `country_assets`. Three whole generations of abandoned image/content tables exist (§H, §L).
4. **Two publish-blocking data bugs:** product cards link to `/{entity-slug}` (e.g. `/t-shirts`) — routes that don't exist → 404s; and the nested slug `guides/how-t-shirt-manufacturing-works` can never render because the frontend route is single-segment `/[slug]` (§P16 items, §M).
5. **The keyword → page pipeline exists and works** (`seo_keywords` → `generate_seo_pages` → `generate_content_blocks` → `generate_internal_links`), but the content generator clones page #2 with string replacement — safe at 9 pages, a thin-content factory at 1,000. It needs template-driven generation before scale (§M, §P).

---

## B. Database Map

### B.1 Active core (frontend depends on these — do not touch casually)

| Table | Rows | PK | RLS | Role |
|---|---|---|---|---|
| `seo_entities` | 45 | id | ❌ off | Master registry of products/countries/states/industries/buyer types/etc. |
| `seo_keywords` | 9 | id | ❌ off | Keyword-to-page blueprint; drives `generate_seo_pages` |
| `seo_pages` | 9 | id | ❌ off | One row = one URL. The center of the system |
| `seo_content_blocks` | 90 | id | ❌ off | Per-page sections (hero…faq), ordered by `display_order` |
| `seo_page_products` | 14 | id | ❌ off | Product cards per page |
| `seo_internal_links` | 60 | id | ❌ off | Page-to-page links, grouped by `link_group` |
| `seo_faqs` | 10 | id | ❌ off | Entity-scoped FAQ pool (matched to pages at render time) |
| `country_assets` | 2 | id | ❌ off | Per-country hero/meta images, badges, currency, CTA |
| `quote_requests` | 1 | id | ✅ on | RFQ form target (insert-only policy for anon) |
| `seo_templates` | 6 | id | ❌ off | Copy variants per section/entity (referenced by `seo_content_blocks.source_template_id`; not yet read by any RPC) |

### B.2 Secondary / dormant (schema is wired, but the live site doesn't read them)

| Table | Rows | Status |
|---|---|---|
| `image_library` | 5 | Read only by unused `get_seo_page_render`; `seo_pages.meta_image_id` FK points here |
| `seo_page_images` | 45 | Page↔image assignments; only surfaced by unused RPC |
| `seo_layout_variants` | 5 | `seo_pages.layout_variant_id` FK; frontend ignores layout variants today |
| `seo_layout_positions` | 50 | Section order per layout variant; **no RPC reads it** — actual order comes from `seo_content_blocks.display_order` |
| `quote_configurations` | 3 | Per-page quote settings (min MOQ etc.); frontend hardcodes MOQ 300 fallback instead |
| `quote_customization_options` | 6 | Future quote-builder options; unread |
| `shipping_zones` / `shipping_rates` | 4 / 2 | Future freight quoting; unread |
| `quote_events` | 0 | Future conversion-event log; unread |
| `product_pricing_tiers` | 0 | Future pricing engine; unread |
| `products` | 0 | Physical/logistics product catalog (v3); `seo_page_products.product_id` FK exists but is unused/null |

### B.3 Abandoned older render systems (evidence in §L)

| Generation | Tables | Rows |
|---|---|---|
| Gen-1 "section blocks" | `seo_section_blocks` (9), `seo_block_items` (0), `seo_images` (8), `seo_section_images` (0) | mostly empty |
| Gen-2 "content/image library + assignments" | `seo_content_library` (0), `seo_page_content_assignments` (0), `seo_image_library` (0), `seo_page_image_assignments` (0) | all empty |
| Gen-2.5 "media assets" | `seo_media_assets` (4), `seo_page_media` (5) | demo rows |
| Gen-3 "seo products" | `seo_products` (0), `seo_product_images` (0) | empty |

None of these are referenced by any RPC or any frontend file.

---

## C. Table-by-Table Documentation

Conventions: **Req** = NOT NULL. "Used by render RPC" = returned by `get_landing_page_view` (the live one); notes call out `get_seo_page_render` (legacy) where relevant. Every table has `id bigint` identity PK unless noted.

### C.1 `seo_entities` — master entity registry (CORE)

One row per real-world concept the SEO system can talk about. Everything else points here.

| Column | Type | Req | Default | Purpose / Example | Risk if wrong | In render RPC |
|---|---|---|---|---|---|---|
| `id` | bigint | ✔ | identity | PK. e.g. `6` = T-Shirts | — | via joins |
| `entity_type` | text | ✔ | — | CHECK: one of `product,country,state,city,industry,buyer_type,material,fabric,certification,customization,shipping_zone,keyword,intent,service`. e.g. `product` | Wrong type breaks the validation triggers on pages/FAQs/products | filter only |
| `slug` | text | ✔ | — | kebab-case, CHECK `^[a-z0-9]+(-[a-z0-9]+)*$`. e.g. `t-shirts` | Becomes the product-card link target (`/t-shirts`) — see broken-route bug §P | ✔ (products) |
| `name` | text | ✔ | — | Display name, e.g. `T-Shirts` | Product card title fallback | ✔ (products) |
| `parent_id` | bigint | — | null | Hierarchy (state→country, city→state). Self-FK | Wrong parent breaks future geo expansion | ✖ |
| `attributes` | jsonb | ✔ | `{}` | Bag of extras. Live keys on products: `image_url`, `moq`, `card_description` | Missing keys → product cards render without image/MOQ/description | ✔ (product cards) |
| `is_active` | bool | ✔ | true | Soft-off switch | Inactive entities still render on pages (RPC doesn't check it for products) — needs confirmation whether intended | ✖ |
| `created_at`/`updated_at` | timestamptz | ✔ | now() | Audit (trigger keeps `updated_at`) | — | ✖ |

Uniques: `(entity_type, slug)`, `(id, entity_type)` (composite target for type-safe FKs). Live distribution: product 17, country 9, buyer_type 5, service 5, industry 4, material 4, state 1.

**Never duplicate:** the same concept under two slugs (`tshirts` and `t-shirts`) — every page/FAQ/link keyed off the duplicate splits your topical authority.

### C.2 `seo_keywords` — page blueprint (CORE, generator input)

This is where keywords live. One row = one target keyword = (at most) one page.

| Column | Type | Req | Default | Purpose | Risk if wrong |
|---|---|---|---|---|---|
| `keyword` | text | ✔, unique | — | The raw phrase, e.g. `custom t-shirt manufacturer usa` | Duplicate meaning → duplicate pages |
| `slug` | text | ✔, unique | — | Becomes `seo_pages.slug` verbatim in the generator | Slug collision = upsert overwrite of another page's entity wiring |
| `keyword_group` | text | ✔ | — | Free grouping label | reporting only |
| `keyword_type` | text | ✔ | — | Becomes `seo_pages.template` AND `sitemap_group` (underscores→dashes). e.g. `product_country` | Wrong type → page lands in wrong sitemap group |
| `intent` | text | ✔ | `buy` | CHECK `buy,price,guide,comparison,location` | future content targeting |
| `product/industry/buyer_type/material/service/country/state/city_entity_id` | bigint | — | null | FK → `seo_entities`. Defines the page's meaning | Missing FK → page can't match FAQs/links/assets |
| `priority` | numeric | ✔ | 0.5 | 0–1; copied to `seo_pages.priority` | sitemap ordering |
| `status` | text | ✔ | `active` | CHECK `active,paused,archived`; only `active` is generated | paused keywords silently skipped |

Not read by any render RPC — it's upstream tooling. Live: 9 rows, all `active` (6 product_country, 1 product_state, 1 product_buyer_type, 1 guide).

### C.3 `seo_pages` — one row per URL (CORE)

| Column | Type | Req | Default | Purpose / Example | Risk if wrong | In render RPC |
|---|---|---|---|---|---|---|
| `slug` | text | ✔, unique | — | URL path. CHECK allows nested `a/b` segments | **Frontend `/[slug]` route only renders single segments — nested slugs 404** | ✔ lookup key |
| `keyword_id` | bigint | — | null | FK → `seo_keywords`. Marks generator-managed pages (generators filter `keyword_id is not null`) | Null = invisible to generators | ✖ |
| `product/country/state/city/industry/buyer_type/material/service_entity_id` | bigint | — | null | The page's meaning. Trigger `validate_seo_page_entities` enforces entity types (product/country/state/city/industry/buyer_type; material/service currently unvalidated) | Wrong combo → FAQ/link matching and country assets break | ✔ (FAQ matching, country assets) |
| `title` | text | ✔ | — | Browser/title fallback & internal-link anchor fallback | Anchors show wrong text | ✔ |
| `h1` | text | ✔ | — | Page H1 (hero headline fallback) | SEO relevance | ✔ |
| `meta_title` | text | ✔ | — | CHECK ≤120 chars. Rendered absolute (brand suffix already included) | Truncation in SERPs; live pages are 54–64 chars ✅ | ✔ |
| `meta_description` | text | ✔ | — | CHECK ≤250 chars. Live 128–153 ✅ | CTR | ✔ |
| `canonical_url` | text | — | null | CHECK null or `/…` or `https://…`. RPC falls back to `/<slug>` | Wrong canonical = deindexing; sitemap builds absolute URL from it | ✔ |
| `robots` | text | ✔ | `index,follow` | CHECK 4 combos. Sitemap only includes `index,*` | `noindex` published pages are live-but-invisible (currently 2 of 3 published pages!) | ✔ |
| `hero_image_override_url` | text | — | null | Per-page hero override (https only) | broken URL → dark hero band (CSS-safe) | ✔ (`hero_image_url`) |
| `status` | text | ✔ | `draft` | CHECK `draft,published,archived`. **The publish gate**: RPC returns null unless `published` | Draft link targets are silently dropped from internal links | ✔ filter |
| `priority` | numeric | ✔ | 0.5 | CHECK 0–1. Sitemap ordering + auto-link ranking | — | ✔ |
| `template` | text | ✔ | — | Page archetype (`product_country`, `guide`…). Exposed as sitemap `page_type` | part of entity-combo unique key | ✔ |
| `sitemap_group` | text | ✔ | — | Which `/sitemaps/<group>.xml` file the URL lives in | wrong group ≠ broken, just misfiled | ✖ (sitemap RPCs) |
| `layout_variant_id` | bigint | — | null | FK → `seo_layout_variants`. Returned only by legacy RPC; frontend ignores | — | ✖ |
| `meta_image_id` | bigint | — | null | FK → `image_library`; **no RPC returns it** (OG image actually comes from `country_assets.meta_image_url`) | — | ✖ |
| `published_at` | timestamptz | — | null | Editorial timestamp | — | ✔ |
| `created_at`/`updated_at` | timestamptz | ✔ | now() | `updated_at` = sitemap `<lastmod>` (trigger-maintained) | stale lastmod | ✔ |

Key indexes: unique `slug`; **unique entity combo** `(template, product, country, state, city, industry, buyer_type) NULLS NOT DISTINCT` — this is the duplicate-page firewall; partial indexes per entity column; `seo_pages_published_idx` (covering, `status='published'`); `seo_pages_sitemap_idx` (`sitemap_group, priority desc, updated_at desc` where published).

### C.4 `seo_content_blocks` — per-page sections (CORE)

| Column | Type | Req | Default | Purpose | Risk if wrong | In render RPC |
|---|---|---|---|---|---|---|
| `page_id` | bigint | ✔ | — | FK → seo_pages (unique with `block_key` and with `display_order`) | — | join key |
| `block_key` | text | ✔ | — | Section identity. Live vocabulary (10 per page): `hero, intro, manufacturing_overview, customization_options, why_choose_us, production_process, buyer_solutions, related_products, rfq, faq` | Unknown key → generic text section (safe); missing key → section skipped (except RFQ which the UI force-appends) | ✔ |
| `display_order` | smallint | ✔ | — | CHECK ≥1; unique per page. **This is the real section-order mechanism** | Duplicate order = insert error; wrong order = sections shuffle | ✔ (`sort_order`) |
| `heading` | text | — | null | Section H2/H3; hero heading overrides page `h1` | — | ✔ |
| `body` | text | — | null | Paragraphs (split on blank lines) | empty section body | ✔ |
| `cta_label` / `cta_url` | text | — | null | CHECK url `/…` or `https://…`. Rendered by RFQ + generic blocks | Live data points at `/quote?market=us|canada` — **no `/quote` route exists** | ✔ |
| `image_url` / `image_alt` | text | — | null | https-only. **This is where the hero image actually comes from** (all 9 hero blocks have one) | broken hero image | ✔ |
| `source_template_id` | bigint | — | null | FK → seo_templates; provenance of generated copy | — | ✖ |

### C.5 `seo_page_products` — product cards (CORE)

| Column | Type | Req | Default | Purpose | Risk if wrong |
|---|---|---|---|---|---|
| `page_id` / `product_entity_id` | bigint | ✔ | — | FKs; unique pair; trigger enforces entity_type='product' | — |
| `display_order` | smallint | ✔ | — | CHECK ≥1; unique per page → card order | duplicate = insert error |
| `is_featured` | bool | ✔ | false | Unique partial index allows **max one featured per page** → yellow "Featured" ribbon | second featured = insert error |
| `card_title` | text | — | null | Falls back to `seo_entities.name` | — |
| `card_description` | text | — | null | Falls back to `attributes->>'card_description'` | card without body |
| `cta_text` | text | — | null | Card CTA; UI default "View Details" | — |
| `moq` | int | — | null | CHECK >0; falls back to `attributes->>'moq'`; also feeds hero "MOQ FROM" chip (min across cards, default 300) | wrong MOQ shown site-wide on that page |
| `image_override_url` | text | — | null | https-only; falls back to `attributes->>'image_url'` | text-only card |
| `product_id` | bigint | — | null | FK → `products` (v3 catalog). Currently unused | — |

### C.6 `seo_internal_links` — link graph (CORE)

| Column | Type | Req | Purpose | Risk if wrong |
|---|---|---|---|---|
| `source_page_id` → `target_page_id` | bigint | ✔ | Directed edge, FK both ends (broken IDs impossible) | — |
| `link_group` | text | ✔ | Grouping key: live groups `auto_related` (48), `related_products` (7), `related_countries` (2), `related_buyer_types` (1), `related_guides` (1), `related_states` (1) | UI titles the sidebar group from this key |
| `anchor_text` | text | — | 1–150 chars or null → falls back to target page `title` | Over-optimized anchors at scale |
| `display_order` | smallint | ✔ | ≥1; unique per (source, group) | duplicate = insert error |

Unique edge per `(source, group, target)` — the same target may legitimately appear in two groups (this is why "duplicate anchors" appear in QA; see §P16). Render-time rule: **targets that aren't `published` are silently filtered out** by the RPC join.

### C.7 `seo_faqs` — entity-scoped FAQ pool (CORE)

FAQs are **not** attached to pages. They target an entity scope and are matched at render time:

```
(product_entity_id IS NULL OR = page.product_entity_id)
AND (country_entity_id IS NULL OR = page.country_entity_id)
AND (buyer_type_entity_id IS NULL OR = page.buyer_type_entity_id)
```

All-null scope = global FAQ shown on **every** page.

| Column | Type | Req | Default | Purpose | Risk if wrong |
|---|---|---|---|---|---|
| `product/country/buyer_type_entity_id` (+`*_type` discriminators) | bigint/text | — | null / type name | Scope; composite FKs enforce entity type | Too many all-null FAQs = same FAQ block on every page (duplicate content) |
| `question` | text | ✔ | — | CHECK 8–300 chars; unique per scope (case-insensitive, NULLS NOT DISTINCT) | — |
| `answer` | text | ✔ | — | CHECK 20–1200 chars | — |
| `priority` | smallint | ✔ | 100 | Tiebreak after display_order (desc) | — |
| `display_order` | smallint | ✔ | — | ≥1; unique per scope (NULLS NOT DISTINCT) — global FAQs share one numbering space | insert error on collision |
| `include_in_schema` | bool | ✔ | true | false ⇒ renders on page but excluded from FAQPage JSON-LD | schema spam control |
| `is_active` | bool | ✔ | true | Hard off-switch (RPC filters) | — |

### C.8 `country_assets` — per-country enrichment (CORE)

One row per country entity (unique `country_entity_id`, composite FK enforces `entity_type='country'`). All fields required: `hero_image_url`, `meta_image_url` (https-only), `trust_badges` (jsonb array of `{label, image_url}`), `shipping_text`, `currency_code` (CHECK `^[A-Z]{3}$`), `cta_label`, `cta_url`, `factory_message`. Live rows: united-states, canada. **Australia has none** → its page renders with hero-block image and no badges/currency chip (works, but thinner). Used by: hero fallback image, OG image, trust badges, shipping line, currency chip, footer.

### C.9 `quote_requests` — RFQ inbox (CORE, the only RLS-protected table)

`source_page_id`/`source_slug` (attribution), `product_entity_id`/`country_entity_id` (validated by trigger; the public form leaves them null and composes Product/Country/Timeline into `message`), `company_name`, `email` (regex CHECK), `phone` (regex CHECK), `quantity` (≥1), `message` (≤5000), `attachment_url` (https), `status` (`new→contacted→quoted→won|lost|spam`), `assigned_to`, `keyword_id`. RLS: **enabled**, single policy `quote_requests_public_insert` (INSERT, `with_check: true`, roles anon+authenticated). No SELECT policy ⇒ anon cannot read submissions back (note: the table-level SELECT grant still exists, but RLS returns zero rows).

### C.10 `seo_templates` — copy variants (semi-active)

`section_key` + `variant_number` + optional product/buyer_type/country scope (composite type-safe FKs), `heading`, `body` (non-empty CHECK), `is_active`. Unique slot `(section_key, variant_number, product, buyer_type, country) NULLS NOT DISTINCT`. Live: 6 rows (intro v1/v2, manufacturing_overview, customization_options, production_process, buyer_solutions). **No RPC reads it yet** — `generate_content_blocks` currently clones page 2 instead. This is the natural home of future variant-based generation (§P).

### C.11 Image system tables (dormant + legacy) — details in §H

- **`image_library`** (5): `image_key` (unique), `image_url`, `image_type` (`hero,product,factory,customization,quality`), `section_target` (same vocabulary), targeting hints (`product_type`, `fabric_type`, `gsm_min/max`, `country`, `buyer_intent` — all free text, not FKs), `alt_template`, `width`/`height`, `file_format`, `sort_order`, `is_active`.
- **`seo_page_images`** (45): `(page_id, section_name, image_id)` unique; `display_order`, `is_primary`, `is_active`. Live sections: hero/factory/products/customization/quality × 9 pages.
- Legacy: `seo_images` (8) + `seo_section_images` (0); `seo_image_library` (0) + `seo_page_image_assignments` (0); `seo_media_assets` (4) + `seo_page_media` (5); `seo_product_images` (0).

### C.12 Quote/logistics satellites (future engine, unread today)

`quote_configurations` (per-page min_moq/currency/incoterm/response_time; 3 rows), `quote_customization_options` (6), `shipping_zones` (4) → `shipping_rates` (2), `product_pricing_tiers` (0), `quote_events` (0), `products` (0, full logistics catalog with carton/CBM computed columns). None referenced by frontend or RPCs. Keep for the quote-engine roadmap (§P).

### C.13 Layout tables (dormant)

`seo_layout_variants` (5: layout_a…layout_e, all active) and `seo_layout_positions` (50: 10 sections × 5 variants, with `position`, `is_fixed`). Only `layout_variant_id` is echoed back by the **legacy** RPC; nothing reads `seo_layout_positions`. Section order is actually `seo_content_blocks.display_order`. Either wire these into a future layout system or treat as archived (§L).

---

## D. Function / RPC Documentation

11 functions exist in `public`. **Security posture: every one is SECURITY INVOKER and EXECUTE is granted to `anon` and `authenticated`** — including the admin generators (critical finding, §K).

| Function | Args | Returns | Used by frontend | Status | Notes |
|---|---|---|---|---|---|
| `get_landing_page_view` | `page_slug text` | jsonb | ✔ (`/[slug]`) | **ACTIVE** | Published-only; `SET search_path=public`; STABLE |
| `get_sitemap_index` | `chunk_size int = 5000` | table | ✔ (`/sitemap.xml`) | **ACTIVE** | Emits `/sitemaps/<group>[-N].xml` paths |
| `get_sitemap_pages` | — | table | ✔ (`/sitemaps/[group]`) | **ACTIVE** | Hardcodes `https://www.1and9apparel.com` base |
| `get_seo_page_render` | `p_slug text` | jsonb | ✖ | **LEGACY / unused** | No status filter (returns drafts); no search_path pin |
| `generate_seo_pages` | — | table | ✖ (admin) | ACTIVE tooling | Upserts pages from active keywords |
| `generate_content_blocks` | — | table | ✖ (admin) | ACTIVE tooling | Clones page 2's blocks into empty keyword pages |
| `generate_internal_links` | — | table | ✖ (admin) | ACTIVE tooling | Rebuilds `auto_related` group (≤6/page) |
| `set_updated_at` | trigger | trigger | — | ACTIVE | On 8 tables |
| `validate_seo_page_entities` | trigger | trigger | — | ACTIVE | Type-checks 6 entity FKs on seo_pages |
| `validate_seo_page_product_entity` | trigger | trigger | — | ACTIVE | seo_page_products guard |
| `validate_quote_request_entities` | trigger | trigger | — | ACTIVE | quote_requests guard |

### D.1 `get_landing_page_view(page_slug text) → jsonb` — the live render contract

**Lookup:** `select * from seo_pages where slug = page_slug and status = 'published'`; **returns SQL `null` if not found or not published** (frontend maps that to a 404). Then builds one jsonb object:

- **`page`** — id, slug, title, h1, meta_title, meta_description, `canonical_url` (coalesced to `/<slug>`), robots, template, priority, `hero_image_url` = `coalesce(hero_image_override_url, country_assets.hero_image_url)`, published_at, updated_at.
- **`country_assets`** — the full country row (or null when the page has no country / no row): hero_image_url, meta_image_url, trust_badges, shipping_text, currency_code, cta_label, cta_url, factory_message.
- **`content_blocks[]`** — all blocks for the page, `order by display_order`; fields renamed: `display_order → sort_order`. Empty ⇒ `[]`.
- **`faqs[]`** — active FAQs matched by the entity-scope rule (§C.7), `order by display_order, priority desc`. Fields: question, answer, sort_order, include_in_schema.
- **`products[]`** — page products joined to entities, `order by display_order`. Coalescing: title = `card_title → entity.name`; description = `card_description → attributes.card_description`; moq = `moq → attributes.moq::int`; image_url = `image_override_url → attributes.image_url`; plus slug (⚠ entity slug, not a page slug), cta_text, is_featured.
- **`internal_links{}`** — object keyed by `link_group`, each an array of `{anchor: coalesce(anchor_text, target.title), slug: target.slug, sort_order}` ordered by display_order; **join filters `target.status='published'`**. No links ⇒ `{}`.

Null handling: each collection is `coalesce(…, '[]'/'{}')`; scalar nulls pass through and the UI guards every field. Volatility STABLE; `SET search_path TO public` (injection-hardened).

### D.2 `get_seo_page_render(p_slug text) → jsonb` — legacy twin (unused)

Same shape family but: **no `status` filter** (drafts and archived pages render — an information-leak/SEO hazard if anything ever calls it), no `country_assets`, adds `layout_variant_id`, adds **`section_blocks`** (same `seo_content_blocks` rows under other aliases: `section_key`=`block_key`, `title`=`heading`, `position`=`display_order`) and **`assigned_images`** (`seo_page_images` ⨝ `image_library` where both `is_active`, ordered by section_name, display_order; exposing image_key/url/alt_template/image_type/section_target/width/height). FAQ/product/link logic mirrors D.1 (links still filter published targets). Not called anywhere in the repo — cleanup candidate (§L), or the future upgrade path if the image system is adopted (§P).

### D.3 Sitemap RPCs

- **`get_sitemap_pages()`**: all pages where `status='published'` AND `robots in ('index,follow','index,nofollow')` AND slug non-empty. Returns slug, absolute `canonical_url` (base **hardcoded** to `https://www.1and9apparel.com` — mismatch with `NEXT_PUBLIC_SITE_URL` on Vercel; pick one canonical host before indexing), page_type=template, sitemap_group, updated_at, priority.
- **`get_sitemap_index(chunk_size=5000)`**: groups those pages by `sitemap_group`, chunks by 5,000 (`row_number` over priority desc, updated_at desc), returns one row per chunk with `sitemap_path` `/sitemaps/<group>.xml`, `/sitemaps/<group>-2.xml`, …
- ⚠ **Chunk-2 gap:** the frontend group route matches `sitemap_group === "manufacturer-2"` — no group has that name, so any second chunk 404s. Invisible below 5,000 URLs per group; must fix before that scale (§M).

### D.4 Generator pipeline (admin tooling — currently executable by anon ⚠)

1. **`generate_seo_pages()`** — INSERT…SELECT from `seo_keywords` (status `active`): slug=keyword slug, title/h1 = `initcap(keyword)`, meta_title = `initcap(keyword) || ' | 1 & 9 Apparel'`, boilerplate meta_description, canonical `/<slug>`, **robots `noindex,follow`**, **status `draft`** (safe-by-default: new pages can't leak into the index or sitemap), template=keyword_type, sitemap_group=keyword_type with dashes, priority copied. `ON CONFLICT (slug) DO UPDATE` refreshes only the entity wiring + updated_at — **manual edits to titles/meta survive re-runs**.
2. **`generate_content_blocks()`** — for keyword pages with zero blocks, clones all 10 blocks **from hardcoded master page_id=2**, with string surgery: heading replace of page 2's H1 → target H1; body replaces `'custom t-shirt manufacturer'` → lower(title) and `'USA'` → country name (or `'global markets'`). Fragile by design: if page 2's copy changes, replacements silently stop matching; output is near-duplicate copy (§M thin-content risk).
3. **`generate_internal_links()`** — **deletes all `auto_related` rows**, then for every keyword-page pair sharing product OR country OR buyer_type (or either side being a `guide`), ranks candidates (same product=1, same country=2, same buyer_type=3, else 9; then target priority desc, id) and inserts the **top 6 per source page** with anchor = target title. Manually curated groups (`related_products` etc.) are untouched. Includes drafts as targets (harmless at render — RPC filters — but wastes link slots on unpublished pages).

### D.5 Trigger functions

`set_updated_at` — BEFORE UPDATE on seo_entities, seo_pages, seo_content_blocks, seo_templates, seo_faqs, seo_internal_links, seo_page_products, country_assets, quote_requests. `validate_seo_page_entities` / `validate_seo_page_product_entity` / `validate_quote_request_entities` — BEFORE INSERT/UPDATE type-guards (23514 on mismatch). Advisor note: none of the trigger functions or generators pin `search_path` (WARN-level; fix in the lock plan §O).

---

## E. Page Generation Flow

```
seo_keywords (1 keyword = 1 intent = 1 slug)
      │  generate_seo_pages()            [upsert; draft + noindex]
      ▼
seo_pages (slug, entity wiring, title/H1/meta, template, sitemap_group)
      │  generate_content_blocks()       [10 blocks cloned from master page 2]
      ▼
seo_content_blocks (hero…faq, display_order 1–10)
      │  generate_internal_links()       [auto_related ≤6/page]
      ▼
seo_internal_links
      │  (manual) seo_page_products, seo_faqs, country_assets, curated link groups
      ▼
EDITORIAL PASS: rewrite title/H1/meta + block copy → set robots='index,follow', status='published'
      ▼
get_landing_page_view(slug)  ──►  /[slug] page render
get_sitemap_index/pages      ──►  /sitemap.xml + /sitemaps/<group>.xml
```

- **Slug** = `seo_keywords.slug`, copied verbatim; globally unique (`seo_pages_slug_key`). Must stay single-segment until the frontend gets a catch-all route.
- **Title/H1/meta** are stored columns (never computed at render). Generator seeds them mechanically; editorial rewrite is expected before publishing.
- **Status machine:** `draft` (default, invisible everywhere) → `published` (renders + eligible for sitemap) → `archived`. **Indexability is separate:** published+`noindex,follow` = viewable but out of sitemap/index — the current staging pattern for 2 of 3 published pages.
- **Canonical/robots:** canonical defaults to `/<slug>` in the RPC; frontend emits it via Next metadata `alternates.canonical`, and robots via `metadata.robots`. Sitemap requires `index,*` robots.
- **Layout variant:** `layout_variant_id` exists on every page (all = 1) but no consumer; actual layout order = block `display_order`.
- **Priority:** 0–1 numeric; orders sitemap output and chunking; also the tiebreak in auto-linking. Convention in live data: 0.9 flagship, 0.7–0.8 standard, 0.5–0.6 supporting.
- **Safe sitemap publishing requires:** `status='published'`, `robots='index,follow'`, non-empty single-segment `slug`, correct `canonical_url` (or null), real `updated_at`, sensible `priority`, correct `sitemap_group`.

---

## F. Entity System Explanation

- **`seo_entities` is the vocabulary; `seo_pages` is the grammar.** A page's meaning = the combination of its entity FKs, e.g. page 2 = product(t-shirts) × country(united-states) rendered through template `product_country`. Buyer-type pages skip country (private-label page: product × buyer_type). Guides may carry only a product.
- **Keywords live in `seo_keywords`** (the phrase + slug + entity decomposition + intent). Entities never store keywords; entity `attributes` stores presentation data (image, MOQ, card copy for products).
- **How an entity becomes part of a page:** keyword row references entity IDs → generator copies them onto `seo_pages` → validation triggers enforce types → at render time those FKs pull FAQs (scope match), country assets (country FK), and steer auto-linking (shared-entity ranking).
- **What must never be duplicated:**
  1. An entity concept under two slugs (splits the graph).
  2. A slug in `seo_keywords`/`seo_pages` (upsert collision / overwrite).
  3. An entity combination under the same template — the DB blocks this (`seo_pages_entity_combo_key`), which is your strongest anti-duplicate guarantee. Don't relax it.
  4. Global (all-null) FAQs beyond a handful — they repeat on every page.
- **Required before scaling:** every product entity needs `attributes.image_url`, `attributes.moq`, `attributes.card_description`; every country you target needs a `country_assets` row; every new keyword needs correct entity decomposition (a keyword with no entity FKs generates an orphan page that can't match FAQs or links). `state`/`city` expansion needs `parent_id` chains populated (only 1 state exists today; cities: 0).

---

## G. Product + Internal Link System

**Products on a page** (`seo_page_products` → `seo_entities`):
- Attach = insert (page_id, product_entity_id, display_order). Trigger rejects non-product entities; unique keys reject duplicate product or duplicate order; partial unique index allows only one `is_featured=true` per page.
- Card rendering (RelatedProductsSection): image (override → entity attributes), title (card_title → name), description, MOQ badge, CTA text ("View Details" default), Featured ribbon. Card MOQs also drive the hero "MOQ FROM" chip (min, default 300).
- ⚠ Card link = `/{entity.slug}` (e.g. `/t-shirts`). **No pages exist at those slugs** → every product card currently links to a 404. Fix options: create product hub pages whose `seo_pages.slug` equals each product entity slug, or change the RPC to emit a real target page slug. Until then product cards should be considered broken links (they do render fine visually).
- **Recipe — add 6 related products to a new page safely:**
  1. Confirm the 6 entities exist (`entity_type='product'`) with image/moq/card_description attributes.
  2. Insert 6 rows with `display_order` 1–6; set `is_featured=true` on exactly one.
  3. Optionally override card_title/description/moq/image per page for local flavor.
  4. QA: `select * from get_landing_page_view('<slug>') -> 'products';`

**Internal links** (`seo_internal_links`):
- Directed edges grouped by `link_group`. The render RPC returns an object keyed by group; the UI shows them in the "Helpful Links" sidebar (group key prettified into the heading) and BuyerSolutionsSection **reuses the same pool**, matching link anchors/slugs against buyer-segment keywords (streetwear, gym, corporate…) — so buyer-type pages you create automatically light up those cards if anchors contain the segment words.
- `auto_related` is machine-owned: `generate_internal_links()` wipes and rebuilds it (≤6/page, shared-entity ranking). Never hand-edit that group; curate in the `related_*` groups instead, which the generator never touches.
- Broken links are structurally impossible (FKs) and links to draft pages are filtered at render.
- **Anti-spam rules for scale:** keep total rendered links per page ≤ ~15–20 (6 auto + ≤6 products + a handful curated); avoid reciprocal-everything patterns (the current ranking already prefers relevance); vary anchors (anchor null → target title is a good default; avoid repeating one exact-match anchor site-wide); never link groups of pages all-to-all within the same entity cluster once a cluster exceeds ~10 pages — switch to hub-and-spoke (product hub ↔ country pages, sibling links capped).

---

## H. Image System

**What actually renders today** (in priority order, from frontend source):
1. Hero: `hero` block `image_url` → `page.hero_image_url` (= `hero_image_override_url` → `country_assets.hero_image_url`) → dark band with no image. All 9 hero blocks have an image ✅.
2. OG/meta image: `country_assets.meta_image_url` → `page.hero_image_url`.
3. Intro grid: hero-ish images + product card images (first 4 distinct of: block image, page hero, country hero, product images).
4. Product cards: `image_override_url` → entity `attributes.image_url`.
5. Trust badges: `country_assets.trust_badges[].image_url`.

**The assignment system that exists but is NOT consumed:** `image_library` (5 images: one per type hero/product/factory/customization/quality, each with `section_target` matching its type, `alt_template`, dimensions) + `seo_page_images` (45 rows: all 9 pages × those 5 sections, display_order 1, hero rows `is_primary`). Only the **unused** `get_seo_page_render` exposes them (`assigned_images`, ordered by section_name then display_order, filtered on both `is_active` flags). `section_target`/`image_type` describe where an image belongs; `display_order` sequences multiple images in a section; `is_primary` marks the hero pick. If the URL of a rendered image 404s: hero degrades gracefully (absolute-positioned backdrop under a gradient), product cards show a broken-image glyph — no crash either way.

**Legacy image tables (unused, keep-don't-delete):** `seo_images`+`seo_section_images` (gen-1), `seo_image_library`+`seo_page_image_assignments` (gen-2), `seo_media_assets`+`seo_page_media` (gen-2.5, 9 demo rows), `seo_product_images` (gen-3, empty). Evidence: zero frontend references, zero RPC references, zero/near-zero rows.

**Decision to make before scaling (needs your call):** either adopt `image_library`/`seo_page_images` as the single source (add `assigned_images` to `get_landing_page_view` and stop writing block `image_url`), or standardize on block/country/entity URLs and archive the assignment tables. Running both means every new page needs images wired twice.

---

## I. FAQ + Schema System

- Selection: entity-scope match (§C.7) on active rows; a page shows global FAQs + product-scoped + country-scoped + buyer-scoped ones. Live pages match 7–10 each.
- Order: `display_order` asc, then `priority` desc. The UI splits the list into two accordion columns (first item open).
- FAQPage JSON-LD: built client-side from the same array, **excluding** rows with `include_in_schema=false`; JSON is `<`-escaped before injection (XSS-safe). If every FAQ is schema-excluded, the script tag is omitted while FAQs still render — that's the by-design "renders on page but not in schema" behavior.
- If zero FAQs match, the FAQ section is skipped entirely (no empty shell, no schema).
- **Safe counts:** 5–10 rendered per page; keep schema-included ones to the genuinely question-shaped 4–8 to avoid FAQ-rich-result spam signals. Google currently shows FAQ rich results only for well-known authoritative sites — treat schema as hygiene, not a rankings lever.
- **Required before publishing a page:** at least ~4 matched FAQs (write product- or country-scoped ones if the pool doesn't cover the new entity combo), unique questions within scope (DB-enforced), answers 20–1200 chars (DB-enforced).
- Scale warning: because matching is scope-based, 1,000 pages sharing one product entity all show identical product FAQs. Add country/buyer-scoped variants as you expand so FAQ blocks differentiate (§M).

---

## J. Frontend Dependency Map

**Files that call Supabase (the complete list):**

| File | Call | Purpose |
|---|---|---|
| `src/lib/supabase.ts` | client init | anon key only, stateless |
| `src/lib/landing.ts` | `rpc('get_landing_page_view')` | typed fetch + `not_found`/`error` discrimination |
| `src/app/[slug]/page.tsx` | via `fetchLandingPage` (React `cache`d) | metadata + page render; null → `notFound()`; RPC error → 503 UI |
| `src/app/sitemap.xml/route.ts` | `rpc('get_sitemap_index')` | sitemap index (force-dynamic) |
| `src/app/sitemaps/[group]/route.ts` | `rpc('get_sitemap_pages')` | per-group urlset (filters group in JS) |
| `src/components/landing/RFQSection.tsx` | `from('quote_requests').insert(…)` | the only write path; no `.select()` chained (RLS-safe) |

**Component ↔ data contract** (`PSEOPageRenderer` maps `block_key` → component; unknown keys → GenericBlock; missing FAQ data → section skipped; missing `rfq` block → RFQ force-appended):

| Component | Consumes |
|---|---|
| HeroSection | hero block, page.h1/title/meta_description/hero_image_url, country_assets (badges, shipping, factory_message), products (MOQ min) |
| IntroSection | intro block + image fallback chain |
| StatsSection | manufacturing_overview block heading/body |
| IconGridSection ×2 | customization_options / why_choose_us blocks (icons are UI constants) |
| ProcessSection | production_process block |
| BuyerSolutionsSection | buyer_solutions block + internal_links (keyword match) |
| RelatedProductsSection | related_products block + products[] + internal_links{} |
| RFQSection | rfq block heading/body/cta_label + page.id/slug (attribution) |
| FAQSection | faqs[] + faq block body; emits FAQPage JSON-LD |
| FooterTrustBar / LandingNav | page.title, country_assets.currency_code |

**Hard requirements for a page to render:** a published `seo_pages` row with slug/title/h1/meta_title/meta_description (all NOT NULL anyway). Literally everything else is optional at the UI level — every field is null-guarded, sections skip cleanly. **What visibly degrades if missing:** content_blocks (page becomes hero+RFQ only), hero image sources (dark hero), country_assets (no badges/currency/OG fallback), products (catalogue placeholder text), internal_links (no sidebar, buyer cards fall back to #rfq), faqs (no FAQ section/schema). **Safe to add later without frontend changes:** new block_keys (GenericBlock fallback), new link_groups (sidebar auto-titles), more FAQs/products/images, new entities/countries.

---

## K. Security / RLS Risk Report

**Verified live posture:**
- RLS **disabled** on 32 of 33 public tables (everything except `quote_requests`). Supabase advisor flags all 32 as ERROR `rls_disabled_in_public`.
- Default PostgREST grants intact: **`anon` and `authenticated` hold SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER on every public table.**
- All 11 functions are EXECUTE-granted to anon/authenticated, **including `generate_seo_pages` / `generate_content_blocks` / `generate_internal_links`** (which can mass-rewrite content) — and all are SECURITY INVOKER, so they run with the caller's (fully-granted) table rights.
- `quote_requests`: RLS on, one INSERT-only `with_check(true)` policy — correct pattern for a public form (advisor WARN about `true` is acceptable here; tighten later with rate limiting/captcha at the edge).
- Advisor WARNs: mutable `search_path` on `set_updated_at`, the three `validate_*` triggers, the three generators, and `get_seo_page_render`. (`get_landing_page_view` and both sitemap RPCs already pin `search_path` ✅.)

**Practical attack surface with just the public anon key:** rewrite any page's copy/meta (SEO defacement), inject spam internal links or FAQ schema, `TRUNCATE seo_pages`, run the generators, read all quote-request PII via… actually `quote_requests` reads are blocked by RLS ✅ — but **an attacker can UPDATE/DELETE quote rows blind** (grants exist; RLS has no UPDATE/DELETE policy → those are blocked too ✅). The real exposure is every *other* table.

**Recommended policy plan** (documented only — NOT applied):

| Tier | Tables | anon | service_role |
|---|---|---|---|
| Public read-only | seo_pages, seo_content_blocks, seo_entities, seo_page_products, seo_internal_links, seo_faqs, country_assets, seo_templates, image_library, seo_page_images, seo_layout_variants, seo_layout_positions, seo_keywords* | SELECT only | full |
| Public insert-only | quote_requests (already done), later quote_events | INSERT only | full |
| Admin/service-only | products, seo_products(+images), pricing/shipping/quote config tables, all legacy gen-1/2 tables | none | full |

\* `seo_keywords` could be admin-only too; nothing public reads it. Marked read-only here only if you want client-side tooling later — otherwise put it in tier 3. **Needs confirmation.**

**Exact SQL (run in a migration when you're ready — order matters, and test `get_landing_page_view` + both sitemap routes + the RFQ form after):**

```sql
-- 1) Stop anon/authenticated writes everywhere (grants layer)
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

-- 2) Lock the generators & legacy RPC to service contexts
revoke execute on function public.generate_seo_pages()        from anon, authenticated;
revoke execute on function public.generate_content_blocks()   from anon, authenticated;
revoke execute on function public.generate_internal_links()   from anon, authenticated;
revoke execute on function public.get_seo_page_render(text)   from anon, authenticated;

-- 3) Enable RLS on every public table (keeps service_role unaffected)
alter table public.seo_pages            enable row level security;
-- …repeat for all 32 tables…

-- 4) Read policies ONLY where the anon render path needs them
--    (get_landing_page_view & sitemap RPCs are SECURITY INVOKER, so anon
--     must be able to SELECT these tables or the RPCs return nothing)
create policy public_read on public.seo_pages           for select to anon, authenticated using (true);
create policy public_read on public.seo_content_blocks  for select to anon, authenticated using (true);
create policy public_read on public.seo_entities        for select to anon, authenticated using (true);
create policy public_read on public.seo_page_products   for select to anon, authenticated using (true);
create policy public_read on public.seo_internal_links  for select to anon, authenticated using (true);
create policy public_read on public.seo_faqs            for select to anon, authenticated using (true);
create policy public_read on public.country_assets      for select to anon, authenticated using (true);
-- add image_library / seo_page_images ONLY if you adopt assigned_images later
-- quote_requests: keep existing insert policy; add NO select policy

-- 5) Pin search_path on the flagged functions
alter function public.set_updated_at()                    set search_path = public;
alter function public.validate_seo_page_entities()        set search_path = public;
alter function public.validate_seo_page_product_entity()  set search_path = public;
alter function public.validate_quote_request_entities()   set search_path = public;
alter function public.generate_seo_pages()                set search_path = public;
alter function public.generate_content_blocks()           set search_path = public;
alter function public.generate_internal_links()           set search_path = public;
```

Note: `using (true)` SELECT policies keep draft pages *readable in theory* via PostgREST table access; if you want drafts fully hidden from the anon key, use `using (status = 'published')` on `seo_pages` — `get_landing_page_view` still works (it only serves published), but internal-link target joins also only use published targets, so this stricter variant is safe too. Alternative architecture: make the two read RPCs `SECURITY DEFINER` and grant anon **no** table SELECT at all — strongest, but audit the function bodies first.

---

## L. Cleanup Candidates (do not delete now)

| Object(s) | Why it appears unused | Evidence | Frontend risk | Suggested action |
|---|---|---|---|---|
| `get_seo_page_render(text)` | Superseded by `get_landing_page_view`; leaks drafts | zero repo references; no status filter | none | **Archive later** (or repurpose as v2 render; decide with the image-system question) |
| `seo_section_blocks`, `seo_block_items`, `seo_images`, `seo_section_images` | Gen-1 render system | 0–9 stale rows; no RPC/frontend reads | none | Archive later |
| `seo_content_library`, `seo_page_content_assignments`, `seo_image_library`, `seo_page_image_assignments` | Gen-2 system, never populated | 0 rows everywhere | none | Delete later (after backup) |
| `seo_media_assets`, `seo_page_media` | Gen-2.5 demo | 4+5 demo rows; unread | none | Archive later |
| `seo_products`, `seo_product_images` | Parallel product catalog, empty | 0 rows; only self-referencing FKs | none | Keep only if it's the planned catalog; else delete later |
| `products`, `product_pricing_tiers`, `shipping_zones/rates`, `quote_customization_options`, `quote_configurations`, `quote_events` | Future quote engine, unread today | 0–6 rows; no reads | none | **Keep** (roadmap §P) |
| `image_library`, `seo_page_images`, `seo_layout_variants`, `seo_layout_positions` | Wired but unconsumed | only legacy RPC / nothing reads them | none today | **Keep — pending the §H / layout decision** |
| `seo_pages.meta_image_id` | No RPC returns it | column unread | none | Keep; wire into RPC when adopting image system |
| `seo_page_products.product_id` | Points at empty `products` | always null | none | Keep for catalog integration |
| Dangerous non-table item | `anon` write grants + generator EXECUTE | §K | **site integrity** | Lock first (§O) — this is the one "cleanup" that is urgent |

---

## M. Scaling Readiness

**Indexing is already strong** (slug unique; partial entity indexes; covering published/sitemap indexes; proper composite uniques on blocks/links/products/FAQs). The risks are architectural:

| Scale | Verdict | What bites, in order |
|---|---|---|
| **1,000 pages** | ✅ Ready after publish-blockers | Fix first: `/quote` route or CTA retarget; product-card 404 links; nested `guides/*` slug (catch-all route or flatten); canonical host mismatch (RPC hardcodes `www.1and9apparel.com`, env says Vercel URL). Thin content: `generate_content_blocks` clones page 2 — 1,000 near-identical pages risk "scaled content abuse" classification. Rewrite generator to compose from `seo_templates` variants before bulk-publishing. |
| **10,000 pages** | ⚠ Work needed | `get_sitemap_pages()` returns *all* rows and each `/sitemaps/[group]` request filters in JS — O(N) per request; add a `p_group` (and chunk) parameter. Sitemap chunk-2 URLs 404 (frontend never parses `-2` suffix). `generate_internal_links` full delete+rebuild gets slow and lock-heavy; the `template='guide'` OR-clause makes every guide pair with every page (candidate set ≈ N×guides). FAQ pool must grow with scoped variants or every t-shirt page shows identical FAQs. |
| **50,000 pages** | ❌ Not yet | All of the above, plus: per-request RPC with no caching layer (add ISR/`revalidate` or edge cache; pages are `force-dynamic` today only for sitemaps, but `/[slug]` is uncached SSR by default); generator functions need batching/queueing; consider materialized sitemap tables; watch `seo_internal_links` row count (6×N auto rows is fine; the *candidate join* is the problem); `NULLS NOT DISTINCT` FAQ ordering forces global coordination of `display_order` for global FAQs — trivial now, annoying with many editors. |
| Cross-cutting | | **Slug collisions:** DB-safe (unique), but upsert-by-slug means a re-typed keyword silently captures an existing page — add a pre-flight report of slug collisions between keywords and non-keyword pages. **Duplicate meaning:** entity-combo unique key protects same-template dupes; nothing stops `product_country` vs `country_product` style template forks — keep template vocabulary tight. **Schema risk:** FAQ JSON-LD only; safe. Add `Organization`/`Product` schema deliberately, not per-page ad hoc. |

**Dynamic metadata** is already correct (per-page `generateMetadata` from the RPC, absolute title, canonical, robots, OG image). **Internal-linking automation** is in place but needs published-only targeting and hub-and-spoke rules at >100 pages. **Product recommendation automation** doesn't exist yet — `seo_page_products` is manual; the natural v2 is a generator that picks 6 products by shared entity + priority (§P).

---

## N. New Page Publishing Checklist (print this)

Assume: new keyword "custom polo shirt manufacturer uk".

1. **Entities** — product `polo-shirts` exists ✔ / create country `united-kingdom` (`entity_type='country'`, slug kebab-case, attributes as needed).
2. **Country assets** — insert `country_assets` row for the UK (hero + meta image https URLs, trust_badges array, shipping_text, `GBP`, cta_label/url, factory_message). *(Skip only for non-country pages.)*
3. **Keyword** — insert `seo_keywords` row: keyword, slug (single segment!), keyword_group, keyword_type=`product_country`, intent, product+country entity IDs, priority, status `active`.
4. **Page row** — run `generate_seo_pages()` (or manual insert). Verify: slug, entity IDs, template, sitemap_group, status `draft`, robots `noindex,follow`.
5. **Content blocks** — run `generate_content_blocks()` then **rewrite by hand** (or insert 10 blocks manually): keys `hero,intro,manufacturing_overview,customization_options,why_choose_us,production_process,buyer_solutions,related_products,rfq,faq`, display_order 1–10, hero block gets `image_url`+`image_alt`, CTAs point at real routes (today that means `#rfq` or an existing page — **not** `/quote`).
6. **Meta/editorial** — rewrite title, h1, meta_title (≤60 chars ideal), meta_description (140–160), unique vs sibling pages.
7. **FAQs** — ensure ≥4 match the page's scope; add UK-scoped rows (unique question + display_order within scope; `include_in_schema` true for the best 4–8).
8. **Products** — 6 rows in `seo_page_products`, display_order 1–6, exactly one featured, MOQ set; confirm each entity has image/card_description attributes.
9. **Internal links** — run `generate_internal_links()`; hand-curate `related_products` / `related_countries` groups (unique display_order per group). Get ≥2 published pages to link *to* the new page.
10. **Images** — hero block image_url verified (200 OK, https, sized ~1600w); optional: `seo_page_images` assignments if/when the image system goes live.
11. **QA query:**
```sql
select
  p.slug, p.status, p.robots,
  (select count(*) from seo_content_blocks b where b.page_id=p.id)  as blocks,   -- want 10
  (select count(*) from seo_page_products x where x.page_id=p.id)   as products, -- want 6
  (select count(*) from seo_internal_links l where l.source_page_id=p.id) as links_out,
  (select count(*) from seo_internal_links l join seo_pages sp on sp.id=l.source_page_id
     where l.target_page_id=p.id and sp.status='published')          as links_in,
  (select count(*) from seo_faqs f where f.is_active
     and (f.product_entity_id    is null or f.product_entity_id=p.product_entity_id)
     and (f.country_entity_id    is null or f.country_entity_id=p.country_entity_id)
     and (f.buyer_type_entity_id is null or f.buyer_type_entity_id=p.buyer_type_entity_id)) as faqs,
  exists (select 1 from country_assets ca where ca.country_entity_id=p.country_entity_id) as has_country_assets,
  p.slug not like '%/%' as slug_renderable
from seo_pages p where p.slug = 'custom-polo-shirt-manufacturer-uk';
```
12. **Render check** — `select get_landing_page_view('<slug>')` returns null (still draft) → flip `status='published'`, re-check JSON, load the page.
13. **Go index** — set `robots='index,follow'`, set `published_at`, confirm the URL appears in `/sitemaps/<group>.xml`.

---

## O. Recommended Lock Plan (before any scaling)

Priority order — steps 1–3 are the "stop the bleeding" set:

1. **Revoke anon/authenticated write grants** on all public tables; revoke EXECUTE on the three generators (+ legacy render RPC) from anon/authenticated. Zero frontend impact (verified: frontend only SELECTs via RPC + INSERTs quote_requests).
2. **Enable RLS everywhere** with the §K policy plan; keep quote_requests insert-only. Re-test: landing page, sitemap index, one group sitemap, RFQ submit.
3. **Pin `search_path`** on the seven flagged functions.
4. **Freeze the render contract:** treat `get_landing_page_view`'s JSON shape as versioned API; additive changes only.
5. **Fix publish-blockers:** `/quote` CTAs, product-card slug targets, nested guide slug, canonical host (one domain in both `get_sitemap_pages` and `NEXT_PUBLIC_SITE_URL`).
6. **Guard the master template:** page 2 is the seed for all generated copy — protect it editorially until the generator reads `seo_templates` instead.
7. **Decide the image system** (adopt `image_library`/`seo_page_images` or archive) so scaling doesn't double-write.
8. Add a pre-publish QA view/RPC encoding §N's checks, so "publish" is a query result, not a memory.

---

## P. Future Upgrade Roadmap (non-breaking order)

1. **Template-driven content generator** — rewrite `generate_content_blocks` to compose per-section copy from `seo_templates` variants (slot-unique table already built for exactly this), with placeholder interpolation from entities; stamp `source_template_id`. Kills the page-2-clone fragility and thin-content risk.
2. **Keyword pipeline hardening** — collision pre-flight (keyword slug vs existing page slugs), `paused` handling report, bulk import path.
3. **Auto internal-linking v2** — published-only targets, per-group caps, hub-and-spoke rules per entity cluster, and a `link_weight`/`is_manual` column so curated links can coexist inside generated groups.
4. **Product recommendation automation** — generator filling `seo_page_products` (same product family + shared country/buyer signals, priority-ranked, 6 cards, deterministic featured pick); later join `products` catalog via the already-present `product_id` FK for MOQ/pricing truth.
5. **Country asset enrichment** — one `country_assets` row per targeted country (only 2/9 exist); add per-country shipping copy from `shipping_zones/rates` when the quote engine lands.
6. **Quote conversion tracking** — start writing `quote_events` (view→start→submit) with an insert-only RLS policy mirroring quote_requests; wire `quote_configurations` into RFQSection instead of the hardcoded 300 MOQ.
7. **Sitemap v2** — parameterize `get_sitemap_pages(p_group text, p_chunk int)`; teach `/sitemaps/[group]` to parse `-N` chunk suffixes; consider a base-URL setting table instead of the hardcoded host.
8. **Admin panel** — service-role-only Next.js (or Supabase Studio + SQL snippets) for keywords, editorial rewrite, publish gates; never expose generators to the anon role again.
9. **Schema automation** — site-wide `Organization` JSON-LD in layout; per-page `BreadcrumbList` once hub pages exist; `Product` schema only when real pricing exists.
10. **Content quality scoring** — nightly job scoring pages (block word counts, similarity vs siblings, FAQ counts, link in/out) into a `page_quality` table; block `robots='index,follow'` flips below threshold.
11. **Sitemap locking** — publish requires passing the QA RPC (§O.8); optionally a `seo_pages.locked_at` column set on first indexation to alarm on slug/canonical changes.

---

## Appendix 1 — Relationship diagrams

**Render path:**

```
seo_keywords ──generate_seo_pages()──► seo_pages ◄── seo_entities (product/country/state/
                                          │            city/industry/buyer_type/material/service FKs)
                                          │
                    ┌─────────────────────┼──────────────────────┐
                    ▼                     ▼                      ▼
          seo_content_blocks      country_assets           (status='published' gate)
                    │                     │                      │
                    └───────────┬─────────┘                      │
                                ▼                                │
                 get_landing_page_view(page_slug) ◄──────────────┘
                                │  jsonb: page, country_assets, content_blocks,
                                │         faqs, products, internal_links
                                ▼
              Next.js /[slug]/page.tsx  (generateMetadata + render)
                                ▼
                    PSEOPageRenderer (order = sort_order)
                                ▼
   Hero · Intro · Stats · Customization · WhyUs · Process · BuyerSolutions ·
   RelatedProducts · RFQ (→ quote_requests INSERT) · FAQ (+FAQPage JSON-LD) · Footer
```

**Satellite joins:**

```
seo_pages ──► seo_page_products ──► seo_entities (product rows; attributes: image/moq/desc)
seo_pages ──► seo_internal_links ──► seo_pages (target; published-only at render)
seo_pages ──► seo_page_images ──► image_library      [dormant: only legacy RPC]
seo_pages ──(entity-scope match)── seo_faqs
seo_pages ──► seo_layout_variants ──► seo_layout_positions   [dormant]
seo_pages ──► quote_requests / quote_configurations / quote_events   [RFQ + future]
```

**Sitemap path:**

```
seo_pages (published + index,*) ──► get_sitemap_pages / get_sitemap_index
      ──► /sitemap.xml (index) ──► /sitemaps/<group>.xml (urlset)
```

## Appendix 2 — Open items marked "Needs confirmation"

1. Whether `seo_entities.is_active=false` products should be excluded from product cards (RPC doesn't filter today).
2. Which host is canonical: `www.1and9apparel.com` (hardcoded in `get_sitemap_pages`) vs the Vercel URL in `NEXT_PUBLIC_SITE_URL`.
3. Intended fate of the image-assignment system (`image_library`/`seo_page_images`) vs block-URL images — both are half-adopted.
4. Whether `seo_keywords` should be anon-readable at all (locked plan assumes no).
5. Whether the 2 published-but-noindex pages (hoodie USA, Canada) are deliberate staging or forgotten flips.
6. Whether `seo_templates` heading/body variants are final copy or placeholders awaiting the v2 generator.
