import type { SectionBlock } from "@/types/seo";
import { SectionCopy, SectionCta, SectionShell } from "./shared";

/** Intro — centered opening statement, straight from the RPC block. */
export function IntroSection({ section }: { section: SectionBlock }) {
  return (
    <SectionShell id="intro">
      <SectionCopy block={section} center />
      {section.cta_label && section.cta_url ? (
        <div className="mt-8 text-center">
          <SectionCta block={section} />
        </div>
      ) : null}
    </SectionShell>
  );
}
