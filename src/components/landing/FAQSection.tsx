import { blockByKey, type LandingPageData, type Faq } from "@/lib/landing";

/**
 * FAQ — two-column accessible accordion + FAQPage JSON-LD, rendered inside
 * the page's SectionShell.
 *
 * Content comes exclusively from the RPC faqs array; no FAQs are invented.
 * The JSON-LD schema uses the actual questions/answers and respects the
 * RPC's `include_in_schema` flag (rows flagged false render on the page but
 * stay out of the structured data). Native <details>/<summary> keeps the
 * accordion keyboard-accessible without JavaScript.
 *
 * Deliberate: this section has no CTA slot by design — the faq block's
 * cta_label/cta_url are not rendered here (the section closes with the
 * fixed "ask it in your quote request" link to #rfq instead).
 */
export function FAQSection({ data }: { data: LandingPageData }) {
  const faqs: Faq[] = (data.faqs ?? []).filter((f) => f.question && f.answer);
  if (faqs.length === 0) return null;

  const block = blockByKey(data.content_blocks, "faq");

  // Only rows the RPC explicitly marks for schema inclusion.
  const schemaFaqs = faqs.filter((f) => f.include_in_schema === true);
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

  // Split into two columns for the reference's side-by-side accordion.
  const mid = Math.ceil(faqs.length / 2);
  const columns = [faqs.slice(0, mid), faqs.slice(mid)].filter((c) => c.length > 0);

  return (
    <div>
      {jsonLd ? (
        <script
          type="application/ld+json"
          // Escape "<" so RPC text can never close the script tag early.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      {block?.body ? (
        <p className="mb-6 max-w-3xl text-base leading-relaxed text-neutral-600 sm:text-lg">
          {block.body}
        </p>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-2 lg:gap-4">
        {columns.map((column, ci) => (
          <div key={ci} className="space-y-3">
            {column.map((f, i) => (
              <details
                key={i}
                open={ci === 0 && i === 0}
                className="group rounded-xl border border-[#E5E5E5] bg-white shadow-sm"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-neutral-50 [&::-webkit-details-marker]:hidden">
                  <h3 className="text-sm font-bold text-neutral-900 sm:text-base">
                    {f.question}
                  </h3>
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center text-[#FFC400] transition-transform group-open:rotate-45"
                    aria-hidden
                  >
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      className="h-4 w-4"
                    >
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                  </span>
                </summary>
                <div className="px-5 pb-5">
                  <p className="text-sm leading-relaxed text-neutral-600 sm:text-base">
                    {f.answer}
                  </p>
                </div>
              </details>
            ))}
          </div>
        ))}
      </div>

      <p className="mt-6 text-sm text-neutral-500">
        Still have a question?{" "}
        <a
          href="#rfq"
          className="font-semibold text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
        >
          Ask it in your quote request
        </a>
        .
      </p>
    </div>
  );
}
