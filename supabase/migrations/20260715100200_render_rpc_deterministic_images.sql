-- ============================================================================
-- Deterministic Image Engine — Part 3/3: get_seo_page_render integration
-- ============================================================================
-- assigned_images is now produced by resolve_seo_page_image() per section
-- instead of a bare seo_page_images join. The response CONTRACT IS PRESERVED:
-- every existing key keeps its name, type and semantics; three additive keys
-- (selection_source, selection_score, selection_reason) are appended per
-- image for auditability.
--
-- Backward compatibility guarantees:
--   * pages default to image_assignment_mode='hybrid', and every current page
--     has active manual rows for all five sections, so today's payload is
--     byte-identical except for the three additive keys;
--   * `id` stays seo_page_images.id for manual/override rows; deterministic
--     picks (no assignment row) use a synthetic NEGATIVE id (-image_id;
--     -900001 for a hero URL override) so they can never collide with real
--     assignment ids — the frontend only uses `id` for de-duplication;
--   * published-only lookup is unchanged (unpublished pages return SQL null);
--   * inactive, expired and demo images are never returned;
--   * section_blocks / faqs / products / internal_links are untouched.
--
-- Sections resolved = every distinct section_target of active production
-- images UNION the page's own active manual/override section names, so a new
-- section added in the DB flows to the frontend without a code change.
-- ============================================================================

create or replace function public.get_seo_page_render(p_slug text)
returns jsonb
language plpgsql
stable
set search_path = public
as $function$
declare
  result jsonb;
begin
  select jsonb_build_object(
    'page', jsonb_build_object(
      'id', p.id,
      'slug', p.slug,
      'title', p.title,
      'h1', p.h1,
      'meta_title', p.meta_title,
      'meta_description', p.meta_description,
      'layout_variant_id', p.layout_variant_id,
      'robots', p.robots,
      'is_indexable', (p.robots like 'index%')
    ),

    'section_blocks', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', cb.id,
          'section_key', cb.block_key,
          'block_key', cb.block_key,
          'title', cb.heading,
          'heading', cb.heading,
          'body', cb.body,
          'cta_label', cb.cta_label,
          'cta_url', cb.cta_url,
          'image_url', cb.image_url,
          'image_alt', cb.image_alt,
          'position', cb.display_order
        )
        order by cb.display_order
      )
      from seo_content_blocks cb
      where cb.page_id = p.id
    ), '[]'::jsonb),

    -- Deterministic image engine: one resolver call per known section.
    'assigned_images', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', case
                  when r.assignment_id is not null then r.assignment_id
                  when r.image_id is not null then -r.image_id
                  else -900001
                end,
          'section_name', s.section_key,
          'display_order', r.display_order,
          'is_primary', r.is_primary,
          'image_id', r.image_id,
          'image_key', r.image_key,
          'image_url', r.image_url,
          'alt', r.alt,
          'image_type', r.image_type,
          'section_target', r.section_target,
          'width', r.width,
          'height', r.height,
          'selection_source', r.selection_source,
          'selection_score', r.selection_score,
          'selection_reason', r.selection_reason
        )
        order by s.section_key, r.display_order
      )
      from (
        select distinct il.section_target as section_key
        from image_library il
        where il.is_active and not il.is_demo and il.section_target is not null
        union
        select distinct spi.section_name
        from seo_page_images spi
        where spi.page_id = p.id
          and spi.is_active
          and spi.source in ('manual', 'override')
      ) s
      cross join lateral public.resolve_seo_page_image(p.id, s.section_key) r
    ), '[]'::jsonb),

    'faqs', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', f.id,
          'question', f.question,
          'answer', f.answer,
          'priority', f.priority,
          'display_order', f.display_order,
          'include_in_schema', f.include_in_schema
        )
        order by f.display_order, f.priority desc
      )
      from seo_faqs f
      where f.is_active = true
        and (
          f.product_entity_id is null
          or f.product_entity_id = p.product_entity_id
        )
        and (
          f.country_entity_id is null
          or f.country_entity_id = p.country_entity_id
        )
        and (
          f.buyer_type_entity_id is null
          or f.buyer_type_entity_id = p.buyer_type_entity_id
        )
    ), '[]'::jsonb),

    'products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sort_order',  pp.display_order,
        'is_featured', pp.is_featured,
        'slug',        e.slug,
        'title',       coalesce(pp.card_title, e.name),
        'description', coalesce(pp.card_description, e.attributes->>'card_description'),
        'cta_text',    pp.cta_text,
        'moq',         coalesce(pp.moq, nullif(e.attributes->>'moq', '')::int),
        'image_url',   coalesce(pp.image_override_url, e.attributes->>'image_url')
      ) order by pp.display_order)
      from seo_page_products pp
      join seo_entities e on e.id = pp.product_entity_id
      where pp.page_id = p.id
    ), '[]'::jsonb),

    'internal_links', coalesce((
      select jsonb_object_agg(g.link_group, g.links)
      from (
        select l.link_group,
               jsonb_agg(jsonb_build_object(
                 'anchor',     coalesce(l.anchor_text, tp.title),
                 'slug',       tp.slug,
                 'sort_order', l.display_order
               ) order by l.display_order) as links
        from seo_internal_links l
        join seo_pages tp on tp.id = l.target_page_id
        where l.source_page_id = p.id
          and tp.status = 'published'
        group by l.link_group
      ) g
    ), '{}'::jsonb)
  )
  into result
  from seo_pages p
  where p.slug = p_slug
    and p.status = 'published'
  limit 1;

  return result;
end;
$function$;
