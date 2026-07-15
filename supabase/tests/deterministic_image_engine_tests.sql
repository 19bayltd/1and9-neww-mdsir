-- ============================================================================
-- Deterministic Image Engine — TEST MATRIX (Phase 12, Tests A–J)
-- ============================================================================
-- Self-contained and NON-DESTRUCTIVE: everything runs inside one transaction
-- that is ROLLED BACK at the end. Fixtures use is_demo = true and a dedicated
-- 'imgtest_*' template namespace, so even a mid-run abort cannot leak test
-- data into production selection.
--
-- To run:  psql -f deterministic_image_engine_tests.sql  (or SQL editor)
-- Success: NOTICE lines "TEST x PASS" for A–J and a final ALL TESTS PASSED.
-- Any failure raises an exception and aborts the transaction.
-- ============================================================================

begin;

-- --------------------------------------------------------------------------
-- Isolation: hide every pre-existing image from the engine for the duration
-- of the transaction (rolled back afterwards).
-- --------------------------------------------------------------------------
update image_library set is_active = false;

-- --------------------------------------------------------------------------
-- Geographic fixture entities (real hierarchy; may pre-exist)
-- --------------------------------------------------------------------------
insert into seo_entities (entity_type, slug, name, parent_id)
select 'state', 'texas', 'Texas', e.id
from seo_entities e where e.entity_type='country' and e.slug='united-states'
on conflict (entity_type, slug) do nothing;

insert into seo_entities (entity_type, slug, name, parent_id)
select 'city', 'dallas', 'Dallas', e.id
from seo_entities e where e.entity_type='state' and e.slug='texas'
on conflict (entity_type, slug) do nothing;

insert into seo_entities (entity_type, slug, name, parent_id)
select 'state', 'ontario', 'Ontario', e.id
from seo_entities e where e.entity_type='country' and e.slug='canada'
on conflict (entity_type, slug) do nothing;

insert into seo_entities (entity_type, slug, name, parent_id)
select 'city', 'toronto', 'Toronto', e.id
from seo_entities e where e.entity_type='state' and e.slug='ontario'
on conflict (entity_type, slug) do nothing;

-- --------------------------------------------------------------------------
-- Image fixtures (all is_demo = true; priority/quality 0 so scores alone
-- decide, except the inactive trap which gets a huge priority on purpose)
-- --------------------------------------------------------------------------
create temporary table _ent on commit drop as
select
  (select id from seo_entities where entity_type='country' and slug='united-states') as usa,
  (select id from seo_entities where entity_type='country' and slug='canada')        as canada,
  (select id from seo_entities where entity_type='state'   and slug='texas')         as texas,
  (select id from seo_entities where entity_type='state'   and slug='california')    as california,
  (select id from seo_entities where entity_type='state'   and slug='ontario')       as ontario,
  (select id from seo_entities where entity_type='city'    and slug='dallas')        as dallas,
  (select id from seo_entities where entity_type='city'    and slug='toronto')       as toronto,
  (select id from seo_entities where entity_type='product' and slug='t-shirts')      as tshirt,
  (select id from seo_entities where entity_type='product' and slug='hoodies')       as hoodie;

insert into image_library
  (image_key, image_url, image_type, section_target, alt_template, width, height,
   is_active, is_demo, geographic_scope, country_entity_id, state_entity_id,
   city_entity_id, product_entity_id, compatible_sections, priority, quality_score)
select v.k, 'https://assets.1and9apparel.com/test/' || v.k || '.webp',
       v.sect, v.sect, v.alt, 1600, 1000,
       v.act, true, v.scope, v.country, v.state, v.city, v.product, v.compat, v.prio, 0
