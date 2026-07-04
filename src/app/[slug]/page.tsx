import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  fetchLandingPage,
  blockByKey,
  type LandingPageData,
  type ContentBlock,
  type Product,
  type Faq,
  type CountryAssets,
  type InternalLink,
} from "@/lib/landing";

/**
 * Dynamic PSEO landing route.
 *
 * URLs like /custom-t-shirt-manufacturer-usa are resolved entirely from the
 * `get_landing_page_view` Supabase RPC. No page-specific copy is hardcoded —
 * this file only knows the section *order* and layout.
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

  return (
    <main className="bg-white text-neutral-900">
      <Hero data={data} />
      <Intro data={data} />
      <ManufacturingOverview data={data} />
      <CustomizationOptions data={data} />
      <WhyChooseUs data={data} />
      <ProductionProcess data={data} />
      <BuyerSolutions data={data} />
      <RelatedProducts data={data} />
      <RfqSection data={data} />
      <Faqs data={data} />
      <InternalLinksSection data={data} />
      <SiteFooter data={data} />
    </main>
  );
}

/* -------------------------------------------------------------------------- */
/* Small shared primitives                                                     */
/* -------------------------------------------------------------------------- */

/** Split a plain-text body into paragraphs on blank lines / newlines. */
function Paragraphs({ text, className }: { text?: string | null; className?: string }) {
  if (!text) return null;
  const parts = text
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (
        <p key={i} className={className}>
          {p}
        </p>
      ))}
    </>
  );
}

function SectionHeading({
  eyebrow,
  children,
}: {
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{children}</h2>
    </div>
  );
}

/**
 * Generic text section used by Intro, Manufacturing, Customization, Why,
 * Process, and Buyer Solutions. Renders nothing if the block is absent.
 */
