# Frontend → Database Mapping Audit (Evidence-Based)

**Date:** 2026-07-09 · **Code:** `main` @ `47eaea8` · **DB:** Supabase "1 & 9 SEO" (`sotbdgqytbatifkgbewb`)
Every claim below is backed by the actual RPC SQL (`pg_get_functiondef`) and the actual React source. Nothing is assumed.

---

## 0. The shared data spine (applies to every section)

**One RPC feeds the whole page.** From the live function definition of `public.get_seo_page_render(p_slug)`:

```sql
select jsonb_build_object(
  'page', jsonb_build_object('id',p.id,'slug',p.slug,'title',p.title,'h1',p.h1,
          'meta_title',p.meta_title,'meta_description',p.meta_description,
          'layout_variant_id',p.layout_variant_id),
  'section_blocks',  ... from seo_content_blocks cb where cb.page_id = p.id order by cb.display_order,
  'assigned_images', ... from seo_page_images spi join image_library il on il.id = spi.image_id
                         where spi.page_id = p.id and spi.is_active and il.is_active,
  'faqs',            ... from seo_faqs f where f.is_active = true and (entity-scope match ...),
  'products',        ... from seo_page_products pp join seo_entities e on e.id = pp.product_entity_id
                         where pp.page_id = p.id,
  'internal_links',  ... from seo_internal_links l join seo_pages tp on tp.id = l.target_page_id
                         where l.source_page_id = p.id and tp.status = 'published'
) from seo_pages p where p.slug = p_slug limit 1;
```

**Universal render path** (every file involved):

```
PostgreSQL (seo_pages, seo_content_blocks, seo_page_images, image_library,
            seo_faqs, seo_page_products, seo_entities, seo_internal_links)
  ↓ get_seo_page_render(p_slug)                        [SQL above]
src/app/[slug]/page.tsx            const getPage = cache(getSeoPageRender)
  ↓
src/lib/seo/getSeoPageRender.ts    supabase.rpc("get_seo_page_render", { p_slug: slug })
  ↓
src/lib/seo/mapRpcToLandingProps.ts  (shape adapter; images swapped to assigned_images)
  + src/lib/seo/imageResolver.ts     (getSectionImage: section key → image_library.section_target)
  ↓
src/components/landing/PSEOPageRenderer.tsx   (sorts by sort_order, maps block_key → component,
                                               wraps each in SectionShell.tsx)
  ↓
<Section>.tsx (+ _shared.tsx Paragraphs, icons.tsx)  →  HTML
```

**Universal ordering evidence** — section order is DB data, not code:

```tsx
// PSEOPageRenderer.tsx
const blocks = [...(data.content_blocks ?? [])]
  .filter((b): b is ContentBlock => Boolean(b && b.block_key))
  .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));   // = seo_content_blocks.display_order
```

**Universal copy evidence** — every section's heading/body render the block row verbatim:

```tsx
{block.heading ? <h3 ...>{block.heading}</h3> : null}
<Paragraphs text={block.body} />          // _shared.tsx splits body on newlines into <p>
```

