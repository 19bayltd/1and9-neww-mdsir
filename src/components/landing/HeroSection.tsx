import { blockByKey, type LandingPageData, type CountryAssets } from "@/lib/landing";

/**
 * Hero section. Title, subtitle, description, hero image, CTAs, shipping note,
 * and trust badges — all sourced from the RPC JSON (hero content block,
 * page, and country_assets). No page-specific copy is hardcoded.
 */
export function HeroSection({ data }: { data: LandingPageData }) {
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
