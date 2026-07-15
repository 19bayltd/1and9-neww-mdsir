-- ============================================================================
-- Deterministic Image Engine — OPTIONAL demo/test seed
-- ============================================================================
-- ⚠️  DEMO DATA ONLY — every image row here is inserted with is_demo = true,
--     which the production render path excludes unconditionally. The demo
--     page is created as status='draft' + robots='noindex,nofollow', so the
--     public RPC never returns it. Apply only when you want live-database
--     smoke testing of the resolver; skip entirely for production-only
--     rollouts. Idempotent: safe to re-run.
--
-- Removal:
--   delete from seo_page_images where image_id in (select id from image_library where is_demo);
--   delete from image_library where is_demo;
--   delete from seo_pages where slug = 'demo-image-engine-texas-t-shirt';
--   -- (geographic entities added below are real-world facts and safe to keep)
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Real geographic entities used by the demo images (correct hierarchy:
--    city.parent → state, state.parent → country). These are genuine
--    geography, not fake data, and may be kept permanently.
-- ----------------------------------------------------------------------------
insert into public.seo_entities (entity_type, slug, name, parent_id)
select 'state', 'texas', 'Texas', e.id
from public.seo_entities e
where e.entity_type = 'country' and e.slug = 'united-states'
on conflict (entity_type, slug) do nothing;

insert into public.seo_entities (entity_type, slug, name, parent_id)
select 'city', 'dallas', 'Dallas', e.id
from public.seo_entities e
where e.entity_type = 'state' and e.slug = 'texas'
on conflict (entity_type, slug) do nothing;

insert into public.seo_entities (entity_type, slug, name, parent_id)
select 'state', 'ontario', 'Ontario', e.id
from public.seo_entities e
where e.entity_type = 'country' and e.slug = 'canada'
on conflict (entity_type, slug) do nothing;

insert into public.seo_entities (entity_type, slug, name, parent_id)
select 'city', 'toronto', 'Toronto', e.id
from public.seo_entities e
where e.entity_type = 'state' and e.slug = 'ontario'
on conflict (entity_type, slug) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Demo images (ALL is_demo = true). Entity tags reflect what each demo
--    asset is DECLARED to depict; URLs point at the 1and9 asset host that is
--    already whitelisted in next.config.ts.
-- ----------------------------------------------------------------------------
with e as (
  select
    (select id from public.seo_entities where entity_type='country' and slug='united-states') as usa,
    (select id from public.seo_entities where entity_type='country' and slug='canada')        as canada,
    (select id from public.seo_entities where entity_type='state'   and slug='texas')         as texas,
    (select id from public.seo_entities where entity_type='city'    and slug='dallas')        as dallas,
    (select id from public.seo_entities where entity_type='city'    and slug='toronto')       as toronto,
    (select id from public.seo_entities where entity_type='product' and slug='t-shirts')      as tshirt,
    (select id from public.seo_entities where entity_type='product' and slug='hoodies')       as hoodie
)
insert into public.image_library
  (image_key, image_url, image_type, section_target, alt_template,
   width, height, is_active, is_demo, geographic_scope,
   country_entity_id, state_entity_id, city_entity_id, product_entity_id,
   compatible_sections, priority, quality_score,
   license_type, source_name, copyright_owner)
select v.image_key,
       'https://assets.1and9apparel.com/demo/' || v.image_key || '.webp',
       v.image_type, v.section_target, v.alt_template,
       1600, 1000, v.is_active, true, v.geo_scope,
       ids.country_id, ids.state_id, ids.city_id, ids.product_id,
       v.compat, v.priority, v.quality,
       'demo', 'seed:deterministic_image_engine', '1 & 9 Apparel (demo)'
