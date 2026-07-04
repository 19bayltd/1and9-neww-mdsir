import Link from "next/link";
import { blockByKey, type LandingPageData, type Product } from "@/lib/landing";
import { SectionHeading } from "./_shared";

/**
 * Related Products section. Renders the products array from the RPC as simple
 * cards (name, image, category, MOQ, link). Renders nothing if empty.
 */
export function ProductCards({ data }: { data: LandingPageData }) {
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
