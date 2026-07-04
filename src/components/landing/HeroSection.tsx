import {
  blockByKey,
  type LandingPageData,
  type CountryAssets,
  type Product,
} from "@/lib/landing";

/**
 * Hero section — premium B2B apparel manufacturer layout.
 *
 * Page-specific content (H1, subtitle, description, images, trust badges,
 * shipping, MOQ) is sourced from the RPC JSON. Only generic, brand-level UI
 * (section labels, and the manufacturer's standard lead-time / turnaround,
 * which are identical across every page) is defined here as constants.
 */

// Generic brand constants — NOT page-specific SEO. Same on every landing page.
// Used only as a fallback / for the generic "Lead Time" trust stat the design
// requires. Page-specific values (e.g. MOQ) still prefer the RPC data below.
const DEFAULT_MOQ = 300;
const LEAD_TIME = "30–45 days";
const QUOTE_TURNAROUND = "24 hrs";

/** Smallest MOQ advertised across the page's products, or the brand default. */
function resolveMoq(products: Product[]): number {
  const values = products
    .map((p) => p.moq)
    .filter((n): n is number => typeof n === "number" && n > 0);
  return values.length > 0 ? Math.min(...values) : DEFAULT_MOQ;
}

/** First product image available (featured first), if any. */
function resolveProductImage(products: Product[]): { url: string; alt: string } | null {
  const featured = products.find((p) => p.is_featured && p.image_url);
  const any = products.find((p) => p.image_url);
  const chosen = featured ?? any;
  return chosen?.image_url ? { url: chosen.image_url, alt: chosen.title ?? "Product" } : null;
}

export function HeroSection({ data }: { data: LandingPageData }) {
  const page = data.page ?? {};
  const assets: CountryAssets = data.country_assets ?? {};
  const products = data.products ?? [];
  const hero = blockByKey(data.content_blocks, "hero");

  // Page-specific copy from RPC (with graceful fallbacks up the chain).
  const title = hero?.heading || page.h1 || page.title || "Custom Apparel Manufacturing";
  const subtitle = page.title && page.title !== title ? page.title : null;
  const description = hero?.body || page.meta_description || assets.factory_message;

  // Page-specific imagery from RPC.
  const factoryImage = hero?.image_url || page.hero_image_url || assets.hero_image_url;
  const factoryImageAlt = hero?.image_alt || `${title} — 1 & 9 Apparel factory`;
  const productImage = resolveProductImage(products);

  // Trust signals.
  const badges = (assets.trust_badges ?? []).filter((b) => b.label || b.image_url);
  const leadBadge = badges[0]?.label ?? null;

  const moq = resolveMoq(products);

  const primaryHref = hero?.cta_url || assets.cta_url || "#rfq";

  const stats: { label: string; value: string }[] = [
    { label: "Minimum Order", value: `${moq} pcs` },
    { label: "Lead Time", value: LEAD_TIME },
    { label: "Quote Turnaround", value: QUOTE_TURNAROUND },
  ];

  return (
    <section className="border-b border-neutral-200 bg-white">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
        {/* ---------------------------------------------------------------- */}
        {/* Left column — messaging + CTAs + trust                            */}
        {/* ---------------------------------------------------------------- */}
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium uppercase tracking-wider text-neutral-600">
            <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" aria-hidden />
            1 &amp; 9 Apparel · Bangladesh
          </span>

          <h1 className="mt-5 text-4xl font-bold leading-[1.08] tracking-tight text-neutral-900 sm:text-5xl">
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

          {/* CTAs */}
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={primaryHref}
              className="inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
            >
              Request Bulk Quote
            </a>
            <a
              href="#production-process"
              className="inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-900"
            >
              View Production Options
            </a>
          </div>

          {/* Spec strip — MOQ / Lead Time / Turnaround */}
          <dl className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-3 sm:px-4"
              >
                <dt className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  {s.label}
                </dt>
                <dd className="mt-1 text-base font-bold text-neutral-900 sm:text-lg">
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          {assets.shipping_text ? (
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-neutral-500">
              {assets.shipping_text}
            </p>
          ) : null}

          {/* Trust badges */}
          {badges.length > 0 ? (
            <ul className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
              {badges.map((b, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-neutral-500"
                >
                  {b.image_url ? (
                    <img src={b.image_url} alt={b.label ?? "Certification"} className="h-6 w-auto" />
                  ) : null}
                  {b.label ? <span>{b.label}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        {/* ---------------------------------------------------------------- */}
        {/* Right column — visual showcase + RFQ mini card                    */}
        {/* ---------------------------------------------------------------- */}
        <div className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3 shadow-sm sm:p-4">
          <div className="relative overflow-hidden rounded-xl bg-neutral-100">
            {factoryImage ? (
              <img
                src={factoryImage}
                alt={factoryImageAlt}
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="flex aspect-[4/3] w-full items-center justify-center text-sm text-neutral-400">
                1 &amp; 9 Apparel
              </div>
            )}

            {/* Certification pill (page-specific, from RPC trust badges) */}
            {leadBadge ? (
              <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-800 shadow-sm backdrop-blur">
                {leadBadge}
              </span>
            ) : null}

            {/* Product image inset (page-specific, from RPC products) */}
            {productImage ? (
              <img
                src={productImage.url}
                alt={productImage.alt}
                className="absolute bottom-3 left-3 h-20 w-20 rounded-lg object-cover shadow-md ring-2 ring-white sm:h-24 sm:w-24"
              />
            ) : null}
          </div>

          {/* RFQ mini card */}
          <div className="mt-3 rounded-xl border border-neutral-200 bg-white p-4 sm:mt-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-neutral-900">Request a Bulk Quote</p>
                <p className="mt-0.5 text-xs text-neutral-500">
                  MOQ {moq} pcs · Lead time {LEAD_TIME} · Reply in {QUOTE_TURNAROUND}
                </p>
              </div>
              <span className="hidden shrink-0 rounded-full bg-neutral-900 px-2.5 py-1 text-[11px] font-semibold text-white sm:inline">
                Free
              </span>
            </div>

            <div className="mt-3 flex items-center gap-2">
              <span className="flex-1 truncate rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-xs text-neutral-400">
                you@company.com
              </span>
              <a
                href="#rfq"
                className="shrink-0 rounded-md bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-neutral-700"
              >
                Get Quote
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
