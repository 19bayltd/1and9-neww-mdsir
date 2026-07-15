-- ============================================================================
-- Deterministic Image Engine — Part 2/3: resolver functions
-- ============================================================================
-- Functions created here:
--   render_image_alt(template, page_id, section)   deterministic alt text
--   resolve_seo_page_image(page_id, section, ...)  canonical resolver
--   debug_seo_image_candidates(page_id, section)   explainability/audit
--   materialize_seo_page_images(page_id)           optional cache writer
--
-- Scoring model (documented in docs/IMAGE_ENGINE.md):
--   exact city                      +1000
--   exact state/province            +800
--   exact country                   +600   (also the "correct ancestor" path:
--                                           a USA image on a Texas/Dallas page
--                                           matches at the country tier)
--   global geographic image         +100
--   exact product                   +500
--   product category (parent)       +350
--   generic apparel (no product)    +100
--   exact section                   +300
--   compatible section fallback     +100
--   exact industry                  +180
--   exact buyer type                +160
--   exact material                  +140
--   exact service                   +120
--   + image_library.priority, + image_library.quality_score
-- Layer bases (outside candidate scoring):
--   hero_image_override_url         6000  manual_page_override
--   seo_pages.meta_image_id (og)    5500  manual_page_override
--   seo_page_images source=override 5000  manual_page_override
--   seo_page_images source=manual   4000  manual_page_mapping
--
-- Conflict REJECTION (excluded, not down-scored):
--   image geo tag set and != page's effective geo at that tier  → reject
--     (an image more geo-specific than the page is also rejected:
--      a Texas image never serves a plain-USA or Canadian page)
--   image product set and != page product / product parent      → reject
--   image section_target != requested and requested not in
--     compatible_sections                                       → reject
--   both image and page set a secondary entity and they differ  → reject
--   inactive, demo (in production mode), or expired image       → reject
--
-- Stable tie-break: score DESC, priority DESC, quality_score DESC,
--   specificity_score DESC, updated_at DESC, id ASC. random() is never used;
--   identical inputs always return identical output.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- render_image_alt — deterministic, database-driven alt text
-- ----------------------------------------------------------------------------
-- Substitutes controlled placeholders from the page's REAL entities:
--   {{product}} {{country}} {{state}} {{city}} {{industry}} {{buyer_type}}
--   {{material}} {{service}} {{section}} {{brand}}
-- Placeholders the page cannot fill are removed and separators are tidied,
-- never guessed. Templates without placeholders pass through verbatim, so
-- every existing alt string renders unchanged. Empty alt (decorative image)
-- is preserved as ''.

create or replace function public.render_image_alt(
  p_template    text,
  p_page_id     bigint,
  p_section_key text default null
) returns text
language plpgsql
stable
set search_path = public
as $function$
declare
  v      text := coalesce(p_template, '');
  v_page record;
