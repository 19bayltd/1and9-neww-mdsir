import { supabase } from "@/lib/supabase";

/**
 * Defensive types for the `get_landing_page_view` RPC payload.
 *
 * The exact JSON may vary slightly between pages (nullable fields, optional
 * groups), so every field is treated as optional / nullable at the type level
 * and guarded at render time. Nothing about page content is hardcoded — the
 * frontend only knows the *shape*, never the copy.
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

export interface LandingPageData {
  page?: LandingPage | null;
  country_assets?: CountryAssets | null;
  content_blocks?: ContentBlock[] | null;
  faqs?: Faq[] | null;
  products?: Product[] | null;
  internal_links?: InternalLinks | null;
}

export type LandingPageResult =
  | { status: "ok"; data: LandingPageData }
  | { status: "not_found" }
  | { status: "error"; message: string };

/**
 * Fetch a landing page by slug via the deterministic Supabase RPC.
 * Never throws — returns a discriminated result the page can render against.
 */
export async function fetchLandingPage(slug: string): Promise<LandingPageResult> {
  const { data, error } = await supabase.rpc("get_landing_page_view", {
    page_slug: slug,
  });

  if (error) {
    // Log the real error server-side; the UI shows a generic message.
    console.error(`[get_landing_page_view] RPC error for slug "${slug}":`, error);
    return { status: "error", message: error.message };
  }

  // RPC returns SQL null when the page does not exist / is unpublished.
  const payload = data as LandingPageData | null;
  if (!payload || !payload.page || !payload.page.slug) {
    return { status: "not_found" };
  }

  return { status: "ok", data: payload };
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
