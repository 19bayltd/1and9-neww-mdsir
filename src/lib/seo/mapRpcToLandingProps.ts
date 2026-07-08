import type {
  ContentBlock,
  Faq,
  GalleryImage,
  LandingPageData,
} from "@/lib/landing";
import type { SeoPageRenderResponse } from "@/types/seo";
import { getSectionImage } from "./imageResolver";

/**
 * Adapter: `get_seo_page_render` RPC payload → landing component view-model.
 *
 * The landing components (src/components/landing) keep the original visual
 * design; this mapping is the only place the two shapes meet.
 *
 * Image policy: every image comes from `assigned_images` via the resolver —
 * section_blocks.image_url is intentionally ignored as an image source.
 */
export function mapRpcToLandingProps(data: SeoPageRenderResponse): LandingPageData {
  const { page, section_blocks, assigned_images, faqs } = data;

  const heroImage = getSectionImage("hero", assigned_images);

  const content_blocks: ContentBlock[] = (section_blocks ?? []).map((block) => {
    const key = block.section_key ?? block.block_key ?? null;
    const image = key ? getSectionImage(key, assigned_images) : null;
    return {
      block_key: key,
      sort_order: block.position,
      heading: block.heading ?? block.title,
      body: block.body,
      cta_label: block.cta_label,
      cta_url: block.cta_url,
      image_url: image?.image_url ?? null,
      image_alt: image?.alt ?? null,
    };
  });

  const mappedFaqs: Faq[] = (faqs ?? []).map((f) => ({
    question: f.question,
    answer: f.answer,
    sort_order: f.display_order,
    include_in_schema: f.include_in_schema,
  }));

  // Non-hero assigned images feed the intro image grid, in display_order.
  const gallery_images: GalleryImage[] = (assigned_images ?? [])
    .filter((img) => Boolean(img.image_url) && img.id !== heroImage?.id)
    .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999))
    .map((img) => ({ url: img.image_url as string, alt: img.alt }));

  return {
    page: page
      ? {
          id: page.id,
          slug: page.slug,
          title: page.title,
          h1: page.h1,
          meta_title: page.meta_title,
          meta_description: page.meta_description,
          hero_image_url: heroImage?.image_url ?? null,
        }
      : null,
    // Not provided by get_seo_page_render — components skip these cleanly.
    country_assets: null,
    products: [],
    internal_links: null,
    content_blocks,
    faqs: mappedFaqs,
    gallery_images,
  };
}