from _ent e, lateral (values
  -- HERO candidates
  ('t3_tx_ts_hero',  'hero', '{{product}} manufacturing facility serving buyers in {{state}}, {{country}}',
                     true,  'state',   null::bigint, e.texas,      null::bigint, e.tshirt, '{}'::text[], 0),
  ('t3_tx_gen_hero', 'hero', 'Apparel manufacturing for {{state}} buyers',
                     true,  'state',   null,         e.texas,      null,         null,     '{}', 0),
  ('t3_us_ts_hero',  'hero', '{{product}} manufacturing for {{country}} buyers',
                     true,  'country', e.usa,        null,         null,         e.tshirt, '{}', 0),
  ('t3_us_gen_hero', 'hero', 'Apparel manufacturing for {{country}} buyers',
                     true,  'country', e.usa,        null,         null,         null,     '{}', 0),
  ('t3_ca_ts_hero',  'hero', '{{product}} manufacturing for {{country}} buyers',
                     true,  'country', e.canada,     null,         null,         e.tshirt, '{}', 0),
  ('t3_ca_gen_hero', 'hero', 'Apparel manufacturing for {{country}} buyers',
                     true,  'country', e.canada,     null,         null,         null,     '{}', 0),
  ('t3_gl_ts_hero',  'hero', 'Custom t-shirt manufacturing at 1 & 9 Apparel',
                     true,  'global',  null,         null,         null,         e.tshirt, '{}', 0),
  ('t3_gl_gen_hero', 'hero', 'Apparel manufacturing at 1 & 9 Apparel',
                     true,  'global',  null,         null,         null,         null,     '{}', 0),
  ('t3_dal_hd_hero', 'hero', '{{product}} manufacturing serving {{city}}, {{state}}',
                     true,  'city',    null,         null,         e.dallas,     e.hoodie, '{}', 0),
  ('t3_tx_hd_hero',  'hero', '{{product}} manufacturing serving {{state}}',
                     true,  'state',   null,         e.texas,      null,         e.hoodie, '{}', 0),
  ('t3_us_hd_hero',  'hero', '{{product}} manufacturing for {{country}}',
                     true,  'country', e.usa,        null,         null,         e.hoodie, '{}', 0),
  ('t3_gl_hd_hero',  'hero', 'Custom hoodie manufacturing at 1 & 9 Apparel',
                     true,  'global',  null,         null,         null,         e.hoodie, '{}', 0),
  ('t3_tor_gen_hero','hero', 'Apparel manufacturing serving {{city}}',
                     true,  'city',    null,         null,         e.toronto,    null,     '{}', 0),
  ('t3_cali_gen_hero','hero','Apparel manufacturing for {{state}} buyers',
                     true,  'state',   null,         e.california, null,         null,     '{}', 0),
  -- FACTORY candidates
  ('t3_us_hd_fact',  'factory', 'Hoodie production line for {{country}} orders',
                     true,  'country', e.usa,        null,         null,         e.hoodie, '{}', 0),
  ('t3_us_gen_fact', 'factory', 'Factory floor producing {{country}} export orders',
                     true,  'country', e.usa,        null,         null,         null,     '{}', 0),
  ('t3_gl_hd_fact',  'factory', 'Hoodie production line at 1 & 9 Apparel',
                     true,  'global',  null,         null,         null,         e.hoodie, '{}', 0),
  ('t3_ca_gen_fact', 'factory', 'Factory floor producing {{country}} export orders',
                     true,  'country', e.canada,     null,         null,         null,     '{}', 0),
  -- Section-compatibility fixtures (Test J)
  ('t3_fact_only',   'factory', 'Factory-only image', true, 'global', null, null, null, null, '{}', 0),
  ('t3_fact_j_ok',   'factory', 'Factory image marked compatible with the J slot',
                     true,  'global',  null,         null,         null,         null,     '{jtest_slot}', 0),
  -- Inactive trap (Test F): would beat everything if activity were ignored
  ('t3_inactive_tx_ts_hero', 'hero', 'INACTIVE trap', false, 'state',
                     null,          e.texas,      null,         e.tshirt, '{}', 9999)
) as v(k, sect, alt, act, scope, country, state, city, product, compat, prio);

-- --------------------------------------------------------------------------
-- Page fixtures (template namespace imgtest_* keeps the entity-combo unique
-- index clear of real pages; drafts except the published-RPC sanity page)
-- --------------------------------------------------------------------------
insert into seo_pages
  (slug, product_entity_id, country_entity_id, state_entity_id, city_entity_id,
   title, h1, meta_title, meta_description, robots, status, published_at,
   priority, template, sitemap_group, image_assignment_mode)
select v.slug, v.product, v.country, v.state, v.city,
       v.title, v.title, v.title, 'Image engine test fixture.',
       'noindex,nofollow', v.status,
       case when v.status = 'published' then now() end,
       0.1, v.tpl, 'guide', v.mode
