import type { FAQItem, SectionBlock } from "@/types/seo";
import { Paragraphs, SectionShell } from "./shared";

/**
 * FAQ — accessible <details> accordion + FAQPage JSON-LD.
 *
 * Content comes exclusively from the RPC faqs array; nothing is invented.
 * The JSON-LD includes ONLY rows with include_in_schema === true, and is
 * emitted once here (no duplicate schema elsewhere on the page).
 */
export function FAQSection({
  section,
  faqs,
}: {
  section: SectionBlock;
  faqs: FAQItem[];
}) {
  const items = faqs.filter((f) => f.question && f.answer);
  if (items.length === 0) return null;

  const schemaFaqs = items.filter((f) => f.include_in_schema === true);
  const jsonLd =
    schemaFaqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: schemaFaqs.map((f) => ({
            "@type": "Question",
            name: f.question,
            acceptedAnswer: {
              "@type": "Answer",
              text: f.answer,
            },
          })),
        }
      : null;

  return (
    <SectionShell id="faq">
      {jsonLd ? (
        <script
          type="application/ld+json"
          // Escape "<" so RPC text can never close the script tag early.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      <div className="max-w-3xl">
        {section.heading || section.title ? (
          <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
            {section.heading || section.title}
          </h2>
        ) : null}
        {section.body ? (
          <div className="mt-4 space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
            <Paragraphs text={section.body} />
          </div>
        ) : null}
      </div>

      <div className="mt-10 divide-y divide-neutral-200 border-y border-neutral-200">
        {items.map((f) => (
          <details key={f.id} className="group">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 [&::-webkit-details-marker]:hidden">
              <h3 className="text-base font-medium text-neutral-950 sm:text-lg">
                {f.question}
              </h3>
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center text-neutral-400 transition-transform group-open:rotate-45"
                aria-hidden
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  className="h-4 w-4"
                >
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </span>
            </summary>
            <div className="pb-6">
              <p className="max-w-3xl text-sm leading-relaxed text-neutral-600 sm:text-base">
                {f.answer}
              </p>
            </div>
          </details>
        ))}
      </div>
    </SectionShell>
  );
}