from e, (values
  -- key, type, section, alt template, active, scope, country, state, city, product, compat, priority, quality
  ('demo2_texas_tshirt_hero',    'hero',    'hero',    '{{product}} manufacturing serving buyers in {{state}}, {{country}}', true,  'state',   null::text, 'texas',   null::text, 't-shirts', '{}'::text[],    0, 10),
  ('demo2_texas_generic_hero',   'hero',    'hero',    'Apparel manufacturing for {{state}} buyers',                          true,  'state',   null,       'texas',   null,       null,       '{}',            0, 10),
  ('demo2_usa_tshirt_hero',      'hero',    'hero',    '{{product}} manufacturing for buyers in {{country}}',                 true,  'country', 'united-states', null, null,       't-shirts', '{}',            0, 10),
  ('demo2_usa_generic_hero',     'hero',    'hero',    'Apparel manufacturing for {{country}} buyers',                        true,  'country', 'united-states', null, null,       null,       '{}',            0, 10),
  ('demo2_canada_tshirt_hero',   'hero',    'hero',    '{{product}} manufacturing for buyers in {{country}}',                 true,  'country', 'canada',   null,      null,       't-shirts', '{}',            0, 10),
  ('demo2_canada_generic_hero',  'hero',    'hero',    'Apparel manufacturing for {{country}} buyers',                        true,  'country', 'canada',   null,      null,       null,       '{}',            0, 10),
  ('demo2_global_tshirt_hero',   'hero',    'hero',    '{{product}} manufacturing at 1 & 9 Apparel',                          true,  'global',  null,       null,      null,       't-shirts', '{}',            0, 10),
  ('demo2_dallas_hoodie_hero',   'hero',    'hero',    '{{product}} manufacturing serving {{city}}, {{state}}',               true,  'city',    null,       null,      'dallas',   'hoodies',  '{}',            0, 10),
  ('demo2_toronto_generic_hero', 'hero',    'hero',    'Apparel manufacturing serving {{city}} buyers',                       true,  'city',    null,       null,      'toronto',  null,       '{}',            0, 10),
  ('demo2_usa_hoodie_factory',   'factory', 'factory', '{{product}} production line for {{country}} orders',                  true,  'country', 'united-states', null, null,       'hoodies',  '{}',            0, 10),
  ('demo2_usa_generic_factory',  'factory', 'factory', 'Factory floor producing export orders for {{country}}',               true,  'country', 'united-states', null, null,       null,       '{}',            0, 10),
  ('demo2_canada_hoodie_factory','factory', 'factory', '{{product}} production line for {{country}} orders',                  true,  'country', 'canada',   null,      null,       'hoodies',  '{}',            0, 10),
  ('demo2_global_hoodie_factory','factory', 'factory', '{{product}} production line at 1 & 9 Apparel',                        true,  'global',  null,       null,      null,       'hoodies',  '{}',            0, 10),
  ('demo2_factory_hero_compat',  'factory', 'factory', 'Factory exterior, hero-compatible',                                   true,  'global',  null,       null,      null,       null,       '{hero}',        0,  5),
  ('demo2_inactive_texas_hero',  'hero',    'hero',    'INACTIVE: must never be selected',                                    false, 'state',   null,       'texas',   null,       't-shirts', '{}',         9999, 99)
) as v(image_key, image_type, section_target, alt_template, is_active, geo_scope,
       country_slug, state_slug, city_slug_v, product_slug, compat, priority, quality)
left join lateral (
  select
    case v.country_slug when 'united-states' then e.usa when 'canada' then e.canada end as country_id,
    case v.state_slug   when 'texas'   then e.texas end                                  as state_id,
    case v.city_slug_v  when 'dallas'  then e.dallas when 'toronto' then e.toronto end   as city_id,
    case v.product_slug when 't-shirts' then e.tshirt when 'hoodies' then e.hoodie end   as product_id
) ids on true
on conflict (image_key) do nothing;

-- ----------------------------------------------------------------------------
-- 3. One DRAFT demo page in automatic mode for live resolver smoke tests.
--    Never rendered publicly (draft + noindex). Remove anytime.
-- ----------------------------------------------------------------------------
insert into public.seo_pages
  (slug, product_entity_id, country_entity_id, state_entity_id,
   title, h1, meta_title, meta_description, robots, status, priority,
   template, sitemap_group, image_assignment_mode)
select
  'demo-image-engine-texas-t-shirt',
  (select id from public.seo_entities where entity_type='product' and slug='t-shirts'),
  (select id from public.seo_entities where entity_type='country' and slug='united-states'),
  (select id from public.seo_entities where entity_type='state' and slug='texas'),
  'DEMO — Custom T-Shirt Manufacturer Texas',
  'DEMO — Custom T-Shirt Manufacturer in Texas',
  'DEMO — Custom T-Shirt Manufacturer Texas',
  'Demo page for the deterministic image engine. Not for publication.',
  'noindex,nofollow', 'draft', 0.1,
  'product_state', 'state', 'automatic'
where not exists (
  select 1 from public.seo_pages where slug = 'demo-image-engine-texas-t-shirt'
);

commit;

-- Smoke test (service role):
--   select * from debug_seo_image_candidates(
--     (select id from seo_pages where slug='demo-image-engine-texas-t-shirt'),
--     'hero', p_include_demo => true);
