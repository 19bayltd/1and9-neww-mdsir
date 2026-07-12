# 1 & 9 Apparel — Full System Audit (Post-PR#4)

**Audit date:** 2026-07-09
**Audited state:** GitHub `main` @ `47eaea8` · Supabase project **1 & 9 SEO** (`sotbdgqytbatifkgbewb`, Postgres 17, ap-southeast-2)
**Method:** live `pg_catalog` / `information_schema` / `pg_get_functiondef` queries, Supabase advisors, full frontend source read, git history, GitHub PR history. **Read-only — nothing in code or DB was modified.**
**Supersedes:** `docs/DATABASE_MANUAL.md` and `docs/SYSTEM_CONSTITUTION.md` (both written against the **pre-PR#4** frontend; see §R for the correction table).

---

## A. Executive Summary

The system is a database-driven programmatic-SEO engine: 9 landing pages generated from 9 keywords, rendered by a Next.js 16 frontend through a single Supabase RPC. **PR#4 flipped the active render RPC from `get_landing_page_view` to `get_seo_page_render` and flipped the active image system from content-block/country-asset URLs to `image_library` + `seo_page_images` (assigned_images).** Yesterday's audit documents describe the old world and are stale on exactly those points.

**The five most important findings (current state):**

1. **CRITICAL — Security:** RLS is disabled on 32 of 33 tables and the `anon` key holds SELECT/INSERT/UPDATE/DELETE/TRUNCATE on every table, plus EXECUTE on the three generator functions. Anyone with the shipped anon key can rewrite or destroy the entire SEO system. Unchanged from yesterday; still the #1 blocker.
2. **CRITICAL — Draft gate removed:** the now-active `get_seo_page_render` has **no `status='published'` filter**. Any draft or archived page renders publicly the moment its slug is guessed. (Today all 9 pages happen to be published, so nothing is leaking *right now* — but the gate is gone.)
3. **HIGH — Canonical & robots regression:** the current frontend emits **no canonical tag and no robots meta at all**. The active RPC doesn't return `canonical_url`/`robots`, and `generateMetadata` doesn't render them. The old UI did. 8 of 9 pages are `noindex` in the DB but nothing tells Google that on-page.
4. **HIGH — Broken destination links:** all product cards link to `/{entity-slug}` (`/t-shirts`, `/hoodies`…) — no such pages exist → 404. Every content-block CTA points to `/quote?market=…` — no `/quote` route exists → 404. The guide page slug `guides/how-t-shirt-manufacturing-works` can never render (single-segment route).
5. **MEDIUM — Publish-state anomaly:** all 9 pages are now `status='published'` (yesterday: 3 published / 6 draft), but 8 of 9 are `robots='noindex,follow'`. Only `custom-t-shirt-manufacturer-usa` is indexable and in the sitemap. Whether the 8 noindex-published pages are deliberate staging is **Needs confirmation**.

**Verdict:** architecture is sound and can scale, but the system must not be scaled or publicly indexed until: the RLS/grants lock is applied, the render RPC regains a publish filter + canonical/robots fields, and the three broken-link classes are fixed. Full fix list in §V, lock plan in §W.

---

## B. Current Source of Truth (Part 1)

| Check | Result |
|---|---|
| Current branch (this workspace) | `claude/system-audit-post-pr4-8acczm` (audit branch, created from main) |
| Current HEAD commit | `47eaea8` — same as `origin/main` (working tree clean, no uncommitted work) |
| Current `origin/main` | `47eaea8` "Merge pull request #5" |
| Latest merged PRs | #5 (docs manual, merged 2026-07-09 06:46) ← #4 (`restore-old-ui-with-rpc`, merged 2026-07-08 10:33) ← #3 (superseded same-session variant, merged 10:33) ← #2 ← #1 |
| Is PR#4 in current main? | **Yes** — merge commit `69dc510` is an ancestor of `origin/main` |
| Vercel deployed from latest main? | **Needs confirmation.** This environment's network policy blocks requests to `*.vercel.app`, so the deployed commit could not be verified. Verify in the Vercel dashboard that the production deployment SHA is `47eaea8` (or at least ≥ `69dc510`). Marker to check by eye: hero/OG image should be the Unsplash `photo-1521572163474` t-shirt image (assigned_images system) and the `<head>` should contain **no** canonical tag — that is the PR#4 build. |
| Local source matches GitHub? | Yes — `git status` clean, HEAD == origin/main |
| Local-only / uncommitted work | None |

**Git history note:** PR#3 and PR#4 were merged one second apart from the same session; PR#4 (`restore-old-ui-with-rpc`) landed second and is the code that survives in `src/`. Supabase migration history shows `add_products_and_internal_links_to_get_seo_page_render` applied 2026-07-08 01:30 — i.e. the active RPC was amended (products + internal_links added) the same morning PR#4 merged. The base `get_seo_page_render` function itself has **no tracked creation migration** (created ad-hoc, e.g. via dashboard) — a reproducibility gap; its definition should be captured in a migration file.

**The real source of truth is:** GitHub `main` @ `47eaea8` + the live Supabase schema as captured in this document.

---

## C. Current Render Flow (Part 2)

### C.1 Actual execution path for `/custom-t-shirt-manufacturer-usa`

```
Browser: GET /custom-t-shirt-manufacturer-usa
  ↓
Next.js App Router: src/app/[slug]/page.tsx   (dynamic SSR, single-segment)
  ↓  getPage = cache(getSeoPageRender)  — one RPC call shared by
  ↓  generateMetadata() and the page component
src/lib/seo/getSeoPageRender.ts
  ↓  supabase.rpc("get_seo_page_render", { p_slug: slug })   [anon key]
Supabase RPC: public.get_seo_page_render(p_slug text) → jsonb
  ↓  reads: seo_pages, seo_content_blocks, seo_page_images ⨝ image_library,
  ↓         seo_faqs, seo_page_products ⨝ seo_entities, seo_internal_links ⨝ seo_pages
  ↓  returns { page, section_blocks[], assigned_images[], faqs[], products[], internal_links{} }
src/lib/seo/mapRpcToLandingProps.ts   (adapter → LandingPageData view-model)
  ↓  images resolved ONLY from assigned_images via src/lib/seo/imageResolver.ts
  ↓  country_assets forced to null (RPC doesn't return it)
src/components/landing/PSEOPageRenderer.tsx
  ↓  sorts blocks by sort_order (= seo_content_blocks.display_order)
  ↓  block_key → section component; unknown key → GenericBlock; RFQ force-appended if absent
HeroSection · IntroSection · StatsSection · IconGridSection×2 · ProcessSection ·
BuyerSolutionsSection · RelatedProductsSection · RFQSection · FAQSection · FooterTrustBar
  ↓
HTML (+ FAQPage JSON-LD from FAQSection)
```

- RPC error → 503-style UI. RPC returns SQL null / no `page.slug` → `notFound()` (404).
- `generateMetadata` emits: absolute `title` (meta_title), description, OG + Twitter cards with the assigned hero image. **It does NOT emit canonical or robots.**

### C.2 Part-2 checklist answers

| # | Question | Answer |
|---|---|---|
| 1 | Route rendering SEO pages | `src/app/[slug]/page.tsx` (single dynamic segment) |
| 2–3 | RPC called | **`get_seo_page_render`** (`get_landing_page_view` is no longer called anywhere; it survives only in a comment in `src/lib/landing.ts`) |
| 4 | Adapter files | `src/lib/seo/getSeoPageRender.ts` (fetch+normalize), `src/lib/seo/mapRpcToLandingProps.ts` (shape adapter), `src/lib/seo/imageResolver.ts` (image selection) |
| 5 | Components | `PSEOPageRenderer` + the 13 files in `src/components/landing/` |
| 6 | Active files | `src/app/[slug]/page.tsx`, `src/app/page.tsx`, `src/app/layout.tsx`, `src/app/sitemap.xml/route.ts`, `src/app/sitemaps/[group]/route.ts`, `src/lib/supabase.ts`, `src/lib/landing.ts` (types+`blockByKey` only), `src/lib/seo/*` (3 files), `src/types/seo.ts`, all `src/components/landing/*` |
| 7–8 | Dead / unused files | **No dead .ts/.tsx files remain** — PR#3/#4 deleted the old fetch path. Dead *code*: `LandingPage.canonical_url/robots/template/priority/published_at` and `CountryAssets`/`TrustBadge` types in `landing.ts` are typed but never populated (adapter passes `country_assets: null`). `supabase/cleanup_review.sql` is documentation, not executed. |
| 9 | Old visual UI preserved? | Yes — PR#4's whole point; the PR#2 landing design renders, fed by the new RPC through the adapter |
| 10 | Related products render? | Yes — `products[]` from the RPC (14 page-product rows) render as cards in RelatedProductsSection |
| 11 | Internal links render? | Yes — grouped `internal_links{}` render in the Helpful Links sidebar; BuyerSolutions cards keyword-match against them |
| 12–13 | FAQs / FAQ schema render? | Yes — accordion + FAQPage JSON-LD; schema respects `include_in_schema` (subset of visible FAQs — correct) |
| 14 | assigned_images render? | **Yes — now the ONLY image source.** Hero, section images, intro gallery, OG image all resolve from `assigned_images` |
| 15 | country_assets render? | **No.** RPC doesn't return it; adapter hardcodes `null`. Hero fallbacks, trust badges, currency chip, shipping text, factory message, country CTA are all dead at render time (data still in DB) |
| 16 | Canonical URL renders? | **No** — regression (old UI emitted `alternates.canonical`) |
| 17 | Robots metadata renders? | **No** — regression (old UI emitted `metadata.robots`); DB `noindex` flags have no on-page effect |
| 18 | Can draft pages render publicly? | **Yes** — `get_seo_page_render` has no status filter. Currently zero drafts exist, so nothing leaks today |
| 19 | Nested slugs render? | **No** — `/[slug]` matches one segment; page 10 (`guides/how-t-shirt-manufacturing-works`) is unreachable (404) |
| 20 | CTA URLs point to existing routes? | **No** — all block CTAs → `/quote?market=us|canada` (route doesn't exist); product cards → `/t-shirts` etc. (no pages); BuyerSolutions unmatched cards → `#rfq` (fine) |

---

## D. Current RPC / Function Audit (Part 3)

### D.1 Function inventory (all 11 public functions, live `pg_get_functiondef`)

| Function | Args | Returns | Security | search_path | Tables touched | Frontend | Sitemap | Generator/Admin | Status / Risk |
|---|---|---|---|---|---|---|---|---|---|
| `get_seo_page_render` | `p_slug text` | jsonb | INVOKER, STABLE | **NOT pinned** ⚠ | seo_pages, seo_content_blocks, seo_page_images, image_library, seo_faqs, seo_page_products, seo_entities, seo_internal_links | **YES — the active render RPC** | no | no | **ACTIVE.** No publish filter (CRITICAL); no canonical/robots in payload (HIGH) |
| `get_landing_page_view` | `page_slug text` | jsonb | INVOKER, STABLE | pinned ✔ | seo_pages, country_assets, seo_content_blocks, seo_faqs, seo_page_products, seo_entities, seo_internal_links | **no (since PR#4)** | no | no | **LEGACY.** Well-built (published-only, canonical/robots, country_assets). Candidate: keep archived or fold its filters into the active RPC |
| `get_sitemap_index` | `chunk_size int = 5000` | table | INVOKER, STABLE | pinned ✔ | seo_pages | via `/sitemap.xml` | **YES** | no | ACTIVE, healthy |
| `get_sitemap_pages` | — | table | INVOKER, STABLE | pinned ✔ | seo_pages | via `/sitemaps/[group]` | **YES** | no | ACTIVE. Hardcodes host `https://www.1and9apparel.com` (mismatch risk); returns ALL groups (O(N) filter in JS) |
| `generate_seo_pages` | — | table | INVOKER | not pinned ⚠ | seo_keywords → seo_pages (INSERT…ON CONFLICT slug DO UPDATE) | no | no | **YES** | Admin. **anon-executable** (CRITICAL grant issue) |
| `generate_content_blocks` | — | table | INVOKER | not pinned ⚠ | seo_pages, seo_content_blocks (INSERT, clones page 2) | no | no | **YES** | Admin. anon-executable; thin-content factory (see §H) |
| `generate_internal_links` | — | table | INVOKER | not pinned ⚠ | seo_pages, seo_internal_links (DELETE `auto_related` + INSERT) | no | no | **YES** | Admin. anon-executable; destructive delete step |
| `set_updated_at` | trigger | trigger | INVOKER | not pinned ⚠ | (row NEW) | — | — | trigger on 9 tables | Fine; pin search_path |
| `validate_seo_page_entities` | trigger | trigger | INVOKER | not pinned ⚠ | seo_entities | — | — | trigger on seo_pages | Good guard; pin search_path |
| `validate_seo_page_product_entity` | trigger | trigger | INVOKER | not pinned ⚠ | seo_entities | — | — | trigger on seo_page_products | Good guard |
| `validate_quote_request_entities` | trigger | trigger | INVOKER | not pinned ⚠ | seo_entities | — | — | trigger on quote_requests | Good guard |

EXECUTE on **every** function is granted to `anon`, `authenticated`, `postgres`, `service_role`, and PUBLIC (`-`). Supabase advisors: 32 × `rls_disabled_in_public` (ERROR) + 8 × `function_search_path_mutable` (WARN) + 1 × always-true INSERT policy (WARN, expected for the RFQ form).

### D.2 Deep audit — the ACTIVE render RPC `get_seo_page_render(p_slug)`

1. **Input:** one arg `p_slug text`. Matched with `where p.slug = p_slug limit 1`.
2. **Page lookup:** exact slug equality against `seo_pages`. `limit 1` is redundant (slug is UNIQUE) but harmless.
3. **`status='published'` filter:** **ABSENT.**
4. **Returns drafts:** yes.
5. **Returns archived:** yes.
6. **`page` object fields:** `id, slug, title, h1, meta_title, meta_description, layout_variant_id`. **Missing vs old RPC:** `canonical_url, robots, template, priority, hero_image_url, published_at, updated_at`.
7. **`section_blocks[]` fields:** `id, section_key, block_key` (both = `block_key`), `title, heading` (both = `heading`), `body, cta_label, cta_url, image_url, image_alt, position` (= `display_order`), ordered by `display_order`. Coalesces to `[]`.
8. **`assigned_images[]` (image fields):** from `seo_page_images spi JOIN image_library il`, both `is_active=true`, ordered by `(section_name, display_order)`: `id` (spi.id), `section_name, display_order, is_primary` + `image_id, image_key, image_url, alt` (= `alt_template`), `image_type, section_target, width, height`.
9. **`faqs[]` fields:** `id, question, answer, priority, display_order, include_in_schema` where `is_active` and each of `product/country/buyer_type_entity_id` is NULL-or-matches the page. Ordered `display_order, priority desc`.
10. **`products[]` fields:** from `seo_page_products pp JOIN seo_entities e`: `sort_order` (display_order), `is_featured`, `slug` (**entity** slug — source of the 404s), `title` (card_title → entity name), `description` (card_description → `attributes->>'card_description'`), `cta_text`, `moq` (pp.moq → `attributes->>'moq'`), `image_url` (image_override_url → `attributes->>'image_url'`). Ordered by display_order. **No `e.is_active` filter** — deactivated entities still render.
11. **`internal_links{}`:** object keyed by `link_group`; each item `{anchor (anchor_text → target title), slug (target page slug), sort_order}`; **targets filtered to `tp.status='published'`** (the only place a publish filter survives). Coalesces to `{}`.
12. **Country asset fields:** **none** — not queried.
13. **Canonical fields:** none. 14. **Robots fields:** none.
15. **Ordering:** deterministic everywhere (display_order / section_name+display_order / display_order+priority desc).
16. **Null handling:** every collection `coalesce`d to `[]`/`{}`; nonexistent slug → SQL NULL → frontend 404; frontend re-normalizes nulls defensively.
17. **Security risks:** no publish gate (draft/archived leak); `search_path` not pinned (SECURITY INVOKER + anon's default path mitigates, but pin it — advisor WARN); executable by PUBLIC/anon (correct for a render RPC, but only once the publish gate exists).
18. **Frontend dependency risks:** `src/types/seo.ts` mirrors this shape exactly; imageResolver depends on `section_target ∈ {hero,factory,quality,products,customization}` and `section_name`; PSEOPageRenderer depends on the 10-key block vocabulary; RelatedProductsSection depends on `products[].slug` being a *routable* slug (currently violated).
19. **What breaks if changed:** removing/renaming any key in `page`/`section_blocks`/`assigned_images`/`faqs`/`products`/`internal_links` breaks the adapter silently (fields go undefined → sections quietly skip). Adding keys is safe. Adding a `status='published'` filter changes not-found behavior for drafts (desired). Emitting page-slug instead of entity-slug in `products[].slug` changes card links (desired, coordinate with any future product hub pages).

### D.3 Contract snapshot (freeze this)

```
get_seo_page_render(p_slug) → {
  page: { id, slug, title, h1, meta_title, meta_description, layout_variant_id } | null-doc,
  section_blocks: [ { id, section_key, block_key, title, heading, body,
                      cta_label, cta_url, image_url, image_alt, position } ],
  assigned_images: [ { id, image_id, image_key, image_url, alt, image_type,
                       section_name, section_target, display_order, is_primary, width, height } ],
  faqs:            [ { id, question, answer, priority, display_order, include_in_schema } ],
  products:        [ { slug, title, description, cta_text, moq, image_url, sort_order, is_featured } ],
  internal_links:  { <link_group>: [ { anchor, slug, sort_order } ] }
}
```

---

## E. Database Map (Part 4)

33 public tables. Exact row counts (live, 2026-07-09). RLS ON only for `quote_requests`. `anon`+`authenticated` hold ALL privileges on ALL tables (the lock plan in §W removes this).

### E.1 CORE (active render/write path — 9 tables)

| Table | Rows | Purpose | Used by |
|---|---|---|---|
| `seo_pages` | 9 | Page registry: slug, meta, entity wiring, status/robots/sitemap | render RPC, sitemap RPCs, generators, home page (direct SELECT), links |
| `seo_content_blocks` | 90 | Per-page section content (10 blocks/page) | render RPC, generate_content_blocks |
| `seo_page_images` | 45 | Page ⨝ image assignments (5/page: hero, factory, quality, products, customization) | render RPC (assigned_images) |
| `image_library` | 5 | Central image pool (image_key, url, section_target, alt_template) | render RPC via seo_page_images; `seo_pages.meta_image_id` FK |
| `seo_faqs` | 10 | Scoped FAQ pool (global / per product / country / buyer_type) | render RPC |
| `seo_page_products` | 14 | Page ⨝ product-entity cards (order, featured, cta, moq, overrides) | render RPC |
| `seo_entities` | 45 | Master vocabulary (product/country/state/…) | render RPC (product join), generators, triggers, FKs everywhere |
| `seo_internal_links` | 60 | Directed link graph in named groups | render RPC, generate_internal_links |
| `quote_requests` | 1 | RFQ lead inbox (the only anon WRITE path; RLS ON, insert-only policy) | RFQSection insert |

### E.2 SUPPORTING (referenced but not rendered — 4 tables)

| Table | Rows | Purpose / status |
|---|---|---|
| `seo_keywords` | 9 | Keyword→entity source for `generate_seo_pages`. Generator-only |
| `seo_templates` | 6 | Variant copy templates (`{{product_name}}`, `{{location_name}}`); FK target of `seo_content_blocks.source_template_id`; **no function reads it yet** — designated future generator source |
| `seo_layout_variants` | 5 | layout_a–e; `seo_pages.layout_variant_id` (all pages = 1); RPC returns the id, frontend ignores it |
| `country_assets` | 2 | US + Canada hero/OG/badges/currency/CTA. **Orphaned by PR#4** — only `get_landing_page_view` (legacy) reads it. Data is real; decide: re-attach to render RPC or archive |

### E.3 FUTURE (quote/logistics domain, dormant — 7 tables)

`quote_configurations` (3), `quote_customization_options` (6), `quote_events` (0), `product_pricing_tiers` (0), `products` (0), `shipping_zones` (4), `shipping_rates` (2). No function or frontend touches them (frontend hardcodes MOQ 300 instead of reading `quote_configurations` — see §Q). Keep for the quote-engine roadmap.

### E.4 LEGACY / UNUSED (four abandoned generations — 12 tables)

| Generation | Tables (rows) | Evidence of death |
|---|---|---|
| Gen-1 sections | `seo_section_blocks` (9), `seo_block_items` (0), `seo_images` (8), `seo_section_images` (0) | No function references; only intra-group FKs |
| Gen-2 libraries | `seo_content_library` (0), `seo_page_content_assignments` (0), `seo_image_library` (0), `seo_page_image_assignments` (0) | All empty; no references |
| Gen-2.5 media | `seo_media_assets` (4), `seo_page_media` (5) | No function references |
| Gen-3 product catalog | `seo_products` (0), `seo_product_images` (0) | Empty; no references |
| Layout engine (half-legacy) | `seo_layout_positions` (50) | No function reads it; the real order source is `seo_content_blocks.display_order` |

**DANGEROUS classification:** none of the tables is dangerous per se — the danger is the *grants* (every table anon-writable) and the anon-executable generators.

Constraint/trigger/index inventory per table is in §F. Triggers exist on exactly 9 tables: `set_updated_at` on seo_entities, seo_pages, seo_content_blocks, seo_templates, seo_faqs, seo_internal_links, seo_page_products, country_assets, quote_requests; plus the three `validate_*` entity-type triggers on seo_pages, seo_page_products, quote_requests.

---

## F. Table-by-Table Field Manual (Part 5)

Format per column: **name** · type · null? · default → purpose / validation / FK / who reads it / risk if wrong.
"RPC" below = the active `get_seo_page_render`. "FE" = frontend. Safe-to-change verdicts assume the §W lock is applied first.

### F.1 `seo_pages` (9 rows) — the page registry. PK `id`. UNIQUE `slug`; UNIQUE entity combo `(template, product, country, state, city, industry, buyer_type) NULLS NOT DISTINCT`.

| Column | Type | Null/Default | Purpose & contract |
|---|---|---|---|
| `id` | bigint | NOT NULL identity | PK. FK target for blocks/links/products/images/quotes. Never reuse. |
| `slug` | text | NOT NULL | URL path. CHECK kebab-case, **allows nested `a/b`** (frontend can't route nested — mismatch). UNIQUE. RPC lookup key. Risk if wrong: page unreachable / wrong page served. Do not change after indexing. |
| `product_entity_id` … `buyer_type_entity_id` (6 cols) | bigint | NULL, FK→seo_entities RESTRICT | Page meaning. CHECK ≥1 of the 6 non-null; trigger enforces entity_type matches column. Drives FAQ matching, link generation, combo uniqueness. Risk: wrong FAQ/link/product targeting. |
| `material_entity_id`, `service_entity_id` | bigint | NULL, FK→seo_entities RESTRICT | Copied from keyword; **not part of combo key, not used in FAQ matching** — informational today. Safe to backfill. |
| `keyword_id` | bigint | NULL, FK→seo_keywords SET NULL | Provenance. `generate_content_blocks`/`generate_internal_links` only process pages where NOT NULL. Manual pages without it are invisible to generators (feature, not bug). |
| `title` | text | NOT NULL | Display title; anchors fall back to it. FE fallback for H1. |
| `h1` | text | NOT NULL | On-page H1 (hero heading falls back h1→title). |
| `meta_title` | text | NOT NULL, CHECK ≤120 | `<title>` (absolute, brand suffix included). Live values 54–64 chars ✔. |
| `meta_description` | text | NOT NULL, CHECK ≤250 | Meta description + hero body fallback. Live 128–153 ✔. |
| `canonical_url` | text | NULL, CHECK `/…` or `https://…` | **Currently dead at render time** (RPC omits, FE never emits). Used by `get_sitemap_pages` (coalesced onto hardcoded host). All 9 currently NULL. |
| `robots` | text | NOT NULL default `index,follow`, CHECK 4 combos | Sitemap gate (only `index,*` enter). **Not emitted on-page** (regression). 8/9 rows `noindex,follow`. |
| `hero_image_override_url` | text | NULL, CHECK https | Legacy hero override — only `get_landing_page_view` reads it. Dead in active path. All NULL. |
| `status` | text | NOT NULL default `draft`, CHECK draft/published/archived | Publish gate for sitemap + internal-link targets + home list. **NOT enforced by the active render RPC** (bug). CHECK: published ⇒ published_at NOT NULL. |
| `priority` | numeric | NOT NULL default 0.5, CHECK 0–1 | Sitemap ordering + link-candidate ranking. |
| `template` | text | NOT NULL, CHECK `^[a-z0-9_]+$` | Page family (`product_country`, `product_state`, `product_buyer_type`, `guide`). Combo-key component; `generate_internal_links` guide clause keys off it. |
| `published_at` | timestamptz | NULL | First-publish timestamp (CHECK-coupled to status). |
| `created_at`/`updated_at` | timestamptz | NOT NULL now() | `updated_at` maintained by trigger; feeds sitemap `<lastmod>`. |
| `sitemap_group` | text | NOT NULL, CHECK kebab | Sitemap chunking key (`manufacturer`, `country`, `state`, `private-label`, `guide`). Groups the `/sitemaps/<group>.xml` files. |
| `layout_variant_id` | bigint | NULL, FK→seo_layout_variants | Future layout engine; RPC returns it, FE ignores. All = 1. |
| `meta_image_id` | bigint | NULL, FK→image_library | Intended OG override; **no RPC returns it** — dormant. All NULL. |

Safe to change later: `material/service_entity_id`, `meta_image_id`, `layout_variant_id`, `priority`. Locked once indexed: `slug`, `canonical_url` policy, `template`, entity ids.

### F.2 `seo_content_blocks` (90 rows) — page sections. PK `id`. UNIQUE `(page_id, block_key)` and `(page_id, display_order)`.

| Column | Notes |
|---|---|
| `page_id` bigint NOT NULL FK→seo_pages CASCADE | Owning page. Cascade delete with page. |
| `block_key` text NOT NULL CHECK `^[a-z0-9_]+$` | Section identity. Live vocabulary (exactly 10 per page, same order): `hero, intro, manufacturing_overview, customization_options, why_choose_us, production_process, buyer_solutions, related_products, rfq, faq`. FE maps each to a component; unknown → GenericBlock. Never rename/repurpose. |
| `display_order` smallint NOT NULL CHECK ≥1 | THE section-order source (RPC `position`). Unique per page → deterministic. |
| `heading`, `body` text NULL | Copy. CHECK: at least one of heading/body/cta_label/image_url non-null. |
| `cta_label`+`cta_url` | CHECK pair (both or neither); URL CHECK `/…` or https. Live CTAs all `/quote?market=…` → **broken route**. |
| `image_url`+`image_alt` | CHECK https; alt required if url. **Ignored by FE since PR#4** (adapter uses assigned_images only). 9 rows (hero blocks) still carry URLs incl. a th.bing.com thumbnail — harmless but stale. |
| `source_template_id` bigint NULL FK→seo_templates SET NULL | Provenance for future template generation. All NULL today. |

Risk: deleting a row removes a section silently; changing `display_order` reorders the page. Duplication evidence: only `intro` bodies are unique per page (9 distinct); `manufacturing_overview/why_choose_us/production_process/buyer_solutions/related_products/rfq` bodies have **2 distinct values across 9 pages** (clone output) — thin-content risk at scale (§H).

### F.3 `seo_page_images` (45 rows) — image assignments (ACTIVE image system). PK `id`. UNIQUE `(page_id, section_name, image_id)`.

| Column | Notes |
|---|---|
| `page_id` FK→seo_pages CASCADE; `image_id` FK→image_library CASCADE | Join row. |
| `section_name` text NOT NULL | Assignment slot. Live values = `hero, factory, quality, products, customization` (identical 5 per page, every page maps to the same 5 library images — placeholder era). |
| `display_order` int default 1 | Tie-break within a slot (RPC orders by section_name, display_order). |
| `is_primary` bool default false | Hero disambiguation: resolver prefers `is_primary` in the hero slot. 1 per page (the hero row). |
| `is_active` bool default true | RPC filters `= true`. Soft-off switch. |

Risk if wrong: page loses hero/OG image (FE degrades to dark band, `summary` twitter card). This is now the **canonical image system — lock it**.

### F.4 `image_library` (5 rows) — image pool. PK `id`. UNIQUE `image_key`.

`image_key` (stable handle) · `image_url` NOT NULL (all 5 are Unsplash demo images) · `image_type` (hero/factory/quality/product/customization) · `section_target` (resolver match key: hero/factory/quality/products/customization) · `alt_template` NOT NULL (rendered as alt/OG alt) · `width/height` (returned, unused by FE) · targeting columns `product_type/fabric_type/gsm_min/gsm_max/country/buyer_intent` (all NULL — future contextual selection) · `file_format` default webp · `sort_order` · `is_active` (RPC filters). Risk: a dead `image_url` breaks hero visuals sitewide (all 9 pages share these 5 rows). **Replace Unsplash demo URLs with owned CDN assets before indexing.**

### F.5 `seo_faqs` (10 rows) — FAQ pool. PK `id`. UNIQUE `(lower(question), product, country, buyer_type) NULLS NOT DISTINCT` and `(product, country, buyer_type, display_order) NULLS NOT DISTINCT`.

`question` CHECK 8–300 chars · `answer` CHECK 20–1200 · scoping trio `product_entity_id/country_entity_id/buyer_type_entity_id` each NULL=global, composite typed FK (`(id, entity_type)`) RESTRICT ensures correct entity type without triggers · `priority` smallint ≥0 (sort tiebreak desc) · `display_order` ≥1 (primary sort, unique per scope) · `include_in_schema` bool (JSON-LD gate) · `is_active` (RPC filter). Matching = AND of NULL-or-equal per dimension: page 2 (t-shirts+USA) gets 5 global + 3 US + 2 t-shirt = 10; Canada/Australia pages get 5 global + product FAQs. Risk: near-duplicate question text across scopes is allowed by the index (unique only within scope) — dedupe editorially.

### F.6 `seo_page_products` (14 rows) — product cards. PK `id`. UNIQUE `(page_id, display_order)`, `(page_id, product_entity_id)`.

`page_id` FK CASCADE · `product_entity_id` FK→seo_entities RESTRICT + trigger enforces type='product' · `display_order` ≥1 · `is_featured` (badge; live data: pages 4–10 have exactly 1 featured card; page 2 features t-shirts among 6 cards; page 3's single hoodie card is NOT featured — inconsistency) · `cta_text` (card CTA label; live oddity: polo/sweatshirt/canada pages say "Get T-Shirt Pricing" on non-t-shirt cards) · `card_title/card_description/moq/image_override_url` (per-page overrides; fallback chain → entity attributes) · `product_id` FK→products SET NULL (all NULL — future link to the structured catalog). Risk: the RPC emits the **entity** slug as card link target → 404 until product hub pages exist or the RPC swaps to page slugs.

### F.7 `seo_entities` (45 rows) — master vocabulary. PK `id`. UNIQUE `(entity_type, slug)`. See §G for the system audit.

`entity_type` CHECK ∈ 14 values (product, country, state, city, industry, buyer_type, material, fabric, certification, customization, shipping_zone, keyword, intent, service) · `slug` CHECK kebab (unique per type, NOT globally — `/t-shirts` card links rely on it being routable, which it isn't) · `name` NOT NULL (display + anchor fallback) · `parent_id` FK self RESTRICT, CHECK only state/city may have parents (California→United States is the only live edge) · `attributes` jsonb NOT NULL `{}` (products 6–11 carry `moq`, `image_url`, `card_description`; country 2 carries `iso2`, `priority_tier`) · `is_active` (only partial-index consumers filter it; **render RPC does NOT** — deactivating an entity does not hide its product cards). Risk: entity duplication poisons everything downstream (see §G.5).

### F.8 `seo_internal_links` (60 rows) — link graph. PK `id`. UNIQUE `(source, group, target)` and `(source, group, display_order)`. CHECK no self-link, group kebab, anchor 1–150, order ≥1. FKs both ends → seo_pages CASCADE. Groups live: `auto_related` 48 (generator-owned, 6 per page for 8 pages / rebuilt on each run), `related_products` 7, `related_countries` 2, `related_buyer_types` 1, `related_guides` 1, `related_states` 1 (manual, curated — irreplaceable). `anchor_text` NULL → RPC falls back to target page title (3 live NULLs, fine). Render-time filter: target must be published.

### F.9 `quote_requests` (1 row) — lead inbox. RLS **ON**; single policy `quote_requests_public_insert` (INSERT, anon+authenticated, WITH CHECK true). anon gets zero rows on SELECT (no SELECT policy) — write-only mailbox. Columns: `source_page_id`/`source_slug` (attribution; FE sends both), `product_entity_id`/`country_entity_id` (typed-FK validated via trigger; **FE currently leaves them NULL** and composes product/country/timeline into `message`), `company_name`, `email` NOT NULL CHECK regex, `phone` CHECK regex, `quantity` NOT NULL CHECK ≥1, `message` CHECK ≤5000, `attachment_url` CHECK https, `status` CHECK new/contacted/quoted/won/lost/spam default new, `assigned_to`, `keyword_id` FK SET NULL, timestamps + updated_at trigger.

### F.10 Supporting tables (compact)

- **`seo_keywords` (9):** `keyword` UNIQUE · `slug` UNIQUE (becomes page slug verbatim — including the nested `guides/…` one) · `keyword_group` · `keyword_type` (→ page.template and sitemap_group after `_`→`-`) · `intent` CHECK buy/price/guide/comparison/location · 8 entity FKs (RESTRICT) · `priority` 0–1 · `status` CHECK active/paused/archived (generator consumes `active` only). Risk: keyword slug typo permanently captures/creates the page slug; entity mis-wiring propagates to the page on next generator run (upsert overwrites entity ids).
- **`seo_templates` (6):** `section_key` + `variant_number` ≥1 · optional typed-FK scoping (product/buyer_type/country composite FKs) · `heading` NULL, `body` NOT NULL (contains `{{product_name}}`/`{{location_name}}` placeholders) · `is_active` + partial index. Read by nothing yet — the intended replacement for the clone generator.
- **`seo_layout_variants` (5) / `seo_layout_positions` (50):** layout_a–e each with 10 positioned section keys (`position`, `is_fixed`). Dormant layout engine; only `layout_variant_id` surfaces (ignored). Decide with the layout roadmap; harmless to keep.
- **`country_assets` (2):** one row per country entity (UNIQUE country_entity_id; composite typed FK CASCADE). All content columns NOT NULL: hero/meta image (https CHECK), `trust_badges` jsonb array CHECK, `shipping_text`, `currency_code` CHECK `^[A-Z]{3}$`, `cta_label`, `cta_url` CHECK, `factory_message`. **Orphaned by PR#4** (only legacy RPC reads it). Canada row's hero/meta URLs are th.bing.com thumbnails (108px) — junk data if ever re-activated.

### F.11 Future quote/logistics tables (compact)

`quote_configurations` (3; per-page min_moq 300/currency USD/incoterm DDP/response time — FE hardcodes these instead) · `quote_customization_options` (6; option_key/name/type/price_note) · `quote_events` (0; funnel telemetry, FKs to quote_requests/pages/keywords) · `products` (0; structured catalog: pricing, weights, cartons, production days; FK target of seo_page_products.product_id) · `product_pricing_tiers` (0; qty-band pricing per product entity) · `shipping_zones` (4; zone_key, countries[]) · `shipping_rates` (2; per-zone per-kg rates, DDP). All unreferenced by code; keep, lock to admin-only.

### F.12 Legacy tables (columns preserved in `supabase/cleanup_review.sql`; do not build on them)

Gen-1: `seo_section_blocks` (9 rows for page 2, superseded by seo_content_blocks), `seo_block_items` (0), `seo_images` (8 Unsplash rows), `seo_section_images` (0). Gen-2: `seo_content_library`, `seo_page_content_assignments`, `seo_image_library`, `seo_page_image_assignments` (all 0). Gen-2.5: `seo_media_assets` (4), `seo_page_media` (5). Gen-3: `seo_products` (0, rich catalog schema), `seo_product_images` (0). Archive → drop after backup, in the dependency order documented in `cleanup_review.sql`.

---

## G. Entity System (Part 6)

1. **What `seo_entities` does:** it is the single polymorphic vocabulary table — every noun the system can talk about (a product, a country, a buyer type…) is one row. Pages, keywords, FAQs, product cards, quote requests and country assets all point at it by id. Entities are *meaning*; pages are *grammar* (a page = a combination of entity ids + a template).
2. **Entity types in the CHECK:** product, country, state, city, industry, buyer_type, material, fabric, certification, customization, shipping_zone, keyword, intent, service (14 allowed). **Live types:** product 17, country 9, buyer_type 5, service 5, industry 4, material 4, state 1. Empty: city, fabric, certification, customization, shipping_zone, keyword, intent.
3. **Product entities (17):** 6 "real" ones (ids 6–11: t-shirts, hoodies, polo-shirts, sweatshirts, tank-tops, long-sleeve-tees) carry full attributes (`moq: 300`, `image_url` on cdn.1and9apparel.com, `card_description`) and power the product cards. 11 later ones (leggings, uniform, sweatshirt, hoodie, polo-shirt, tank-top, shorts, jacket, t-shirt, crop-top, joggers) have empty attributes — several are **singular/plural duplicates of the first six**.
4. **Country entities (9):** united-states, canada, australia (used by pages; US has iso2+priority_tier) + uk, germany, uae, france, netherlands, and **`usa` — a duplicate of `united-states`**.
5. **State entities (1):** california (parent → united-states). The only parent-child edge.
6. **City entities:** none yet (type reserved; parent CHECK ready).
7. **Industry entities (4):** school, gym, restaurant, hospital — not yet referenced by any page/keyword; they exist to feed BuyerSolutions-style pages later.
8. **Buyer-type entities (5):** private-label-brands (used by page 9), corporate-buyer, streetwear-brand, startup-brand, and **private-label-brand — duplicate of private-label-brands**.
9. **Material entities (4):** organic-cotton, combed-cotton, french-terry, fleece. Unreferenced so far.
10. **Service entities (5):** private-label, oem, odm, screen-printing, embroidery. Unreferenced so far.
11. **Keyword-type entities:** the `keyword` and `intent` entity types are allowed by the CHECK but empty — keywords live in their own table (see 20 below).
12. **Hierarchy:** `parent_id` self-FK, RESTRICT, CHECK restricted to state/city rows. Live: california→united-states. Cities would chain city→state(→country).
13. **Entities→pages:** 8 nullable FK columns on `seo_pages` (6 in the combo key + material/service), trigger-validated for type. A page's identity = its entity combination + template (UNIQUE NULLS NOT DISTINCT).
14. **Entities→keywords:** same 8 FK columns on `seo_keywords`; the generator copies them keyword→page verbatim.
15. **Entities→FAQs:** the scoping trio (product/country/buyer_type) with composite typed FKs; NULL = global.
16. **Entities→products:** `seo_page_products.product_entity_id` (+ trigger); card content falls back to entity `attributes`.
17. **Entities→internal linking:** `generate_internal_links` ranks candidate targets by shared product (1) > shared country (2) > shared buyer_type (3) — the link graph is literally entity-similarity.
18. **What must never be duplicated:** one real-world concept = one entity row, ever. Also: never two entities of the same type with slugs that alias each other (see 19/20).
19. **Fields required before scaling:** every *product* entity used on cards needs `attributes.moq`, `attributes.image_url`, `attributes.card_description` (or per-page overrides); every *country* targeted needs iso2 (+ country_assets row if that system is revived); every state/city needs `parent_id`.
20. **Entity mistakes that can destroy the system:** (a) the **live duplicates** — `usa`/`united-states`, `t-shirt`/`t-shirts`, `hoodie`/`hoodies`, `polo-shirt`/`polo-shirts`, `sweatshirt`/`sweatshirts`, `tank-top`/`tank-tops`, `private-label-brand`/`private-label-brands`. If future keywords wire to the singular twins, the combo-uniqueness key silently stops protecting you (two "t-shirt USA" pages become legal), FAQ matching splits, and internal-link clustering fractures. **Merge or deactivate the duplicates before adding keywords.** (b) Re-typing an entity (blocked by triggers — keep them). (c) Deleting an entity (blocked by RESTRICT FKs — keep them). (d) Renaming slugs after cards/links reference them.

**Keywords vs entities:** keywords live in `seo_keywords`, one row per search phrase, with its own slug and priority. A keyword is *demand* (what people type); an entity is a *concept* (what the business sells/serves). Many keywords can point at the same entity combination — the combo-unique index on pages is what stops two keywords producing two near-identical pages (currently: it upserts by slug, then the combo key rejects a second page with the same meaning). Never put keyword phrases into `seo_entities`.

---

## H. Page Generation System (Part 7)

**Pipeline:** `seo_keywords` (status=active) → `generate_seo_pages()` → `seo_pages` → `generate_content_blocks()` → `seo_content_blocks` → `generate_internal_links()` → `seo_internal_links` → editorial pass → flip `status` + `robots`.

1. **Keyword→page:** `generate_seo_pages()` inserts one page per active keyword: slug = keyword.slug (verbatim), all 8 entity ids copied, `title` = `h1` = `initcap(keyword)`, `meta_title` = initcap + " | 1 & 9 Apparel", boilerplate `meta_description`, `canonical_url` = `/`+slug, robots `noindex,follow`, template = keyword_type, **status `draft`**, priority = keyword.priority, sitemap_group = keyword_type with `_`→`-`.
2. **Slug creation:** never derived — it *is* the keyword slug. A typo there is a permanent URL. (Note: the 9 live pages have `canonical_url` NULL, so they predate or were edited after generation.)
3. **Entity copy:** verbatim, then re-validated by the seo_pages trigger.
4. **Title/H1/meta:** naive initcap ("Usa" style bugs are possible; live pages have been hand-fixed — meta lengths 54–64/128–153 are human).
5. **Status/robots:** born draft + noindex — safe-by-default. **Publishing requires two explicit flips.**
6. **sitemap_group:** from keyword_type; live groups manufacturer/country/state/private-label/guide. (Note: pages 3–5 are `manufacturer` but keyword_type `product_country` — hand-edited groups; fine.)
7. **priority:** copied from keyword; used for sitemap ordering and link ranking only (not exported to Google as `<priority>`).
8. **Canonical:** should be a *policy*, not per-row art: either always NULL (and render `https://<host>/<slug>` from one env var) or always absolute on the final domain. Today: all NULL + RPC omits it + FE omits it → no canonical anywhere (fix before indexing).
9. **On conflict:** `ON CONFLICT (slug) DO UPDATE` — refreshes keyword_id + all entity ids + updated_at **only**. Editorial fields (title/h1/meta/status/robots) survive re-runs.
10. **Is generation safe?** Mostly: draft+noindex birth, upsert preserves editorial work, triggers validate entities. Unsafe parts: anon can execute it; a keyword slug edit re-captures an existing page's entity wiring silently; `initcap` quality.
11. **Can the generator overwrite manual work?** `generate_seo_pages`: no (entity wiring only). `generate_content_blocks`: no (it skips pages that already have any block). `generate_internal_links`: **yes, for `auto_related` only** — full delete+rebuild of that group each run; curated groups untouched.
12. **Born draft/noindex?** Yes (see 5).
13. **Thin/duplicate content risk:** **HIGH.** `generate_content_blocks` clones page 2's ten blocks with three string replacements (H1 swap; "custom t-shirt manufacturer"→lower(title); "USA"→country name or "global markets"). Live proof: 7 of 10 block types have only **2 distinct bodies across 9 pages** (§F.2). At 9 noindex pages this is harmless; at 1,000 indexed pages it is scaled-content-abuse territory.
14. **Must fix before 1,000+ pages:** (a) replace the clone with `seo_templates`-driven variant assembly (table exists, is scoped per entity, unread today); (b) kill the hardcoded `page_id = 2` master; (c) make generators service-role-only; (d) add batching (`where id > last_id limit N`) so runs don't lock everything; (e) unique-content QA gate before any robots flip.

---

## I. Content Block System (Part 8)

1. **Storage:** one row per section per page in `seo_content_blocks` (90 = 9×10). No HTML — plain text; FE splits `body` on blank lines into paragraphs.
2. **Order:** `display_order` (unique per page) → RPC `position` → FE sort. Single source of truth.
3. **`block_key`:** the section's semantic identity and the FE component switch key.
4. **`section_key`:** exists only as an RPC alias of `block_key` (emitted twice for adapter compatibility). In legacy `seo_section_blocks` it was a real column — ignore that table.
5. **Sections that exist (all 9 pages, same order 1–10):** hero, intro, manufacturing_overview, customization_options, why_choose_us, production_process, buyer_solutions, related_products, rfq, faq.
6. **Hero:** block heading→h1→title; body→meta_description; hero image from assigned_images (block image_url ignored); MOQ chip from min(products moq); quantity placeholder likewise. Rendered outside the numbered shell.
7. **Intro:** heading/body + image grid = gallery (non-hero assigned images) → padded with product images if fewer than 4 tiles.
8. **Manufacturing (StatsSection):** heading/body + **hardcoded stat tiles** (300 pcs MOQ, 15–20 days, 8 lines, QC AQL 2.5 — presentation vocabulary, identical on every page).
9. **Customization (IconGridSection tile variant):** heading/body + hardcoded CUSTOMIZATION_ITEMS icon labels.
10. **Why Choose Us (IconGridSection feature variant):** heading/body + hardcoded WHY_ITEMS proof cards.
11. **Process:** heading/body + hardcoded 6-step timeline labels.
12. **Buyer Solutions:** heading/body + 7 hardcoded segment cards, each resolving a real internal link by keyword match (streetwear/gym/corporate/school/startup/restaurant/medical); unmatched → `#rfq`.
13. **Related Products:** heading/body + product cards (RPC products) + Helpful Links sidebar (RPC internal_links).
14. **RFQ:** heading/body/cta_label feed the panel; the form is the component. If the block is missing, FE force-appends the RFQ section (the only invented section — deliberate conversion safety net).
15. **FAQ:** block body is the section intro; items come from `faqs[]`; skipped if no FAQ has both question+answer.
16. **Missing section:** silently skipped (no crash, no placeholder) — except rfq (see 14).
17. **Wrong order:** page renders in that wrong order (FE trusts display_order absolutely); the unique constraint prevents ties, not mistakes.
18. **Layout tables:** `seo_layout_variants`/`seo_layout_positions` are **inactive** (no reader). Section order does NOT come from them.
19. **Templates:** `seo_templates` inactive (no reader) — reserved for the generator rewrite.
20. **Never hardcode:** page copy, product data, FAQ text, link URLs (all DB-driven ✔). Currently hardcoded and acceptable as *presentation vocabulary*, but flag for DB migration if they must vary per page: stat tiles, icon-grid items, process steps, buyer segments, trust-bar chips, MOQ "300" fallbacks in Intro/Stats/IconGrid copy.

---

## J. Image System (Part 9)

1. **Active system now:** `image_library` (pool) + `seo_page_images` (assignment) → RPC `assigned_images[]` → `imageResolver.getSectionImage()`. This decision was made by PR#4. **Lock this one.**
2. **assigned_images used?** Yes — exclusively.
3. **section_blocks.image_url ignored?** Yes — adapter comment says so explicitly; RPC still emits it (harmless).
4. **country_assets images:** **not used** (RPC omits the key; adapter nulls it). The US/Canada hero+OG urls are dormant data, not lost — decide re-attach vs archive.
5. **Hero image:** resolver takes assigned images where `section_target`/`section_name` = `hero`, prefers `is_primary`, else lowest display_order → `page.hero_image_url` in the view-model → HeroSection (`hero.image_url` from the block never fires since the adapter feeds resolver output into the block too).
6. **Section image:** SECTION_TARGET_MAP: `manufacturing_overview`→factory, `why_choose_us`→quality, `related_products`→products, `customization_options`→customization; unmapped keys fall through to a same-name target (forward-compatible).
7. **Product image:** `image_override_url` → entity `attributes.image_url` (cdn.1and9apparel.com/products/*.webp). **Reachability of cdn.1and9apparel.com: Needs confirmation** (outbound fetch blocked in this environment; if that host isn't real, every product card image and `next.config.ts` remotePattern is pointing at nothing).
8. **OG image:** `getSectionImage("hero", assigned_images)` in generateMetadata — currently the same Unsplash photo for all 9 pages (duplicate OG across site).
9. **Broken image URL:** plain `<img>` tags (not next/image) in cards/hero → browser broken-image / empty band; no build-time failure. `next.config.ts` remotePatterns only matter if next/image is adopted.
10. **Lock:** image_library + seo_page_images as the only system; alt from `alt_template`; hero via is_primary.
11. **Legacy image tables:** seo_images, seo_section_images, seo_image_library, seo_page_image_assignments, seo_media_assets, seo_page_media, seo_product_images (+ block image_url/alt columns and pages.hero_image_override_url/meta_image_id as dormant columns).
12. **Clean later, after backup:** the four legacy generations (order in cleanup_review.sql); then decide `meta_image_id` (wire into RPC for per-page OG) vs drop; replace the 5 Unsplash placeholders with real assets and diversify per page before indexing.

---

## K. Product System (Part 10)

1. **Attachment:** `seo_page_products` join row (page ⨝ product entity), trigger-checked type, unique per page (both by entity and by display_order).
2. **Card rendering:** RelatedProductsSection renders ALL rows the RPC returns in display_order (page 2 has 6 cards; the other pages currently have 1 card each — the "6 cards" experience exists only on the master page today).
3. **Featured:** `is_featured` → yellow badge only (no reordering). Live: exactly one featured card on pages 2 and 4–10; page 3's only card is not featured.
4. **MOQ:** pp.moq → entity attributes.moq (both 300 everywhere today); also min() of card MOQs powers the hero chip and RFQ placeholder.
5. **CTA:** `cta_text` → button label, default "View Details"; card target = `/{products[].slug}` (entity slug) or `#rfq` when slug is null.
6. **Card image:** override → entity attributes.image_url; no image → title-on-gray placeholder tile.
7. **Do product links 404 today?** **Yes — all of them.** No `seo_pages.slug` equals any product entity slug (verified by query). Options: (a) create product hub pages whose slugs equal entity slugs, (b) change the RPC to emit a *page* slug (e.g. the page for that product+context), or (c) point cards at `#rfq` until hubs exist.
8. **Safely adding products to a new page:** ensure product entity exists once (no plural/singular twin) with moq/image_url/card_description attributes → insert seo_page_products rows with unique display_order 1..6 → exactly one is_featured → per-page cta_text if wanted → QA card links.
9. **Required product fields:** entity: slug, name, attributes{moq,image_url,card_description}; join row: page_id, product_entity_id, display_order.
10. **Future recommendation engine:** the schema anticipates it: `products` (structured catalog) + `product_pricing_tiers` + `seo_page_products.product_id` FK are in place and empty. Path: fill `products`, backfill product_id, then rank cards by shared entity dimensions (same country/buyer_type pages' top products) instead of manual curation. Keep entity attributes as the render fallback.

---

## L. Internal Link System (Part 11)

1. **Generated links:** `generate_internal_links()` owns exactly the `auto_related` group: deletes it wholesale, recomputes per page the top-6 targets ranked by shared product (1) < country (2) < buyer_type (3) < else 9, tiebreak priority desc, id; guide pages OR-match everything (see 8). Anchor = target title.
2. **Manual links:** every other group (`related_products`, `related_countries`, `related_buyer_types`, `related_guides`, `related_states`) is hand-curated and never touched by the generator. 12 live manual links, all on pages 2–3.
3. **Frontend grouping:** RPC returns `{group: [links]}`; sidebar prints every non-empty group with prettified name (auto_related → "Auto Related").
4. **Helpful Links:** sidebar in RelatedProductsSection; renders anchor (fallback slug) → `/{slug}`.
5. **Buyer Solutions links:** flattens ALL groups and keyword-matches segment vocab against anchor+slug (e.g. "private label" matches page 9's link) — cards become real links when a matching page exists.
6. **Target status filtering:** in the RPC join (`tp.status='published'`) — unpublished targets vanish at render time, rows stay in the table.
7. **Draft-target links visible?** No (6). Currently zero rows point at unpublished targets anyway.
8. **Circular spam:** pairwise A↔B is expected and fine; the real trap is the **guide OR-clause** — every guide links to/from every page regardless of entity overlap, which at 10k pages makes guides into link centralizers and floods auto_related with weak edges. Cap guide fan-in by entity overlap before scaling.
9. **Safe link count:** current 6 auto + ≤6 manual ≈ ≤12 per page — good. Keep ≤15–20 total; the schema doesn't enforce a cap (display_order unique per group, not a count limit).
10. **Authority flow:** money pages (product_country, priority 0.9) should receive more than they give; guides should push authority down to money pages (related_guides exists for the reverse edge). Today page 2 is correctly the hub (highest fan-in via shared-product edges).
11. **Scaling to 10k+:** (a) make the generator incremental (per changed page) instead of global delete+rebuild in one transaction; (b) entity-scoped candidate SQL already uses the partial indexes — good; (c) replace guide OR-clause with tagged relevance; (d) consider capping fan-in per target (e.g. ≤50 inbound auto links) to avoid over-concentration; (e) `seo_internal_links_target_idx` already covers reverse lookups.

---

## M. FAQ + Schema System (Part 12)

1. **Selection:** entity-scope match (see §F.5): global rows (all-NULL trio) + rows matching the page's product / country / buyer_type. No per-page FAQ table — one pool, scoped.
2. **Order:** `display_order` asc, then `priority` desc. display_order is unique *within a scope*, so cross-scope collisions (global #1 vs US #1) are resolved by priority — stable in practice; watch it as scopes multiply.
3. **On-page:** all matched FAQs render (page 2: 10; other US t-shirt pages: 7–10 depending on scope overlap).
4. **Schema:** FAQPage JSON-LD built from the same rendered array, filtered to `include_in_schema = true` (FAQ #5 "Why choose…" is visible but excluded — correct pattern).
5. **Schema ⊆ visible?** Yes, by construction (same source array).
6. **Repeated-FAQ risk:** the same global 5 appear on every page — acceptable at 9 pages, but at scale Google treats sitewide-identical FAQPage markup as boilerplate; add product/country-specific rows so each page's set is mostly distinct.
7. **How many:** 5–10 per page is the sweet spot; the two-column accordion handles it; schema >10 dilutes.
8. **Adding FAQs for new pages:** insert scoped rows (set exactly the entity dims that define the audience), next free display_order within that scope, priority per importance, include_in_schema true unless promotional, is_active true. Uniqueness guards duplicates within scope.
9. **What breaks the schema:** answer <20 chars (CHECK blocks), HTML in answers (rendered as text — will look wrong in SERP), include_in_schema=false on ALL rows (JSON-LD block simply not emitted — fine), duplicate Question names across the page (Google may ignore), unescaped `<` (FE escapes → safe).

---

## N. Sitemap + Indexing (Part 13)

1. **Who enters:** `status='published'` AND `robots IN ('index,follow','index,nofollow')` AND slug non-empty. **Today that is exactly 1 page** (`custom-t-shirt-manufacturer-usa`) → one group `manufacturer`, one URL.
2. **Drafts in sitemap?** No. 3. **Noindex in sitemap?** No (both RPCs filter). Correct.
4. **Host:** `get_sitemap_pages` hardcodes `https://www.1and9apparel.com`; the sitemap *index* builds `<loc>` from `NEXT_PUBLIC_SITE_URL` (currently the vercel.app URL). **The index and the URL files can disagree about the site's host** — pick one canonical host, put it in one place (env var read by both, or DB config), before indexing. Whether www.1and9apparel.com is even live: Needs confirmation.
5. **Nested slugs:** the guide page would enter the sitemap when flipped to index — and 404 on visit (single-segment route). Sitemap and router disagree; fix routing (catch-all `[...slug]`) or forbid nested slugs (tighten the CHECK).
6. **Chunking:** `get_sitemap_index(chunk_size=5000)` emits `manufacturer.xml`, `manufacturer-2.xml`… but the group route strips only `.xml` and matches `sitemap_group === "manufacturer-2"` — **no such group → chunk 2+ 404s.** Invisible until a group exceeds 5,000 URLs; fix the route to parse the `-N` suffix and slice.
7. **Risks at 5k/10k/50k:** 5k: chunk bug fires. 10k: `get_sitemap_pages()` returns every row and the route filters in JS — O(N) payload per request; add a group+chunk parameterized RPC. 50k: same plus you want materialized sitemap tables and CDN caching of the XML (currently force-dynamic, uncached).
8. **Before publishing at scale:** one canonical host everywhere; canonical tag emitted on-page; robots meta emitted on-page; per-group paged sitemap RPC; chunk-suffix parsing; `<lastmod>` already correct; keep the two-flag gate.


---

## O. Frontend Dependency Map

Every Supabase touchpoint in the current codebase (verified by grep — these are ALL of them):

| File | Call | Purpose |
|---|---|---|
| `src/lib/supabase.ts` | `createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` | Stateless anon client (no sessions). Service key nowhere in repo ✔ |
| `src/lib/seo/getSeoPageRender.ts` | `rpc('get_seo_page_render', {p_slug})` | THE render read |
| `src/app/page.tsx` | `from('seo_pages').select('slug,title').eq('status','published').order('id')` | Home index list — **the only direct table SELECT**; requires a SELECT path on seo_pages after the lock (RLS policy or a small RPC) |
| `src/app/sitemap.xml/route.ts` | `rpc('get_sitemap_index')` | Sitemap index |
| `src/app/sitemaps/[group]/route.ts` | `rpc('get_sitemap_pages')` | Group sitemaps (filters group in JS) |
| `src/components/landing/RFQSection.tsx` | `from('quote_requests').insert({...})` no `.select()` | The only write. Sends source_page_id, source_slug, company_name, email, phone, quantity, message (product/country/timeline composed into message; entity id columns left NULL) |

Component ⇄ data contracts: PSEOPageRenderer (block vocabulary + order), HeroSection (hero block, page h1/title/meta_description, products min-MOQ, country_assets fallbacks now always null), IntroSection (gallery = non-hero assigned images, pads with product images), StatsSection/IconGrid/Process (block copy + hardcoded presentation items), BuyerSolutions (block + all link groups), RelatedProducts (block + products + link groups), RFQSection (page id/slug + block copy), FAQSection (faqs + faq block body → JSON-LD subset), FooterTrustBar (page title; currency chip permanently hidden now).

Hard render requirements: a `seo_pages` row (title/h1/meta_title/meta_description NOT NULL by schema) reachable by slug. Everything else degrades silently.

---

## P. Security / RLS Report (Part 14)

**Current posture (live-verified):**

1. RLS: OFF on 32/33 tables; ON only for `quote_requests` (advisor: 32 × ERROR).
2. `anon` grants: DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE on **every** public table.
3. `authenticated` grants: identical (no auth system exists — same blast radius).
4. service_role assumptions: nothing relies on service_role today; generators are meant to be admin-only but are anon-executable.
5. Public read risk: entire schema readable via PostgREST — including `quote_requests`? No: RLS ON + no SELECT policy → 0 rows (lead PII protected ✔). Everything else — keywords, templates, layouts, quote configs — is world-readable.
6. Public write risk: **maximal.** With the shipped anon key anyone can UPDATE page copy (spam/link injection into indexed pages + FAQ schema), TRUNCATE any SEO table, or corrupt entities.
7. Generator execute risk: anon can run `generate_seo_pages` (mass-create draft pages), `generate_content_blocks` (mass clone), `generate_internal_links` (wipe+rebuild auto_related). All three also lack pinned search_path.
8. `quote_requests` insert policy: `WITH CHECK (true)` for anon+authenticated — correct for a public form (advisor WARN is acceptable); consider rate limiting at the edge later.
9. Can anon UPDATE/DELETE SEO tables? **Yes, today.** 10. Can anon run generators? **Yes, today.**

**Updated RLS lock plan — matched to the CURRENT active RPC and frontend (do NOT apply during this audit):**

The active read path is `get_seo_page_render` (SECURITY INVOKER) + the two sitemap RPCs + one direct SELECT on `seo_pages` (home page) + legacy `get_landing_page_view` if kept. INVOKER means the RPCs read *as anon*, so anon needs SELECT (via RLS policy) on exactly the tables those functions touch — this is the delta from yesterday's plan: **`seo_page_images` and `image_library` are now render-path tables; `country_assets` no longer is.**

```sql
-- 1) Strip default write grants everywhere (public schema)
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon, authenticated;

-- 2) Re-allow the one legitimate public write
grant insert on public.quote_requests to anon, authenticated;
-- (existing RLS policy quote_requests_public_insert stays)

-- 3) Enable RLS on all 32 remaining tables
--    (repeat for every table in §E)
alter table public.seo_pages enable row level security;  -- …etc ×32

-- 4) Public-read policies ONLY on the render-path tables (8 + optional legacy 1)
--    seo_pages, seo_content_blocks, seo_page_images, image_library,
--    seo_faqs, seo_page_products, seo_entities, seo_internal_links
create policy public_read on public.seo_pages
  for select to anon, authenticated using (true);
--   ↳ stricter option once the RPC gains its own publish filter:
--     using (status = 'published')  — also fixes the home page listing safely
-- (repeat a using(true) select policy for the other 7 tables)
-- If get_landing_page_view is kept alive: add country_assets to this list; otherwise not.

-- 5) Admin-only tables: NO anon policies at all (RLS on + no policy = invisible)
--    seo_keywords, seo_templates, seo_layout_variants, seo_layout_positions,
--    country_assets (while orphaned), all quote/logistics tables, all legacy tables.

-- 6) Service-role-only functions
revoke execute on function public.generate_seo_pages()      from public, anon, authenticated;
revoke execute on function public.generate_content_blocks() from public, anon, authenticated;
revoke execute on function public.generate_internal_links() from public, anon, authenticated;

-- 7) Deprecated function: either revoke until removal…
revoke execute on function public.get_landing_page_view(text) from public, anon, authenticated;
-- …or keep it executable only if you deliberately keep it as the fallback contract.

-- 8) Pin search_path on the 8 flagged functions
alter function public.get_seo_page_render(text)            set search_path = public;
alter function public.generate_seo_pages()                 set search_path = public;
alter function public.generate_content_blocks()            set search_path = public;
alter function public.generate_internal_links()            set search_path = public;
alter function public.set_updated_at()                     set search_path = public;
alter function public.validate_seo_page_entities()         set search_path = public;
alter function public.validate_seo_page_product_entity()   set search_path = public;
alter function public.validate_quote_request_entities()    set search_path = public;
```

Frontend impact of this lock: **zero**, provided the 8 public-read policies land in the same migration as the RLS enables (the home page's direct SELECT keeps working; the RPCs keep working; the RFQ insert keeps working). If you adopt the stricter `status='published'` policy on seo_pages, the render RPC stops returning drafts even before its own filter is added — defense in depth.

---

## Q. Data Quality Report (Part 16)

Live queries, 2026-07-09:

| # | Check | Result |
|---|---|---|
| 1 | Pages without content blocks | **0** (all 9 have exactly 10) |
| 2 | Pages without FAQs | **0** (every page matches ≥5 global + product FAQs) |
| 3 | Pages without hero image | **0** (all 9 have the hero assignment) — but it's the SAME Unsplash image on all 9 |
| 4 | Pages without assigned images | **0** (all 9 have the same 5 assignments — placeholder uniformity, not real coverage) |
| 5 | Pages without products | **0** (page 2: 6 cards; pages 3–10: 1 card each) |
| 6 | Pages without internal links | **0** (6 auto each; manual links only on pages 2–3) |
| 7 | Duplicate slugs | **0** (UNIQUE constraint) |
| 8 | Duplicate entity combinations | **0 among pages** (UNIQUE NULLS NOT DISTINCT) — but 7 semantic entity twins exist that will defeat this guard if used (§G.20) |
| 9 | Draft pages that can render | **0 drafts exist**, but the RPC would render any (gate absent — structural hole, not current leak) |
| 10 | Published pages with noindex | **8 of 9** (ids 3–10). Deliberate staging? Needs confirmation |
| 11 | Indexable pages missing canonical | **1 of 1** — the only indexable page has canonical_url NULL and the frontend emits no canonical tag at all |
| 12 | Empty meta titles/descriptions | **0** (NOT NULL + length CHECKs; live 54–64 / 128–153 chars) |
| 13 | Missing H1 | **0** (NOT NULL) |
| 14 | Broken CTA routes | **9 of 9 pages** — every rfq/hero block CTA → `/quote?market=…` (no such route); BuyerSolutions fallbacks `#rfq` are fine |
| 15 | Nested slugs that cannot render | **1** — page 10 `guides/how-t-shirt-manufacturing-works` |
| 16 | Product links that 404 | **14 of 14** card rows (entity slugs have no pages) |
| 17 | Internal links to drafts | **0** |
| 18 | Internal links to archived | **0** |
| 19 | Duplicate anchors | 3 cases, all benign cross-group repeats (same target in related_products + auto_related on pages 2–3); RPC/unique keys prevent in-group dupes |
| 20 | Empty image alt | **0** in the active system (alt_template NOT NULL). Legacy hero-block image on page 6 has alt (CHECK enforces pairing) |
| 21 | Broken/suspicious image URLs | **5 active images are Unsplash placeholders** (fine to render, wrong for brand/OG at launch). Suspicious: page-6 hero block + Canada country_assets use a **th.bing.com 108px thumbnail** (junk; dormant paths). `cdn.1and9apparel.com/products/*.webp` (6 product entities) — host reachability **Needs confirmation** (outbound fetch blocked in this audit environment) |

Also observed: `cta_text` says "Get T-Shirt Pricing" on polo/sweatshirt cards (pages 4–6) — copy bug; page 3's single product card has `is_featured=false` (inconsistent with all other pages).

---

## R. Old Audit Corrections (Part 15)

Yesterday's `DATABASE_MANUAL.md` + `SYSTEM_CONSTITUTION.md` vs today's live system:

| Old statement (doc) | Current reality | Corrected statement | Severity | Action |
|---|---|---|---|---|
| Frontend renders via `get_landing_page_view`; `get_seo_page_render` is "unused, not referenced anywhere in the repo" | PR#4 (merged 2026-07-08 10:33, ~20 min before the manual's PR was opened) switched the frontend to `get_seo_page_render` | `get_seo_page_render` IS the production render RPC; `get_landing_page_view` is the unused one | **CRITICAL** | Rewrite §A/§D/§J of the manual; treat this document as the reference |
| `get_seo_page_render` "returns no products/internal_links" (implied by its §D.2 shape diff) | Migration `20260708013051` added products + internal_links to it | Active RPC returns all six payload keys (§D.3 here) | HIGH | Update contract docs; freeze §D.3 |
| Image system: image_library/seo_page_images "not consumed by the live site"; images come from block.image_url + country_assets | Exactly inverted by PR#4 | assigned_images is the ONLY live image source; block.image_url and country_assets images are dormant | **CRITICAL** | Lock assigned_images (§J); update manual §H |
| `country_assets` is CORE/active (hero fallback, OG, badges, currency, shipping) | RPC omits it; adapter hardcodes null | country_assets is ORPHANED data (US+Canada rows intact) | HIGH | Decide: re-attach via RPC (recommended for differentiation) or archive |
| Canonical + robots are emitted per page via Next metadata | Neither is emitted anywhere in the current frontend | On-page canonical/robots do not exist post-PR#4 | **CRITICAL** | Add canonical_url+robots to the RPC payload and generateMetadata before any indexing |
| Drafts cannot render via the live path (published-only RPC) | Active RPC has no status filter | Drafts/archived WILL render publicly if a slug is known | **CRITICAL** | Add `status='published'` to get_seo_page_render (+ strict RLS read policy) |
| Live counts: 3 published / 6 draft | All 9 published (8 of them noindex); updated_at shows flips on 2026-07-07/08 | Publish state changed after the audit snapshot | MEDIUM | Confirm the 8 noindex-published pages are intentional |
| Frontend dependency map lists `fetchLandingPage`/landing.ts as the RPC caller | Those functions were deleted; new files `src/lib/seo/*`, `src/types/seo.ts` | Dependency map is §O of this document | HIGH | Replace manual §J |
| Cleanup list: `get_seo_page_render` is a DEPRECATED drop candidate ("revoke, then remove") | It is the production RPC | **Do NOT drop or revoke `get_seo_page_render`.** The drop candidate is now `get_landing_page_view` | **CRITICAL** | Amend cleanup docs (`supabase/cleanup_review.sql` Group 6 already targets the right one ✔) |
| RLS lock plan grants public read to 7 tables incl. country_assets, excl. image tables | Render path changed | Public-read set is now the 8 tables in §P (adds seo_page_images + image_library; country_assets only if legacy RPC kept) | HIGH | Use §P plan, not the manual's §K plan |
| Internal links: 60 rows incl. links to 6 draft targets "wasted slots" | 60 rows, 0 unpublished targets (everything is published now) | Link graph currently fully live | LOW | None |
| seo_internal_links count 60 with auto_related 48 | Confirmed identical | Still true | — | None |
| Bugs: product-card 404s, nested-slug 404, /quote missing, sitemap chunk-2 404, canonical host mismatch, clone-generator thin content | All six re-verified against current code/DB | All still true post-PR#4 | HIGH | §V fix list |
| Constitution Part 2/15: the locked chain names `get_landing_page_view` as "one render" | The chain's RPC is now `get_seo_page_render` — and it currently violates two constitution rules (published-only render; canonical emitted) | Constitution must be re-pointed at the new RPC and its two violated invariants restored | **CRITICAL** | Amend SYSTEM_CONSTITUTION.md after the fixes land |
| set_updated_at trigger table list inconsistent (8 vs 9) in the manual itself | Live: exactly 9 tables (§E.4 list) | 9 tables carry the trigger | LOW | Fix doc |

Everything else in yesterday's documents (schema shapes, constraints, generator mechanics, entity model, scaling analysis, golden rules) checks out against the live system.

---

## S. Relationship Diagrams (Part 17)

```
1) KEYWORD → PAGE → RENDER
   seo_keywords ──generate_seo_pages()──▶ seo_pages ◀─FK─ seo_content_blocks (10/page)
        │ entity FKs (8)                     │  ▲                │
        ▼                                    │  └─ triggers ─ seo_entities
   seo_entities ◀──────── entity FKs (8) ────┘
   seo_pages ──get_seo_page_render(p_slug)──▶ jsonb ──adapter──▶ components ──▶ HTML

2) PAGE → PRODUCT
   seo_pages ◀─ seo_page_products ─▶ seo_entities(type=product)
                    │ (order, featured, cta, moq, overrides)      │ attributes{moq,image_url,card_description}
                    └── product_id ─▶ products (empty, future)

3) PAGE → INTERNAL LINKS → PAGE
   seo_pages(source) ◀─ seo_internal_links{link_group, anchor, order} ─▶ seo_pages(target)
   render-time filter: target.status='published'
   generator owns ONLY link_group='auto_related' (delete+rebuild, top 6 by entity similarity)

4) PAGE → FAQ (pool matching, no join table)
   seo_faqs(product_eid, country_eid, buyer_type_eid — each NULL=global)
     match: (f.p IS NULL OR f.p = page.p) AND (f.c IS NULL OR f.c = page.c) AND (f.b IS NULL OR f.b = page.b)
     order: display_order, priority DESC → page render + include_in_schema subset → FAQPage JSON-LD

5) PAGE → IMAGES (active system)
   image_library(pool: image_key, url, section_target, alt) ◀─ seo_page_images(page_id, section_name,
     display_order, is_primary, is_active) → RPC assigned_images[] → imageResolver
     hero→hero(is_primary first) · manufacturing_overview→factory · why_choose_us→quality ·
     related_products→products · customization_options→customization · others→same-name target
   [dormant: seo_content_blocks.image_url, country_assets.hero/meta, hero_image_override_url, meta_image_id]

6) PAGE → QUOTE REQUEST
   /[slug] RFQSection ──insert──▶ quote_requests{source_page_id, source_slug, email, quantity, message…}
     RLS: INSERT-only for anon; no SELECT → write-only mailbox
     triggers: validate entity types; quote_events/quote_configurations = future funnel

7) SITEMAP FLOW
   seo_pages(status=published AND robots=index,*) ─▶ get_sitemap_index(5000) ─▶ /sitemap.xml (host from env)
                                                └──▶ get_sitemap_pages() ─▶ /sitemaps/<group>.xml
                                                      (host hardcoded www.1and9apparel.com; group filtered in JS)

8) GENERATOR FLOW
   seo_keywords(active) ─▶ generate_seo_pages (upsert by slug; draft+noindex)
                        ─▶ generate_content_blocks (clone page 2 ×3 string replaces — REPLACE with seo_templates)
                        ─▶ generate_internal_links (rebuild auto_related, top 6)
                        ─▶ [manual: products, images, FAQs, curated links, copy edit]
                        ─▶ flip status=published, robots=index,follow

9) FRONTEND RENDER FLOW
   / (home) ── direct SELECT seo_pages(published) ─ list links
   /[slug] ── get_seo_page_render ─ adapter ─ PSEOPageRenderer ─ 10 sections + forced RFQ + FAQ JSON-LD
   /sitemap.xml, /sitemaps/[group] ── sitemap RPCs
   (no other data paths exist)
```

---

## T. Scaling Readiness (Part 18)

| Level | Works | Breaks / bottlenecks | Required before this level |
|---|---|---|---|
| **100 pages** | Everything functional today keeps working: RPC render (8 indexed reads/page, all on PK/partial indexes), sitemap, generators, FAQ matching | Nothing technical. Content: clone-generator output is 90% identical across pages → Google thin-content risk the moment they're indexable. OG image identical sitewide | §V items 1–6 (security, publish gate, canonical/robots, links). Entity dedupe. Real images. Template-based copy for differentiation |
| **1,000 pages** | DB trivially (Postgres 17, ~10 blocks + 5 image rows + ~6 links/page); render RPC stays fast (per-page indexed) | `generate_internal_links` global delete+rebuild in one txn gets slow/locky; guide OR-clause creates megahubs; FAQ pool (10 rows) becomes sitewide boilerplate; every request hits SSR uncached — Supabase read volume grows linearly with traffic | Replace clone generator with seo_templates variants; incremental link generation; per-entity FAQ batches; add caching (ISR/`revalidate` or CDN) for /[slug]; capture RPC defs in migrations |
| **10,000 pages** | Schema + combo-key + indexes hold; sitemap gate logic holds | `get_sitemap_pages()` returns ALL rows per request, JS filters group → O(N) payload; chunk-2 404 bug fires past 5k/group; home page lists 10k links; anon direct SELECT on seo_pages returns 10k rows | Parameterized `get_sitemap_pages(group, chunk, size)` RPC; fix chunk-suffix routing; paginate home; materialize link candidates; monitor Supabase connection limits (consider pooled PgBouncer defaults — already Supabase default) |
| **50,000 pages** | Core relational model still sound | Sitemap XML generation per-request untenable; generator runs need batching/queueing; FAQ scope-order uniqueness coordination across thousands of scopes; link graph 50k×6 rows fine but rebuilds aren't | Materialized sitemap tables refreshed on publish; job queue (pg_cron / external worker with service_role) for generators; per-cluster link caps; observability (quote_events, query stats) |
| **100,000 pages** | Postgres capacity fine (≈1M content-block rows, ~2.5M total — small for PG17) | Everything operational: publish workflows, QA at scale, index-budget management, content uniqueness pipeline become the constraint, not the DB | Full CMS/ops layer: publish queue with QA gates, per-template canonical/robots policy engine, AI-assisted but gated content generation into drafts, dedicated search-console feedback loop |

Content duplication and security dominate every level: the schema scales; the *copy factory* and the *open grants* do not.

---

## U. New Page Publishing Checklist (Part 19) — print me

```
□ 1  KEYWORD    seo_keywords row: keyword UNIQUE, slug final (kebab, single segment,
                no typos — it becomes the URL forever), keyword_type/intent set,
                priority set, status='active'
□ 2  ENTITIES   All entity ids exist ONCE (no singular/plural twins!); product entities
                carry attributes {moq, image_url, card_description}; state/city have parent_id
□ 3  PAGE ROW   Run generate_seo_pages() (or insert manually) → row exists, status='draft',
                robots='noindex,follow'
□ 4  SLUG       Matches keyword slug; single segment; not colliding with entity slugs
□ 5  TITLE      Human-edited (no raw initcap artifacts like "Usa")
□ 6  H1         Distinct-enough from title; reads like a headline
□ 7  META TITLE ≤60 chars incl. " | 1 & 9 Apparel"
□ 8  META DESC  120–160 chars, unique, includes keyword naturally
□ 9  CANONICAL  Per policy (NULL + rendered from site host, or absolute final-domain URL)
□ 10 ROBOTS     Still 'noindex,follow' until final QA passes
□ 11 STATUS     Still 'draft'
□ 12 BLOCKS     10 rows, display_order 1–10, keys = the locked vocabulary;
                body copy EDITED, not raw clone output; CTA pair valid and route EXISTS
□ 13 IMAGES     image_library rows exist (real CDN, alt_template written);
                seo_page_images: hero (is_primary) + factory + quality + products +
                customization assigned; is_active=true
□ 14 PRODUCTS   2–6 seo_page_products rows, display_order unique, EXACTLY one is_featured,
                cta_text matches the product (not "T-Shirt" on a polo card),
                card link target verified to exist
□ 15 FAQS       Page matches 5–10 FAQs (add scoped rows if needed); ≥3 unique to this
                page's scope; include_in_schema correct
□ 16 LINKS      Run generate_internal_links() (auto_related refreshed) + add curated
                related_* links; total ≤15–20; all targets published
□ 17 SITEMAP    sitemap_group correct; page ABSENT from sitemap while noindex (verify)
□ 18 RENDER QA  Visit /{slug}: all 10 sections render, hero image loads, no broken
                images, CTAs navigate, RFQ submits (check quote_requests row)
□ 19 SCHEMA QA  View source: FAQPage JSON-LD present, questions = visible subset;
                validate in Rich Results test
□ 20 QUOTE QA   RFQ insert works from THIS page (source_page_id = this page id)
□ 21 GO LIVE    Flip status='published' (published_at set) THEN robots='index,follow';
                confirm page appears in /sitemaps/<group>.xml; request indexing
```

---

## V. Immediate Fix List (ranked)

1. **Apply the §W/§P security lock** (RLS + grant revokes + generator lockdown + search_path pins). Zero frontend impact if shipped as one migration. *Everything else is optional until this is done.*
2. **Restore the publish gate:** add `where p.slug = p_slug and p.status = 'published'` to `get_seo_page_render` (+ optionally return `null` for archived). Capture the full function in a migration file.
3. **Restore canonical + robots:** add `canonical_url` (coalesced) and `robots` to the RPC `page` object; emit `alternates.canonical` and `robots` in `generateMetadata`. Choose ONE canonical host and read it from ONE place (env), replacing the hardcoded host in `get_sitemap_pages`.
4. **Fix the three broken-link classes:** create `/quote` (or repoint block CTAs to `#rfq`); decide product-card targets (hub pages vs page-slug emission vs `#rfq`); fix nested-slug routing (`[...slug]` catch-all) or forbid nested slugs.
5. **Entity hygiene:** merge/deactivate the 7 duplicate entities (`usa`, `t-shirt`, `hoodie`, `polo-shirt`, `sweatshirt`, `tank-top`, `private-label-brand`) before any new keywords reference them; add `e.is_active = true` filter to the RPC product join.
6. **Confirm intent on the 8 published+noindex pages**; fix `cta_text` copy bugs (pages 4–6) and page 3's missing featured flag.
7. **Replace the clone generator with `seo_templates`-driven generation** before adding page #10+; remove hardcoded `page_id = 2`.
8. **Replace the 5 Unsplash placeholders** with owned, per-page-varied images; verify `cdn.1and9apparel.com` actually serves the product images; purge th.bing.com junk URLs.
9. **Sitemap scale prep** (before 5k pages): chunk-suffix parsing in the group route + parameterized sitemap RPC.
10. **Docs:** amend DATABASE_MANUAL/SYSTEM_CONSTITUTION per §R (or supersede with this document).

## W. Lock Plan (architecture freeze after fixes 1–4)

- **Freeze the RPC contract** at §D.3 + the three restored fields (`status` filter behavior, `canonical_url`, `robots`). Changes additive-only; breaking changes = new versioned function.
- **Freeze the block vocabulary** (10 keys) and `display_order` as the only order source.
- **Freeze the image system**: image_library + seo_page_images; section_target vocabulary {hero, factory, quality, products, customization} + same-name fallthrough.
- **Freeze the write surface**: anon = `quote_requests` INSERT only. Generators = service_role only. Everything else via migrations.
- **Freeze entity semantics**: types, one-row-per-concept, triggers + RESTRICT FKs stay forever.
- **Freeze the publish gate**: `status='published'` AND `robots='index,follow'` as the only path into the sitemap; two explicit flips to go live.
- **Decide and record** (needs your call, then lock): country_assets — re-attach (recommended: it's the only per-country differentiation data you have) or archive; `get_landing_page_view` — revoke+archive once country_assets is decided; legacy 12 tables — backup then drop per `cleanup_review.sql`.

## X. Future Upgrade Roadmap

1. Template-based content engine (seo_templates + variant_number per entity scope) with a uniqueness QA gate.
2. Per-page OG images via `meta_image_id` (wire into RPC) once real assets exist.
3. Country differentiation: revive country_assets (badges, currency, shipping copy) through the active RPC.
4. Quote engine: wire quote_configurations/customization_options into the RFQ; log quote_events; populate products + pricing tiers; backfill seo_page_products.product_id.
5. City/industry expansion: city entities under states; industry pages feeding BuyerSolutions with real per-segment links.
6. Caching layer: ISR or CDN caching for /[slug]; materialized sitemaps on publish.
7. Ops: generator job queue (service_role worker), publish dashboard, data-quality checks as a scheduled SQL report (the §Q queries are reusable).
8. PITR backups on the Supabase project before any cleanup/drops.

## Y. Final Verdict

The post-PR#4 system is **architecturally coherent and the right long-term shape**: one vocabulary table, one page registry with real integrity constraints, one render RPC, one assignment-based image system, deterministic ordering everywhere, and a frontend that renders whatever the database says. The database schema would carry 100,000 pages without redesign.

It is also, today, **unsafe to scale and unsafe to index**: the whole database is anon-writable, the render RPC lost the publish gate and the canonical/robots contract in the PR#4 migration, every product card and CTA on the site 404s, and the content generator manufactures near-duplicates. None of these is architectural — all are closable with one security migration, one RPC amendment, one frontend metadata patch, and a routing decision.

**Order of operations: lock (§W step 1) → gate + canonical/robots (§V 2–3) → links (§V 4) → entities/content (§V 5–8) → then scale.** Yesterday's audit is wrong about which RPC and which image system are live (and therefore about what to drop and what to protect); this document reflects the system as it actually runs on `main` @ `47eaea8`.

*Needs confirmation (the only items this audit could not verify from inside the environment): the Vercel production deployment SHA, the reachability of `cdn.1and9apparel.com` and `www.1and9apparel.com`, and whether the 8 published-noindex pages are intentional staging.*