from _ent e, lateral (values
  ('imgtest-a-canada-tshirt',   e.tshirt, e.canada, null::bigint, null::bigint, 'Test A — Canada T-Shirt',  'imgtest_a',   'draft',     'automatic'),
  ('imgtest-b-usa-hoodie',      e.hoodie, e.usa,    null,         null,         'Test B — USA Hoodie',      'imgtest_b',   'draft',     'automatic'),
  ('imgtest-c-texas-tshirt',    e.tshirt, e.usa,    e.texas,      null,         'Test C — Texas T-Shirt',   'imgtest_c',   'draft',     'automatic'),
  ('imgtest-d-dallas-hoodie',   e.hoodie, e.usa,    e.texas,      e.dallas,     'Test D — Dallas Hoodie',   'imgtest_d',   'draft',     'automatic'),
  ('imgtest-e-override',        e.tshirt, e.usa,    e.texas,      null,         'Test E — Override',        'imgtest_e',   'draft',     'automatic'),
  ('imgtest-e2-hybrid',         e.tshirt, e.usa,    e.texas,      null,         'Test E2 — Hybrid',         'imgtest_e2',  'draft',     'hybrid'),
  ('imgtest-g-unpublished',     e.hoodie, null,     null,         null,         'Test G — Unpublished',     'imgtest_g',   'draft',     'automatic'),
  ('imgtest-pub-sanity',        e.hoodie, e.canada, null,         null,         'Test G2 — Published',      'imgtest_pub', 'published', 'automatic'),
  ('imgtest-i-generic-product', e.tshirt, null,     null,         null,         'Test I — No Geography',    'imgtest_i',   'draft',     'automatic'),
  ('imgtest-j-section-compat',  e.tshirt, null,     null,         null,         'Test J — Section Compat',  'imgtest_j',   'draft',     'automatic')
) as v(slug, product, country, state, city, title, tpl, status, mode);

-- Test E fixture rows: an explicit override on the override page, and a
-- deliberately "wrong-product" manual mapping on the hybrid page.
insert into seo_page_images (page_id, image_id, section_name, display_order, is_primary, is_active, source)
select p.id, il.id, 'hero', 1, true, true, 'override'
from seo_pages p, image_library il
where p.slug = 'imgtest-e-override' and il.image_key = 't3_gl_gen_hero';

insert into seo_page_images (page_id, image_id, section_name, display_order, is_primary, is_active, source)
select p.id, il.id, 'hero', 1, true, true, 'manual'
from seo_pages p, image_library il
where p.slug = 'imgtest-e2-hybrid' and il.image_key = 't3_gl_hd_hero';

-- ==========================================================================
-- THE TESTS
-- ==========================================================================
do $tests$
declare
  v_pid    bigint;
  v_keys   text[];
  v_key    text;
  v_alt    text;
  v_src    text;
  v_n      integer;
  v_json   jsonb;