begin
  if v = '' or position('{{' in v) = 0 then
    return v;
  end if;

  select
    prod.name  as product_name,
    ctry.name  as country_name,
    st.name    as state_name,
    city.name  as city_name,
    ind.name   as industry_name,
    buy.name   as buyer_type_name,
    mat.name   as material_name,
    srv.name   as service_name
  into v_page
  from seo_pages p
  left join seo_entities prod on prod.id = p.product_entity_id
  left join seo_entities ctry on ctry.id = p.country_entity_id
  left join seo_entities st   on st.id   = p.state_entity_id
  left join seo_entities city on city.id = p.city_entity_id
  left join seo_entities ind  on ind.id  = p.industry_entity_id
  left join seo_entities buy  on buy.id  = p.buyer_type_entity_id
  left join seo_entities mat  on mat.id  = p.material_entity_id
  left join seo_entities srv  on srv.id  = p.service_entity_id
  where p.id = p_page_id;

  v := replace(v, '{{product}}',    coalesce(v_page.product_name, ''));
  v := replace(v, '{{country}}',    coalesce(v_page.country_name, ''));
  v := replace(v, '{{state}}',      coalesce(v_page.state_name, ''));
  v := replace(v, '{{city}}',       coalesce(v_page.city_name, ''));
  v := replace(v, '{{industry}}',   coalesce(v_page.industry_name, ''));
  v := replace(v, '{{buyer_type}}', coalesce(v_page.buyer_type_name, ''));
  v := replace(v, '{{material}}',   coalesce(v_page.material_name, ''));
  v := replace(v, '{{service}}',    coalesce(v_page.service_name, ''));
  v := replace(v, '{{section}}',    coalesce(p_section_key, ''));
  v := replace(v, '{{brand}}',      '1 & 9 Apparel');

  -- Unknown placeholders are dropped, then separators left dangling by empty
  -- substitutions are tidied: ", ," / leading-trailing commas / double spaces.
  v := regexp_replace(v, '\{\{[a-z_]+\}\}', '', 'g');
  v := regexp_replace(v, '\s+,', ',', 'g');
  v := regexp_replace(v, ',(\s*,)+', ',', 'g');
  v := regexp_replace(v, '\s{2,}', ' ', 'g');
  v := regexp_replace(v, '^[\s,]+|[\s,]+$', '', 'g');
  return v;
end;
$function$;

-- ----------------------------------------------------------------------------
-- resolve_seo_page_image — THE canonical deterministic resolver
-- ----------------------------------------------------------------------------
-- Returns the winning image(s) for one page section, applying the override
-- hierarchy, geographic/product/section conflict rejection, explicit scoring
-- and stable tie-breaks. `selection_source` values:
--   manual_page_override | manual_page_mapping | exact_city | exact_state |
--   exact_country | product_section | global_fallback
-- p_include_demo: test flag — demo images are never selected without it.
-- p_max_results > 1 returns ordered runners-up (same determinism).

create or replace function public.resolve_seo_page_image(
  p_page_id      bigint,
  p_section_key  text,
  p_include_demo boolean default false,
  p_max_results  integer default 1
) returns table (
  assignment_id    bigint,
  image_id         bigint,
  image_key        text,
  image_url        text,
  alt              text,
  image_type       text,
  section_target   text,
  width            integer,
  height           integer,
  display_order    integer,
  is_primary       boolean,
  selection_source text,
  selection_score  integer,
  selection_reason text
)
language plpgsql
stable
set search_path = public
as $function$
declare
  v_page        record;
  v_eff_city    bigint;
  v_eff_state   bigint;
  v_eff_country bigint;
  v_prod_parent bigint;
  v_limit       integer := greatest(coalesce(p_max_results, 1), 1);
