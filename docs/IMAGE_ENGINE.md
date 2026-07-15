# Deterministic Image Engine

**Branch:** `claude/deterministic-image-engine-2mpbj7` · **Date:** 2026-07-15
**Status:** implemented + fully tested locally against a byte-faithful replica of the live schema. **Nothing has been applied to the production Supabase project** — apply the migrations after review (§8).

The engine turns the manually mapped image system into a database-driven,
deterministic, explainable image selector that scales to hundreds of
thousands of pSEO pages. No AI, no `random()`: the same page + section +
data always yields the same image.

---

## 1. Architecture before the upgrade

```text
image_library (5 generic Unsplash images, flat text tags, entity-less)
        ▲
        │ manual join
seo_page_images (45 rows: EVERY page needs 5 hand-inserted rows,
        │        all pointing at the same 5 global images)
        ▼
get_seo_page_render(p_slug)  →  assigned_images[]  →  frontend
                                                       getSectionImage()
```

* Every new page required five manual `seo_page_images` inserts.
* `image_library` had free-text `country` / `product_type` columns that
  nothing matched on; no entity links, no scoping, no scoring.
* Geographic/product relevance was impossible: a Canada page showed the same
  hero as a USA page.
* Legacy abandoned image systems still exist and were left untouched:
  `seo_images`, `seo_image_library`, `seo_page_image_assignments`,
  `seo_section_images`, `seo_media_assets` + `seo_page_media`,
  `seo_product_images`, and `country_assets` (only read by the unused
  `get_landing_page_view`).

## 2. New architecture

```text
seo_pages (product/country/state/city/industry/buyer_type/material/service FKs,
    │      image_assignment_mode: automatic | manual | hybrid)
    ▼
resolve_seo_page_image(page_id, section_key)         ← THE canonical resolver
    │  layer 0  hero_image_override_url        (+6000, every mode)
    │  layer 0b seo_pages.meta_image_id (og)   (+5500, every mode)
    │  layer 1  seo_page_images source=override (+5000, every mode)
    │  layer 2  seo_page_images source=manual   (+4000, manual/hybrid)
    │  layer 3  deterministic scoring over image_library
    │            (conflict rejection → scoring → stable tie-break)
    ▼
get_seo_page_render(p_slug)  →  assigned_images[] (same contract,
    │                            + selection_source/score/reason)
    ▼
frontend (unchanged rendering; getSectionImage untouched)
```

Support functions:

* `debug_seo_image_candidates(page_id, section, include_demo)` — full audit:
  every candidate, eligibility, score breakdown, rejection reason, final rank.
* `render_image_alt(template, page_id, section)` — deterministic alt text.
* `materialize_seo_page_images(page_id)` — optional cache writer
  (`source='materialized'` rows; the render path never reads them, so dynamic
  resolution remains the source of truth and staleness is impossible).

## 3. Database changes (all additive; nothing dropped, no rows deleted)

### `image_library` (canonical table, extended in place)

| Column | Type | Purpose |
|---|---|---|
| `product_entity_id` … `service_entity_id` (8 cols) | bigint FK → `seo_entities` | what the image depicts (typed-checked by trigger) |
| `geographic_scope` | text, default `'global'` | `city\|state\|country\|region\|global` |
| `compatible_sections` | text[], default `{}` | extra sections the image may serve |
| `country_code`, `state_code`, `city_slug` | text | operational metadata only — matching uses entity ids |
| `priority`, `quality_score`, `specificity_score` | int, default 0 | ranking inputs / tie-breaks |
| `is_default` | bool | marks global fallbacks |
| `is_demo` | bool | test images; excluded from production selection |
| `valid_from`, `valid_until` | timestamptz | validity window |
| `license_type`, `source_name`, `source_url`, `copyright_owner` | text | provenance |
| `updated_at` | timestamptz + trigger | tie-break input |

### `seo_page_images` (now the manual/override layer)

`source` (`manual` = editorial mapping, `override` = explicit page-section
override, `materialized` = resolver cache), `resolver_version`,
`selection_score`, `selection_reason`, `materialized_at`.
All 45 existing rows backfilled to `source='manual'`.

### `seo_pages`

`image_assignment_mode` (`automatic|manual|hybrid`), default **hybrid** —
current production output is preserved exactly.

### Indexes

`image_library_resolver_idx` (partial: active production images by
section/geo/product/priority), `image_library_compat_sections_gin`,
per-entity partial indexes (8), `image_library_default_idx`,
`seo_page_images_page_source_idx`, plus two FK-support indexes measured to
matter at scale: `seo_page_images_image_idx` and `seo_pages_meta_image_idx`
(a 50k-image delete went from **>4 minutes to 0.7 s** locally).

### Backfill

