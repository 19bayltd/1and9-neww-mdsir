import type { ContentBlock } from "@/lib/landing";
import { Paragraphs } from "./_shared";
import { SpecIcon, type IconName } from "./icons";

/**
 * IconGridSection — RPC copy + a grid of icon cards.
 *
 * Two visual variants per the reference:
 *  - "tile": compact centered icon tiles (Customization Options row)
 *  - "feature": icon + label + caption cards (Why 1 & 9 Apparel)
 *
 * Item labels/captions are generic brand capabilities, identical across
 * pages; page-specific copy (heading/body) renders verbatim from the RPC.
 */

export type IconGridItem = { label: string; caption?: string; icon: IconName };

export const CUSTOMIZATION_ITEMS: IconGridItem[] = [
  { label: "Fabric & GSM", caption: "Cotton, blends & organic — 140–450 GSM.", icon: "fabric" },
  { label: "Color Options", caption: "Lab dips matched to your palette.", icon: "gsm" },
  { label: "Printing", caption: "Screen, DTG & DTF — up to 12 colours.", icon: "printing" },
  { label: "Embroidery", caption: "Flat and 3D puff decoration.", icon: "embroidery" },
  { label: "Custom Labels", caption: "Neck, woven and care labels.", icon: "labels" },
  { label: "Hang Tags", caption: "Branded tags and barcodes.", icon: "design" },
  { label: "Custom Packaging", caption: "Poly-bag or boxed retail packing.", icon: "packaging" },
];

export const WHY_ITEMS: IconGridItem[] = [
  {
    label: "Factory Direct Pricing",
    caption: "Work directly with the production floor — no trading middleman.",
    icon: "factory",
  },
  {
    label: "Low MOQ from 300 pcs",
    caption: "Accessible runs for startups and growing brands.",
    icon: "moq",
  },
  {
    label: "Fast Sampling 7–10 Days",
    caption: "Quick samples to bring your ideas to life.",
    icon: "sampling",
  },
  {
    label: "Quality Control",
    caption: "Strict QC at every stage of production.",
    icon: "qc",
  },
  {
    label: "Private Label & Branding",
    caption: "Your brand, your label — we handle the rest.",
    icon: "labels",
  },
  {
    label: "Worldwide Shipping",
    caption: "DDP export to the USA, UK, EU, Canada and Australia.",
    icon: "export",
  },
];

export function IconGridSection({
  block,
  items,
  variant,
  lead,
}: {
  block: ContentBlock;
  items: IconGridItem[];
  variant: "tile" | "feature";
  /** Optional generic lead line above the grid (e.g. "Fully Customizable."). */
  lead?: string;
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
      {lead ? <p className="mt-6 text-sm font-bold text-neutral-900">{lead}</p> : null}

      {variant === "tile" ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
          {items.map((item) => (
            <div
              key={item.label}
              className="flex flex-col items-center rounded-xl border border-[#E5E5E5] bg-white p-4 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg border border-neutral-300 text-neutral-900">
                <SpecIcon icon={item.icon} />
              </span>
              <p className="mt-3 text-xs font-bold uppercase leading-snug tracking-wide text-neutral-900">
                {item.label}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-[#E5E5E5] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#0A0A0A] text-[#FFC400]">
                <SpecIcon icon={item.icon} />
              </span>
              <p className="mt-4 text-sm font-bold uppercase tracking-wide text-neutral-900">
                {item.label}
              </p>
              {item.caption ? (
                <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{item.caption}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
