-- ============================================================================
-- Deterministic Image Engine — Part 1/3: schema
-- ============================================================================
-- Extends the CANONICAL image tables (image_library + seo_page_images) into a
-- deterministic, entity-driven selection model. Purely additive:
--   * no column is dropped or renamed,
--   * no existing row is deleted,
--   * every new column has a default that reproduces today's behavior,
--   * legacy tables (seo_images, seo_image_library, seo_media_assets, ...)
--     are left untouched.
--
-- Rollback: supabase/rollback/20260715_deterministic_image_engine_rollback.sql
-- Verification: supabase/verification/deterministic_image_engine_verification.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. image_library — entity targeting, scope, scoring and licensing columns
-- ----------------------------------------------------------------------------
-- Entity FKs point at seo_entities (the canonical entity registry, same as
-- seo_pages.*_entity_id). The legacy free-text columns (product_type, country,
-- buyer_intent) are kept for backward compatibility but the resolver matches
-- ONLY on entity ids — text columns are operational metadata.

alter table public.image_library
  add column if not exists product_entity_id    bigint references public.seo_entities(id) on delete restrict,
  add column if not exists country_entity_id    bigint references public.seo_entities(id) on delete restrict,
  add column if not exists state_entity_id      bigint references public.seo_entities(id) on delete restrict,
  add column if not exists city_entity_id       bigint references public.seo_entities(id) on delete restrict,
  add column if not exists industry_entity_id   bigint references public.seo_entities(id) on delete restrict,
  add column if not exists buyer_type_entity_id bigint references public.seo_entities(id) on delete restrict,
  add column if not exists material_entity_id   bigint references public.seo_entities(id) on delete restrict,
  add column if not exists service_entity_id    bigint references public.seo_entities(id) on delete restrict,
  -- Controlled geographic scope of what the image genuinely depicts.
  add column if not exists geographic_scope     text not null default 'global',
  -- Extra sections this image may serve besides section_target (Test J:
  -- a factory-only image must NOT serve hero unless listed here).
  add column if not exists compatible_sections  text[] not null default '{}',
  -- Operational text codes (never used for matching; entity ids win).
  add column if not exists country_code         text,
  add column if not exists state_code           text,
  add column if not exists city_slug            text,
  -- Deterministic ranking inputs.
  add column if not exists priority             integer not null default 0,
  add column if not exists quality_score        integer not null default 0,
  add column if not exists specificity_score    integer not null default 0,
  add column if not exists is_default           boolean not null default false,
  -- Demo/test flag: production selection excludes these unless the resolver
  -- is called with p_include_demo => true.
  add column if not exists is_demo              boolean not null default false,
  -- Validity window; expired images are never selected.
  add column if not exists valid_from           timestamptz,
  add column if not exists valid_until          timestamptz,
  -- Licensing / provenance metadata.
  add column if not exists license_type         text,
  add column if not exists source_name          text,
  add column if not exists source_url           text,
  add column if not exists copyright_owner      text,
  add column if not exists updated_at           timestamptz not null default now();

alter table public.image_library
  drop constraint if exists image_library_geographic_scope_check;
alter table public.image_library
  add constraint image_library_geographic_scope_check
  check (geographic_scope in ('city','state','country','region','global'));

alter table public.image_library
  drop constraint if exists image_library_valid_window_check;
alter table public.image_library
  add constraint image_library_valid_window_check
  check (valid_from is null or valid_until is null or valid_from < valid_until);

-- Keep updated_at fresh (reuses the existing set_updated_at() trigger fn).
drop trigger if exists image_library_set_updated_at on public.image_library;
create trigger image_library_set_updated_at
  before update on public.image_library
  for each row execute function public.set_updated_at();

-- Entity-type guard: each *_entity_id must reference an entity of the right
-- type (same pattern as validate_seo_page_entities on seo_pages).
create or replace function public.validate_image_library_entities()
returns trigger
language plpgsql
set search_path = public
as $function$
declare
  bad text;
begin
  select string_agg(x.col, ', ') into bad
  from (values
    ('product_entity_id',    new.product_entity_id,    'product'),
    ('country_entity_id',    new.country_entity_id,    'country'),
    ('state_entity_id',      new.state_entity_id,      'state'),
    ('city_entity_id',       new.city_entity_id,       'city'),
    ('industry_entity_id',   new.industry_entity_id,   'industry'),
    ('buyer_type_entity_id', new.buyer_type_entity_id, 'buyer_type'),
    ('material_entity_id',   new.material_entity_id,   'material'),
    ('service_entity_id',    new.service_entity_id,    'service')
  ) as x(col, eid, expected)
  where x.eid is not null
    and not exists (
      select 1 from public.seo_entities e
      where e.id = x.eid and e.entity_type = x.expected
    );

  if bad is not null then
    raise exception 'image_library entity type mismatch on: %', bad
      using errcode = '23514';
  end if;

  return new;
end;
$function$;

drop trigger if exists image_library_validate_entities on public.image_library;
create trigger image_library_validate_entities
  before insert or update on public.image_library
  for each row execute function public.validate_image_library_entities();

