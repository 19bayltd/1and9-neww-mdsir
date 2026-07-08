import type { AssignedImage, FAQItem, SectionBlock, SeoPage } from "@/types/seo";
import { HeroSection } from "./HeroSection";
import { IntroSection } from "./IntroSection";
import { ManufacturingSection } from "./ManufacturingSection";
import { CustomizationSection } from "./CustomizationSection";
import { WhyChooseUsSection } from "./WhyChooseUsSection";
import { ProductionProcessSection } from "./ProductionProcessSection";
import { BuyerSolutionsSection } from "./BuyerSolutionsSection";
import { RelatedProductsSection } from "./RelatedProductsSection";
import { RFQSection } from "./RFQSection";
import { FAQSection } from "./FAQSection";
import { SectionCopy, SectionCta, SectionShell } from "./shared";

/**
 * SectionRenderer — maps a DB section block to its component.
 *
 * Section ORDER is never hardcoded: the page renders blocks in the RPC's
 * `position` order and each block lands here. Unknown keys render a safe
 * generic text section (or nothing when the block is empty) — they never
 * crash the page.
 */
export function SectionRenderer({
  section,
  page,
  assignedImages,
  faqs,
}: {
  section: SectionBlock;
  page: SeoPage;
  assignedImages: AssignedImage[];
  faqs: FAQItem[];
}) {
  const key = (section.section_key ?? section.block_key ?? "").toLowerCase();

  switch (key) {
    case "hero":
      return <HeroSection section={section} page={page} assignedImages={assignedImages} />;
    case "intro":
      return <IntroSection section={section} />;
    case "manufacturing_overview":
      return <ManufacturingSection section={section} assignedImages={assignedImages} />;
    case "customization_options":
      return <CustomizationSection section={section} assignedImages={assignedImages} />;
    case "why_choose_us":
      return <WhyChooseUsSection section={section} assignedImages={assignedImages} />;
    case "production_process":
      return <ProductionProcessSection section={section} />;
    case "buyer_solutions":
      return <BuyerSolutionsSection section={section} />;
    case "related_products":
      return <RelatedProductsSection section={section} assignedImages={assignedImages} />;
    case "rfq":
      return <RFQSection section={section} page={page} />;
    case "faq":
      return <FAQSection section={section} faqs={faqs} />;
    default:
      return <GenericSection section={section} />;
  }
}

/** Safe fallback for section keys this UI doesn't know yet. */
function GenericSection({ section }: { section: SectionBlock }) {
  if (!section.heading && !section.title && !section.body) return null;
  const id = (section.section_key ?? section.block_key ?? `section-${section.id}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  return (
    <SectionShell id={id}>
      <SectionCopy block={section} />
      <div className="mt-8">
        <SectionCta block={section} />
      </div>
    </SectionShell>
  );
}
