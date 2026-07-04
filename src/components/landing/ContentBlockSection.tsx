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
