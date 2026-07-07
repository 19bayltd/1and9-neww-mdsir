import Link from "next/link";
import type { ContentBlock, InternalLink, InternalLinks, Product } from "@/lib/landing";
import { Paragraphs } from "./_shared";

/**
 * Related Products + Helpful Links — per the reference layout: product cards
 * on the left, an internal-links sidebar on the right.
 *
 * Products and links come exclusively from the RPC (no invented items).
 * Whole grid or sidebar is skipped cleanly when its data is empty.
 */
export function RelatedProductsSection({
  block,
  products,
  internalLinks,
}: {
  block: ContentBlock;
  products: Product[];
  internalLinks?: InternalLinks | null;
}) {
  const items = products.filter((p) => p.title || p.slug);
  const linkGroups = Object.entries(internalLinks ?? {}).filter(
    ([, links]) => Array.isArray(links) && links.length > 0
  );

  const prettyGroup = (key: string) =>
    key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div>
      {block.heading ? (
        <h3 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
          {block.heading}
        </h3>
      ) : null}
      {block.body ? (
        <div className="mt-3 max-w-3xl space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
          <Paragraphs text={block.body} />
        </div>
      ) : null}

      <div
        className={`mt-8 grid gap-8 ${linkGroups.length > 0 ? "lg:grid-cols-[minmax(0,1fr)_260px]" : ""}`}
      >
        {/* Product cards */}
        {items.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:gap-5 xl:grid-cols-3">
            {items.map((p, i) => (
              <ProductCard key={p.slug ?? i} product={p} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-neutral-500">
            Product range available on request —{" "}
            <a href="#rfq" className="font-semibold text-neutral-900 underline underline-offset-4">
              ask for the catalogue
            </a>
            .
          </p>
        )}

        {/* Helpful links sidebar — real RPC internal links only */}
        {linkGroups.length > 0 ? (
          <aside className="h-fit rounded-xl border border-[#E5E5E5] bg-neutral-50 p-5">
            <p className="text-sm font-extrabold uppercase tracking-wide text-neutral-900">
              Helpful Links
            </p>
            <div className="mt-4 space-y-5">
              {linkGroups.map(([group, links]) => (
                <div key={group}>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-neutral-400">
                    {prettyGroup(group)}
                  </p>
                  <ul className="space-y-1.5">
                    {(links as InternalLink[]).map((link, i) => (
                      <li key={link.slug ?? i}>
                        <Link
                          href={link.slug ? `/${link.slug}` : "#"}
                          className="group flex items-center justify-between gap-2 text-sm font-medium text-neutral-700 hover:text-neutral-900"
                        >
                          <span className="truncate">{link.anchor || link.slug}</span>
                          <span className="shrink-0 text-[#FFC400]" aria-hidden>
                            +
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const href = product.slug ? `/${product.slug}` : undefined;

  const inner = (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-[#E5E5E5] bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.title ?? "Product"}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center px-3 text-center text-sm text-neutral-400">
            {product.title}
          </div>
        )}
        {product.is_featured ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-[#FFC400] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
            Featured
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h4 className="text-xs font-bold uppercase leading-snug tracking-wide text-neutral-900">
          {product.title}
        </h4>
        <div className="mt-auto flex items-center justify-between pt-3">
          {typeof product.moq === "number" ? (
            <span className="text-[11px] font-semibold text-neutral-500">
              MOQ {product.moq}
            </span>
          ) : (
            <span />
          )}
          <span className="text-xs font-bold text-neutral-900 group-hover:text-[#b78c00]">
            {product.cta_text || "View Details"} →
          </span>
        </div>
      </div>
    </article>
  );

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
