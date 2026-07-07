import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchLandingPage } from "@/lib/landing";
import { PSEOPageRenderer } from "@/components/landing/PSEOPageRenderer";

/**
 * Dynamic PSEO landing route.
 *
 * URLs like /custom-t-shirt-manufacturer-usa are resolved entirely from the
 * `get_landing_page_view` Supabase RPC. No page-specific copy is hardcoded —
 * PSEOPageRenderer maps the DB-ordered content blocks to section components.
 */

type PageParams = { slug: string };

// Dedupe the RPC call between generateMetadata() and the page render.
const getPage = cache(fetchLandingPage);

export async function generateMetadata({
  params,
}: {
  params: Promise<PageParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getPage(slug);

  if (result.status !== "ok") {
    return { title: "1 & 9 Apparel" };
  }

  const { page, country_assets } = result.data;
  const ogImage = country_assets?.meta_image_url ?? page?.hero_image_url ?? undefined;

  return {
    // RPC meta_title already carries the brand suffix — bypass the layout template.
    title: { absolute: page?.meta_title || page?.title || "1 & 9 Apparel" },
    description: page?.meta_description ?? undefined,
    alternates: page?.canonical_url ? { canonical: page.canonical_url } : undefined,
    robots: page?.robots ?? undefined,
    openGraph: {
      title: page?.meta_title || page?.title || undefined,
      description: page?.meta_description ?? undefined,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "website",
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
  if (result.status === "not_found") {
    notFound();
  }

  return <PSEOPageRenderer data={result.data} />;
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