-- ----------------------------------------------------------------------------
-- 2. seo_page_images — becomes the manual/override layer of the engine
-- ----------------------------------------------------------------------------
-- source semantics:
--   'manual'       existing editorial page↔image mapping (+4000, wins over
--                  deterministic candidates in manual/hybrid mode)
--   'override'     explicit page-section override (+5000, wins in EVERY mode)
--   'materialized' cache rows written by materialize_seo_page_images();
--                  NEVER read by the render path (dynamic resolution stays
--                  the source of truth), safe to delete/regenerate anytime.

alter table public.seo_page_images
  add column if not exists source           text not null default 'manual',
  add column if not exists resolver_version text,
  add column if not exists selection_score  integer,
  add column if not exists selection_reason text,
  add column if not exists materialized_at  timestamptz;

alter table public.seo_page_images
  drop constraint if exists seo_page_images_source_check;
alter table public.seo_page_images
  add constraint seo_page_images_source_check
  check (source in ('manual','override','materialized'));

-- ----------------------------------------------------------------------------
-- 3. seo_pages — per-page image assignment mode
-- ----------------------------------------------------------------------------
--   automatic: deterministic resolver only (explicit overrides still win —
--              editorial control is never removable)
--   manual:    only manually assigned page-section images
--   hybrid:    manual where present, deterministic resolver otherwise
-- Default 'hybrid' preserves current production output exactly: every page
-- keeps rendering its existing seo_page_images assignments.

alter table public.seo_pages
  add column if not exists image_assignment_mode text not null default 'hybrid';

alter table public.seo_pages
  drop constraint if exists seo_pages_image_assignment_mode_check;
alter table public.seo_pages
  add constraint seo_pages_image_assignment_mode_check
  check (image_assignment_mode in ('automatic','manual','hybrid'));

-- ----------------------------------------------------------------------------
-- 4. Backfill — existing production data, no fake geography
-- ----------------------------------------------------------------------------
-- The 5 existing images are generic Unsplash apparel/factory photos. They do
-- NOT depict any specific geography or product, so they become GLOBAL DEFAULTS
-- (geographic_scope='global', no entity tags). They are live production
-- fallbacks today, therefore is_demo stays false — flipping it would blank
-- every current page.

update public.image_library
set geographic_scope = 'global',
    is_default       = true,
    source_name      = coalesce(source_name, 'Unsplash'),
    license_type     = coalesce(license_type, 'unsplash'),
    source_url       = coalesce(source_url, image_url)
where image_key in
  ('demo_hero_tshirt','demo_factory','demo_quality','demo_product','demo_customization')
  and product_entity_id is null
  and country_entity_id is null;

-- Existing page↔image rows are the editorial manual layer.
update public.seo_page_images set source = 'manual' where source is null;

-- ----------------------------------------------------------------------------
-- 5. Indexes — resolver access paths (pSEO scale)
-- ----------------------------------------------------------------------------
-- Workhorse: candidates for one section among active production images.
create index if not exists image_library_resolver_idx
  on public.image_library (section_target, country_entity_id, state_entity_id,
                           city_entity_id, product_entity_id, priority desc)
  where is_active and not is_demo;

-- Compatible-section fallback lookup (@> array[p_section_key]).
create index if not exists image_library_compat_sections_gin
  on public.image_library using gin (compatible_sections)
  where is_active;

-- Per-entity partial indexes for admin/audit queries and entity-first plans.
create index if not exists image_library_country_idx
  on public.image_library (country_entity_id) where country_entity_id is not null and is_active;
create index if not exists image_library_state_idx
  on public.image_library (state_entity_id) where state_entity_id is not null and is_active;
create index if not exists image_library_city_idx
  on public.image_library (city_entity_id) where city_entity_id is not null and is_active;
create index if not exists image_library_product_idx
  on public.image_library (product_entity_id) where product_entity_id is not null and is_active;
create index if not exists image_library_industry_idx
  on public.image_library (industry_entity_id) where industry_entity_id is not null and is_active;
create index if not exists image_library_buyer_type_idx
  on public.image_library (buyer_type_entity_id) where buyer_type_entity_id is not null and is_active;
create index if not exists image_library_material_idx
  on public.image_library (material_entity_id) where material_entity_id is not null and is_active;
create index if not exists image_library_service_idx
  on public.image_library (service_entity_id) where service_entity_id is not null and is_active;
create index if not exists image_library_default_idx
  on public.image_library (section_target) where is_default and is_active;

-- Manual/override layer lookup by page+section, filtered by source.
create index if not exists seo_page_images_page_source_idx
  on public.seo_page_images (page_id, section_name, source)
  where is_active;

-- FK-support indexes: image_library deletions must not seq-scan the
-- referencing tables. Measured locally at 100k pages, deleting 50k images
-- took >4 minutes without these and milliseconds with them.
create index if not exists seo_page_images_image_idx
  on public.seo_page_images (image_id);
create index if not exists seo_pages_meta_image_idx
  on public.seo_pages (meta_image_id) where meta_image_id is not null;
