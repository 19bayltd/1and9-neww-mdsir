import { blockByKey, type LandingPageData, type Faq } from "@/lib/landing";
import { SectionHeading } from "./_shared";

/**
 * FAQ section — accessible accordion + FAQPage JSON-LD.
 *
 * Content comes exclusively from the RPC faqs array; no FAQs are invented.
 * The JSON-LD schema uses the actual questions/answers and respects the
 * RPC's `include_in_schema` flag (rows flagged false render on the page but
 * stay out of the structured data). The accordion uses native
 * <details>/<summary>, which is keyboard-accessible without JavaScript.
 */
export function FAQSection({ data }: { data: LandingPageData }) {
  const faqs: Faq[] = (data.faqs ?? []).filter((f) => f.question && f.answer);
  if (faqs.length === 0) return null;

  const block = blockByKey(data.content_blocks, "faq");
  const heading = block?.heading || "Frequently Asked Questions";

  // Only rows the RPC marks for schema inclusion (default true when absent).
  const schemaFaqs = faqs.filter((f) => f.include_in_schema !== false);
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
    <section id="faq" className="border-t border-neutral-200 bg-white">
      {jsonLd ? (
        <script
          type="application/ld+json"
          // Escape "<" so RPC text can never close the script tag early.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
          }}
        />
      ) : null}

      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow="FAQ">{heading}</SectionHeading>
        {block?.body ? (
          <p className="-mt-2 mb-8 text-base leading-relaxed text-neutral-600 sm:text-lg">
            {block.body}
          </p>
        ) : null}

        <div className="overflow-hidden rounded-xl border border-neutral-200">
          {faqs.map((f, i) => (
            <details
              key={i}
              open={i === 0}
              className={`group bg-white ${i > 0 ? "border-t border-neutral-200" : ""}`}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-neutral-50 sm:px-6 [&::-webkit-details-marker]:hidden">
                <h3 className="text-base font-semibold text-neutral-900">{f.question}</h3>
                <span
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-300 text-neutral-500 transition-transform group-open:rotate-45"
                  aria-hidden
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="h-3.5 w-3.5"
                  >
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </span>
              </summary>
              <div className="px-5 pb-5 sm:px-6">
                <p className="max-w-2xl text-base leading-relaxed text-neutral-600">
                  {f.answer}
                </p>
              </div>
            </details>
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
    </section>
  );
}