The five existing Unsplash images are generic (no real geography/product), so
they became `geographic_scope='global'`, `is_default=true`, `is_demo=false`
(they are live production fallbacks), with Unsplash provenance recorded. No
image was tagged with a geography it does not depict.

## 4. SQL functions

| Function | Kind | Access |
|---|---|---|
| `resolve_seo_page_image(p_page_id, p_section_key, p_include_demo=false, p_max_results=1)` | new, STABLE | public (needed by render RPC) |
| `debug_seo_image_candidates(p_page_id, p_section_key, p_include_demo=false)` | new, STABLE | service_role only |
| `render_image_alt(p_template, p_page_id, p_section_key=null)` | new, STABLE | public |
| `materialize_seo_page_images(p_page_id)` | new, VOLATILE | service_role only |
| `validate_image_library_entities()` | new trigger fn | – |
| `get_seo_page_render(p_slug)` | **upgraded** (assigned_images now resolver-driven; everything else byte-identical) | public |

## 5. Frontend changes

| File | Change | Why |
|---|---|---|
| `src/types/seo.ts` | added optional `selection_source`, `selection_score`, `selection_reason` to `AssignedImage`; documented synthetic negative ids | type accuracy for the additive RPC fields |

That is the **only** frontend change. `imageResolver.ts`,
`mapRpcToLandingProps.ts`, `page.tsx` and all components consume the payload
unchanged (verified end-to-end, §9).

## 6. Deterministic scoring

