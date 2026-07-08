import type { SectionBlock } from "@/types/seo";
import { SectionCopy, SectionCta, SectionShell } from "./shared";

/** Buyer solutions — RPC copy with an optional CTA. */
export function BuyerSolutionsSection({ section }: { section: SectionBlock }) {
  return (
    <SectionShell id="buyer-solutions">
      <SectionCopy block={section} />
      {section.cta_label && section.cta_url ? (
        <div className="mt-8">
          <SectionCta block={section} />
        </div>
      ) : null}
    </SectionShell>
  );
}
