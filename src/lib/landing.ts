/**
 * View-model types for the landing UI components.
 *
 * These shapes originally mirrored the `get_landing_page_view` RPC. Today the
 * data comes from `get_seo_page_render` and is mapped into this shape by
 * src/lib/seo/mapRpcToLandingProps.ts — the components stay purely
 * presentational. Every field is optional / nullable and guarded at render
 * time; nothing about page content is hardcoded.
 */

export interface LandingPage {
  id?: number | string | null;
  slug?: string | null;
  title?: string | null;
  h1?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  canonical_url?: string | null;
  robots?: string | null;
  template?: string | null;
  priority?: number | null;
  hero_image_url?: string | null;
  published_at?: string | null;
  updated_at?: string | null;
}

export interface TrustBadge {
  label?: string | null;
  image_url?: string | null;
}

export interface CountryAssets {
  hero_image_url?: string | null;
  meta_image_url?: string | null;
  trust_badges?: TrustBadge[] | null;
  shipping_text?: string | null;
  currency_code?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  factory_message?: string | null;
}

export interface ContentBlock {
  block_key?: string | null;
  sort_order?: number | null;
  heading?: string | null;
  body?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  image_url?: string | null;
  image_alt?: string | null;
}

export interface Faq {
  question?: string | null;
  answer?: string | null;
  sort_order?: number | null;
  include_in_schema?: boolean | null;
}

export interface Product {
  slug?: string | null;
  title?: string | null;
  description?: string | null;
  category?: string | null;
  cta_text?: string | null;
  moq?: number | null;
  image_url?: string | null;
  sort_order?: number | null;
  is_featured?: boolean | null;
}

export interface InternalLink {
  anchor?: string | null;
  slug?: string | null;
  sort_order?: number | null;
}

/** internal_links is an object keyed by link group (e.g. "related_products"). */
export type InternalLinks = Record<string, InternalLink[]>;

/** A DB-assigned image for the intro gallery (from assigned_images). */
export interface GalleryImage {
  url: string;
  alt?: string | null;
}

export interface LandingPageData {
  page?: LandingPage | null;
  country_assets?: CountryAssets | null;
  content_blocks?: ContentBlock[] | null;
  faqs?: Faq[] | null;
  products?: Product[] | null;
  internal_links?: InternalLinks | null;
  /** Non-hero assigned images, in display_order — used by the intro grid. */
  gallery_images?: GalleryImage[] | null;
}

/** Find the first content block whose key matches any of the given keys. */
export function blockByKey(
  blocks: ContentBlock[] | null | undefined,
  ...keys: string[]
): ContentBlock | undefined {
  if (!blocks) return undefined;
  const wanted = keys.map((k) => k.toLowerCase());
  return blocks.find(
    (b) => b.block_key != null && wanted.includes(b.block_key.toLowerCase())
  );
}
