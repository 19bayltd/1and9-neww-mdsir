import { blockByKey, type LandingPageData, type Faq } from "@/lib/landing";
import { SectionHeading } from "./_shared";

/**
 * FAQ section. Renders the faqs array (question / answer) from the RPC as a
 * native <details> accordion. Renders nothing if there are no usable FAQs.
 */
export function FAQSection({ data }: { data: LandingPageData }) {
  const faqs: Faq[] = (data.faqs ?? []).filter((f) => f.question && f.answer);
  if (faqs.length === 0) return null;

  const block = blockByKey(data.content_blocks, "faq");
  const heading = block?.heading || "Frequently Asked Questions";

  return (
    <section id="faq" className="border-t border-neutral-200 bg-white">
      <div className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow="FAQ">{heading}</SectionHeading>
        <dl className="divide-y divide-neutral-200 border-t border-neutral-200">
          {faqs.map((f, i) => (
            <details key={i} className="group py-5" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
                <dt className="text-base font-semibold text-neutral-900">{f.question}</dt>
                <span className="mt-1 shrink-0 text-neutral-400 transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <dd className="mt-3 text-base leading-relaxed text-neutral-600">{f.answer}</dd>
            </details>
          ))}
        </dl>
      </div>
    </section>
  );
}
