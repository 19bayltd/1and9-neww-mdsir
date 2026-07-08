-- ============================================================================
-- DATABASE CLEANUP REVIEW — 1 & 9 Apparel SEO project
-- ============================================================================
-- REVIEW ONLY. Every statement is commented out on purpose. Nothing here is
-- executed by the app. Run statements manually, one group at a time, only
-- after confirming the notes below still hold.
--
-- Context: the frontend now renders exclusively through the
-- `get_seo_page_render(p_slug)` RPC, which reads from:
--
--   seo_pages, seo_content_blocks, seo_page_images, image_library, seo_faqs
--
-- Those five tables (plus quote_requests, written by the RFQ form, and the
-- sitemap RPCs' sources) are the live surface. The schema also contains
-- several older, overlapping "generations" of content/image systems that
-- nothing references anymore. Dependency evidence below comes from:
--   * pg_proc source scan — which DB functions mention each table
--   * pg_constraint — which foreign keys point at each table
--   * frontend code — which tables/RPCs the app calls after this refactor
-- ============================================================================


-- ----------------------------------------------------------------------------
-- GROUP 1 — Abandoned image system #2: seo_images / seo_section_images
-- ----------------------------------------------------------------------------
-- What:      seo_images (8 rows), seo_section_images (0 rows).
-- Why safe:  The live image system is image_library + seo_page_images (used by
--            get_seo_page_render). No DB function references seo_images or
--            seo_section_images. The only FKs into seo_images come from
--            seo_section_images and seo_block_items — both empty.
-- Depends:   seo_section_images → seo_pages, seo_layout_variants, seo_images.
--            Drop seo_section_images and seo_block_items (Group 2) first.
-- Frontend:  Not used anywhere.
--
-- DROP TABLE public.seo_section_images;
-- DROP TABLE public.seo_images;   -- after seo_block_items (Group 2) is gone


-- ----------------------------------------------------------------------------
-- GROUP 2 — Abandoned content system #2: seo_section_blocks / seo_block_items
-- ----------------------------------------------------------------------------
-- What:      seo_section_blocks (9 rows), seo_block_items (0 rows).
-- Why safe:  The live content system is seo_content_blocks (read by
--            get_seo_page_render, ordered by display_order). No DB function
--            references seo_section_blocks or seo_block_items. seo_block_items
--            is the only FK into seo_section_blocks.
-- Depends:   seo_block_items → seo_section_blocks, seo_images.
-- Frontend:  Not used anywhere.
--
-- DROP TABLE public.seo_block_items;
-- DROP TABLE public.seo_section_blocks;


-- ----------------------------------------------------------------------------
-- GROUP 3 — Abandoned content/image system #3: *_library + *_assignments
-- ----------------------------------------------------------------------------
-- What:      seo_content_library (0), seo_page_content_assignments (0),
--            seo_image_library (0), seo_page_image_assignments (0).
-- Why safe:  All four tables are empty, no DB function references them, and
--            the only FKs among them are internal to this group (assignments →
--            library, assignments → seo_pages).
-- Frontend:  Not used anywhere. (Note: the LIVE library is `image_library`,
--            a different table — do not confuse it with `seo_image_library`.)
--
-- DROP TABLE public.seo_page_content_assignments;
-- DROP TABLE public.seo_content_library;
-- DROP TABLE public.seo_page_image_assignments;
-- DROP TABLE public.seo_image_library;


-- ----------------------------------------------------------------------------
-- GROUP 4 — Abandoned media system #4: seo_media_assets / seo_page_media
-- ----------------------------------------------------------------------------
-- What:      seo_media_assets (4 rows), seo_page_media (5 rows).
-- Why safe:  No DB function references either table; the render RPC uses
--            image_library + seo_page_images instead. The only FK into
--            seo_media_assets comes from seo_page_media.
-- Caution:   These tables contain a few rows — confirm the 4 assets are
--            duplicated in image_library before dropping.
--
-- DROP TABLE public.seo_page_media;
-- DROP TABLE public.seo_media_assets;


-- ----------------------------------------------------------------------------
-- GROUP 5 — Abandoned product system: seo_products / seo_product_images
-- ----------------------------------------------------------------------------
-- What:      seo_products (0 rows), seo_product_images (0 rows).
-- Why safe:  Both empty; no DB function references them. seo_product_images is
--            the only FK into seo_products. (The separate `products` table IS
--            still referenced — by seo_page_products and two functions — so it
--            is NOT listed for cleanup.)
--
-- DROP TABLE public.seo_product_images;
-- DROP TABLE public.seo_products;


-- ----------------------------------------------------------------------------
-- GROUP 6 — Legacy RPC: get_landing_page_view (and its exclusive tables)
-- ----------------------------------------------------------------------------
-- What:      The old frontend RPC, replaced by get_seo_page_render.
-- Why safe:  After this refactor no frontend code calls it. It reads
--            seo_pages/seo_content_blocks/seo_faqs (shared, keep) plus
--            country_assets / seo_page_products / seo_internal_links /
--            products.
-- Caution:   country_assets (2 rows), seo_page_products (14), seo_internal_links
--            (60) hold real data and generate_internal_links still writes
--            seo_internal_links — KEEP those tables; they may return to the
--            render RPC later. Only the function itself is a drop candidate.
--
-- DROP FUNCTION public.get_landing_page_view(text);


-- ----------------------------------------------------------------------------
-- GROUP 7 — Review only, do NOT drop yet
-- ----------------------------------------------------------------------------
-- seo_layout_variants (5 rows):  referenced by seo_pages.layout_variant_id and
--     returned by get_seo_page_render — KEEP.
-- seo_layout_positions (50 rows): only consumer would be a layout engine the
--     frontend does not implement yet. Unused today, but it is the data behind
--     layout_variant_id. Decide with the layout roadmap.
-- seo_content_blocks.image_url / image_alt columns: the render engine now uses
--     assigned_images exclusively, but the RPC still selects these columns.
--     If you want to retire them: first remove them from get_seo_page_render,
--     then:
--     -- ALTER TABLE public.seo_content_blocks DROP COLUMN image_url;
--     -- ALTER TABLE public.seo_content_blocks DROP COLUMN image_alt;
-- seo_pages.hero_image_url (if present): superseded by assigned_images hero —
--     same procedure: update RPCs first, then drop.
-- Quote/logistics domain (quote_events, quote_configurations,
--     quote_customization_options, shipping_zones, shipping_rates,
--     product_pricing_tiers, products): separate feature domain, some with FKs
--     from live tables — out of scope for the SEO render cleanup. KEEP.
-- ============================================================================
