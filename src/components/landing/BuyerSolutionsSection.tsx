import Link from "next/link";
import type { ContentBlock, InternalLink, InternalLinks } from "@/lib/landing";
import { BlockCta, Paragraphs } from "./_shared";
import { SpecIcon, type IconName } from "./icons";

/**
 * Buyer Solutions — black buyer-type cards, per the reference.
 *
 * Segment labels are generic B2B buyer categories (identical across pages).
 * Each card resolves a REAL internal link from the RPC internal_links by
 * keyword match; unmatched cards fall back to the on-page #rfq anchor. No
 * fabricated URLs and no stock imagery — cards are icon-based since the DB
 * provides no per-segment images.
 */

const SEGMENTS: { label: string; keywords: string[]; icon: IconName }[] = [
  { label: "Streetwear Brands", keywords: ["streetwear", "street-wear"], icon: "streetwear" },
  { label: "Gym Wear Brands", keywords: ["gym", "fitness", "activewear", "athletic"], icon: "gym" },
  { label: "Corporate Uniforms", keywords: ["corporate", "workwear", "uniform"], icon: "corporate" },
  { label: "School Uniforms", keywords: ["school", "college", "university", "spiritwear"], icon: "school" },
  { label: "Startup Brands", keywords: ["startup", "start-up", "private label", "private-label"], icon: "startup" },
  { label: "Restaurant Uniforms", keywords: ["restaurant", "hospitality", "cafe"], icon: "restaurant" },
  { label: "Medical Uniforms", keywords: ["medical", "healthcare", "scrubs", "clinic"], icon: "medical" },
];

function findSegmentLink(
  internalLinks: InternalLinks | null | undefined,
  keywords: string[]
): InternalLink | null {
  if (!internalLinks) return null;
  const all = Object.values(internalLinks)
    .filter(Array.isArray)
    .flat()
    .filter((l): l is InternalLink => Boolean(l && l.slug));
  for (const link of all) {
    const haystack = `${link.anchor ?? ""} ${link.slug ?? ""}`.toLowerCase();
    if (keywords.some((k) => haystack.includes(k))) return link;
  }
  return null;
}

export function BuyerSolutionsSection({
  block,
  internalLinks,
}: {
  block: ContentBlock;
  internalLinks?: InternalLinks | null;
}) {
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

      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
        {SEGMENTS.map((segment) => {
          const link = findSegmentLink(internalLinks, segment.keywords);
          const inner = (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-white/10 text-[#FFC400] transition-colors group-hover:bg-[#FFC400] group-hover:text-black">
                <SpecIcon icon={segment.icon} />
              </span>
              <p className="mt-4 text-xs font-bold uppercase leading-snug tracking-wide text-white">
                {segment.label}
              </p>
            </>
          );
          const cardClass =
            "group flex h-full flex-col items-center rounded-xl bg-[#0A0A0A] p-5 text-center transition-transform hover:-translate-y-0.5";

          return link?.slug ? (
            <Link key={segment.label} href={`/${link.slug}`} className={cardClass}>
              {inner}
            </Link>
          ) : (
            <a key={segment.label} href="#rfq" className={cardClass}>
              {inner}
            </a>
          );
        })}
      </div>

      {/* DB-driven CTA — renders only when the block carries the pair. */}
      <BlockCta label={block.cta_label} url={block.cta_url} />
    </div>
  );
}