begin
  select * into v_page from seo_pages p where p.id = p_page_id;
  if not found then
    return;
  end if;

  -- Effective geography: use the page's explicit columns and derive missing
  -- ancestors upward through seo_entities.parent_id (city → state → country).
  -- A Texas page therefore accepts USA-tagged images even if only
  -- state_entity_id is set on the page.
  v_eff_city  := v_page.city_entity_id;
  v_eff_state := v_page.state_entity_id;
  if v_eff_state is null and v_eff_city is not null then
    select e.parent_id into v_eff_state
    from seo_entities e where e.id = v_eff_city;
  end if;
  v_eff_country := v_page.country_entity_id;
  if v_eff_country is null and v_eff_state is not null then
    select e.parent_id into v_eff_country
    from seo_entities e where e.id = v_eff_state;
  end if;

  -- Product category = parent entity of the page's product (future-proof:
  -- products are currently flat, so this is normally null).
  if v_page.product_entity_id is not null then
    select e.parent_id into v_prod_parent
    from seo_entities e where e.id = v_page.product_entity_id;
  end if;

  -- --------------------------------------------------------------------
  -- Layer 0 — page-level URL override for the hero slot (+6000).
  -- Editorial control: always wins, in every assignment mode.
  -- --------------------------------------------------------------------
  if p_section_key = 'hero' and v_page.hero_image_override_url is not null then
    return query select
      null::bigint, null::bigint,
      'page_hero_override'::text,
      v_page.hero_image_override_url,
      public.render_image_alt(v_page.title, p_page_id, p_section_key),
      'hero'::text, 'hero'::text,
      null::integer, null::integer,
      1, true,
      'manual_page_override'::text, 6000,
      'seo_pages.hero_image_override_url set for this page'::text;
    return;
  end if;

  -- --------------------------------------------------------------------
  -- Layer 0b — explicit Open Graph image (seo_pages.meta_image_id, +5500).
  -- --------------------------------------------------------------------
  if p_section_key = 'open_graph' and v_page.meta_image_id is not null then
    return query select
      null::bigint, il.id, il.image_key, il.image_url,
      public.render_image_alt(il.alt_template, p_page_id, p_section_key),
      il.image_type, il.section_target, il.width, il.height,
      1, true,
      'manual_page_override'::text, 5500,
      'seo_pages.meta_image_id set for this page'::text
    from image_library il
    where il.id = v_page.meta_image_id
      and il.is_active
      and (p_include_demo or not il.is_demo)
      and (il.valid_from  is null or il.valid_from  <= now())
      and (il.valid_until is null or il.valid_until >  now());
    if found then
      return;
    end if;
  end if;

  -- --------------------------------------------------------------------
  -- Layer 1 — explicit page-section override rows (+5000). Every mode.
  -- --------------------------------------------------------------------
  return query
  select
    spi.id, il.id, il.image_key, il.image_url,
    public.render_image_alt(il.alt_template, p_page_id, p_section_key),
    il.image_type, il.section_target, il.width, il.height,
    spi.display_order, spi.is_primary,
    'manual_page_override'::text, 5000,
    'explicit seo_page_images override (source=override)'::text
  from seo_page_images spi
  join image_library il on il.id = spi.image_id
  where spi.page_id = p_page_id
    and spi.section_name = p_section_key
    and spi.is_active
    and spi.source = 'override'
    and il.is_active
    and (p_include_demo or not il.is_demo)
    and (il.valid_from  is null or il.valid_from  <= now())
    and (il.valid_until is null or il.valid_until >  now())
  order by spi.display_order asc, spi.id asc
  limit v_limit;
  if found then
    return;
  end if;

  -- --------------------------------------------------------------------
  -- Layer 2 — manual page mapping rows (+4000). manual + hybrid modes.
  -- --------------------------------------------------------------------
  if v_page.image_assignment_mode in ('manual', 'hybrid') then
    return query
    select
      spi.id, il.id, il.image_key, il.image_url,
      public.render_image_alt(il.alt_template, p_page_id, p_section_key),
      il.image_type, il.section_target, il.width, il.height,
      spi.display_order, spi.is_primary,
      'manual_page_mapping'::text, 4000,
      'manual seo_page_images assignment (source=manual)'::text
    from seo_page_images spi
    join image_library il on il.id = spi.image_id
    where spi.page_id = p_page_id
      and spi.section_name = p_section_key
      and spi.is_active
      and spi.source = 'manual'
      and il.is_active
      and (p_include_demo or not il.is_demo)
      and (il.valid_from  is null or il.valid_from  <= now())
      and (il.valid_until is null or il.valid_until >  now())
    order by spi.display_order asc, spi.id asc
    limit v_limit;
    if found then
      return;
    end if;
  end if;

  -- manual mode never falls through to the deterministic engine.
  if v_page.image_assignment_mode = 'manual' then
    return;
  end if;

  -- --------------------------------------------------------------------
  -- Layer 3 — deterministic candidate scoring.
  -- The WHERE clause is the conflict-REJECTION filter; scoring only ranks
  -- candidates that survived it.
  -- --------------------------------------------------------------------
  return query
  with candidates as (
    select
      il.*,
      case when il.city_entity_id    is not null and il.city_entity_id    = v_eff_city    then 1000 else 0 end as s_city,
      case when il.state_entity_id   is not null and il.state_entity_id   = v_eff_state   then  800 else 0 end as s_state,
      case when il.country_entity_id is not null and il.country_entity_id = v_eff_country then  600 else 0 end as s_country,
      case when il.city_entity_id is null and il.state_entity_id is null and il.country_entity_id is null
           then 100 else 0 end as s_geo_global,
      case
        when il.product_entity_id is not null and il.product_entity_id = v_page.product_entity_id then 500
        when il.product_entity_id is not null and v_prod_parent is not null and il.product_entity_id = v_prod_parent then 350
        when il.product_entity_id is null then 100
        else 0
      end as s_product,
      case when il.section_target = p_section_key then 300 else 100 end as s_section,
      case when il.industry_entity_id   is not null and il.industry_entity_id   = v_page.industry_entity_id   then 180 else 0 end as s_industry,
      case when il.buyer_type_entity_id is not null and il.buyer_type_entity_id = v_page.buyer_type_entity_id then 160 else 0 end as s_buyer,
      case when il.material_entity_id   is not null and il.material_entity_id   = v_page.material_entity_id   then 140 else 0 end as s_material,
      case when il.service_entity_id    is not null and il.service_entity_id    = v_page.service_entity_id    then 120 else 0 end as s_service
    from image_library il
    where il.is_active
      and (p_include_demo or not il.is_demo)
      and (il.valid_from  is null or il.valid_from  <= now())
      and (il.valid_until is null or il.valid_until >  now())
      -- section compatibility (reject, Test J)
      and (il.section_target = p_section_key
           or il.compatible_sections @> array[p_section_key])
      -- geographic conflict rejection (strict: a geo-tagged image only serves
      -- pages whose effective geography matches that tier exactly)
      and (il.city_entity_id    is null or il.city_entity_id    = v_eff_city)
      and (il.state_entity_id   is null or il.state_entity_id   = v_eff_state)
      and (il.country_entity_id is null or il.country_entity_id = v_eff_country)
      -- product conflict rejection (null = generic apparel, always allowed)
      and (il.product_entity_id is null
           or il.product_entity_id = v_page.product_entity_id
           or (v_prod_parent is not null and il.product_entity_id = v_prod_parent))
      -- secondary entity conflicts: reject only when both sides disagree
      and (il.industry_entity_id   is null or v_page.industry_entity_id   is null or il.industry_entity_id   = v_page.industry_entity_id)
      and (il.buyer_type_entity_id is null or v_page.buyer_type_entity_id is null or il.buyer_type_entity_id = v_page.buyer_type_entity_id)
      and (il.material_entity_id   is null or v_page.material_entity_id   is null or il.material_entity_id   = v_page.material_entity_id)
      and (il.service_entity_id    is null or v_page.service_entity_id    is null or il.service_entity_id    = v_page.service_entity_id)
  )
  select
    null::bigint,
    c.id, c.image_key, c.image_url,
    public.render_image_alt(c.alt_template, p_page_id, p_section_key),
    c.image_type, c.section_target, c.width, c.height,
    1 as display_order, true as is_primary,
    case
      when c.s_city    > 0 then 'exact_city'
      when c.s_state   > 0 then 'exact_state'
      when c.s_country > 0 then 'exact_country'
      when c.s_product >= 350 then 'product_section'
      else 'global_fallback'
    end as selection_source,
    (c.s_city + c.s_state + c.s_country + c.s_geo_global + c.s_product
     + c.s_section + c.s_industry + c.s_buyer + c.s_material + c.s_service
     + c.priority + c.quality_score) as selection_score,
    concat_ws('; ',
      case when c.s_city    > 0 then 'exact city match (+1000)' end,
      case when c.s_state   > 0 then 'exact state match (+800)' end,
      case when c.s_country > 0 then 'exact country match (+600)' end,
      case when c.s_geo_global > 0 then 'global geographic image (+100)' end,
      case when c.s_product = 500 then 'exact product match (+500)'
           when c.s_product = 350 then 'product category match (+350)'
           when c.s_product = 100 then 'generic apparel (+100)' end,
      case when c.s_section = 300 then 'exact section match (+300)'
           else 'compatible section fallback (+100)' end,
      case when c.s_industry > 0 then 'exact industry match (+180)' end,
      case when c.s_buyer    > 0 then 'exact buyer-type match (+160)' end,
      case when c.s_material > 0 then 'exact material match (+140)' end,
      case when c.s_service  > 0 then 'exact service match (+120)' end,
      case when c.priority      <> 0 then 'priority (+' || c.priority || ')' end,
      case when c.quality_score <> 0 then 'quality (+' || c.quality_score || ')' end
    ) as selection_reason
  from candidates c
  order by
    (c.s_city + c.s_state + c.s_country + c.s_geo_global + c.s_product
     + c.s_section + c.s_industry + c.s_buyer + c.s_material + c.s_service
     + c.priority + c.quality_score) desc,
    c.priority desc,
    c.quality_score desc,
    c.specificity_score desc,
    c.updated_at desc,
    c.id asc
  limit v_limit;