| Rule | Score |
|---|---|
| Explicit hero URL override (`seo_pages.hero_image_override_url`) | 6000 |
| Explicit OG image (`seo_pages.meta_image_id`, `open_graph` slot) | 5500 |
| Explicit page-section override (`seo_page_images.source='override'`) | 5000 |
| Manual page mapping (`source='manual'`, manual/hybrid mode) | 4000 |
| Exact city match | +1000 |
| Exact state/province match | +800 |
| Exact country match (this is also the "correct ancestor" path: a USA image on a Dallas/Texas page matches at the country tier) | +600 |
| Global geographic image (no geo tags) | +100 |
| Exact product match | +500 |
| Product category match (image tagged with the product's parent entity) | +350 |
| Generic apparel (no product tag) | +100 |
| Exact section match (`section_target = requested`) | +300 |
| Compatible section fallback (`requested ∈ compatible_sections`) | +100 |
| Exact industry / buyer-type / material / service match | +180 / +160 / +140 / +120 |
| `priority` and `quality_score` columns | +value |

**Conflict rejection (excluded, never merely down-scored):**

* image geo tag set and ≠ page's effective geo at that tier — includes images
  *more* specific than the page (a Texas image never serves a plain-USA page,
  a Toronto image never serves Vancouver, a Canada image never serves USA);
* image product tag set and ≠ page product (and ≠ product parent);
* section incompatible (`section_target ≠ requested` and requested not in
  `compatible_sections`) — a factory image never serves hero unless marked;
* secondary entity set on **both** image and page with different values;
* inactive images, expired images (validity window), demo images unless
  `p_include_demo => true`.

**Effective geography:** the page's own columns, with missing ancestors
derived via `seo_entities.parent_id` (city → state → country).

**Stable tie-break:** `score DESC, priority DESC, quality_score DESC,
specificity_score DESC, updated_at DESC, id ASC`. No `random()` anywhere.

## 7. Fallback hierarchy (final)

```text
1. hero URL override            (hero slot, every mode)
2. meta_image_id                (open_graph slot, every mode)
3. seo_page_images override     (every mode)
4. seo_page_images manual       (manual + hybrid modes)
   — manual mode STOPS here —
5. exact city + product + section
6. exact city + generic + section
7. exact state + product + section
8. exact country + product + section
9. exact state/country + generic + section
10. global + product + section
11. global generic section default (is_default images)
12. compatible-section fallbacks of the above
13. no image (section renders imageless — same as today)
```

(5–12 emerge from one scoring pass; the list shows the resulting order for a
fully-tagged library. See Test C/D evidence below for exact rankings.)

## 8. Migration files

| File | Purpose |
|---|---|
| `supabase/migrations/20260715100000_image_engine_schema.sql` | forward: columns, constraints, triggers, backfill, indexes |
| `supabase/migrations/20260715100100_image_engine_resolver.sql` | forward: the four engine functions + grants |
| `supabase/migrations/20260715100200_render_rpc_deterministic_images.sql` | forward: RPC upgrade |
| `supabase/rollback/20260715_deterministic_image_engine_rollback.sql` | full rollback (restores the previous RPC byte-for-byte) |
| `supabase/verification/deterministic_image_engine_verification.sql` | 13 read-only PASS/FAIL checks |
| `supabase/seed/deterministic_image_engine_demo_seed.sql` | OPTIONAL, clearly marked `is_demo=true` seed + draft demo page |
| `supabase/tests/deterministic_image_engine_tests.sql` | Test matrix A–J, transactional (auto-rollback) |

**Recommended apply order (after review):** migration 1 → 2 → 3 →
verification → (optional) demo seed → tests. Rollback reverses everything and
was drill-tested: after rollback all 9 page payloads were byte-identical to
the pre-migration snapshot, and re-applying the migrations succeeded.

## 9. Test results (local Postgres 16 replica of the live schema + data)

Payload-compatibility diff — new RPC vs pre-migration RPC, all 9 live pages:
**IDENTICAL** after stripping the three additive keys (9/9).

| Test | Scenario | Result |
|---|---|---|
| A | Canada+T-shirt hero → Canada tshirt > Canada generic > global tshirt; USA rejected | PASS |
| B | USA+Hoodie factory → USA hoodie > USA generic > global hoodie; Canada rejected | PASS |
| C | Texas ranking, all 6 tiers exact (1600/1400/1200/1000/900/500); alt = "Custom T-Shirts manufacturing facility serving buyers in Texas, United States" | PASS |
| D | Dallas → Texas → USA → Global (7-tier chain); Toronto/California/Canada rejected | PASS |
| E | Override beats everything; hybrid honors manual; automatic ignores manual | PASS |
| F | Inactive image (priority 9999) never selected | PASS |
| G | Draft page → RPC returns null; published sanity page renders | PASS |
| H | 100 identical calls → 100 identical results | PASS |
| I | Geography-less page → global product > global default; geo images rejected | PASS |
| J | Factory-only image never serves other slots; `compatible_sections` opt-in works | PASS |

Verification suite: **13/13 PASS** (runs in 1.2 s even at 100k pages).
`materialize_seo_page_images` and `debug_seo_image_candidates` exercised.

### Performance (Phase 10, local: 100,010 pages / 2,220 images)

* resolver: **~0.6 ms/call** (1000 distinct pages: 560 ms)
* full `get_seo_page_render`: **~4.8 ms/page** (100 distinct pages: 480 ms)
* candidate scan `EXPLAIN ANALYZE` at 2.2k images: 0.36 ms (seq scan is
  optimal at this size); at **52k images** the planner switches to
  BitmapOr(`image_library_resolver_idx` + GIN compat index): **1.9 ms**,
  resolver ~2.2 ms/call. No unindexed full-table scan at scale.

## 10. Production build

`next build` (Next.js 16.2.10): ✓ compiled, ✓ TypeScript, ✓ 4/4 static pages,
no warnings. Representative routes served by `next start` against the NEW
RPC (via a local shim → local Postgres): country / state / guide pages
HTTP 200 with hero + OG image + robots meta; junk slug → 404; a page flipped
to pure `automatic` mode (zero manual rows) renders correctly end-to-end;
no hydration errors logged.

## 11. Security impact

* **Pre-existing critical finding (unchanged by this work, must be fixed
  separately):** RLS is disabled on 32 public tables and the anon key has
  write grants — anyone with the shipped anon key can modify SEO data.
  This migration does **not** enable RLS (doing so blindly would break public
  rendering through the invoker-rights RPC). Safe order when tackling it:
  add read-only policies for the tables the RPC touches first, revoke anon
  DML grants, then enable RLS table-by-table.
* This change **reduces** exposure slightly: `debug_seo_image_candidates` and
  `materialize_seo_page_images` are revoked from `public`/`anon`/
  `authenticated` and granted to `service_role` only.
* All functions pin `search_path = public`; the resolver is STABLE and
  read-only; the render RPC keeps returning only `status='published'` pages.

## 12. Operating the engine

* **New page, zero inserts:** create the page with entity ids and
  `image_assignment_mode='automatic'` — images resolve dynamically.
* **Editorial override:** insert a `seo_page_images` row with
  `source='override'` (wins in every mode), or set
  `hero_image_override_url` / `meta_image_id` on the page.
* **Explain a choice:** `select * from debug_seo_image_candidates(page_id,
  'hero');` (service role).
* **Add a geo/product image:** insert into `image_library` with the right
  entity ids + `section_target`; it is picked up on the next render, no
  per-page work.
* **Alt templates:** `{{product}} {{country}} {{state}} {{city}} {{industry}}
  {{buyer_type}} {{material}} {{service}} {{section}} {{brand}}`; unfillable
  placeholders are stripped; use geo placeholders only on images that
  genuinely depict that geography; `alt_template=''` keeps decorative images
  silent.

## 13. Final verdict

```text
DETERMINISTIC IMAGE ENGINE: PASS
Geographic matching: PASS
Product matching: PASS
Section matching: PASS
Manual override: PASS
Stable fallback: PASS
Frontend compatibility: PASS
Published-page protection: PASS
Production build: PASS
Safe for merge review: YES
```

(“PASS” = verified on the local replica; production apply is intentionally
deferred until the migration + rollback SQL are reviewed.)
