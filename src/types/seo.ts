/**
 * Types for the `get_seo_page_render(p_slug)` Supabase RPC payload.
 *
 * The shapes below match the RPC's jsonb_build_object output exactly. Every
 * content field is nullable — components must guard at render time. The
 * frontend only knows the *shape* of the data, never the copy.
 */

export interface SeoPage {
  id: number;
  slug: string;
  title: string | null;
  h1: string | null;
  meta_title: string | null;
  meta_description: string | null;
  layout_variant_id: number | null;
  /**
   * seo_pages.robots directive, e.g. "index,follow" or "noindex,follow".
   * NOT NULL in the schema — the frontend fails loudly if it is missing
   * rather than silently defaulting to indexable.
   */
  robots: string | null;
  /** Convenience flag derived in the RPC: robots LIKE 'index%'. */
  is_indexable: boolean | null;
}

export interface SectionBlock {
  id: number;
  /** Canonical section identifier (the RPC emits both keys with the same value). */
  section_key: string | null;
  block_key: string | null;
  title: string | null;
  heading: string | null;
  body: string | null;
  cta_label: string | null;
  cta_url: string | null;
  /**
   * Legacy per-block image. NOT the main image source — assigned_images is
   * the database-driven image system (see imageResolver).
   */
  image_url: string | null;
  image_alt: string | null;
  /** DB-driven render order (seo_content_blocks.display_order). */
  position: number | null;
}

export interface AssignedImage {
  /**
   * seo_page_images.id for manual/override assignments; deterministic
   * resolver picks carry a synthetic NEGATIVE id (-image_id). Only used for
   * de-duplication — never as a database key.
   */
  id: number;
  image_id: number | null;
  image_key: string | null;
  image_url: string | null;
  alt: string | null;
  image_type: string | null;
  /** Assignment slot on the page (resolved section key). */
  section_name: string | null;
  /** Section this image is intended for (image_library.section_target). */
  section_target: string | null;
  display_order: number | null;
  is_primary: boolean | null;
  width: number | null;
  height: number | null;
  /**
   * Deterministic image engine audit fields (additive as of the
   * 20260715 migrations): how this image was chosen for the slot, e.g.
   * "manual_page_mapping" | "exact_city" | "exact_state" | "exact_country" |
   * "product_section" | "global_fallback" | "manual_page_override".
   */
  selection_source?: string | null;
  selection_score?: number | null;
  selection_reason?: string | null;
}

export interface FAQItem {
  id: number;
  question: string | null;
  answer: string | null;
  priority: number | null;
  display_order: number | null;
  /** Only FAQs with this flag set are emitted in the FAQPage JSON-LD. */
  include_in_schema: boolean | null;
}

export interface SeoProduct {
  slug: string | null;
  title: string | null;
  description: string | null;
  cta_text: string | null;
  moq: number | null;
  image_url: string | null;
  sort_order: number | null;
  is_featured: boolean | null;
}

export interface SeoInternalLink {
  anchor: string | null;
  slug: string | null;
  sort_order: number | null;
}

/** Keyed by link group, e.g. "auto_related", "related_products", "related_countries". */
export type SeoInternalLinks = Record<string, SeoInternalLink[]>;

export interface SeoPageRenderResponse {
  page: SeoPage | null;
  section_blocks: SectionBlock[];
  assigned_images: AssignedImage[];
  faqs: FAQItem[];
  products: SeoProduct[];
  internal_links: SeoInternalLinks;
}

/** Discriminated fetch result — the page renders against this, never throws. */
export type SeoPageRenderResult =
  | { status: "ok"; data: SeoPageRenderResponse }
  | { status: "not_found" }
  | { status: "error"; message: string };