end;
$function$;

-- ----------------------------------------------------------------------------
-- debug_seo_image_candidates — audit/explainability
-- ----------------------------------------------------------------------------
-- Returns EVERY layer row and EVERY image_library row considered for a
-- page+section: eligible candidates with their score breakdown and final
-- rank, plus rejected candidates with the concrete rejection reasons.
-- rank = 1 is exactly what resolve_seo_page_image() returns.

create or replace function public.debug_seo_image_candidates(
  p_page_id      bigint,
  p_section_key  text,
  p_include_demo boolean default false
) returns table (
  rank             integer,
  layer            text,
  image_id         bigint,
  image_key        text,
  eligible         boolean,
  selection_source text,
  selection_score  integer,
  score_breakdown  text,
  rejection_reason text
)
language plpgsql
stable
set search_path = public
as $function$
declare
  v_page        record;
  v_eff_city    bigint;
  v_eff_state   bigint;
  v_eff_country bigint;
  v_prod_parent bigint;
begin
  select * into v_page from seo_pages p where p.id = p_page_id;
  if not found then
    return;
  end if;

  v_eff_city  := v_page.city_entity_id;
  v_eff_state := v_page.state_entity_id;
  if v_eff_state is null and v_eff_city is not null then
    select e.parent_id into v_eff_state from seo_entities e where e.id = v_eff_city;
  end if;
  v_eff_country := v_page.country_entity_id;
  if v_eff_country is null and v_eff_state is not null then
    select e.parent_id into v_eff_country from seo_entities e where e.id = v_eff_state;
  end if;
  if v_page.product_entity_id is not null then
    select e.parent_id into v_prod_parent from seo_entities e where e.id = v_page.product_entity_id;
  end if;

  return query
  with layer_rows as (
    -- Layer 0: hero URL override
    select
      'page_url_override'::text as layer,
      null::bigint as image_id,
      'page_hero_override'::text as image_key,
      true as eligible,
      'manual_page_override'::text as selection_source,
      6000 as selection_score,
      'hero_image_override_url (+6000)'::text as score_breakdown,
      null::text as rejection_reason,
      0::bigint as tb_id
    where p_section_key = 'hero' and v_page.hero_image_override_url is not null

    union all
    -- Layer 0b: meta/OG image
    select 'page_meta_image', il.id, il.image_key, true,
           'manual_page_override', 5500, 'seo_pages.meta_image_id (+5500)', null, il.id
    from image_library il
    where p_section_key = 'open_graph'
      and v_page.meta_image_id = il.id
      and il.is_active and (p_include_demo or not il.is_demo)

    union all
    -- Layer 1/2: seo_page_images rows for this section
    select
      case spi.source when 'override' then 'page_section_override' else 'page_section_manual' end,
      il.id, il.image_key,
      (spi.source = 'override'
       or v_page.image_assignment_mode in ('manual','hybrid')),
      case spi.source when 'override' then 'manual_page_override' else 'manual_page_mapping' end,
      case spi.source when 'override' then 5000 else 4000 end,
      case spi.source when 'override' then 'explicit override (+5000)' else 'manual assignment (+4000)' end,
      case when spi.source = 'manual' and v_page.image_assignment_mode = 'automatic'
           then 'page mode is automatic: manual mappings ignored' end,
      spi.id
    from seo_page_images spi
    join image_library il on il.id = spi.image_id
    where spi.page_id = p_page_id
      and spi.section_name = p_section_key
      and spi.is_active
      and spi.source in ('override','manual')
      and il.is_active
      and (p_include_demo or not il.is_demo)
  ),
  det as (
    select
      'deterministic'::text as layer,
      il.id as image_id,
      il.image_key,
      -- eligibility flags (coalesced: NULL comparisons mean "no match")
      coalesce(
      (v_page.image_assignment_mode <> 'manual') and
      (il.section_target = p_section_key or il.compatible_sections @> array[p_section_key]) and
      (il.city_entity_id    is null or il.city_entity_id    = v_eff_city) and
      (il.state_entity_id   is null or il.state_entity_id   = v_eff_state) and
      (il.country_entity_id is null or il.country_entity_id = v_eff_country) and
      (il.product_entity_id is null or il.product_entity_id = v_page.product_entity_id
         or (v_prod_parent is not null and il.product_entity_id = v_prod_parent)) and
      (il.industry_entity_id   is null or v_page.industry_entity_id   is null or il.industry_entity_id   = v_page.industry_entity_id) and
      (il.buyer_type_entity_id is null or v_page.buyer_type_entity_id is null or il.buyer_type_entity_id = v_page.buyer_type_entity_id) and
      (il.material_entity_id   is null or v_page.material_entity_id   is null or il.material_entity_id   = v_page.material_entity_id) and
      (il.service_entity_id    is null or v_page.service_entity_id    is null or il.service_entity_id    = v_page.service_entity_id) and
      (il.valid_from is null or il.valid_from <= now()) and
      (il.valid_until is null or il.valid_until > now())
      , false) as eligible,
      concat_ws('; ',
        case when v_page.image_assignment_mode = 'manual'
             then 'page mode is manual: deterministic engine disabled' end,
        case when not (il.section_target = p_section_key or il.compatible_sections @> array[p_section_key])
             then 'section incompatible (target=' || coalesce(il.section_target,'∅') || ')' end,
        case when il.city_entity_id is not null and il.city_entity_id is distinct from v_eff_city
             then 'geo conflict: city tag does not match page' end,
        case when il.state_entity_id is not null and il.state_entity_id is distinct from v_eff_state
             then 'geo conflict: state tag does not match page' end,
        case when il.country_entity_id is not null and il.country_entity_id is distinct from v_eff_country
             then 'geo conflict: country tag does not match page' end,
        case when il.product_entity_id is not null
                  and il.product_entity_id is distinct from v_page.product_entity_id
                  and (v_prod_parent is null or il.product_entity_id is distinct from v_prod_parent)
             then 'product conflict: image is product-specific for another product' end,
        case when il.industry_entity_id is not null and v_page.industry_entity_id is not null
                  and il.industry_entity_id <> v_page.industry_entity_id
             then 'industry conflict' end,
        case when il.buyer_type_entity_id is not null and v_page.buyer_type_entity_id is not null
                  and il.buyer_type_entity_id <> v_page.buyer_type_entity_id
             then 'buyer-type conflict' end,
        case when il.material_entity_id is not null and v_page.material_entity_id is not null
                  and il.material_entity_id <> v_page.material_entity_id
             then 'material conflict' end,
        case when il.service_entity_id is not null and v_page.service_entity_id is not null
                  and il.service_entity_id <> v_page.service_entity_id
             then 'service conflict' end,
        case when not (il.valid_from is null or il.valid_from <= now())
                  or not (il.valid_until is null or il.valid_until > now())
             then 'outside validity window' end
      ) as rejection_reason,
      case when il.city_entity_id    is not null and il.city_entity_id    = v_eff_city    then 1000 else 0 end as s_city,
      case when il.state_entity_id   is not null and il.state_entity_id   = v_eff_state   then  800 else 0 end as s_state,
      case when il.country_entity_id is not null and il.country_entity_id = v_eff_country then  600 else 0 end as s_country,
      case when il.city_entity_id is null and il.state_entity_id is null and il.country_entity_id is null
           then 100 else 0 end as s_geo_global,
      case
        when il.product_entity_id is not null and il.product_entity_id = v_page.product_entity_id then 500
        when il.product_entity_id is not null and v_prod_parent is not null and il.product_entity_id = v_prod_parent then 350
        when il.product_entity_id is null then 100
        else 0
      end as s_product,
      case when il.section_target = p_section_key then 300 else 100 end as s_section,
      case when il.industry_entity_id   is not null and il.industry_entity_id   = v_page.industry_entity_id   then 180 else 0 end as s_industry,
      case when il.buyer_type_entity_id is not null and il.buyer_type_entity_id = v_page.buyer_type_entity_id then 160 else 0 end as s_buyer,
      case when il.material_entity_id   is not null and il.material_entity_id   = v_page.material_entity_id   then 140 else 0 end as s_material,
      case when il.service_entity_id    is not null and il.service_entity_id    = v_page.service_entity_id    then 120 else 0 end as s_service,
      il.priority, il.quality_score, il.specificity_score, il.updated_at
    from image_library il
    where il.is_active
      and (p_include_demo or not il.is_demo)
  ),
  det_rows as (
    select
      d.layer, d.image_id, d.image_key, d.eligible,
      case
        when d.s_city    > 0 then 'exact_city'
        when d.s_state   > 0 then 'exact_state'
        when d.s_country > 0 then 'exact_country'
        when d.s_product >= 350 then 'product_section'
        else 'global_fallback'
      end as selection_source,
      (d.s_city + d.s_state + d.s_country + d.s_geo_global + d.s_product
       + d.s_section + d.s_industry + d.s_buyer + d.s_material + d.s_service
       + d.priority + d.quality_score) as selection_score,
      concat_ws('; ',
        case when d.s_city    > 0 then 'exact city (+1000)' end,
        case when d.s_state   > 0 then 'exact state (+800)' end,
        case when d.s_country > 0 then 'exact country (+600)' end,
        case when d.s_geo_global > 0 then 'global geo (+100)' end,
        case when d.s_product = 500 then 'exact product (+500)'
             when d.s_product = 350 then 'product category (+350)'
             when d.s_product = 100 then 'generic apparel (+100)' end,
        case when d.s_section = 300 then 'exact section (+300)' else 'compatible section (+100)' end,
        case when d.s_industry > 0 then 'industry (+180)' end,
        case when d.s_buyer    > 0 then 'buyer type (+160)' end,
        case when d.s_material > 0 then 'material (+140)' end,
        case when d.s_service  > 0 then 'service (+120)' end,
        case when d.priority      <> 0 then 'priority (+' || d.priority || ')' end,
        case when d.quality_score <> 0 then 'quality (+' || d.quality_score || ')' end
      ) as score_breakdown,
      nullif(d.rejection_reason, '') as rejection_reason,
      d.priority, d.quality_score, d.specificity_score, d.updated_at,
      d.image_id as tb_id
    from det d
  ),
  unioned as (
    select l.layer, l.image_id, l.image_key, l.eligible, l.selection_source,
           l.selection_score, l.score_breakdown, l.rejection_reason,
           0 as priority, 0 as quality_score, 0 as specificity_score,
           null::timestamptz as updated_at, l.tb_id
    from layer_rows l
    union all
    select dr.layer, dr.image_id, dr.image_key, dr.eligible, dr.selection_source,
           dr.selection_score, dr.score_breakdown, dr.rejection_reason,
           dr.priority, dr.quality_score, dr.specificity_score, dr.updated_at, dr.tb_id
    from det_rows dr
  )
  select
    case when u.eligible then
      (rank() over (
        order by
          case when u.eligible then 0 else 1 end,
          u.selection_score desc,
          u.priority desc,
          u.quality_score desc,
          u.specificity_score desc,
          u.updated_at desc nulls last,
          u.tb_id asc
      ))::integer
    end as rank,
    u.layer, u.image_id, u.image_key, u.eligible, u.selection_source,
    u.selection_score, u.score_breakdown, u.rejection_reason
  from unioned u
  order by u.eligible desc, u.selection_score desc, u.priority desc,
           u.quality_score desc, u.specificity_score desc,
           u.updated_at desc nulls last, u.tb_id asc;
