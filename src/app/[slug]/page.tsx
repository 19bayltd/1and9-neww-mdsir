import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
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
 * (section_blocks[].position → content_blocks[].sort_order); no page copy or
 * layout order is hardcoded.
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

  // RPC error → 503-style UI (real error already logged server-side).
  if (result.status === "error") {
    return <ServiceUnavailable />;
  }

  // No page → standard 404.
  if (result.status === "not_found" || !result.data.page) {
    notFound();
  }

  return <PSEOPageRenderer data={mapRpcToLandingProps(result.data)} />;
}

function ServiceUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-neutral-900">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
          503 · Service Unavailable
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Landing page data is temporarily unavailable.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          We couldn&apos;t load this page right now. Please try again in a few moments.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-900"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