begin
  -- ------------------------------------------------------------------
  -- TEST A — Canada + T-shirt + hero
  -- ------------------------------------------------------------------
  select id into v_pid from seo_pages where slug = 'imgtest-a-canada-tshirt';

  v_keys := array(select image_key from resolve_seo_page_image(v_pid, 'hero', true, 4));
  if v_keys[1] <> 't3_ca_ts_hero' then
    raise exception 'TEST A FAIL: expected Canada+T-shirt hero first, got %', v_keys;
  end if;
  if v_keys[2] <> 't3_ca_gen_hero' or v_keys[3] <> 't3_gl_ts_hero' then
    raise exception 'TEST A FAIL: fallback order wrong: %', v_keys;
  end if;
  -- USA-specific images must be rejected outright
  if exists (
    select 1 from debug_seo_image_candidates(v_pid, 'hero', true)
    where image_key in ('t3_us_ts_hero','t3_us_gen_hero') and eligible
  ) then
    raise exception 'TEST A FAIL: USA image eligible on a Canada page';
  end if;
  raise notice 'TEST A PASS — Canada page: % > % > %; USA images rejected',
    v_keys[1], v_keys[2], v_keys[3];

  -- ------------------------------------------------------------------
  -- TEST B — USA + Hoodie + factory
  -- ------------------------------------------------------------------
  select id into v_pid from seo_pages where slug = 'imgtest-b-usa-hoodie';

  v_keys := array(select image_key from resolve_seo_page_image(v_pid, 'factory', true, 4));
  if v_keys[1] <> 't3_us_hd_fact' or v_keys[2] <> 't3_us_gen_fact' or v_keys[3] <> 't3_gl_hd_fact' then
    raise exception 'TEST B FAIL: expected usa_hoodie > usa_generic > global_hoodie, got %', v_keys;
  end if;
  if exists (
    select 1 from debug_seo_image_candidates(v_pid, 'factory', true)
    where image_key = 't3_ca_gen_fact' and eligible
  ) then
    raise exception 'TEST B FAIL: Canada factory image eligible on a USA page';
  end if;
  raise notice 'TEST B PASS — USA factory: % > % > %; Canada image rejected',
    v_keys[1], v_keys[2], v_keys[3];

  -- ------------------------------------------------------------------
  -- TEST C — Texas + T-shirt + hero: full documented fallback order
  -- ------------------------------------------------------------------
  select id into v_pid from seo_pages where slug = 'imgtest-c-texas-tshirt';

  v_keys := array(select image_key from resolve_seo_page_image(v_pid, 'hero', true, 6));
  if v_keys <> array['t3_tx_ts_hero','t3_us_ts_hero','t3_tx_gen_hero',
                     't3_us_gen_hero','t3_gl_ts_hero','t3_gl_gen_hero'] then
    raise exception 'TEST C FAIL: ranking mismatch: %', v_keys;
  end if;

  -- Phase 8 alt text check on the winner
  select alt into v_alt from resolve_seo_page_image(v_pid, 'hero', true, 1);
  if v_alt <> 'Custom T-Shirts manufacturing facility serving buyers in Texas, United States' then
    raise exception 'TEST C FAIL: alt template rendering wrong: "%"', v_alt;
  end if;
  raise notice 'TEST C PASS — Texas ranking exact (6 tiers); alt = "%"', v_alt;

  -- ------------------------------------------------------------------
  -- TEST D — Dallas: city → state → country → global; no foreign geo
  -- ------------------------------------------------------------------
  select id into v_pid from seo_pages where slug = 'imgtest-d-dallas-hoodie';

  -- Full chain: Dallas(1800) > Texas+hoodie(1600) > USA+hoodie(1400) >
  -- Texas generic(1200) > USA generic(1000) > global hoodie(900) > global(500)
  -- (geographic specificity at a nearer tier outranks a product-only match
  -- at a farther tier — same documented scoring as Test C).
  v_keys := array(select image_key from resolve_seo_page_image(v_pid, 'hero', true, 7));
  if v_keys <> array['t3_dal_hd_hero','t3_tx_hd_hero','t3_us_hd_hero',
                     't3_tx_gen_hero','t3_us_gen_hero','t3_gl_hd_hero','t3_gl_gen_hero'] then
    raise exception 'TEST D FAIL: expected Dallas > Texas > USA > Global chain, got %', v_keys;
  end if;
  if exists (
    select 1 from debug_seo_image_candidates(v_pid, 'hero', true)
    where image_key in ('t3_tor_gen_hero','t3_cali_gen_hero','t3_ca_gen_hero','t3_ca_ts_hero')
      and eligible
  ) then
    raise exception 'TEST D FAIL: Toronto/California/Canada image eligible on a Dallas page';
  end if;
  raise notice 'TEST D PASS — Dallas > Texas > USA > Global; foreign geos rejected';

  -- ------------------------------------------------------------------
  -- TEST E — manual override beats every automatic candidate
  -- ------------------------------------------------------------------
  select id into v_pid from seo_pages where slug = 'imgtest-e-override';

  select image_key, selection_source into v_key, v_src
  from resolve_seo_page_image(v_pid, 'hero', true, 1);
  if v_key <> 't3_gl_gen_hero' or v_src <> 'manual_page_override' then
    raise exception 'TEST E FAIL: override did not win (got %/%)', v_key, v_src;
  end if;

  -- E2: hybrid mode manual mapping wins; automatic mode ignores it
  select id into v_pid from seo_pages where slug = 'imgtest-e2-hybrid';
  select image_key, selection_source into v_key, v_src
  from resolve_seo_page_image(v_pid, 'hero', true, 1);
  if v_key <> 't3_gl_hd_hero' or v_src <> 'manual_page_mapping' then
    raise exception 'TEST E FAIL: hybrid manual mapping did not win (got %/%)', v_key, v_src;
  end if;

  update seo_pages set image_assignment_mode = 'automatic' where id = v_pid;
  select image_key, selection_source into v_key, v_src
  from resolve_seo_page_image(v_pid, 'hero', true, 1);
  if v_key <> 't3_tx_ts_hero' or v_src <> 'exact_state' then
    raise exception 'TEST E FAIL: automatic mode should ignore manual rows (got %/%)', v_key, v_src;
  end if;
  update seo_pages set image_assignment_mode = 'hybrid' where id = v_pid;
  raise notice 'TEST E PASS — override wins; hybrid honors manual; automatic ignores manual';

  -- ------------------------------------------------------------------
  -- TEST F — an inactive image is never selected (even at priority 9999)
  -- ------------------------------------------------------------------
  select id into v_pid from seo_pages where slug = 'imgtest-c-texas-tshirt';
  if exists (
    select 1 from resolve_seo_page_image(v_pid, 'hero', true, 50)
    where image_key = 't3_inactive_tx_ts_hero'
  ) then
    raise exception 'TEST F FAIL: inactive image selected';
  end if;
  raise notice 'TEST F PASS — inactive image never selected';

  -- ------------------------------------------------------------------
  -- TEST G — public render RPC protects unpublished pages
  -- ------------------------------------------------------------------
  if (select get_seo_page_render('imgtest-g-unpublished')) is not null then
    raise exception 'TEST G FAIL: RPC returned an unpublished page';
  end if;
  v_json := get_seo_page_render('imgtest-pub-sanity');
  if v_json is null or v_json->'page'->>'slug' <> 'imgtest-pub-sanity' then
    raise exception 'TEST G FAIL: RPC did not return the published sanity page';
  end if;
  raise notice 'TEST G PASS — draft page hidden, published page rendered';

  -- ------------------------------------------------------------------
  -- TEST H — determinism: 100 identical calls, 1 identical result
  -- ------------------------------------------------------------------
  select id into v_pid from seo_pages where slug = 'imgtest-d-dallas-hoodie';
  select count(distinct fp) into v_n
  from generate_series(1, 100) g
  cross join lateral (
    select string_agg(image_key || ':' || coalesce(selection_score::text,''), ',') as fp
    from resolve_seo_page_image(v_pid, 'hero', true, 5)
  ) f;
  if v_n <> 1 then
    raise exception 'TEST H FAIL: % distinct results across 100 calls', v_n;
  end if;
  raise notice 'TEST H PASS — 100/100 identical resolver results';

  -- ------------------------------------------------------------------
  -- TEST I — page with no geography uses product/global defaults
  -- ------------------------------------------------------------------
  select id into v_pid from seo_pages where slug = 'imgtest-i-generic-product';
  v_keys := array(select image_key from resolve_seo_page_image(v_pid, 'hero', true, 2));
  if v_keys <> array['t3_gl_ts_hero','t3_gl_gen_hero'] then
    raise exception 'TEST I FAIL: expected global product > global generic, got %', v_keys;
  end if;
  -- and no geo-tagged image may qualify at all
  if exists (
    select 1 from debug_seo_image_candidates(v_pid, 'hero', true)
    where eligible and image_key like 't3_%'
      and image_key not in ('t3_gl_ts_hero','t3_gl_gen_hero')
  ) then
    raise exception 'TEST I FAIL: geo-tagged image eligible on a geography-less page';
  end if;
  raise notice 'TEST I PASS — geography-less page falls back to global product/default';

  -- ------------------------------------------------------------------
  -- TEST J — section compatibility: factory-only never serves another
  -- slot; explicitly compatible image does
  -- ------------------------------------------------------------------
  select id into v_pid from seo_pages where slug = 'imgtest-j-section-compat';

  -- the J slot has no native images: only the explicitly-compatible one wins
  select image_key into v_key from resolve_seo_page_image(v_pid, 'jtest_slot', true, 1);
  if v_key is distinct from 't3_fact_j_ok' then
    raise exception 'TEST J FAIL: expected compatible factory image, got %', v_key;
  end if;
  if exists (
    select 1 from resolve_seo_page_image(v_pid, 'jtest_slot', true, 50)
    where image_key = 't3_fact_only'
  ) then
    raise exception 'TEST J FAIL: factory-only image served an incompatible slot';
  end if;
  -- and no factory-targeted image may serve the hero slot
  if exists (
    select 1 from resolve_seo_page_image(v_pid, 'hero', true, 50)
    where section_target = 'factory'
  ) then
    raise exception 'TEST J FAIL: factory image selected for hero';
  end if;
  raise notice 'TEST J PASS — section compatibility enforced';

  raise notice '=== ALL TESTS PASSED (A–J) ===';
end;
$tests$;

rollback;
