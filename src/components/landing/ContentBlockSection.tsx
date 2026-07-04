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
 * Two blocks get richer layouts:
 *  - "intro": editorial two-column with a supporting visual + angle framings.
 *  - "manufacturing_overview": RPC copy + a premium grid of spec cards.
 * All other blocks keep the clean single-column text layout.
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

  const key = (block.block_key ?? "").toLowerCase();

  if (key === "intro" || id === "intro") {
    return <IntroLayout block={block} eyebrow={eyebrow} id={id} tinted={tinted} />;
  }

  if (
    key === "manufacturing_overview" ||
    key === "manufacturing" ||
    id === "manufacturing-overview"
  ) {
    return <ManufacturingLayout block={block} eyebrow={eyebrow} id={id} tinted={tinted} />;
  }

  if (
    key === "customization_options" ||
    key === "customization" ||
    key === "options" ||
    id === "customization-options"
  ) {
    return <CustomizationLayout block={block} eyebrow={eyebrow} id={id} tinted={tinted} />;
  }

  if (
    key === "why_choose_us" ||
    key === "why" ||
    key === "benefits" ||
    key === "trust" ||
    id === "why-choose-us"
  ) {
    return <WhyChooseUsLayout block={block} eyebrow={eyebrow} id={id} tinted={tinted} />;
  }

  if (
    key === "production_process" ||
    key === "process" ||
    key === "production" ||
    id === "production-process"
  ) {
    return <ProductionProcessLayout block={block} eyebrow={eyebrow} id={id} tinted={tinted} />;
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

/* -------------------------------------------------------------------------- */
/* Intro                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Generic, brand-level framing for the intro's two angles. Same on every
 * landing page (not page-specific SEO), so defined here as generic UI copy.
 */
const INTRO_ANGLES: { label: string; text: string; icon: IconName }[] = [
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
                    <SpecIcon icon={angle.icon} />
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

/* -------------------------------------------------------------------------- */
/* Manufacturing Overview                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Generic manufacturing spec cards. The RPC block only carries prose (heading
 * + body), not structured MOQ/sampling/QC fields, so these are generic
 * brand-level labels — identical on every page, not fabricated page-specific
 * claims. The page's own SEO copy (heading + body) is still rendered verbatim
 * from the RPC above the grid.
 */
const MANUFACTURING_SPECS: {
  label: string;
  value: string;
  caption: string;
  icon: IconName;
}[] = [
  { label: "MOQ", value: "300 pcs", caption: "Minimum order per style", icon: "moq" },
  { label: "Sampling", value: "7–10 days", caption: "Pre-production samples", icon: "sampling" },
  { label: "Production", value: "30–45 days", caption: "Bulk lead time after approval", icon: "production" },
  { label: "Quality Control", value: "AQL 2.5", caption: "Inline & final inspection", icon: "qc" },
  { label: "Shipping", value: "DDP ready", caption: "Duties & clearance handled", icon: "shipping" },
  { label: "Capacity", value: "Export scale", caption: "High-volume factory output", icon: "capacity" },
];

function ManufacturingLayout({
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
  return (
    <section
      id={id}
      className={`border-t border-neutral-200 ${tinted ? "bg-neutral-50" : "bg-white"}`}
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow={eyebrow}>{block.heading}</SectionHeading>
        {block.body ? (
          <div className="max-w-3xl space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
            <Paragraphs text={block.body} />
          </div>
        ) : null}

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {MANUFACTURING_SPECS.map((spec) => (
            <div
              key={spec.label}
              className="rounded-xl border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
                  <SpecIcon icon={spec.icon} />
                </span>
                <span className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  {spec.label}
                </span>
              </div>
              <p className="mt-4 text-2xl font-bold tracking-tight text-neutral-900">
                {spec.value}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">{spec.caption}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Customization Options                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Generic customization capability cards. The RPC block carries only prose, so
 * these are generic apparel-manufacturer capabilities — identical on every
 * page, not fabricated product-specific data. The page's own SEO heading +
 * body are still rendered verbatim from the RPC above the grid.
 */
const CUSTOMIZATION_OPTIONS: {
  label: string;
  caption: string;
  icon: IconName;
}[] = [
  { label: "Fabric", caption: "Cotton, blends & organic — combed, carded and ring-spun.", icon: "fabric" },
  { label: "GSM", caption: "140–450 GSM, from lightweight tees to heavy fleece.", icon: "gsm" },
  { label: "Printing", caption: "Screen, DTG and DTF — up to 12-colour artwork.", icon: "printing" },
  { label: "Embroidery", caption: "Flat and 3D puff for logos, badges and monograms.", icon: "embroidery" },
  { label: "Labels", caption: "Custom neck, woven, care and hang tags.", icon: "labels" },
  { label: "Packaging", caption: "Poly-bag or retail box — barcode and carton ready.", icon: "packaging" },
];

function CustomizationLayout({
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
  return (
    <section
      id={id}
      className={`border-t border-neutral-200 ${tinted ? "bg-neutral-50" : "bg-white"}`}
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow={eyebrow}>{block.heading}</SectionHeading>
        {block.body ? (
          <div className="max-w-3xl space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
            <Paragraphs text={block.body} />
          </div>
        ) : null}

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {CUSTOMIZATION_OPTIONS.map((opt) => (
            <div
              key={opt.label}
              className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 transition-shadow hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900 text-white">
                <SpecIcon icon={opt.icon} />
              </span>
              <p className="mt-4 text-base font-semibold text-neutral-900">{opt.label}</p>
              <p className="mt-1 text-sm leading-relaxed text-neutral-600">{opt.caption}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Why 1 & 9 Apparel                                                           */
/* -------------------------------------------------------------------------- */

/**
 * Proof points for the "why choose us" section.
 *
 * Deliberately factual and restrained — NO invented certifications, client
 * names, container counts, or factory-size claims. The only figure is the real
 * brand MOQ (300 pcs, present in the RPC products/FAQ data), and the export
 * markets are the business's stated B2B markets. The page's own SEO heading +
 * body remain the primary proof and are rendered verbatim from the RPC above.
 */
const WHY_PROOFS: { label: string; caption: string; icon: IconName }[] = [
  {
    label: "Factory-Direct",
    caption: "Work directly with the production floor — not a trading middleman.",
    icon: "factory",
  },
  {
    label: "Export-Ready",
    caption: "Set up for B2B export to the USA, UK, EU, Canada and Australia.",
    icon: "export",
  },
  {
    label: "Low MOQ",
    caption: "Start from 300 pieces per style — accessible for growing brands.",
    icon: "moq",
  },
  {
    label: "Quality Control",
    caption: "Export-grade QC with inline and final inspection on every order.",
    icon: "qc",
  },
  {
    label: "Speed",
    caption: "Quotes within one business day and a clear sampling-to-bulk schedule.",
    icon: "speed",
  },
  {
    label: "Buyer Support",
    caption: "A dedicated English-speaking merchandiser on every account.",
    icon: "support",
  },
];

function WhyChooseUsLayout({
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
  return (
    <section
      id={id}
      className={`border-t border-neutral-200 ${tinted ? "bg-neutral-50" : "bg-white"}`}
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow={eyebrow}>{block.heading}</SectionHeading>
        {block.body ? (
          <div className="max-w-3xl space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
            <Paragraphs text={block.body} />
          </div>
        ) : null}

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {WHY_PROOFS.map((proof) => (
            <div
              key={proof.label}
              className="rounded-xl border border-neutral-200 bg-white p-5 transition-shadow hover:shadow-md"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-900 text-white">
                  <SpecIcon icon={proof.icon} />
                </span>
                <span className="text-sm font-semibold text-neutral-900">{proof.label}</span>
              </div>
              <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-neutral-600">
                <span className="mt-0.5 shrink-0 text-neutral-900">
                  <SpecIcon icon="check" />
                </span>
                {proof.caption}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Production Process                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Production timeline steps. Labels are generic manufacturing stages — no
 * per-step day figures are shown, since the RPC block has no structured
 * per-step timing (any durations live only inside the prose body, which is
 * rendered verbatim above the timeline).
 */
const PRODUCTION_STEPS: { label: string; icon: IconName }[] = [
  { label: "Design", icon: "design" },
  { label: "Sampling", icon: "sampling" },
  { label: "Approval", icon: "check" },
  { label: "Production", icon: "production" },
  { label: "QC", icon: "qc" },
  { label: "Shipping", icon: "shipping" },
];

function ProductionProcessLayout({
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
  const last = PRODUCTION_STEPS.length - 1;

  return (
    <section
      id={id}
      className={`border-t border-neutral-200 ${tinted ? "bg-neutral-50" : "bg-white"}`}
    >
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow={eyebrow}>{block.heading}</SectionHeading>
        {block.body ? (
          <div className="max-w-3xl space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
            <Paragraphs text={block.body} />
          </div>
        ) : null}

        {/* Horizontal timeline (lg and up) */}
        <ol className="mt-12 hidden lg:grid lg:grid-cols-6">
          {PRODUCTION_STEPS.map((step, i) => (
            <li key={step.label} className="relative flex flex-col items-center px-2 text-center">
              {i < last ? (
                <span
                  className="absolute left-1/2 top-6 h-px w-full bg-neutral-200"
                  aria-hidden
                />
              ) : null}
              <span className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900 text-white ring-4 ring-white">
                <SpecIcon icon={step.icon} />
              </span>
              <span className="mt-4 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                Step {i + 1}
              </span>
              <span className="mt-0.5 text-sm font-semibold text-neutral-900">{step.label}</span>
            </li>
          ))}
        </ol>

        {/* Vertical timeline (below lg) */}
        <ol className="mt-10 lg:hidden">
          {PRODUCTION_STEPS.map((step, i) => (
            <li key={step.label} className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <span className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-white">
                  <SpecIcon icon={step.icon} />
                </span>
                {i < last ? (
                  <span className="my-1 w-px grow bg-neutral-200" aria-hidden />
                ) : null}
              </div>
              <div className={i < last ? "pb-8 pt-1.5" : "pt-1.5"}>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
                  Step {i + 1}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-neutral-900">{step.label}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Icons                                                                       */
/* -------------------------------------------------------------------------- */

type IconName =
  | "factory"
  | "capability"
  | "moq"
  | "sampling"
  | "production"
  | "qc"
  | "shipping"
  | "capacity"
  | "fabric"
  | "gsm"
  | "printing"
  | "embroidery"
  | "labels"
  | "packaging"
  | "export"
  | "speed"
  | "support"
  | "check"
  | "design";

function SpecIcon({ icon }: { icon: IconName }) {
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

  switch (icon) {
    case "factory":
      return (
        <svg {...common}>
          <path d="M3 21h18" />
          <path d="M4 21V10l6 4V10l6 4V6l4 2v13" />
          <path d="M8 21v-4M13 21v-4" />
        </svg>
      );
    case "capability":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
        </svg>
      );
    case "moq":
      return (
        <svg {...common}>
          <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M3.3 7 12 12l8.7-5M12 22V12" />
        </svg>
      );
    case "sampling":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="3" />
          <circle cx="6" cy="18" r="3" />
          <path d="M20 4 8.1 15.9M14.5 12.5 20 20M8.1 8.1 12 12" />
        </svg>
      );
    case "production":
      return (
        <svg {...common}>
          <rect x="2" y="14" width="20" height="6" rx="1" />
          <path d="M6 17h.01M10 17h.01M14 17h.01M18 17h.01" />
          <path d="M7 14V9a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5M12 7V4" />
        </svg>
      );
    case "qc":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      );
    case "shipping":
      return (
        <svg {...common}>
          <path d="M3 5h11v9H3zM14 8h4l3 3v3h-7z" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="17" cy="18" r="1.6" />
        </svg>
      );
    case "capacity":
      return (
        <svg {...common}>
          <path d="M12 3 2 9l10 6 10-6z" />
          <path d="M2 15l10 6 10-6M2 12l10 6 10-6" />
        </svg>
      );
    case "fabric":
      return (
        <svg {...common}>
          <path d="M3 6c2 0 2 1.5 4 1.5S9 6 11 6s2 1.5 4 1.5S17 6 19 6" />
          <path d="M3 6v12c2 0 2 1.5 4 1.5S9 18 11 18s2 1.5 4 1.5S17 18 19 18V6" />
          <path d="M3 12c2 0 2 1.5 4 1.5S9 12 11 12s2 1.5 4 1.5S17 12 19 12" />
        </svg>
      );
    case "gsm":
      return (
        <svg {...common}>
          <path d="M12 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
          <path d="M8.5 6h7l3 13a2 2 0 0 1-2 2.5H7.5a2 2 0 0 1-2-2.5z" />
          <path d="M9 13h6" />
        </svg>
      );
    case "printing":
      return (
        <svg {...common}>
          <path d="M6 9V3h12v6" />
          <path d="M6 18H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
          <rect x="6" y="14" width="12" height="7" rx="1" />
        </svg>
      );
    case "embroidery":
      return (
        <svg {...common}>
          <path d="M4 20 20 4" />
          <path d="M17 3.5 20.5 7 18 9.5 14.5 6z" />
          <circle cx="6" cy="18" r="2.4" />
        </svg>
      );
    case "labels":
      return (
        <svg {...common}>
          <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-6.2-6.2A2 2 0 0 1 4 13V5a1 1 0 0 1 1-1h8a2 2 0 0 1 1.4.6l6.2 6.2a2 2 0 0 1 0 2.6z" />
          <circle cx="8.5" cy="8.5" r="1.2" />
        </svg>
      );
    case "packaging":
      return (
        <svg {...common}>
          <path d="M3.3 7 12 12l8.7-5" />
          <path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <path d="M12 22V12M7.5 4.5l9 5" />
        </svg>
      );
    case "export":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18" />
        </svg>
      );
    case "speed":
      return (
        <svg {...common}>
          <circle cx="12" cy="13" r="8" />
          <path d="M12 13V9M12 5V3M9 3h6" />
        </svg>
      );
    case "support":
      return (
        <svg {...common}>
          <path d="M4 13a8 8 0 0 1 16 0" />
          <rect x="3" y="13" width="4" height="6" rx="1.5" />
          <rect x="17" y="13" width="4" height="6" rx="1.5" />
          <path d="M20 19a3 3 0 0 1-3 3h-3" />
        </svg>
      );
    case "check":
      return (
        <svg {...common} className="h-4 w-4">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "design":
      return (
        <svg {...common}>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
        </svg>
      );
    default:
      return null;
  }
}
