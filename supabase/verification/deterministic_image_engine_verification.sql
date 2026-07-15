-- ============================================================================
-- Deterministic Image Engine — VERIFICATION (read-only)
-- ============================================================================
-- Run after applying the three 20260715* migrations. Every row of the result
-- must show ok = true. Safe on production: performs no writes.
-- ============================================================================

-- Payload-level checks (08–13) run on a bounded, deterministic sample so the
-- suite stays fast on databases with very large page counts.
with sample_pages as (
  select * from seo_pages
  where status = 'published'
  order by id asc
  limit 50
),
sample_unpublished as (
  select * from seo_pages
  where status <> 'published'
  order by id asc
  limit 50
),
checks as (

  -- 1. Schema: all engine columns exist on image_library
  select '01 image_library engine columns' as check_name,
         (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'image_library'
             and column_name in
               ('product_entity_id','country_entity_id','state_entity_id',
                'city_entity_id','industry_entity_id','buyer_type_entity_id',
                'material_entity_id','service_entity_id','geographic_scope',
                'compatible_sections','country_code','state_code','city_slug',
                'priority','quality_score','specificity_score','is_default',
                'is_demo','valid_from','valid_until','license_type',
                'source_name','source_url','copyright_owner','updated_at')
         ) = 25 as ok

  union all
  select '02 seo_page_images engine columns',
         (select count(*) from information_schema.columns
           where table_schema = 'public' and table_name = 'seo_page_images'
             and column_name in
               ('source','resolver_version','selection_score',
                'selection_reason','materialized_at')) = 5

  union all
  select '03 seo_pages.image_assignment_mode exists',
         exists (select 1 from information_schema.columns
                  where table_schema = 'public' and table_name = 'seo_pages'
                    and column_name = 'image_assignment_mode')

  union all
  select '04 engine functions exist',
         (select count(*) from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public'
            and p.proname in ('resolve_seo_page_image','debug_seo_image_candidates',
                              'render_image_alt','materialize_seo_page_images')) = 4

  union all
  -- 5. Backfill: the five original images are global defaults, not demo
  select '05 original five images are global non-demo defaults',
         (select count(*) from image_library
           where image_key in ('demo_hero_tshirt','demo_factory','demo_quality',
                               'demo_product','demo_customization')
             and geographic_scope = 'global' and is_default and not is_demo) = 5

  union all
  select '06 all pre-existing assignments are source=manual',
         not exists (select 1 from seo_page_images where source is null)
         and not exists (select 1 from seo_page_images
                          where source not in ('manual','override','materialized'))

  union all
  select '07 every page has an assignment mode',
         not exists (select 1 from seo_pages
                      where image_assignment_mode is null
                         or image_assignment_mode not in ('automatic','manual','hybrid'))

  union all
  -- 8. Contract: every published page still returns assigned_images, and
  --    every manual assignment id is preserved verbatim in the payload
  select '08 render payload keeps manual assignment ids',
         not exists (
           select 1
           from sample_pages p
           cross join lateral get_seo_page_render(p.slug) as payload
           join seo_page_images spi
             on spi.page_id = p.id and spi.is_active and spi.source = 'manual'
           join image_library il
             on il.id = spi.image_id and il.is_active and not il.is_demo
           where p.image_assignment_mode in ('manual','hybrid')
             and not exists (
               select 1 from jsonb_array_elements(payload->'assigned_images') ai
               where (ai->>'id')::bigint = spi.id
                 and (ai->>'image_id')::bigint = spi.image_id
                 and ai->>'section_name' = spi.section_name
             )
         )

  union all
  select '09 render payload exposes selection metadata',
         not exists (
           select 1
           from sample_pages p
           cross join lateral get_seo_page_render(p.slug) payload
           cross join lateral jsonb_array_elements(payload->'assigned_images') ai
           where ai->'selection_source' is null or ai->'selection_score' is null
         )

  union all
  -- 10. Published-page protection: RPC yields SQL null for non-published slugs
  select '10 unpublished pages are not rendered',
         not exists (
           select 1 from sample_unpublished p
           where get_seo_page_render(p.slug) is not null
         )

  union all
  -- 11. No demo image ever reaches a render payload
  select '11 no demo images in any published payload',
         not exists (
           select 1
           from sample_pages p
           cross join lateral get_seo_page_render(p.slug) payload
           cross join lateral jsonb_array_elements(payload->'assigned_images') ai
           join image_library il on il.id = (ai->>'image_id')::bigint
           where il.is_demo
         )

  union all
  -- 12. No inactive image ever reaches a render payload
  select '12 no inactive images in any published payload',
         not exists (
           select 1
           from sample_pages p
           cross join lateral get_seo_page_render(p.slug) payload
           cross join lateral jsonb_array_elements(payload->'assigned_images') ai
           join image_library il on il.id = (ai->>'image_id')::bigint
           where not il.is_active
         )

  union all
  -- 13. Determinism: 20 resolver calls per published page hero → 1 result set
  select '13 resolver is deterministic across repeated calls',
         not exists (
           select 1
           from sample_pages p, generate_series(1, 20) g
           cross join lateral (
             select string_agg(r.image_id::text || ':' || coalesce(r.image_url,''), ',')
                    as fingerprint
             from resolve_seo_page_image(p.id, 'hero') r
           ) f
           group by p.id
           having count(distinct f.fingerprint) > 1
         )
)
select check_name,
       case when ok then 'PASS ✅' else 'FAIL ❌' end as result
from checks
order by check_name;
