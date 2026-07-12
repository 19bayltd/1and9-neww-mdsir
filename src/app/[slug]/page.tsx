import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSeoPageRender } from "@/lib/seo/getSeoPageRender";
import { getSectionImage } from "@/lib/seo/imageResolver";
import { mapRpcToLandingProps } from "@/lib/seo/mapRpcToLandingProps";
import { PSEOPageRenderer } from "@/components/landing/PSEOPageRenderer";

/**
 * Dynamic SEO landing route.
 *
 * Data comes entirely from the `get_seo_page_render` Supabase RPC; the
 * original landing visual system (src/components/landing) renders it via the
 * mapRpcToLandingProps adapter. Section order comes from the DB
 * (section_blocks[].position → content_blocks[].sort_order). Copy and CTAs
 * are DB-first: components render the block's values when present and fall
 * back to fixed presentation defaults (e.g. the hero's "Get Instant Quote"
 * → #rfq) when the DB fields are null.
 */

type PageParams = { slug: string };

// Dedupe the RPC call between generateMetadata() and the page render.
const getPage = cache(getSeoPageRender);

/**
 * Map the page's robots directive (seo_pages.robots via the RPC) to Next.js
 * metadata. The column is NOT NULL with four allowed values; if the RPC ever
 * stops returning it, fail loudly — a page must never silently default to
 * indexable.
 */
function robotsDirective(robots: string | null | undefined, slug: string) {
  if (typeof robots !== "string" || robots.trim() === "") {
    throw new Error(
      `get_seo_page_render returned no robots directive for slug "${slug}" — ` +
        "refusing to render metadata without an explicit index/noindex signal."
    );
  }
  const [indexPart, followPart] = robots.split(",").map((s) => s.trim().toLowerCase());
  return {
    index: indexPart === "index",
    follow: followPart !== "nofollow",
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPage(slug);

  if (result.status !== "ok" || !result.data.page) {
    return { title: "1 & 9 Apparel" };
  }

  const { page, assigned_images } = result.data;
  const title = page.meta_title || page.title || "1 & 9 Apparel";
  const description = page.meta_description ?? undefined;
  // OG image: the page's assigned hero image (real DB data, never invented).
  const ogImage = getSectionImage("hero", assigned_images)?.image_url ?? undefined;

  return {
    // RPC meta_title already carries the brand suffix — bypass the layout template.
    title: { absolute: title },
    description,
    // Explicit index/noindex from seo_pages.robots — never an implicit default.
    robots: robotsDirective(page.robots, slug),
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "website",
    },
    twitter: {
      card: ogImage ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function LandingPage({
  params,
}: {
  params: Promise<PageParams>;
}) {
  const { slug } = await params;
  const result = await getPage(slug);

  // RPC error → throw so the route answers with a real 5xx instead of a
  // cacheable 200 "soft error". error.tsx renders the same 503-style UI;
  // the underlying RPC error is already logged server-side.
  if (result.status === "error") {
    throw new Error("SEO_RENDER_UPSTREAM_UNAVAILABLE");
  }

  // No page → standard 404.
  if (result.status === "not_found" || !result.data.page) {
    notFound();
  }

  return <PSEOPageRenderer data={mapRpcToLandingProps(result.data)} />;
}
