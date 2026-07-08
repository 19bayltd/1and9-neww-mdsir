import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeoPageRender } from "@/lib/seo/getSeoPageRender";
import { getSectionImage } from "@/lib/seo/imageResolver";
import { SectionRenderer } from "@/components/seo/SectionRenderer";
import type { SectionBlock } from "@/types/seo";

/**
 * Dynamic SEO landing route.
 *
 * URLs like /custom-t-shirt-manufacturer-usa are resolved entirely from the
 * `get_seo_page_render` Supabase RPC. Section order comes from the DB
 * (section_blocks[].position); no page copy or layout order is hardcoded.
 */

type PageParams = { slug: string };

// Dedupe the RPC call between generateMetadata() and the page render.
const getPage = cache(getSeoPageRender);

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

export default async function SeoPage({
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

  const { page, section_blocks, assigned_images, faqs } = result.data;

  // DB-driven order: sort by the RPC's position (seo_content_blocks.display_order).
  const sections = section_blocks
    .filter((b): b is SectionBlock => Boolean(b && (b.section_key || b.block_key)))
    .sort((a, b) => (a.position ?? 999) - (b.position ?? 999));

  return (
    <main className="bg-white text-neutral-950">
      {sections.length > 0 ? (
        sections.map((section) => (
          <SectionRenderer
            key={section.id}
            section={section}
            page={page}
            assignedImages={assigned_images}
            faqs={faqs}
          />
        ))
      ) : (
        <EmptyPage title={page.h1 || page.title} />
      )}
    </main>
  );
}

/** Published page with no section blocks yet — render its heading, not a crash. */
function EmptyPage({ title }: { title: string | null }) {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-3xl flex-col justify-center px-6 py-20">
      {title ? (
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
      ) : null}
      <p className="mt-4 text-base leading-relaxed text-neutral-600">
        Content for this page is being prepared.
      </p>
    </div>
  );
}

function ServiceUnavailable() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-neutral-950">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
          503 · Service Unavailable
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
          This page is temporarily unavailable.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          We couldn&apos;t load this page right now. Please try again in a few moments.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:border-neutral-950"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
