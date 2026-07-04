import Link from "next/link";
import { blockByKey, type LandingPageData, type Product } from "@/lib/landing";
import { SectionHeading } from "./_shared";

/**
 * Related Products section — premium B2B product grid.
 *
 * Every card is driven entirely by the RPC products array (image, name, MOQ,
 * category, CTA text, link). No products are hardcoded and none are invented;
 * if the array is empty the section renders nothing. Images lazy-load so the
 * grid stays fast on long landing pages.
 */
export function ProductCards({ data }: { data: LandingPageData }) {
  const products: Product[] = (data.products ?? []).filter((p) => p.title || p.slug);
  if (products.length === 0) return null;

  const block = blockByKey(data.content_blocks, "related_products");
  const heading = block?.heading || "Related Products";

  return (
    <section id="related-products" className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-3xl">
            <SectionHeading eyebrow="Product Range">{heading}</SectionHeading>
            {block?.body ? (
              <p className="-mt-2 text-base leading-relaxed text-neutral-600 sm:text-lg">
                {block.body}
              </p>
            ) : null}
          </div>
          <a
            href="#rfq"
            className="hidden shrink-0 items-center justify-center rounded-md border border-neutral-300 px-5 py-2.5 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-900 sm:inline-flex"
          >
            Quote Multiple Styles
          </a>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
  const category = product.category ?? null;

  const inner = (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white transition-all hover:-translate-y-0.5 hover:shadow-lg">
      {/* Image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title ?? "Product"}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-neutral-400">
            {product.title}
          </div>
        )}

        {/* Badges over image — only from real RPC data */}
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.is_featured ? (
            <span className="rounded-full bg-neutral-900/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur">
              Featured
            </span>
          ) : null}
          {category ? (
            <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-800 shadow-sm backdrop-blur">
              {category}
            </span>
          ) : null}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold text-neutral-900">{product.title}</h3>
        {product.description ? (
          <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-600">
            {product.description}
          </p>
        ) : (
          <span className="flex-1" />
        )}

        <div className="mt-4 flex items-center justify-between border-t border-neutral-100 pt-4">
          {typeof product.moq === "number" ? (
            <span className="rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-semibold text-neutral-700">
              MOQ {product.moq} pcs
            </span>
          ) : (
            <span className="text-xs font-medium text-neutral-400">Bulk orders</span>
          )}

          <span
            className={
              href
                ? "inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition-colors group-hover:bg-neutral-700"
                : "inline-flex items-center rounded-md border border-neutral-300 px-4 py-2 text-xs font-semibold text-neutral-900"
            }
          >
            {product.cta_text || "Get Pricing"}
          </span>
        </div>
      </div>
    </article>
  );

  // Whole card links to the product's landing page when the RPC provides a
  // slug; otherwise the CTA anchors to the on-page RFQ form (no fake URLs).
  return href ? (
    <Link href={href} className="block h-full">
      {inner}
    </Link>
  ) : (
    <a href="#rfq" className="block h-full">
      {inner}
    </a>
  );
}
