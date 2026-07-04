import type { ContentBlock } from "@/lib/landing";
import { Paragraphs, SectionHeading } from "./_shared";

/**
 * Generic text section driven by a single content block.
 *
 * Reused for Intro, Manufacturing Overview, Customization Options,
 * Why 1 & 9 Apparel, Production Process, and Buyer Solutions. The caller
 * resolves the right block (via blockByKey) and supplies the eyebrow / id /
 * tint. Renders nothing if the block is absent, so section order is preserved
 * without hardcoding any copy.
 *
 * The Intro block (block_key "intro") gets a richer editorial layout with a
 * supporting visual and two generic "angle" framings; all other blocks keep
 * the clean single-column text layout.
 */
export function ContentBlockSection({
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

  const isIntro = (block.block_key ?? "").toLowerCase() === "intro" || id === "intro";
  if (isIntro) {
    return <IntroLayout block={block} eyebrow={eyebrow} id={id} tinted={tinted} />;
  }

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

/**
 * Generic, brand-level framing for the intro's two angles. These are the same
 * on every landing page (not page-specific SEO), so they live here as generic
 * UI copy rather than in the RPC.
 */
const INTRO_ANGLES: { label: string; text: string; icon: "factory" | "capability" }[] = [
  {
    label: "Factory Story",
    text: "Factory-direct production in Bangladesh — no middlemen between your brand and the sewing floor.",
    icon: "factory",
  },
  {
    label: "Manufacturing Capability",
    text: "Knit and fleece programs handled end to end, with inline QC at cutting, sewing and finishing.",
    icon: "capability",
  },
];

function IntroLayout({
  block,
  eyebrow,
  id,
  tinted,
}: {
  block: ContentBlock;
  eyebrow: string;
  id: string;
  tinted: boolean;
}) {
  const ctaLabel = block.cta_label || "Request Bulk Quote";
  const ctaHref = block.cta_url || "#rfq";

  return (
    <section
      id={id}
      className={`border-t border-neutral-200 ${tinted ? "bg-neutral-50" : "bg-white"}`}
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="grid items-start gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Text — SEO intro content, verbatim from RPC */}
          <div>
            <SectionHeading eyebrow={eyebrow}>{block.heading}</SectionHeading>
            <div className="max-w-xl space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
              <Paragraphs text={block.body} />
            </div>
            <a
              href={ctaHref}
              className="mt-8 inline-flex items-center justify-center rounded-md bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-700"
            >
              {ctaLabel}
            </a>
          </div>

          {/* Aside — supporting image (if RPC provides one) + angle framings */}
          <div className="lg:pt-2">
            {block.image_url ? (
              <img
                src={block.image_url}
                alt={block.image_alt || block.heading || "1 & 9 Apparel manufacturing"}
                className="mb-6 aspect-[16/10] w-full rounded-xl object-cover ring-1 ring-neutral-200"
              />
            ) : null}

            <div className="divide-y divide-neutral-200 rounded-xl border border-neutral-200 bg-white">
              {INTRO_ANGLES.map((angle) => (
                <div key={angle.label} className="flex gap-4 p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
                    <AngleIcon icon={angle.icon} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{angle.label}</p>
                    <p className="mt-1 text-sm leading-relaxed text-neutral-600">{angle.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function AngleIcon({ icon }: { icon: "factory" | "capability" }) {
  const common = {
    className: "h-5 w-5",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    "aria-hidden": true,
  };
  if (icon === "factory") {
    return (
      <svg {...common}>
        <path d="M3 21h18" />
        <path d="M4 21V10l6 4V10l6 4V6l4 2v13" />
        <path d="M8 21v-4M13 21v-4" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
    </svg>
  );
}