**Universal hardcoded layer** — these are code, not DB, on every section:
- Section **titles** in the left rail (`sectionTitle()` overrides map in PSEOPageRenderer: "Manufacturing Overview", "Why 1 & 9 Apparel", …) — the DB `block_key` picks which label, but the label text is hardcoded. Unknown keys get auto-prettified from the key itself.
- Section **numbers** ("01"…"?") — derived from DB order, formatted in code.
- The sticky **nav** (5 anchor links, "Get a Quote" button), all **colors** (#FFC400/#0A0A0A), spacing, fonts, **icons** (`icons.tsx` inline SVG), animations/hover states — all code.

---

## 1. Hero

**Verdict: Partially DB Driven** (headline/description/image/MOQ from DB; chips, CTAs, quote-card mock are code)

**DB sources:** `seo_content_blocks` (block_key='hero'), `seo_pages` (h1, title, meta_description fallbacks), `seo_page_images` ⨝ `image_library` (hero image), `seo_page_products` ⨝ `seo_entities.attributes` (MOQ). `country_assets` fields appear in the code but are **always null** post-PR#4 (adapter: `country_assets: null`).

**Render path:** RPC → adapter → `PSEOPageRenderer` → **`HeroSection.tsx`** (rendered outside SectionShell, before the numbered sections).

**DB fields used:** `hero` block: `heading`, `body`, `image_url` (adapter-injected from assigned_images), `image_alt`; `page`: `h1`, `title`, `meta_description`; `products[]`: `moq` (min).

**Evidence:**
```tsx
const hero = blockByKey(data.content_blocks, "hero");
const title = hero?.heading || page.h1 || page.title || "Custom Apparel Manufacturing";
const description = hero?.body || page.meta_description || assets.factory_message;
const heroImage = hero?.image_url || page.hero_image_url || assets.hero_image_url;
const moq = resolveMoq(products);                 // Math.min of products[].moq, else 300
...
<h1 ...>{head}{accent ? <span className="text-[#FFC400]">{accent}</span> : null}</h1>
{heroImage ? <img src={heroImage} ... className="...opacity-25" /> : null}
```
The last word of the DB headline gets the yellow accent via `splitHeadline()` (code behavior, DB text).

**Hardcoded:** "Private Label • OEM • ODM • Low MOQ" line; both CTA buttons ("Get Instant Quote →" → `#rfq`, "View Products" → `#related-products`); the 4 stat chips (`MOQ FROM <db>` value is DB; "OEM/ODM SERVICE", "DDP SHIPPING", "FACTORY DIRECT PRICE" are code); the entire right-hand "Get Your Instant Quote" card (labels + placeholders, non-functional visual shortcut to #rfq); trust badges + shipping text (code exists, data source `country_assets` is disconnected → never renders).

**Modify from DB?** Headline YES (`heading`/h1) · description YES (`body`) · hero image YES (`seo_page_images` hero row) · MOQ chip value YES (`seo_page_products.moq`) · service-mode line NO · CTA labels/targets NO · stat chips PARTIAL (1 of 4 values) · quote-card mock NO · trust badges NO (until country_assets is re-attached to the RPC).

---

## 2. Intro

**Verdict: Partially DB Driven** (heading, body, entire image grid from DB; 4 feature chips are code)

**DB sources:** `seo_content_blocks` (block_key='intro'), `seo_page_images` ⨝ `image_library` (gallery = all non-hero assigned images), `seo_entities.attributes.image_url` / `seo_page_products.image_override_url` (product images pad the grid).

**Render path:** RPC → adapter (builds `gallery_images` from assigned_images) → `PSEOPageRenderer` case `"intro"` → **`IntroSection.tsx`**.

**DB fields used:** block `heading`, `body`, `image_url`, `image_alt`; `assigned_images[]`: `image_url`, `alt`, `display_order`, `id` (hero excluded); `products[]`: `image_url`, `title`.

**Evidence:**
```tsx
// mapRpcToLandingProps.ts — gallery is DB assigned images, hero excluded, DB-ordered
const gallery_images: GalleryImage[] = (assigned_images ?? [])
  .filter((img) => Boolean(img.image_url) && img.id !== heroImage?.id)
  .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
  .map((img) => ({ url: img.image_url as string, alt: img.alt }));

// IntroSection.tsx
<Paragraphs text={block.body} />
{images.map((img, i) => <img key={img.url} src={img.url} alt={img.alt || ...} />)}
// collectImages() = gallery_images + block.image_url + country_assets(null) + product images, deduped, max 6
```

**Hardcoded:** the 4 `INTRO_FEATURES` chips ("Factory-Direct Manufacturing Partner", "Low MOQ · From 300 Pieces", "Strict Quality Control", "On-Time DDP Delivery") including the **"300"** in the chip text; grid layout (max 6, 4:3 crop).

**Modify from DB?** Heading YES · body YES · gallery images YES (add/remove/reorder `seo_page_images` rows) · feature chips NO.

---

## 3. Manufacturing Overview

**Verdict: Partially DB Driven** (prose from DB; all 5 stat tiles are code)

**DB source:** `seo_content_blocks` (block_key='manufacturing_overview').

**Render path:** RPC → adapter → `PSEOPageRenderer` case `"manufacturing_overview"` → **`StatsSection.tsx`**.

**DB fields used:** `heading`, `body`. (That is all — the block's cta/image fields are unused here; the adapter's image lookup maps this key → image_library target 'factory', but StatsSection never renders `block.image_url`, so the factory image is only visible in the intro gallery.)

**Evidence:**
```tsx
const STATS = [
  { value: "300 pcs", label: "Minimum MOQ", ... },      // HARDCODED
  { value: "7–10 days", label: "Sample Time", ... },     // HARDCODED
  { value: "30–45 days", label: "Production Time", ... },// HARDCODED
  { value: "AQL 2.5", label: "Final Inspection", ... },  // HARDCODED
  { value: "DDP", label: "Shipping Terms", ... },        // HARDCODED
];
{block.heading ? <h3>{block.heading}</h3> : null}
<Paragraphs text={block.body} />
{STATS.map((s) => ... {s.value} ... {s.label} ...)}
```

**Modify from DB?** Heading YES · body YES · the 5 stat values/labels **NO** (note: `quote_configurations` in the DB holds min_moq=300 etc. but nothing reads it — the numbers on screen are code).

---

## 4. Customization Options

**Verdict: Partially DB Driven** (prose from DB; all 7 tiles + lead line are code)

**DB source:** `seo_content_blocks` (block_key='customization_options').

**Render path:** RPC → adapter → `PSEOPageRenderer` case `"customization_options"` → **`IconGridSection.tsx`** (`variant="tile"`, `items=CUSTOMIZATION_ITEMS`, `lead="Fully Customizable. 100% Your Brand."`).

**DB fields used:** `heading`, `body`.

**Evidence:**
```tsx
export const CUSTOMIZATION_ITEMS: IconGridItem[] = [
  { label: "Fabric & GSM", caption: "Cotton, blends & organic — 140–450 GSM.", icon: "fabric" },
  { label: "Color Options", ... }, { label: "Printing", ... }, { label: "Embroidery", ... },
  { label: "Custom Labels", ... }, { label: "Hang Tags", ... }, { label: "Custom Packaging", ... },
];                                                              // ALL HARDCODED
{block.heading ? <h3>{block.heading}</h3> : null}
<Paragraphs text={block.body} />
{lead ? <p ...>{lead}</p> : null}                               // hardcoded lead line
{items.map((item) => ... {item.label} ...)}
```

**Modify from DB?** Heading YES · body YES · the 7 tile labels/captions/icons NO · lead line NO.

---

## 5. Why 1 & 9 Apparel

**Verdict: Partially DB Driven** (prose from DB; all 6 proof cards are code)

**DB source:** `seo_content_blocks` (block_key='why_choose_us').

**Render path:** RPC → adapter → `PSEOPageRenderer` case `"why_choose_us"` → **`IconGridSection.tsx`** (`variant="feature"`, `items=WHY_ITEMS`).

**DB fields used:** `heading`, `body`.

**Evidence:**
```tsx
export const WHY_ITEMS: IconGridItem[] = [
  { label: "Factory Direct Pricing", caption: "Work directly with the production floor...", ... },
  { label: "Low MOQ from 300 pcs", ... }, { label: "Fast Sampling 7–10 Days", ... },
  { label: "Quality Control", ... }, { label: "Private Label & Branding", ... },
  { label: "Worldwide Shipping", caption: "DDP export to the USA, UK, EU, Canada and Australia.", ... },
];                                                              // ALL HARDCODED
{items.map((item) => ... {item.label} ... {item.caption} ...)}
```

**Modify from DB?** Heading YES · body YES · the 6 cards (labels, captions, icons) NO.

---

## 6. Production Process

**Verdict: Partially DB Driven** (prose from DB; the 6-step timeline is code)

**DB source:** `seo_content_blocks` (block_key='production_process').

**Render path:** RPC → adapter → `PSEOPageRenderer` case `"production_process"` → **`ProcessSection.tsx`**.

**DB fields used:** `heading`, `body`.

**Evidence:**
```tsx
const STEPS = [
  { label: "Submit Your Design", caption: "Send your design or tech pack.", ... },
  { label: "Sampling", ... }, { label: "Approval", ... }, { label: "Production", ... },
  { label: "Quality Check", ... }, { label: "Delivery", ... },
];                                                              // ALL HARDCODED
{STEPS.map((step, i) => ... {i + 1} ... {step.label} ... {step.caption} ...)}
```

**Modify from DB?** Heading YES · body YES · step count/labels/captions/numbering NO.

---

## 7. Buyer Solutions

**Verdict: Partially DB Driven** (prose + link *targets* from DB; the 7 segment cards are code)

**DB sources:** `seo_content_blocks` (block_key='buyer_solutions'); `seo_internal_links` ⨝ `seo_pages` (link targets, published-only via RPC).

**Render path:** RPC → adapter → `PSEOPageRenderer` case `"buyer_solutions"` → **`BuyerSolutionsSection.tsx`** (receives `data.internal_links`).

**DB fields used:** block `heading`, `body`; `internal_links{group}[]`: `anchor`, `slug` (matched), `sort_order` (indirect).

**Evidence:**
```tsx
const SEGMENTS = [ { label: "Streetwear Brands", keywords: ["streetwear", ...], ... }, ... ]; // 7 HARDCODED cards
function findSegmentLink(internalLinks, keywords) {
  const all = Object.values(internalLinks).filter(Array.isArray).flat()...;
  for (const link of all) {
    const haystack = `${link.anchor ?? ""} ${link.slug ?? ""}`.toLowerCase();
    if (keywords.some((k) => haystack.includes(k))) return link;      // DB link wins the card
  }
}
return link?.slug ? <Link href={`/${link.slug}`} ...> : <a href="#rfq" ...>   // DB target or #rfq fallback
```
Live effect today: the "Startup Brands" card matches the `private-label-t-shirt-manufacturer` link (keyword "private label") on pages that carry it; unmatched cards anchor to `#rfq`.

**Modify from DB?** Heading YES · body YES · where a card links YES (add a published page + an internal link whose anchor/slug contains the segment keyword) · card labels/icons/count NO · matching keywords NO.

---

## 8. Related Products

**Verdict: Fully DB Driven** for content (every card is a DB row); card chrome/labels are code

**DB sources:** `seo_content_blocks` (block_key='related_products'); `seo_page_products` ⨝ `seo_entities` (cards); `seo_internal_links` (sidebar, see §9).

**Render path:** RPC → adapter (`products` pass-through, sorted by `sort_order`) → `PSEOPageRenderer` case `"related_products"` → **`RelatedProductsSection.tsx`** → `ProductCard`.

**DB fields used:** block `heading`, `body`; `products[]`: `slug` (seo_entities.slug — card link target), `title` (seo_page_products.card_title → seo_entities.name), `cta_text`, `moq` (pp.moq → entity attributes.moq), `image_url` (pp.image_override_url → entity attributes.image_url), `sort_order` (pp.display_order), `is_featured`. (`description` is in the payload but **not rendered** by ProductCard.)

**Evidence:**
```tsx
const items = products.filter((p) => p.title || p.slug);
{items.map((p, i) => <ProductCard key={p.slug ?? i} product={p} />)}
// ProductCard:
const href = product.slug ? `/${product.slug}` : undefined;
{product.image_url ? <img src={product.image_url} alt={product.title ?? "Product"} ... /> : ...}
{product.is_featured ? <span ...>Featured</span> : null}
{typeof product.moq === "number" ? <span ...>MOQ {product.moq}</span> : <span />}
<span ...>{product.cta_text || "View Details"} →</span>
```

**Hardcoded:** "Featured" badge word, "View Details" fallback, "MOQ" prefix, empty-state copy ("Product range available on request…"), grid/card styling. **Known defect:** `href="/{entity slug}"` — those routes don't exist (404) until product hub pages are created or the RPC emits page slugs.

**Modify from DB?** Which products appear YES · order YES (`display_order`) · card title YES · image YES · MOQ YES · CTA label YES (`cta_text`) · featured badge YES (`is_featured`) · card link target PARTIAL (it's the entity slug — you control the value but not the `/{slug}` pattern) · badge text / fallback label NO.

---

## 9. Internal Links (Helpful Links sidebar)

**Verdict: Fully DB Driven** for content (groups, anchors, targets, order); the sidebar title is code

**DB sources:** `seo_internal_links` ⨝ `seo_pages` (RPC filters `tp.status='published'`; anchor falls back to target page `title` in SQL: `coalesce(l.anchor_text, tp.title)`).

**Render path:** RPC (`internal_links` object keyed by `link_group`) → adapter pass-through → `RelatedProductsSection.tsx` sidebar.

**DB fields used:** `link_group` (becomes the printed group header via `prettyGroup`), `anchor` (anchor_text → target title), `slug` (target page slug), `sort_order` (display_order, pre-sorted in SQL).

**Evidence:**
```tsx
const linkGroups = Object.entries(internalLinks ?? {}).filter(([, links]) => links.length > 0);
const prettyGroup = (key) => key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
{linkGroups.map(([group, links]) => (
  <p ...>{prettyGroup(group)}</p>
  {links.map((link, i) => (
    <Link href={link.slug ? `/${link.slug}` : "#"}>{link.anchor || link.slug}</Link>
  ))}
))}
```

**Hardcoded:** "Helpful Links" heading, the "+" glyph, group-name prettification rule (e.g. `auto_related` prints as "Auto Related" — rename the group in DB to change it).

**Modify from DB?** Every link, its text, its target, its group, its order — **YES**. Sidebar title NO.

---

## 10. FAQ

**Verdict: Fully DB Driven** for content (questions, answers, order, schema inclusion); accordion chrome is code

**DB sources:** `seo_faqs` (entity-scope matched in SQL against the page's product/country/buyer_type ids); `seo_content_blocks` (block_key='faq') for the intro line.

**Render path:** RPC (`faqs[]`, SQL-ordered `display_order, priority desc`) → adapter → `PSEOPageRenderer` case `"faq"` (skips the section if no usable FAQ) → **`FAQSection.tsx`**.

**DB fields used:** `question`, `answer`, `display_order`→`sort_order`, `include_in_schema`; block `body` (intro paragraph). (`priority` shapes SQL ordering; `is_active` filters in SQL.)

**Evidence:**
```tsx
const faqs: Faq[] = (data.faqs ?? []).filter((f) => f.question && f.answer);
const schemaFaqs = faqs.filter((f) => f.include_in_schema === true);
const jsonLd = schemaFaqs.length > 0 ? { "@type": "FAQPage",
  mainEntity: schemaFaqs.map((f) => ({ "@type": "Question", name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer } })) } : null;
...
{column.map((f, i) => (
  <details open={ci === 0 && i === 0} ...>
    <summary ...><h3 ...>{f.question}</h3>...</summary>
    <p ...>{f.answer}</p>
  </details>
))}
```
The JSON-LD is built from the **same DB array**, filtered by the DB flag — schema is provably a subset of visible FAQs.

**Hardcoded:** two-column split logic, first-item-open, "+/×" rotation, "Still have a question? Ask it in your quote request" footer.

**Modify from DB?** Questions/answers YES · order YES · which enter schema YES · which pages see which FAQs YES (entity scoping) · footer line / accordion behavior NO.

---

## 11. RFQ / Instant Quote

**Verdict: Partially DB Driven** — panel copy from DB (with code fallbacks); the form itself is code; the **submission writes to the DB**

**DB sources:** read `seo_content_blocks` (block_key='rfq': heading/body/cta_label) + `seo_pages` (id, slug for attribution); write **`quote_requests`**.

**Render path:** RPC → adapter → `PSEOPageRenderer` case `"rfq"` (and force-appended if no rfq block exists — the only invented section) → **`RFQSection.tsx`** → `supabase.from('quote_requests').insert(...)`.

**DB fields used (read):** `heading`, `body`, `cta_label`; `page.id`, `page.slug`.
**DB fields written:** `source_page_id`, `source_slug`, `company_name`, `email`, `phone`, `quantity`, `message` (Product/Country/Timeline/Requirements composed into it), `status: 'new'`.

**Evidence:**
```tsx
const title = heading || "Ready To Launch Your Clothing Brand?";   // DB heading, code fallback
const cta = ctaLabel || "Get Instant Quote";
...
const { error } = await supabase.from("quote_requests").insert({
  source_page_id: sourcePageId ?? null,
  source_slug: sourceSlug ?? null,
  company_name: values.company.trim() || null,
  email: values.email.trim(),
  phone: values.phone.trim() || null,
  quantity: Number(values.quantity),
  message: composedMessage,
  status: "new",
});   // no .select() — RLS allows INSERT only, anon cannot read rows back
```

**Hardcoded:** all form field labels/placeholders, validation messages, the 3-step "how it works" strip, success/error copy, fallback heading/body/CTA text. **Note:** `product_entity_id` / `country_entity_id` columns exist in `quote_requests` but the form does not set them (free-text goes into `message`).

**Modify from DB?** Panel heading YES · intro body YES · submit-button label YES (`cta_label`) · form fields/labels/validation NO · where the lead lands YES by definition (`quote_requests`).

---

## 12. Images — where every pixel comes from

**The active image system is `image_library` (pool) + `seo_page_images` (page assignments), delivered as `assigned_images[]` by the RPC.** Live data: 5 library rows (targets: hero, factory, quality, products, customization — all Unsplash placeholders), 45 assignment rows (the same 5 images assigned to each of the 9 pages).

Resolver (`src/lib/seo/imageResolver.ts`):
```tsx
const SECTION_TARGET_MAP = { hero: "hero", manufacturing_overview: "factory",
  why_choose_us: "quality", related_products: "products", customization_options: "customization" };
// filter assigned_images by section_target/section_name, sort display_order,
// hero slot prefers is_primary === true
```

| Image slot | Actual source | Proof |
|---|---|---|
| Hero backdrop | `seo_page_images` (section hero, `is_primary`) ⨝ `image_library.image_url` | adapter sets both `hero_image_url` and the hero block's `image_url` from `getSectionImage("hero", assigned_images)`; HeroSection renders it at `opacity-25` |
| Intro gallery | all non-hero `assigned_images` (factory, quality, products, customization) in `display_order`, then product images to fill (max 6, deduped) | `gallery_images` in mapRpcToLandingProps + `collectImages()` in IntroSection |
| Manufacturing | **no image rendered in the section** — the 'factory' assignment only surfaces via the intro gallery (StatsSection ignores `block.image_url`) |
| Customization | same — 'customization' assignment surfaces only in the gallery (IconGridSection renders no image) |
| Product cards | `seo_page_products.image_override_url` → `seo_entities.attributes.image_url` (RPC `coalesce`) — **not** image_library | RPC SQL + `<img src={product.image_url}>` in ProductCard |
| OG / Twitter image | the assigned **hero** image | `page.tsx`: `getSectionImage("hero", assigned_images)?.image_url` in `generateMetadata` |
| Alt text | `image_library.alt_template` (aliased `alt` in the RPC) | resolver returns `img.alt`; NOT NULL in schema |
| Fallbacks | none invented: no hero image → dark band + gradient only; no product image → gray tile with the title; empty gallery → grid skipped | conditional renders quoted above |

**Explicitly NOT image sources anymore (dormant):** `seo_content_blocks.image_url` (adapter overwrites it with resolver output; raw DB values incl. a th.bing.com thumbnail never reach the screen), `country_assets.hero_image_url`/`meta_image_url` (adapter nulls country_assets), `seo_pages.hero_image_override_url` and `meta_image_id` (RPC never selects them), plus the four legacy image-table generations.

---

## 13. Final Verdict Table

DB-driven % = share of *visible content* controllable from the database today (layout/colors/icons excluded as design, counted only where they carry content).

| Section | Database Table(s) | React Component | DB % | Hardcoded % | Evidence (key lines) | Status |
|---|---|---|---|---|---|---|
| Hero | seo_content_blocks, seo_pages, seo_page_images⨝image_library, seo_page_products | HeroSection.tsx | ~55% | ~45% (chips, CTAs, quote-card mock, service line) | `{head}<span>{accent}</span>`, `hero?.body \|\| page.meta_description`, `src={heroImage}`, `resolveMoq(products)` | Partially DB Driven |
| Intro | seo_content_blocks, seo_page_images⨝image_library, seo_entities.attributes | IntroSection.tsx | ~75% | ~25% (4 feature chips) | `Paragraphs text={block.body}`, `gallery_images` filter/sort, `images.map(<img src={img.url}>)` | Partially DB Driven |
| Manufacturing Overview | seo_content_blocks | StatsSection.tsx | ~40% | ~60% (5 stat tiles) | `{block.heading}` / `{block.body}` vs `const STATS=[...]` | Partially DB Driven |
| Customization Options | seo_content_blocks | IconGridSection.tsx (tile) | ~35% | ~65% (7 tiles + lead) | `CUSTOMIZATION_ITEMS` constant vs `{block.body}` | Partially DB Driven |
| Why 1 & 9 Apparel | seo_content_blocks | IconGridSection.tsx (feature) | ~35% | ~65% (6 cards) | `WHY_ITEMS` constant vs `{block.body}` | Partially DB Driven |
| Production Process | seo_content_blocks | ProcessSection.tsx | ~35% | ~65% (6 steps) | `const STEPS=[...]` vs `{block.body}` | Partially DB Driven |
| Buyer Solutions | seo_content_blocks, seo_internal_links | BuyerSolutionsSection.tsx | ~50% | ~50% (7 segment cards; DB decides targets) | `findSegmentLink()` → `href={/${link.slug}}` | Partially DB Driven |
| Related Products | seo_page_products⨝seo_entities, seo_content_blocks | RelatedProductsSection.tsx | ~90% | ~10% (badge/fallback labels) | `items.map(<ProductCard>)`, `{product.cta_text \|\| "View Details"}`, `MOQ {product.moq}` | Fully DB Driven (content) |
| Internal Links | seo_internal_links⨝seo_pages | RelatedProductsSection.tsx (sidebar) | ~95% | ~5% ("Helpful Links" title) | `linkGroups.map(...links.map(<Link href={/${link.slug}}>{link.anchor}>))` | Fully DB Driven (content) |
| FAQ | seo_faqs, seo_content_blocks | FAQSection.tsx | ~95% | ~5% (footer line, accordion chrome) | `faqs.map(<details><summary>{f.question}</summary><p>{f.answer}</p>)`, JSON-LD from `schemaFaqs` | Fully DB Driven (content) |
| RFQ / Instant Quote | seo_content_blocks (read), quote_requests (write) | RFQSection.tsx | ~30% read / 100% write path | ~70% (form UI, labels, validation) | `heading \|\| "Ready To Launch..."`, `.from("quote_requests").insert({...})` | Partially DB Driven |

**Site-level (not a section):** section ORDER — Fully DB Driven (`display_order`); section left-rail TITLES — hardcoded label map keyed by DB `block_key`; nav/footer trust bar — hardcoded except the page title line (`data.page?.title`); `<title>`/description/OG — DB (`meta_title`, `meta_description`, assigned hero); canonical/robots — **rendered by nothing** (regression documented in SYSTEM_AUDIT §A.3).

**Bottom line:** the *voice* of every section (headings, prose, products, links, FAQs) and the *order* of the page are 100% database-controlled; the *furniture* (stat tiles, icon grids, process steps, segment labels, form fields, CTAs, chips) is compiled into the frontend. To make the furniture page-specific, the structured items (stats, grid items, steps, segments) would need to move into DB rows — `seo_block_items`/`seo_templates` were built for exactly that and are currently unused.
