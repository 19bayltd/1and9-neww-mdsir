import type { SectionBlock } from "@/types/seo";
import { SectionCopy, SectionCta, SectionShell } from "./shared";

/** Production process — RPC copy rendered as a wide statement band. */
export function ProductionProcessSection({ section }: { section: SectionBlock }) {
  return (
    <SectionShell id="production-process" tinted>
      <SectionCopy block={section} />
      {section.cta_label && section.cta_url ? (
        <div className="mt-8">
          <SectionCta block={section} />
        </div>
      ) : null}
    </SectionShell>
  );
}
