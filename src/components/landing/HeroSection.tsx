import {
  blockByKey,
  type LandingPageData,
  type CountryAssets,
  type Product,
} from "@/lib/landing";
import { SpecIcon } from "./icons";

/**
 * Hero — black band with yellow accent, matching the reference design.
 *
 * Page-specific content (H1, description, hero image, trust badges, shipping)
 * comes from the RPC. Generic brand-level UI (service-mode chips, stat chips,
 * quote-card labels) is constant across pages. The right-side quote card is a
 * visual shortcut into the full working RFQ form (#rfq) — no duplicate insert.
 */

// Generic brand constants — identical on every page, not page-specific SEO.
const DEFAULT_MOQ = 300;

function resolveMoq(products: Product[]): number {
  const values = products
    .map((p) => p.moq)
    .filter((n): n is number => typeof n === "number" && n > 0);
  return values.length > 0 ? Math.min(...values) : DEFAULT_MOQ;
}

/** Split the DB headline so the last word can carry the yellow accent. */
function splitHeadline(title: string): { head: string; accent: string } {
  const words = title.trim().split(/\s+/);
  if (words.length < 2) return { head: title, accent: "" };
  return { head: words.slice(0, -1).join(" "), accent: words[words.length - 1] };
}

export function HeroSection({ data }: { data: LandingPageData }) {
  const page = data.page ?? {};
  const assets: CountryAssets = data.country_assets ?? {};
  const products = data.products ?? [];
  const hero = blockByKey(data.content_blocks, "hero");

  const title = hero?.heading || page.h1 || page.title || "Custom Apparel Manufacturing";
  const { head, accent } = splitHeadline(title);
  const description = hero?.body || page.meta_description || assets.factory_message;
  const heroImage = hero?.image_url || page.hero_image_url || assets.hero_image_url;
  const heroImageAlt = hero?.image_alt || `${title} — 1 & 9 Apparel`;
  // Primary CTA: DB value when the hero block carries one, otherwise the
  // original hardcoded label/anchor. The arrow is markup, not data — DB
  // labels should not include it.
  const primaryCtaLabel = hero?.cta_label || "Get Instant Quote";
  const primaryCtaHref = hero?.cta_url || "#rfq";
  const moq = resolveMoq(products);
  const badges = (assets.trust_badges ?? []).filter((b) => b.label || b.image_url);

  const statChips = [
    { icon: "moq" as const, top: `MOQ FROM`, bottom: `${moq} PCS` },
    { icon: "capability" as const, top: "OEM / ODM", bottom: "SERVICE" },
    { icon: "shipping" as const, top: "DDP", bottom: "SHIPPING" },
    { icon: "factory" as const, top: "FACTORY", bottom: "DIRECT PRICE" },
  ];

  return (
    <section className="relative overflow-hidden bg-[#0A0A0A] text-white">
      {/* DB hero image as a subtle backdrop, when available */}
      {heroImage ? (
        <img
          src={heroImage}
          alt={heroImageAlt}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-25"
        />
      ) : null}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#0A0A0A] via-[#0A0A0A]/85 to-[#0A0A0A]/40"
        aria-hidden
      />

      <div className="relative mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:py-16 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14 lg:py-20">
        {/* ------------------------------------------------------------ */}
        {/* Left — headline, service modes, description, CTAs, chips      */}
        {/* ------------------------------------------------------------ */}
        <div>
          <h1 className="text-4xl font-black uppercase leading-[1.02] tracking-tight sm:text-5xl lg:text-6xl">
            {head}
            {accent ? (
              <>
                {" "}
                <span className="text-[#FFC400]">{accent}</span>
              </>
            ) : null}
          </h1>

          <p className="mt-4 text-lg font-bold text-white sm:text-xl">
            Private Label <span className="text-[#FFC400]">•</span> OEM{" "}
            <span className="text-[#FFC400]">•</span> ODM{" "}
            <span className="text-[#FFC400]">•</span> Low MOQ
          </p>

          {description ? (
            <p className="mt-5 max-w-xl text-base leading-relaxed text-neutral-300 sm:text-lg">
              {description}
            </p>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href={primaryCtaHref}
              className="inline-flex items-center justify-center rounded-md bg-[#FFC400] px-6 py-3 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-[#e6b100]"
            >
              {primaryCtaLabel} →
            </a>
            {/* Secondary CTA stays hardcoded: the block schema carries one CTA pair. */}
            <a
              href="#related-products"
              className="inline-flex items-center justify-center rounded-md border border-neutral-600 px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:border-white"
            >
              View Products
            </a>
          </div>

          {assets.shipping_text ? (
            <p className="mt-6 max-w-xl text-sm leading-relaxed text-neutral-400">
              {assets.shipping_text}
            </p>
          ) : null}

          {/* Stat chips row */}
          <div className="mt-10 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
            {statChips.map((chip) => (
              <div key={chip.top + chip.bottom} className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#FFC400] text-[#FFC400]">
                  <SpecIcon icon={chip.icon} />
                </span>
                <span className="text-[11px] font-bold uppercase leading-tight tracking-wide text-neutral-200">
                  {chip.top}
                  <br />
                  {chip.bottom}
                </span>
              </div>
            ))}
          </div>

          {/* Trust badges from RPC country assets */}
          {badges.length > 0 ? (
            <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-neutral-800 pt-6">
              {badges.map((b, i) => (
                <li
                  key={i}
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-neutral-400"
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

        {/* ------------------------------------------------------------ */}
        {/* Right — instant quote card (visual shortcut to #rfq)          */}
        {/* Intentionally NOT wired to the hero block's cta_url: this card */}
        {/* is an anchor into the on-page RFQ form by design (the caption  */}
        {/* below the button promises "the full production request below").*/}
        {/* ------------------------------------------------------------ */}
        <aside className="lg:pt-2">
          <div className="rounded-2xl border border-neutral-800 bg-[#111111] p-5 shadow-2xl sm:p-6">
            <p className="text-sm font-extrabold uppercase tracking-wide text-white">
              Get Your Instant Quote
            </p>

            <div className="mt-4 space-y-3.5">
              {[
                { label: "Product", placeholder: "e.g. T-shirts, hoodies" },
                { label: "Quantity (Pcs)", placeholder: `e.g. ${moq}` },
                { label: "Country", placeholder: "Delivery country" },
                { label: "Your Email", placeholder: "name@email.com" },
              ].map((f) => (
                <div key={f.label}>
                  <p className="mb-1 text-xs font-semibold text-neutral-400">{f.label}</p>
                  <div className="rounded-md border border-neutral-700 bg-[#0A0A0A] px-3 py-2.5 text-sm text-neutral-500">
                    {f.placeholder}
                  </div>
                </div>
              ))}
            </div>

            <a
              href="#rfq"
              className="mt-5 inline-flex w-full items-center justify-center rounded-md bg-[#FFC400] px-5 py-3 text-sm font-bold uppercase tracking-wide text-black transition-colors hover:bg-[#e6b100]"
            >
              Get Quote Now
            </a>
            <p className="mt-3 text-center text-xs text-neutral-500">
              Opens the full production request below — reply within 24 hours.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}