function TextBlockSection({
  block,
  eyebrow,
  id,
  tinted = false,
}: {
  block?: ContentBlock;
  eyebrow: string;
  id: string;
  tinted?: boolean;
}) {
  if (!block || (!block.heading && !block.body)) return null;
  return (
    <section
      id={id}
      className={`border-t border-neutral-200 ${tinted ? "bg-neutral-50" : "bg-white"}`}
    >
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow={eyebrow}>{block.heading}</SectionHeading>
        <div className="max-w-3xl space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
          <Paragraphs text={block.body} />
        </div>
        {block.cta_label && block.cta_url ? (
          <a
            href={block.cta_url}
            className="mt-8 inline-flex items-center text-sm font-semibold text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
          >
            {block.cta_label} →
          </a>
        ) : null}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Sections                                                                    */
/* -------------------------------------------------------------------------- */

function Hero({ data }: { data: LandingPageData }) {
  const page = data.page ?? {};
  const assets: CountryAssets = data.country_assets ?? {};
  const hero = blockByKey(data.content_blocks, "hero");

  const title = hero?.heading || page.h1 || page.title || "Custom Apparel Manufacturing";
  const subtitle = page.title && page.title !== title ? page.title : null;
  const description = hero?.body || assets.factory_message;
  const heroImage = hero?.image_url || page.hero_image_url || assets.hero_image_url;
  const heroImageAlt = hero?.image_alt || `${title} — 1 & 9 Apparel`;

  const primaryHref = hero?.cta_url || assets.cta_url || "#rfq";
  const primaryLabel = "Request Bulk Quote";

  const badges = assets.trust_badges ?? [];

  return (
    <section className="border-b border-neutral-200 bg-white">
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        <div>
          <span className="inline-flex items-center rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium uppercase tracking-wider text-neutral-600">
            1 &amp; 9 Apparel · Bangladesh
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight sm:text-5xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-3 text-lg font-medium text-neutral-500">{subtitle}</p>
          ) : null}
          {description ? (
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-neutral-600">
              {description}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={primaryHref}
              className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
            >
              {primaryLabel}
            </a>
            <a
              href="#production-process"
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-900"
            >
              View Production Options
            </a>
          </div>

          {assets.shipping_text ? (
            <p className="mt-6 text-sm text-neutral-500">{assets.shipping_text}</p>
          ) : null}

          {badges.length > 0 ? (
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
              {badges.map((b, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500"
                >
                  {b.image_url ? (
                    <img
                      src={b.image_url}
                      alt={b.label ?? "Certification"}
                      className="h-6 w-auto"
                    />
                  ) : null}
                  <span>{b.label}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div className="relative">
          {heroImage ? (
            <img
              src={heroImage}
              alt={heroImageAlt}
              className="aspect-[4/3] w-full rounded-lg object-cover shadow-sm ring-1 ring-neutral-200"
            />
          ) : (
            <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg bg-neutral-100 text-sm text-neutral-400 ring-1 ring-neutral-200">
              1 &amp; 9 Apparel
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function Intro({ data }: { data: LandingPageData }) {
  return (
    <TextBlockSection
      block={blockByKey(data.content_blocks, "intro")}
      eyebrow="Overview"
      id="intro"
    />
  );
}

function ManufacturingOverview({ data }: { data: LandingPageData }) {
  return (
    <TextBlockSection
      block={blockByKey(data.content_blocks, "manufacturing_overview", "manufacturing")}
      eyebrow="Manufacturing"
      id="manufacturing-overview"
      tinted
    />
  );
}

function CustomizationOptions({ data }: { data: LandingPageData }) {
  return (
    <TextBlockSection
      block={blockByKey(data.content_blocks, "customization_options", "customization", "options")}
      eyebrow="Customization"
      id="customization-options"
    />
  );
}

function WhyChooseUs({ data }: { data: LandingPageData }) {
  return (
    <TextBlockSection
      block={blockByKey(data.content_blocks, "why_choose_us", "why", "benefits", "trust")}
      eyebrow="Why 1 & 9 Apparel"
      id="why-choose-us"
      tinted
    />
  );
}

function ProductionProcess({ data }: { data: LandingPageData }) {
  return (
    <TextBlockSection
      block={blockByKey(data.content_blocks, "production_process", "process", "production")}
      eyebrow="Production Process"
      id="production-process"
    />
  );
}

function BuyerSolutions({ data }: { data: LandingPageData }) {
  return (
    <TextBlockSection
      block={blockByKey(data.content_blocks, "buyer_solutions", "buyer", "solutions")}
      eyebrow="Buyer Solutions"
      id="buyer-solutions"
      tinted
    />
  );
}

function RelatedProducts({ data }: { data: LandingPageData }) {
  const products: Product[] = data.products ?? [];
  if (products.length === 0) return null;

  const block = blockByKey(data.content_blocks, "related_products");
  const heading = block?.heading || "Related Products";

  return (
    <section id="related-products" className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow="Product Range">{heading}</SectionHeading>
        {block?.body ? (
          <p className="mb-8 max-w-3xl text-base leading-relaxed text-neutral-600 sm:text-lg">
            {block.body}
          </p>
        ) : null}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((p, i) => (
            <ProductCard key={p.slug ?? i} product={p} />
          ))}
        </div>
      </div>
    </section>
  );
}

function ProductCard({ product }: { product: Product }) {
  const href = product.slug ? `/${product.slug}` : undefined;
  const category = product.category ?? (product.is_featured ? "Featured" : null);

  const inner = (
    <div className="group flex h-full flex-col overflow-hidden rounded-lg border border-neutral-200 bg-white transition-shadow hover:shadow-md">
      <div className="aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title ?? "Product"}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
            {product.title}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-neutral-900">{product.title}</h3>
          {category ? (
            <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-neutral-500">
              {category}
            </span>
          ) : null}
        </div>
        {product.description ? (
          <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">
            {product.description}
          </p>
        ) : null}
        <div className="mt-4 flex items-center justify-between">
          {typeof product.moq === "number" ? (
            <span className="text-xs font-medium text-neutral-500">MOQ {product.moq} pcs</span>
          ) : (
            <span />
          )}
          {href ? (
            <span className="text-sm font-semibold text-neutral-900 group-hover:text-neutral-600">
              {product.cta_text || "View"} →
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function RfqSection({ data }: { data: LandingPageData }) {
  const block = blockByKey(data.content_blocks, "rfq");
  const heading = block?.heading || "Request an Instant Quote";
  const body =
    block?.body ||
    "Send your requirements and our merchandising team replies with pricing and lead time within one business day.";
  const cta = block?.cta_label || "Request Bulk Quote";

  const fields: { name: string; label: string; type?: string; full?: boolean }[] = [
    { name: "product", label: "Product" },
    { name: "quantity", label: "Quantity", type: "number" },
    { name: "country", label: "Country" },
    { name: "company", label: "Company Name" },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "message", label: "Message", full: true },
  ];

  return (
    <section id="rfq" className="border-t border-neutral-200 bg-neutral-900 text-white">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Instant Quote
        </span>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">
          {body}
        </p>

        {/* Visual-only RFQ form — submission is not wired up yet. */}
        <form
          className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2"
          aria-label="Request for quote"
        >
          {fields.map((f) => (
            <div key={f.name} className={f.full ? "sm:col-span-2" : undefined}>
              <label
                htmlFor={`rfq-${f.name}`}
                className="mb-1.5 block text-sm font-medium text-neutral-300"
              >
                {f.label}
              </label>
              {f.full ? (
                <textarea
                  id={`rfq-${f.name}`}
                  name={f.name}
                  rows={4}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none"
                  placeholder={`Your ${f.label.toLowerCase()}`}
                />
              ) : (
                <input
                  id={`rfq-${f.name}`}
                  name={f.name}
                  type={f.type ?? "text"}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none"
                  placeholder={`Your ${f.label.toLowerCase()}`}
                />
              )}
            </div>
          ))}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled
              className="inline-flex w-full items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {cta}
            </button>
            <p className="mt-3 text-xs text-neutral-500">
              Form preview only — quote submission is connected in a later step.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}

function Faqs({ data }: { data: LandingPageData }) {
  const faqs: Faq[] = (data.faqs ?? []).filter((f) => f.question && f.answer);
  if (faqs.length === 0) return null;

  const block = blockByKey(data.content_blocks, "faq");
  const heading = block?.heading || "Frequently Asked Questions";

  return (
    <section id="faq" className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow="FAQ">{heading}</SectionHeading>
        <dl className="divide-y divide-neutral-200 border-t border-neutral-200">
          {faqs.map((f, i) => (
            <details key={i} className="group py-5" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <dt className="text-base font-semibold text-neutral-900">{f.question}</dt>
                <span className="mt-1 shrink-0 text-neutral-400 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <dd className="mt-3 text-base leading-relaxed text-neutral-600">{f.answer}</dd>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}

function InternalLinksSection({ data }: { data: LandingPageData }) {
  const groups = data.internal_links ?? {};
  const entries = Object.entries(groups).filter(
    ([, links]) => Array.isArray(links) && links.length > 0
  );
  if (entries.length === 0) return null;

  const prettyGroup = (key: string) =>
    key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <section className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow="Explore More">Related Manufacturing Pages</SectionHeading>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([group, links]) => (
            <div key={group}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {prettyGroup(group)}
              </h3>
              <ul className="space-y-2">
                {(links as InternalLink[]).map((link, i) => (
                  <li key={link.slug ?? i}>
                    <Link
                      href={link.slug ? `/${link.slug}` : "#"}
                      className="text-sm text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
                    >
                      {link.anchor || link.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

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

/* -------------------------------------------------------------------------- */
/* Error state                                                                 */
/* -------------------------------------------------------------------------- */

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
