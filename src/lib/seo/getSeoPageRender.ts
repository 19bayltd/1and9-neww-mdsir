import { supabase } from "@/lib/supabase";
import type { SeoPageRenderResponse, SeoPageRenderResult } from "@/types/seo";

/**
 * Fetch a fully-assembled SEO page by slug via the `get_seo_page_render` RPC.
 *
 * The RPC returns a single jsonb document with `page`, `section_blocks`,
 * `assigned_images` and `faqs` — or SQL null when the slug does not exist.
 * Never throws: callers switch on the discriminated result. No fallback
 * content is ever synthesized here.
 */
export async function getSeoPageRender(slug: string): Promise<SeoPageRenderResult> {
  const { data, error } = await supabase.rpc("get_seo_page_render", {
    p_slug: slug,
  });

  if (error) {
    // Log the real error server-side; the UI shows a generic message.
    console.error(`[get_seo_page_render] RPC error for slug "${slug}":`, error);
    return { status: "error", message: error.message };
  }

  const payload = data as SeoPageRenderResponse | null;
  if (!payload || !payload.page || !payload.page.slug) {
    return { status: "not_found" };
  }

  // Normalise the collections so components never see null arrays.
  return {
    status: "ok",
    data: {
      page: payload.page,
      section_blocks: payload.section_blocks ?? [],
      assigned_images: payload.assigned_images ?? [],
      faqs: payload.faqs ?? [],
      products: payload.products ?? [],
      internal_links: payload.internal_links ?? {},
    },
  };
}
