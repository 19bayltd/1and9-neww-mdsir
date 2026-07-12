-- Expose the page's indexability through the render RPC.
--
-- seo_pages.robots (text NOT NULL, CHECK: 'index,follow' | 'noindex,follow' |
-- 'index,nofollow' | 'noindex,nofollow') is the single source of truth for
-- indexability. The sitemap RPCs already filter on it; this migration makes
-- the render RPC return it so the frontend can emit the <meta name="robots">
-- directive. Additive contract change only:
--   page.robots       — the raw directive string
--   page.is_indexable — convenience boolean, true when robots starts 'index'
-- The published-only lookup (render_published_pages_only) is preserved:
-- noindex pages still render in full; only non-published pages are excluded.

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

    'assigned_images', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', spi.id,
          'section_name', spi.section_name,
          'display_order', spi.display_order,
          'is_primary', spi.is_primary,
          'image_id', il.id,
          'image_key', il.image_key,
          'image_url', il.image_url,
          'alt', il.alt_template,
          'image_type', il.image_type,
          'section_target', il.section_target,
          'width', il.width,
          'height', il.height
        )
        order by spi.section_name, spi.display_order
      )
      from seo_page_images spi
      join image_library il on il.id = spi.image_id
      where spi.page_id = p.id
        and spi.is_active = true
        and il.is_active = true
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
