import { blockByKey, type LandingPageData } from "@/lib/landing";

/**
 * RFQ / Instant Quote section.
 *
 * Visual-only for now — the form is not wired to any database insert. Fields:
 * Product, Quantity, Country, Company Name, Email, Phone, Message. Heading /
 * body / CTA label come from the "rfq" content block when present.
 */
export function RFQSection({ data }: { data: LandingPageData }) {
  const block = blockByKey(data.content_blocks, "rfq");
  const heading = block?.heading || "Request an Instant Quote";
  const body =
    block?.body ||
    "Send your requirements and our merchandising team replies with pricing and lead time within one business day.";
  const cta = block?.cta_label || "Request Bulk Quote";

  const fields: { name: string; label: string; type?: string; full?: boolean }[] = [
    { name: "product", label: "Product" },
    { name: "quantity", label: "Quantity", type: "number" },
    { name: "country", label: "Country" },
    { name: "company", label: "Company Name" },
    { name: "email", label: "Email", type: "email" },
    { name: "phone", label: "Phone", type: "tel" },
    { name: "message", label: "Message", full: true },
  ];

  return (
    <section id="rfq" className="border-t border-neutral-200 bg-neutral-900 text-white">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Instant Quote
        </span>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{heading}</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">
          {body}
        </p>

        {/* Visual-only RFQ form — submission is not wired up yet. */}
        <form
          className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2"
          aria-label="Request for quote"
        >
          {fields.map((f) => (
            <div key={f.name} className={f.full ? "sm:col-span-2" : undefined}>
              <label
                htmlFor={`rfq-${f.name}`}
                className="mb-1.5 block text-sm font-medium text-neutral-300"
              >
                {f.label}
              </label>
              {f.full ? (
                <textarea
                  id={`rfq-${f.name}`}
                  name={f.name}
                  rows={4}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none"
                  placeholder={`Your ${f.label.toLowerCase()}`}
                />
              ) : (
                <input
                  id={`rfq-${f.name}`}
                  name={f.name}
                  type={f.type ?? "text"}
                  className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none"
                  placeholder={`Your ${f.label.toLowerCase()}`}
                />
              )}
            </div>
          ))}

          <div className="sm:col-span-2">
            <button
              type="submit"
              disabled
              className="inline-flex w-full items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
            >
              {cta}
            </button>
            <p className="mt-3 text-xs text-neutral-500">
              Form preview only — quote submission is connected in a later step.
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