end;
$function$;

-- ----------------------------------------------------------------------------
-- materialize_seo_page_images — OPTIONAL performance cache
-- ----------------------------------------------------------------------------
-- Snapshots the deterministic pick for every automatic section of a page into
-- seo_page_images with source='materialized'. Dynamic resolution remains the
-- source of truth: the render path IGNORES materialized rows (they exist for
-- exports, admin diffing and warm-cache analysis). Regeneration simply
-- deletes and rewrites them, so invalidation is a re-run; manual and override
-- rows are never touched. Returns the number of rows written.

create or replace function public.materialize_seo_page_images(p_page_id bigint)
returns integer
language plpgsql
volatile
set search_path = public
as $function$
declare
  v_written integer := 0;
  v_section text;
  r         record;
begin
  -- Refresh: clear previous materialization for this page only.
  delete from seo_page_images
  where page_id = p_page_id and source = 'materialized';

  for v_section in
    select distinct il.section_target
    from image_library il
    where il.is_active and not il.is_demo and il.section_target is not null
    order by il.section_target
  loop
    -- Sections already covered by an active manual/override row keep their
    -- editorial assignment; nothing to materialize.
    continue when exists (
      select 1 from seo_page_images spi
      where spi.page_id = p_page_id
        and spi.section_name = v_section
        and spi.is_active
        and spi.source in ('manual', 'override')
    );

    for r in
      select * from public.resolve_seo_page_image(p_page_id, v_section)
    loop
      -- Only image-library-backed picks can be cached (URL overrides have no
      -- image_id and are recomputed live).
      continue when r.image_id is null;
      insert into seo_page_images
        (page_id, image_id, section_name, display_order, is_primary, is_active,
         source, resolver_version, selection_score, selection_reason, materialized_at)
      values
        (p_page_id, r.image_id, v_section, r.display_order, r.is_primary, true,
         'materialized', '1.0.0', r.selection_score, r.selection_reason, now())
      on conflict (page_id, section_name, image_id) do nothing;
      v_written := v_written + 1;
    end loop;
  end loop;

  return v_written;
end;
$function$;

-- ----------------------------------------------------------------------------
-- Permissions
-- ----------------------------------------------------------------------------
-- resolve_seo_page_image + render_image_alt must stay executable by anon:
-- get_seo_page_render runs with invoker rights under the anon key.
-- Debug and materialize are back-office tools: not for the public key.
revoke execute on function public.debug_seo_image_candidates(bigint, text, boolean) from public, anon, authenticated;
revoke execute on function public.materialize_seo_page_images(bigint) from public, anon, authenticated;
grant execute on function public.debug_seo_image_candidates(bigint, text, boolean) to service_role;
grant execute on function public.materialize_seo_page_images(bigint) to service_role;
