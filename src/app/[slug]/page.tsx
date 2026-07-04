import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchLandingPage, blockByKey, type LandingPageData } from "@/lib/landing";
import { HeroSection } from "@/components/landing/HeroSection";
import { ContentBlockSection } from "@/components/landing/ContentBlockSection";
import { ProductCards } from "@/components/landing/ProductCards";
import { RFQSection } from "@/components/landing/RFQSection";
import { FAQSection } from "@/components/landing/FAQSection";
import { InternalLinks } from "@/components/landing/InternalLinks";

/**
 * Dynamic PSEO landing route.
 *
 * URLs like /custom-t-shirt-manufacturer-usa are resolved entirely from the
 * `get_landing_page_view` Supabase RPC. No page-specific copy is hardcoded —
 * this file only orchestrates section *order*; each section lives in
 * src/components/landing/.
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

  const data = result.data;
  const blocks = data.content_blocks;
  const rfqBlock = blockByKey(blocks, "rfq");

  return (
    <main className="bg-white text-neutral-900">
      {/* 1. Hero */}
      <HeroSection data={data} />

      {/* 2. Intro */}
      <ContentBlockSection
        block={blockByKey(blocks, "intro")}
        eyebrow="Overview"
        id="intro"
      />

      {/* 3. Manufacturing Overview */}
      <ContentBlockSection
        block={blockByKey(blocks, "manufacturing_overview", "manufacturing")}
        eyebrow="Manufacturing"
        id="manufacturing-overview"
        tinted
      />

      {/* 4. Customization Options */}
      <ContentBlockSection
        block={blockByKey(blocks, "customization_options", "customization", "options")}
        eyebrow="Customization"
        id="customization-options"
      />

      {/* 5. Why 1 & 9 Apparel */}
      <ContentBlockSection
        block={blockByKey(blocks, "why_choose_us", "why", "benefits", "trust")}
        eyebrow="Why 1 & 9 Apparel"
        id="why-choose-us"
        tinted
      />

      {/* 6. Production Process */}
      <ContentBlockSection
        block={blockByKey(blocks, "production_process", "process", "production")}
        eyebrow="Production Process"
        id="production-process"
      />

      {/* 7. Buyer Solutions */}
      <ContentBlockSection
        block={blockByKey(blocks, "buyer_solutions", "buyer", "solutions")}
        eyebrow="Buyer Solutions"
        id="buyer-solutions"
        tinted
      />

      {/* 8. Related Products */}
      <ProductCards data={data} />

      {/* 9. RFQ / Instant Quote */}
      <RFQSection
        sourcePageId={data.page?.id ?? null}
        sourceSlug={data.page?.slug ?? null}
        heading={rfqBlock?.heading}
        body={rfqBlock?.body}
        ctaLabel={rfqBlock?.cta_label}
      />

      {/* 10. FAQ */}
      <FAQSection data={data} />

      {/* 11. Internal Links */}
      <InternalLinks data={data} />

      <SiteFooter data={data} />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Page-level chrome (footer + error state)                                    */
/* -------------------------------------------------------------------------- */

function SiteFooter({ data }: { data: LandingPageData }) {
  const title = data.page?.title || "1 & 9 Apparel";
  return (
    <footer className="border-t border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-6 py-10 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-semibold text-neutral-900">1 &amp; 9 Apparel</p>
          <p className="text-xs text-neutral-500">
            Bangladesh-based B2B custom apparel manufacturer · {title}
          </p>
        </div>
        <a
          href="#rfq"
          className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
        >
          Request Bulk Quote
        </a>
      </div>
    </footer>
  );
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
