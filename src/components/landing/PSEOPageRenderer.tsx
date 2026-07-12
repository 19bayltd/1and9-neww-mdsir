import type { ContentBlock, LandingPageData } from "@/lib/landing";
import { BlockCta, Paragraphs } from "./_shared";
import { SectionShell } from "./SectionShell";
import { HeroSection } from "./HeroSection";
import { IntroSection } from "./IntroSection";
import { StatsSection } from "./StatsSection";
import { IconGridSection, CUSTOMIZATION_ITEMS, WHY_ITEMS } from "./IconGridSection";
import { ProcessSection } from "./ProcessSection";
import { BuyerSolutionsSection } from "./BuyerSolutionsSection";
import { RelatedProductsSection } from "./RelatedProductsSection";
import { RFQSection } from "./RFQSection";
import { FAQSection } from "./FAQSection";
import { FooterTrustBar } from "./FooterTrustBar";

/**
 * PSEOPageRenderer — orchestrates the whole landing page.
 *
 * Section ORDER is not hardcoded: it comes from the DB via the RPC's
 * content_blocks[].sort_order (backed by seo_content_blocks.display_order —
 * this schema's layout-ordering source). Each block_key maps to a section
 * component; unknown keys fall back to a clean generic text section; missing
 * blocks are skipped safely. Content, images and links come from the RPC.
 */

