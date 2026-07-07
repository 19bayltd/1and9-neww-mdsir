import type { ContentBlock, LandingPageData } from "@/lib/landing";
import { Paragraphs } from "./_shared";
import { SpecIcon, type IconName } from "./icons";

/**
 * Intro — text + image grid, per the reference layout.
 *
 * Body copy comes verbatim from the RPC intro block. The image grid uses ONLY
 * images already present in the RPC payload (block image, page/country hero
 * image, product images); if none exist the grid is skipped cleanly. The four
 * mini feature chips are generic brand-level labels, identical across pages.
 */

const INTRO_FEATURES: { label: string; icon: IconName }[] = [
  { label: "Factory-Direct Manufacturing Partner", icon: "factory" },
  { label: "Low MOQ · From 300 Pieces", icon: "moq" },
  { label: "Strict Quality Control", icon: "qc" },
  { label: "On-Time DDP Delivery", icon: "shipping" },
];

/** Collect unique, real image URLs from the RPC payload only. */
function collectImages(data: LandingPageData, block: ContentBlock): string[] {
  const urls = [
    block.image_url,
    data.page?.hero_image_url,
    data.country_assets?.hero_image_url,
    ...(data.products ?? []).map((p) => p.image_url),
  ].filter((u): u is string => Boolean(u));
  return [...new Set(urls)].slice(0, 6);
}

export function IntroSection({
  block,
  data,
}: {
  block: ContentBlock;
  data: LandingPageData;
}) {
  const images = collectImages(data, block);

  return (
    <div className="grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
      {/* Text — verbatim RPC copy + generic feature chips */}
      <div>
        {block.heading ? (
          <h3 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
            {block.heading}
          </h3>
        ) : null}
        <div className="mt-4 space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
          <Paragraphs text={block.body} />
        </div>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {INTRO_FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex items-center gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#FFC400] text-neutral-900">
                <SpecIcon icon={f.icon} className="h-4.5 w-4.5" />
              </span>
              <span className="text-sm font-semibold text-neutral-900">{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Image grid — DB images only; skipped when none exist */}
      {images.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {images.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={block.image_alt || `1 & 9 Apparel manufacturing ${i + 1}`}
              loading="lazy"
              decoding="async"
              className="aspect-[4/3] w-full rounded-xl object-cover ring-1 ring-neutral-200"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
