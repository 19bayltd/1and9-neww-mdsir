# Forensic Audit — Verification of Reality

**Date:** 2026-07-09
**Method:** physical evidence only — `git` history (all remote branches, fetched fresh), the working filesystem, the GitHub PR record (via API), and the live Supabase database (`pg_get_functiondef` executed today). No reliance on prior conversation memory.
**Verdict up front:** **Nothing is lost, nothing was hallucinated, and no code disappeared.** The mismatch you observed has one root cause: **two different Claude sessions worked on this repository in parallel on Jul 8**, and the audit session's reports describe the repository *as it existed at its start point* (`main @ e1f47f5`), while another session's work (PRs #3/#4, which created `src/lib/seo/*` and switched the frontend to `get_seo_page_render`) was merged into `main` underneath it. Every file is accounted for in git history. Full evidence follows.

---

## PART 0 — The reconstructed timeline (all times UTC, from commit/PR metadata)

| When | Event | Evidence |
|---|---|---|
| Jul 7 12:57 | **PR #2 merged** → `main = e1f47f5`. Frontend calls `get_landing_page_view`. | merge commit e1f47f5; PR #2 record |
| Jul 8 01:06 | **Session B** (`session_01TWuh9dR3BewWreBruyLk1o`) commits **7a3748e** on branch `claude/seo-page-render-engine-zfm0qu`: deletes `src/components/landing/*`, creates `src/components/seo/*` (incl. `SectionRenderer.tsx`), `src/lib/seo/getSeoPageRender.ts`, `imageResolver.ts`, `src/types/seo.ts`, `supabase/cleanup_review.sql`; deletes `src/lib/landing.ts`. Opens **PR #3** (01:13). | commit 7a3748e; PR #3 record |
| Jul 8 01:23 | Session B commits **7513e2a** on branch `restore-old-ui-with-rpc`: **restores** all `src/components/landing/*`, **deletes** `src/components/seo/*`, recreates `src/lib/landing.ts` (types + adapter target), adds `src/lib/seo/mapRpcToLandingProps.ts`. Opens **PR #4** (01:23). | commit 7513e2a; PR #4 record |
| Jul 8 01:33 | Session B commits **b34dc32**: adapter passes through `products` + `internal_links` from the RPC. | commit b34dc32 |
| Jul 8 01:58 | **Session A — the audit session** (`session_01EQYtAediFJJuwebT4feJyx`, this one) commits **acf7a34** (`docs/DATABASE_MANUAL.md`) on `claude/apparel-db-audit-2n2ab7`, **branched from e1f47f5**. Its workspace never contained Session B's branches. | commit acf7a34; branch merge-base |
| Jul 8 10:33 | **You merge PR #4 (and #3, same lineage)** → `main = 69dc510`. Frontend now calls `get_seo_page_render` via adapter. | merge 69dc510; PR #3/#4 `merged_at: 2026-07-08T10:33Z` |
| Jul 8 11:01 | Session A commits **73f79f7** (`docs/SYSTEM_CONSTITUTION.md`) — still on the e1f47f5-based tree, **28 minutes after main had moved**, without re-fetching. | commit 73f79f7 |
| Jul 9 06:46 | You merge **PR #5** (the two docs) → `main = 47eaea8` (current). | merge 47eaea8; PR #5 record |

Two sessions, three PRs, one repository. That is the entire mystery.

---

## PART 1 — Verify previous claims

### 1a. Claims made by **this audit session** (Session A) — what "yesterday's reports" actually asserted

| Claim | Reality | Exists? | Path / Commit | Status |
|---|---|---|---|---|
| Created `docs/DATABASE_MANUAL.md`, committed, pushed | Verified in tree and history | **YES** | `docs/DATABASE_MANUAL.md` · acf7a34 · now on `main` via PR #5 | ✅ TRUE |
| Created `docs/SYSTEM_CONSTITUTION.md`, committed, pushed | Verified | **YES** | `docs/SYSTEM_CONSTITUTION.md` · 73f79f7 · on `main` | ✅ TRUE |
| "Database was not modified" (read-only audit) | Session A ran only SELECT queries; no DDL/DML commits or migrations exist from it | — | — | ✅ TRUE |
| "The frontend calls `get_landing_page_view`; `get_seo_page_render` is referenced nowhere in the repo" | **True for the tree it audited (`e1f47f5`) and true for `origin/main` until Jul 8 10:33 UTC.** **FALSE for current `main`** — PR #4 switched the frontend to `get_seo_page_render` via `src/lib/seo/*`. | — | `main:src/app/[slug]/page.tsx` imports `getSeoPageRender` | ⚠️ **STALE — now incorrect for main.** The constitution (pushed 11:01 UTC) shipped 28 min after this became false; the session never re-fetched. Explicitly acknowledged as an error of staleness. |
| "`get_seo_page_render` leaks drafts (no status filter)" | Re-verified live today against the database | **YES** | live `pg_get_functiondef` | ✅ Still true |
| "Image assignment system (`image_library`/`seo_page_images`) is not consumed by the live site" | **Was true at e1f47f5. FALSE on current main** — PR #4's `imageResolver.ts` consumes `assigned_images` from the RPC. | — | `main:src/lib/seo/imageResolver.ts` | ⚠️ STALE — superseded by PR #4 |
| Security findings (RLS off on 32/33 tables, anon write grants, generators publicly executable) | Re-verified this session against live DB | — | live `pg_policies` / grants queries | ✅ Still true (unchanged) |

### 1b. The claims you listed — **none of these were made by this session.** They match **Session B's commits/PRs** (`session_01TWuh9dR3BewWreBruyLk1o`, PRs #3/#4). Verified physically anyway:

| Claim (from PR #3/#4) | Reality | Exists on `main`? | Physical path | Introduced by | Current status |
|---|---|---|---|---|---|
| "Created `src/lib/seo/getSeoPageRender.ts`" | File exists, calls `supabase.rpc("get_seo_page_render", { p_slug })` | **YES** | `src/lib/seo/getSeoPageRender.ts` | 7a3748e (modified b34dc32) | ACTIVE — imported by `[slug]/page.tsx` |
| "Created `imageResolver.ts`" | Exists; resolves `assigned_images` by `section_target` | **YES** | `src/lib/seo/imageResolver.ts` | 7a3748e | ACTIVE |
| "Created `mapRpcToLandingProps.ts`" | Exists; adapts RPC payload → landing view-model | **YES** | `src/lib/seo/mapRpcToLandingProps.ts` | 7513e2a (modified b34dc32) | ACTIVE |
| "Created `SectionRenderer.tsx`" | **Existed only temporarily.** Created 7a3748e in `src/components/seo/`, **deleted** 25 minutes later by 7513e2a. Not on `main`. Recoverable from branch `claude/seo-page-render-engine-zfm0qu`. | **NO** (on main) | was `src/components/seo/SectionRenderer.tsx` | 7a3748e → deleted 7513e2a | TEMPORARY / superseded |
| "Deleted landing components" | Happened in 7a3748e (all 14 `src/components/landing/*` deleted) | — | — | 7a3748e | Reversed by 7513e2a |
| "Restored landing components" | 7513e2a restored all 14 files byte-for-byte (minus deliberate edits to `IntroSection`/`FAQSection`) | **YES** | `src/components/landing/*` (14 files) | 7513e2a | ACTIVE on main |
| "Added products to RPC" / "Added internal links to RPC" | Live DB verified **today**: `get_seo_page_render` returns `products` and `internal_links` (also `page`, `section_blocks`, `assigned_images`, `faqs`). The repo has no migration files, so *when* the DB function gained them cannot be proven from git — only that they are present now. | **YES** (in DB) | live `pg_get_functiondef` | n/a (DB change, no migration in repo) | ACTIVE |
| "Restored old UI" | Current `main` renders through the original `PSEOPageRenderer` + landing components, fed by the new RPC via adapter | **YES** | `main:src/app/[slug]/page.tsx` | PR #4 merge 69dc510 | ACTIVE — this **is** production frontend code |

**Conclusion for Part 1:** every file claim from both sessions is physically accounted for. The only incorrect statements were Session A's (my) frontend-dependency claims **as applied to current main** — accurate when written against `e1f47f5`, stale after your 10:33 UTC merge of PR #4, and the constitution was pushed once after that point without re-checking the remote. That is the error, stated plainly.

---

## PART 2 — Filesystem audit (working tree, now synced to `origin/main` @ 47eaea8)

```
.env.example
.gitignore
AGENTS.md
CLAUDE.md
README.md
docs/DATABASE_MANUAL.md
docs/SYSTEM_CONSTITUTION.md
docs/FORENSIC_AUDIT.md          ← this document
eslint.config.mjs
next.config.ts
package.json / package-lock.json
postcss.config.mjs
public/{file,globe,next,vercel,window}.svg
src/app/[slug]/page.tsx
src/app/favicon.ico
src/app/globals.css
src/app/layout.tsx
src/app/page.tsx
src/app/sitemap.xml/route.ts
src/app/sitemaps/[group]/route.ts
src/components/landing/BuyerSolutionsSection.tsx
src/components/landing/FAQSection.tsx
src/components/landing/FooterTrustBar.tsx
src/components/landing/HeroSection.tsx
src/components/landing/IconGridSection.tsx
src/components/landing/IntroSection.tsx
src/components/landing/PSEOPageRenderer.tsx
src/components/landing/ProcessSection.tsx
src/components/landing/RFQSection.tsx
src/components/landing/RelatedProductsSection.tsx
src/components/landing/SectionShell.tsx
src/components/landing/StatsSection.tsx
src/components/landing/_shared.tsx
src/components/landing/icons.tsx
src/lib/landing.ts
src/lib/seo/getSeoPageRender.ts
src/lib/seo/imageResolver.ts
src/lib/seo/mapRpcToLandingProps.ts
src/lib/supabase.ts
src/types/seo.ts
supabase/cleanup_review.sql
tsconfig.json
```

- `src/lib/seo/` — **exists** (3 files, from PRs #3/#4).
- `src/components/seo/` — **does not exist** (existed only between 7a3748e and 7513e2a).
- `supabase/` — exists; contains only `cleanup_review.sql` (a commented-out, review-only drop plan from Session B). **No migrations directory** — DB functions are not version-controlled in this repo.

---

## PART 3 — GitHub audit (claims vs repository)

**Files that actually exist on `origin/main`:** everything in Part 2's tree.

**Files that never existed anywhere in history:** none of the names you listed — every one appears in history. (Verified with `git log --all` per path; no dangling objects: `git fsck` clean.)

**Files that existed only temporarily** (created 7a3748e Jul 8 01:06, deleted 7513e2a Jul 8 01:23; still recoverable from branch `claude/seo-page-render-engine-zfm0qu`):
`src/components/seo/`: `BuyerSolutionsSection.tsx`, `CustomizationSection.tsx`, `FAQSection.tsx`, `HeroSection.tsx`, `IntroSection.tsx`, `ManufacturingSection.tsx`, `ProductionProcessSection.tsx`, `RFQSection.tsx`, `RelatedProductsSection.tsx`, `SectionRenderer.tsx`, `WhyChooseUsSection.tsx`, `shared.tsx`.

**Files deleted then restored:** all 14 `src/components/landing/*` files and `src/lib/landing.ts` (deleted 7a3748e, restored 7513e2a — on main today).

**Files missing:** none. Nothing referenced by any import on `main` is absent; `npx`-level check: every `@/lib/*`, `@/components/*`, `@/types/*` import on main resolves to an existing file.

**Why GitHub shows PR #3 as "merged" although its files aren't on main:** PR #4's branch was built *on top of* PR #3's commits; when you merged #4, GitHub auto-marked #3 merged (its commits are ancestors of the merge). PR #4's later commits had already deleted `src/components/seo/*` — so PR #3's files are in history but not in the final tree. This is almost certainly the single most confusing artifact you encountered.

---

## PART 4 — Vercel audit

**Direct limitation, stated honestly:** this sandbox's network policy blocks requests to `1and9-neww-mdsir.vercel.app` (proxy CONNECT 403), and no Vercel API tool is available in-session. I cannot read the deployed source from here. What the evidence supports:

- **Which commit should be deployed:** Vercel's default Git integration deploys `main` on push. Current `origin/main` = **47eaea8** (Jul 9 06:46 UTC). If production shows an older build, check the Vercel dashboard → Deployments → the commit SHA on the latest Production entry. **Needs confirmation from your dashboard** — verify it says `47eaea8` (or at minimum `69dc510`+).
- **Does deployed source match GitHub?** If the deployed commit is 47eaea8/69dc510 — yes, and what you saw on Vercel (files `src/lib/seo/*`, adapter, `get_seo_page_render` usage) **matches GitHub main exactly**. That is consistent with your report of a mismatch *against the audit documents*, not against GitHub.
- **Does deployed source match yesterday's audit?** **No — and now we know exactly why:** the audit describes `main @ e1f47f5` (pre-PR #4). The deployment follows `main`, which moved twice after the audit branch was cut (PR #4 at 10:33 UTC Jul 8, PR #5 at 06:46 UTC Jul 9). The deployed source is *newer* than the audited source. Nothing was lost in deployment; the documents lag the code.
- One operational note from `main`'s code: the homepage is now `force-dynamic` and queries `seo_pages` directly, and `next.config.ts` now allowlists image hosts — if the production build predates PR #4 you'd see the old hardcoded homepage ("PSEO Landing Pages" with 5 sample links); if it postdates it you'll see "Custom Apparel Manufacturing" with a DB-driven list of the 3 published pages. That's a 10-second visual check to confirm which commit is live.

---

## PART 5 — Git history audit

- **Current branch:** `claude/apparel-db-audit-2n2ab7`, reset today onto `origin/main` (its PR #5 was merged, so per policy it restarts from the default branch; previous tip 73f79f7 is fully contained in main — nothing lost).
- **Current HEAD:** 47eaea8 + this document's commit.
- **Remote branches (all fetched, none deleted):**
  - `origin/main` → 47eaea8 ✅ source of truth
  - `origin/claude/apparel-db-audit-2n2ab7` → 73f79f7 (merged via PR #5)
  - `origin/restore-old-ui-with-rpc` → b34dc32 (merged via PR #4)
  - `origin/claude/seo-page-render-engine-zfm0qu` → 7a3748e (merged via PR #3 marker; its unique tree state — `src/components/seo/*` — is only reachable here)
  - `origin/pseo-ui-layout-match-v1` → 418a89d (merged via PR #2)
  - `origin/claude/1and9-pseo-frontend-ofjhw2` → 9cd812c (merged via PR #1)
- **Merged branches:** all of the above are merged into main (directly or as ancestors).
- **Unmerged branches:** none containing unique code. (`claude/seo-page-render-engine-zfm0qu`'s *tree* differs from main, but its *commits* are merged ancestors.)
- **Detached/orphan commits:** none (`git fsck --no-reflogs`: clean).
- **Stashes:** none.
- **Unpushed commits:** none after this document is pushed. (The container's stale local `main` pointer at b13fe82 was just a local artifact of the clone; irrelevant and now bypassed.)
- **Anything explaining "disappeared" code:** the only code that ever disappeared from a tree is `src/components/seo/*`, deleted by Session B's own follow-up commit 7513e2a ("Restore original landing UI") — an intentional supersession, preserved in history.

---

## PART 6 — RPC audit (live database, executed today)

`get_seo_page_render(p_slug text)` — **verified against the running database via `pg_get_functiondef`, not from memory.** It genuinely returns all six groups:

| Key | Present in live definition | Notes |
|---|---|---|
| `page` | ✅ | id, slug, title, h1, meta_title, meta_description, layout_variant_id |
| `section_blocks` | ✅ | from `seo_content_blocks`, ordered by `display_order` (exposed as `position`; aliases `section_key`/`block_key`, `title`/`heading`) |
| `assigned_images` | ✅ | `seo_page_images` ⨝ `image_library`, both `is_active`, ordered by section_name, display_order |
| `faqs` | ✅ | entity-scope matched, ordered `display_order, priority desc` |
| `products` | ✅ | `seo_page_products` ⨝ `seo_entities`, override coalescing, ordered |
| `internal_links` | ✅ | object keyed by `link_group`; **targets filtered to `status='published'`** |

The full verbatim definition is reproduced in `docs/DATABASE_MANUAL.md` §D.2 and was re-pulled today (definition md5 `1a9934e0…`). Two properties re-confirmed today: it has **no `status` filter on the page itself** (drafts render through it — now a *live production concern*, see Part 9) and no `search_path` pin. `get_landing_page_view` also still exists in the DB (md5 `b652fb5…`) — now **unused by the frontend** (the roles of the two RPCs have exactly swapped since the audit).

---

## PART 7 — Frontend audit (current `origin/main`)

- **Rendering starts at:** `src/app/[slug]/page.tsx` (dynamic route; also `generateMetadata` there).
- **Route rendering SEO pages:** `/[slug]` — single-segment (nested slugs like `guides/...` still cannot render; unchanged).
- **Actually used (import-traced):**
  - `src/lib/seo/getSeoPageRender.ts` → RPC `get_seo_page_render` ✅
  - `src/lib/seo/mapRpcToLandingProps.ts` (adapter) ✅
  - `src/lib/seo/imageResolver.ts` (assigned_images → per-section image) ✅
  - `src/types/seo.ts` (RPC payload types) ✅
  - `src/components/landing/*` — **all 14 files imported and live** (PSEOPageRenderer orchestrates; sections consume the adapted view-model)
  - `src/lib/landing.ts` — still live but **demoted**: it now only exports the view-model *types* + `blockByKey()`; `fetchLandingPage()` and the `get_landing_page_view` call are **gone** from it
  - `src/lib/supabase.ts` — client; also used by homepage (direct `seo_pages` select), sitemap routes, RFQ insert
- **Dead code in the tree:** none — every file on main is imported. The dead artifact is *in the database*, not the repo: RPC `get_landing_page_view` no longer has any caller.
- **Never-imported files:** none on main. (The never-imported set — `src/components/seo/*` — was deleted before merge.)

---

## PART 8 — Dependency audit: the ACTUAL execution chain

`GET /custom-t-shirt-manufacturer-usa` on current main:

```
Next.js route  src/app/[slug]/page.tsx
      │  const getPage = cache(getSeoPageRender)
      ▼
RPC            supabase.rpc('get_seo_page_render', { p_slug: 'custom-t-shirt-manufacturer-usa' })
      │  ← jsonb: page, section_blocks, assigned_images, faqs, products, internal_links
      │  (null payload → notFound(); RPC error → 503 UI)
      ▼
Adapter        mapRpcToLandingProps(data)
      │  • section_blocks → content_blocks (position → sort_order)
      │  • images: EXCLUSIVELY from assigned_images via getSectionImage()
      │    (section_blocks.image_url deliberately ignored)
      │  • faqs/products/internal_links passed through
      │  • country_assets: hardcoded null  ← NOTE: country enrichment no longer renders
      ▼
Orchestrator   PSEOPageRenderer (unchanged visual system)
      ▼
Components     HeroSection · IntroSection (now gallery from assigned_images) · StatsSection ·
               IconGridSection ×2 · ProcessSection · BuyerSolutionsSection ·
               RelatedProductsSection · RFQSection (insert → quote_requests) · FAQSection (+JSON-LD) ·
               FooterTrustBar
      ▼
HTML           + generateMetadata(): title/description from page, OG image from assigned hero image
```

Differences from the *audited* chain (what changed underneath the documents): the RPC (`get_landing_page_view` → `get_seo_page_render`), the adapter layer (new), the image source (block URLs → `assigned_images`), the homepage (hardcoded samples → live DB query), and **three functional consequences**:
1. **Draft pages are now publicly renderable** — `get_seo_page_render` has no `status='published'` filter, and it's now the production data path. (The audited RPC filtered drafts; the swap silently removed that gate.) The homepage only *lists* published pages, but a direct URL to a draft slug renders.
2. **`country_assets` no longer reaches the page** (adapter emits `null`) — trust badges, currency chip, shipping text, factory message, and the country meta/OG image fallback no longer render.
3. **Canonical/robots are no longer emitted** — the new `generateMetadata` sets neither `alternates.canonical` nor `robots` (the old page.tsx set both from the RPC; `get_seo_page_render` doesn't return them).

---

## PART 9 — Inconsistency report

| # | Yesterday's claim (audit docs) | Actual repository state (main @ 47eaea8) | Evidence | Explanation | Severity |
|---|---|---|---|---|---|
| 1 | "Frontend calls `get_landing_page_view`; `get_seo_page_render` referenced nowhere in repo" | Frontend calls `get_seo_page_render`; `get_landing_page_view` referenced nowhere | `main:src/app/[slug]/page.tsx` L5; `git grep` on main | True at e1f47f5; inverted by PR #4 (merged Jul 8 10:33 UTC) after the audit branch was cut | **HIGH** (doc accuracy) — roles of the two RPCs have fully swapped |
| 2 | "`src/lib/seo/*` does not exist" (implicit in file inventory §J) | Three files exist + `src/types/seo.ts` + `supabase/cleanup_review.sql` | `git ls-tree origin/main` | Added by PRs #3/#4 from the parallel session | HIGH (doc accuracy) |
| 3 | "Image assignment system is dormant / not consumed" | `imageResolver.ts` consumes `assigned_images` on every page | `main:src/lib/seo/imageResolver.ts` | PR #4 adopted the image system (resolving the manual's §H open decision — in favor of adoption) | MEDIUM — manual §H decision point is now decided |
| 4 | "`get_seo_page_render` is LEGACY/unused → cleanup candidate" (manual §L, constitution Part 15 "DEPRECATED") | It is the **production** RPC | live DB + main imports | Same root cause; the deprecation recommendation must be **withdrawn** — deprecating it now would take down every page | **CRITICAL if acted on** — do NOT execute manual §L / cleanup_review.sql items touching this RPC |
| 5 | "Draft pages cannot leak: render RPC filters `status='published'`" | **No longer true in production** — the now-live RPC has no status filter | live `pg_get_functiondef` today | The safety property belonged to the *old* RPC and didn't survive the swap | **HIGH (live SEO/product risk)** — new finding, not just stale docs |
| 6 | "country_assets feeds hero fallback, badges, currency, OG image" | Adapter hardcodes `country_assets: null`; none of it renders | `main:src/lib/seo/mapRpcToLandingProps.ts` | PR #4 didn't port country assets into the new RPC path | MEDIUM (feature regression on main) |
| 7 | "Canonical + robots emitted per page from RPC" | Current `generateMetadata` emits neither | `main:src/app/[slug]/page.tsx` | `get_seo_page_render` doesn't return `canonical_url`/`robots`; PR #4's metadata dropped them | **HIGH (SEO)** — no canonical, no robots meta on any landing page |
| 8 | Product cards 404 (`/t-shirts`), nested-slug guide unroutable, sitemap chunk-2 gap, security posture (RLS off etc.) | All re-verified unchanged | live DB + main source | Untouched by PR #4 | Same severities as documented |
| 9 | This session's own work: two docs created/pushed/merged | Confirmed on main | tree + PR #5 | — | ✅ consistent |

**Explicit acknowledgment:** claims 1–4 were written by me. They were accurate snapshots of the tree this session was given (`e1f47f5`) — git proves that — but the constitution was pushed at 11:01 UTC, 28 minutes *after* PR #4 changed reality, and this session never re-fetched before publishing. Rows 1–4 are therefore **incorrect statements about current main published under this session's name**, regardless of when they were first true. The documents need an addendum before anyone acts on §L (cleanup) or §K/§O (lock plan) — several of their recommendations now point at production components.

---

## PART 10 — Root cause

Determined from git evidence only, by elimination:

- ~~Wrong branch~~ — partially: the audit session worked on a correct-at-the-time base (`e1f47f5`) but never re-synced. Its own deliverables (docs) are intact and merged.
- ~~Wrong deployment~~ — no evidence; deployment follows main (confirm SHA in dashboard).
- ~~Unmerged branch~~ — no unique unmerged work exists.
- ~~Local-only changes~~ — none (no stashes, no unpushed, no dirty tree).
- ~~Deleted/reverted commits~~ — `git fsck` clean; every commit reachable; nothing force-pushed away.
- ~~Hallucinated file creation~~ — every claimed file exists in history at the claimed content; the "phantom" files (`SectionRenderer.tsx` etc.) are real commits, superseded 17 minutes later by their own author's follow-up, and GitHub's auto-"merged" marker on PR #3 made that supersession look like a merge of files that never reached main.

**Root cause, precisely:** **concurrent sessions + a moving default branch + a non-refreshing audit workspace.** Session B (PRs #3/#4) rebuilt the data layer during the same hours Session A (this one) audited a frozen clone of the previous main. You merged B's work mid-day; A published its second document afterward without fetching. The documents describe `e1f47f5`; the repo and deployment are `47eaea8`. No code was ever lost, and no report invented files — but the audit documents are stale on every frontend-dependency claim, and staleness in a published report is an error, which I own.

---

## PART 11 — Recovery plan (no code modified; recommendations only)

1. **The source of truth is `origin/main` @ 47eaea8.** It is internally consistent (all imports resolve), contains both sessions' surviving work, and every historical state remains reachable via the five preserved branches. **GitHub is correct.**
2. **Which branch should be production: `main`, as-is.** No rollback, no force-push, no branch surgery is needed or advisable. The only branch action taken in this forensic pass: `claude/apparel-db-audit-2n2ab7` was restarted from current main to carry this document (its old tip is fully merged; nothing discarded).
3. **Vercel:** almost certainly correct (tracks main). Confirm in the dashboard that the latest Production deployment SHA is 47eaea8 (or redeploy). 10-second visual check: homepage headline "Custom Apparel Manufacturing" with a 3-item live list = post-PR #4 build; "PSEO Landing Pages" with 5 hardcoded links = stale build.
4. **Yesterday's audit:** database-layer content (schema, tables, constraints, security, data quality, generators, sitemap RPCs) is **still accurate — re-verified live today**. Frontend-dependency content (§D.1-usage/§J of the manual; the RPC-role and image-system passages of the constitution) is **superseded by PR #4** and must not be acted on as-written. Priority correction: *do not* deprecate `get_seo_page_render` (it is production); the deprecation candidate is now `get_landing_page_view`. I can produce that addendum/revision on request.
5. **Has anything been lost? No.** Full accounting: all 14 landing components — on main; `src/lib/seo/*` — on main; `src/components/seo/*` incl. `SectionRenderer.tsx` — superseded by its own author, recoverable any time from `claude/seo-page-render-engine-zfm0qu` (7a3748e); both audit documents — on main; database — untouched by both audit passes, and both RPCs still exist.
6. **Three *new* production findings surfaced by this forensic pass** (side-effects of PR #4 worth fixing soon, listed by urgency): (a) the live render RPC no longer filters drafts — draft slugs render publicly; (b) landing pages currently emit **no canonical and no robots metadata**; (c) `country_assets` enrichment (badges, currency, shipping text, OG fallback) no longer renders. None of these require rollback — each is a small forward fix in either the RPC or the adapter/metadata layer.

---

*Every statement in this document is backed by a command output produced today: `git fetch/branch/log/ls-tree/show/grep/fsck/stash`, the GitHub PR API, and live `pg_catalog` queries. Where this environment could not observe something directly (the Vercel deployment SHA), that is stated as needing dashboard confirmation rather than asserted.*
