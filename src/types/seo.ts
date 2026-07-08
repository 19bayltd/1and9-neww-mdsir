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
  id: number;
  image_id: number | null;
  image_key: string | null;
  image_url: string | null;
  alt: string | null;
  image_type: string | null;
  /** Assignment slot on the page (seo_page_images.section_name). */
  section_name: string | null;
  /** Section this image is intended for (image_library.section_target). */
  section_target: string | null;
  display_order: number | null;
  is_primary: boolean | null;
  width: number | null;
  height: number | null;
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

export interface SeoPageRenderResponse {
  page: SeoPage | null;
  section_blocks: SectionBlock[];
  assigned_images: AssignedImage[];
  faqs: FAQItem[];
}

/** Discriminated fetch result — the page renders against this, never throws. */
export type SeoPageRenderResult =
  | { status: "ok"; data: SeoPageRenderResponse }
  | { status: "not_found" }
  | { status: "error"; message: string };