/** Generic display names for the label column, derived from the block key. */
function sectionTitle(key: string): string {
  const overrides: Record<string, string> = {
    intro: "Intro",
    manufacturing_overview: "Manufacturing Overview",
    customization_options: "Customization Options",
    why_choose_us: "Why 1 & 9 Apparel",
    production_process: "Production Process",
    buyer_solutions: "Buyer Solutions",
    related_products: "Related Products & Internal Links",
    rfq: "RFQ / Instant Quote",
    faq: "FAQ · Frequently Asked Questions",
  };
  return (
    overrides[key] ??
    key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

const sectionId = (key: string) => key.replace(/_/g, "-");

export function PSEOPageRenderer({ data }: { data: LandingPageData }) {
  const page = data.page ?? {};

  // DB-driven order: sort by the RPC's sort_order (seo_content_blocks.display_order).
  const blocks = [...(data.content_blocks ?? [])]
    .filter((b): b is ContentBlock => Boolean(b && b.block_key))
    .sort((a, b) => (a.sort_order ?? 999) - (b.sort_order ?? 999));

  const hasRfqBlock = blocks.some((b) => (b.block_key ?? "").toLowerCase() === "rfq");

  // Assign "01", "02" … in DB order to every numbered section (hero and intro
  // are unnumbered per the reference; FAQ gets the "?" marker).
  const numberedKeys = blocks
    .map((b) => (b.block_key ?? "").toLowerCase())
    .filter((k) => k !== "hero" && k !== "intro" && k !== "faq");
  const numberMap = new Map(
    numberedKeys.map((k, i) => [k, String(i + 1).padStart(2, "0")])
  );
  const numberFor = (key: string): string | null => {
    if (key === "hero" || key === "intro") return null;
    if (key === "faq") return "?";
    return numberMap.get(key) ?? null;
  };

  const sections = blocks
    .map((block) => {
      const key = (block.block_key ?? "").toLowerCase();
      if (key === "hero") return null; // rendered as the full-bleed hero band

      if (key === "faq" && (data.faqs ?? []).filter((f) => f.question && f.answer).length === 0) {
        return null; // no FAQ data — skip cleanly
      }

      const number = numberFor(key);
      const title = sectionTitle(key);
      const id = sectionId(key);

      let content: React.ReactNode;
      switch (key) {
        case "intro":
          content = <IntroSection block={block} data={data} />;
          break;
        case "manufacturing_overview":
          content = <StatsSection block={block} />;
          break;
        case "customization_options":
          content = (
            <IconGridSection
              block={block}
              items={CUSTOMIZATION_ITEMS}
              variant="tile"
              lead="Fully Customizable. 100% Your Brand."
            />
          );
          break;
        case "why_choose_us":
          content = <IconGridSection block={block} items={WHY_ITEMS} variant="feature" />;
          break;
        case "production_process":
          content = <ProcessSection block={block} />;
          break;
        case "buyer_solutions":
          content = (
            <BuyerSolutionsSection block={block} internalLinks={data.internal_links} />
          );
          break;
        case "related_products":
          content = (
            <RelatedProductsSection
              block={block}
              products={data.products ?? []}
              internalLinks={data.internal_links}
            />
          );
          break;
        case "rfq":
          content = (
            <RFQSection
              sourcePageId={page.id ?? null}
              sourceSlug={page.slug ?? null}
              heading={block.heading}
              body={block.body}
              ctaLabel={block.cta_label}
            />
          );
          break;
        case "faq":
          content = <FAQSection data={data} />;
          break;
        default:
          // Unknown block key — clean generic text fallback, never dropped data.
          content = <GenericBlock block={block} />;
      }

      return (
        <SectionShell key={key + (block.sort_order ?? "")} id={id} number={number} title={title}>
          {content}
        </SectionShell>
      );
    })
    .filter(Boolean);

  return (
    <main className="bg-white text-neutral-900">
      <LandingNav data={data} />
      <HeroSection data={data} />
      {sections}

      {/* Safety net: the conversion form always exists even if the DB has no rfq block. */}
      {!hasRfqBlock ? (
        <SectionShell
          id="rfq"
          number={String(numberedKeys.length + 1).padStart(2, "0")}
          title="RFQ / Instant Quote"
        >
          <RFQSection
            sourcePageId={page.id ?? null}
            sourceSlug={page.slug ?? null}
            heading={null}
            body={null}
            ctaLabel={null}
          />
        </SectionShell>
      ) : null}

      <FooterTrustBar data={data} />
    </main>
  );
}

/** Clean fallback for content blocks with keys this UI doesn't know yet. */
function GenericBlock({ block }: { block: ContentBlock }) {
  if (!block.heading && !block.body) return null;
  return (
    <div>
      {block.heading ? (
        <h3 className="text-xl font-bold tracking-tight text-neutral-900 sm:text-2xl">
          {block.heading}
        </h3>
      ) : null}
      <div className="mt-3 max-w-3xl space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
        <Paragraphs text={block.body} />
      </div>
      <BlockCta label={block.cta_label} url={block.cta_url} />
    </div>
  );
}

/** Sticky black navbar with generic on-page anchors, per the reference. */
function LandingNav({ data }: { data: LandingPageData }) {
  const currency = data.country_assets?.currency_code;

  const links = [
    { label: "Products", href: "#related-products" },
    { label: "Customize", href: "#customization-options" },
    { label: "Process", href: "#production-process" },
    { label: "Why Us", href: "#why-choose-us" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#050505] text-white">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-6">
        <a href="#top" className="flex items-baseline gap-1.5">
          <span className="text-lg font-black tracking-tight">
            1<span className="text-[#FFC400]">&amp;</span>9
          </span>
          <span className="hidden text-[9px] font-semibold uppercase tracking-[0.25em] text-neutral-400 sm:inline">
            One and Nine
          </span>
        </a>

        <nav aria-label="Page sections" className="hidden items-center gap-6 lg:flex">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="text-xs font-bold uppercase tracking-wide text-neutral-300 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {currency ? (
            <span className="hidden rounded-full border border-neutral-700 px-2.5 py-1 text-[11px] font-bold text-neutral-300 sm:inline">
              {currency}
            </span>
          ) : null}
          <a
            href="#rfq"
            className="inline-flex items-center rounded-md bg-[#FFC400] px-4 py-2 text-xs font-bold uppercase tracking-wide text-black transition-colors hover:bg-[#e6b100]"
          >
            Get a Quote
          </a>
        </div>
      </div>
    </header>
  );
}
