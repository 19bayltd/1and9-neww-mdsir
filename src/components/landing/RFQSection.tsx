"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * RFQ / Instant Quote — styled as a Production Request / Bulk Quote system,
 * not a basic contact form.
 *
 * Submit inserts a row into public.quote_requests via the anon Supabase
 * client (never the service role). The table stores products/countries as
 * entity IDs, not free text, and has no timeline column — so Product,
 * Country, Timeline and Requirements are composed into the `message` field.
 *
 * We intentionally do NOT chain `.select()` — RLS grants `anon` INSERT but
 * no SELECT, so returning the row would fail (42501). Plain insert only.
 *
 * The "Upload Artwork" area is visual-only for now (storage not connected);
 * the form submits fine without it.
 */

type SubmitState = "idle" | "submitting" | "success" | "error";

type FieldErrors = {
  product?: string;
  quantity?: string;
  email?: string;
};

const TIMELINE_OPTIONS = [
  "Flexible",
  "ASAP — rush order",
  "Within 1–2 months",
  "Within 3–6 months",
  "Planning ahead (6+ months)",
];

export function RFQSection({
  sourcePageId,
  sourceSlug,
  heading,
  body,
  ctaLabel,
}: {
  sourcePageId: number | string | null;
  sourceSlug: string | null;
  heading?: string | null;
  body?: string | null;
  ctaLabel?: string | null;
}) {
  const title = heading || "Start a Production Request";
  const intro =
    body ||
    "Send your requirements and our merchandising team replies with pricing and lead time within one business day.";
  const cta = ctaLabel || "Submit Production Request";

  const [values, setValues] = useState({
    product: "",
    quantity: "",
    country: "",
    timeline: "",
    requirements: "",
    company: "",
    email: "",
    phone: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<SubmitState>("idle");

  const update =
    (field: keyof typeof values) =>
    (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
      setValues((v) => ({ ...v, [field]: e.target.value }));
    };

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!values.product.trim()) next.product = "Product is required.";
    if (!values.quantity.trim()) {
      next.quantity = "Quantity is required.";
    } else if (!Number.isInteger(Number(values.quantity)) || Number(values.quantity) <= 0) {
      next.quantity = "Enter a valid quantity.";
    }
    if (!values.email.trim()) next.email = "Email is required.";
    return next;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setState("submitting");

    // Product / Country / Timeline / Requirements are preserved in the
    // message body — the table keys product/country by entity id and has no
    // timeline column, and the schema must not change.
    const composedMessage = [
      `Product: ${values.product.trim()}`,
      `Country: ${values.country.trim() || "—"}`,
      `Timeline: ${values.timeline.trim() || "—"}`,
      values.requirements.trim() ? `\n${values.requirements.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("quote_requests").insert({
      source_page_id: sourcePageId ?? null,
      source_slug: sourceSlug ?? null,
      company_name: values.company.trim() || null,
      email: values.email.trim(),
      phone: values.phone.trim() || null,
      quantity: Number(values.quantity),
      message: composedMessage,
      status: "new",
    });

    if (error) {
      // Log the real database error for debugging; show a generic message.
      console.error("[quote_requests] insert error:", error);
      setState("error");
      return;
    }

    setState("success");
  }

  const inputClass =
    "w-full rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none";
  const labelClass = "mb-1.5 block text-sm font-medium text-neutral-300";
  const errorInputClass = "border-red-400 focus:border-red-400";

  return (
    <section id="rfq" className="border-t border-neutral-200 bg-neutral-900 text-white">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-16">
          {/* ------------------------------------------------------------ */}
          {/* Left rail — what this is and what happens next                */}
          {/* ------------------------------------------------------------ */}
          <div>
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
              Bulk Quote System
            </span>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
            <p className="mt-3 max-w-md text-base leading-relaxed text-neutral-300 sm:text-lg">
              {intro}
            </p>

            <ol className="mt-8 space-y-5">
              {[
                { step: "01", label: "Submit your request", text: "Product, quantity and target timeline." },
                { step: "02", label: "Merchandiser review", text: "A dedicated merchandiser checks feasibility and costs." },
                { step: "03", label: "Quote in 24 hours", text: "Landed pricing with a sampling and production plan." },
              ].map((s) => (
                <li key={s.step} className="flex gap-4">
                  <span className="mt-0.5 shrink-0 font-mono text-sm font-bold text-neutral-500">
                    {s.step}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{s.label}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-neutral-400">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-wrap gap-2">
              {["MOQ from 300 pcs", "DDP shipping", "No obligation"].map((chip) => (
                <span
                  key={chip}
                  className="rounded-full border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-300"
                >
                  {chip}
                </span>
              ))}
            </div>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Right panel — the production request form                     */}
          {/* ------------------------------------------------------------ */}
          <div className="rounded-2xl border border-neutral-700 bg-neutral-800/50 p-6 sm:p-8">
            {state === "success" ? (
              <div role="status" className="flex min-h-[24rem] flex-col items-center justify-center text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-neutral-900">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-7 w-7"
                    aria-hidden
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                </span>
                <p className="mt-5 text-xl font-bold text-white">
                  Quote request received. Our team will contact you shortly.
                </p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">
                  Your request is with our merchandising team — expect a reply within one
                  business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate aria-label="Production request">
                <div className="flex items-center justify-between gap-3 border-b border-neutral-700 pb-4">
                  <p className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
                    Production Request
                  </p>
                  <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-neutral-900">
                    Reply in 24 hrs
                  </span>
                </div>

                {state === "error" ? (
                  <div
                    role="alert"
                    className="mt-5 rounded-md border border-red-400 bg-red-950/40 px-4 py-3 text-sm text-red-200"
                  >
                    Something went wrong. Please try again.
                  </div>
                ) : null}

                {/* Order specs */}
                <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
                  <Field
                    id="product"
                    label="Product"
                    required
                    value={values.product}
                    onChange={update("product")}
                    error={errors.product}
                    inputClass={inputClass}
                    labelClass={labelClass}
                    errorInputClass={errorInputClass}
                    placeholder="e.g. T-shirts, hoodies"
                  />
                  <Field
                    id="quantity"
                    label="Quantity"
                    type="number"
                    required
                    value={values.quantity}
                    onChange={update("quantity")}
                    error={errors.quantity}
                    inputClass={inputClass}
                    labelClass={labelClass}
                    errorInputClass={errorInputClass}
                    placeholder="Total pieces"
                  />
                  <Field
                    id="country"
                    label="Country"
                    value={values.country}
                    onChange={update("country")}
                    inputClass={inputClass}
                    labelClass={labelClass}
                    errorInputClass={errorInputClass}
                    placeholder="Delivery country"
                  />
                  <div>
                    <label htmlFor="rfq-timeline" className={labelClass}>
                      Timeline
                    </label>
                    <select
                      id="rfq-timeline"
                      name="timeline"
                      value={values.timeline}
                      onChange={update("timeline")}
                      className={`${inputClass} appearance-none`}
                    >
                      <option value="" className="bg-neutral-800">
                        Select a timeline
                      </option>
                      {TIMELINE_OPTIONS.map((t) => (
                        <option key={t} value={t} className="bg-neutral-800">
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label htmlFor="rfq-requirements" className={labelClass}>
                      Requirements
                    </label>
                    <textarea
                      id="rfq-requirements"
                      name="requirements"
                      rows={4}
                      value={values.requirements}
                      onChange={update("requirements")}
                      className={inputClass}
                      placeholder="Fabric, GSM, colours, sizes, decoration, packaging — anything from your tech pack."
                    />
                  </div>

                  {/* Upload artwork — visual only, storage not connected yet */}
                  <div className="sm:col-span-2">
                    <span className={labelClass}>Upload Artwork</span>
                    <div
                      aria-disabled="true"
                      className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-600 bg-neutral-800/60 px-4 py-6 text-center"
                    >
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="h-6 w-6 text-neutral-500"
                        aria-hidden
                      >
                        <path d="M12 16V4M7 9l5-5 5 5" />
                        <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
                      </svg>
                      <p className="text-sm font-medium text-neutral-300">
                        Artwork &amp; tech pack upload
                      </p>
                      <p className="text-xs text-neutral-500">
                        Coming soon — for now, describe artwork in Requirements or email it
                        after we reply.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Contact details */}
                <div className="mt-6 border-t border-neutral-700 pt-6">
                  <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-neutral-400">
                    Your Details
                  </p>
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                    <Field
                      id="company"
                      label="Company Name"
                      value={values.company}
                      onChange={update("company")}
                      inputClass={inputClass}
                      labelClass={labelClass}
                      errorInputClass={errorInputClass}
                      placeholder="Your brand or company"
                    />
                    <Field
                      id="email"
                      label="Email"
                      type="email"
                      required
                      value={values.email}
                      onChange={update("email")}
                      error={errors.email}
                      inputClass={inputClass}
                      labelClass={labelClass}
                      errorInputClass={errorInputClass}
                      placeholder="you@company.com"
                    />
                    <Field
                      id="phone"
                      label="Phone"
                      type="tel"
                      value={values.phone}
                      onChange={update("phone")}
                      inputClass={inputClass}
                      labelClass={labelClass}
                      errorInputClass={errorInputClass}
                      placeholder="Include country code"
                    />
                  </div>
                </div>

                <div className="mt-8">
                  <button
                    type="submit"
                    disabled={state === "submitting"}
                    className="inline-flex w-full items-center justify-center rounded-md bg-white px-6 py-3.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {state === "submitting" ? "Submitting…" : cta}
                  </button>
                  <p className="mt-3 text-center text-xs text-neutral-500">
                    Reviewed by a merchandiser — not a bot. No spam, no obligation.
                  </p>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  required = false,
  error,
  inputClass,
  labelClass,
  errorInputClass,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  required?: boolean;
  error?: string;
  inputClass: string;
  labelClass: string;
  errorInputClass: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label htmlFor={`rfq-${id}`} className={labelClass}>
        {label}
        {required ? <span className="ml-0.5 text-red-400">*</span> : null}
      </label>
      <input
        id={`rfq-${id}`}
        name={id}
        type={type}
        value={value}
        onChange={onChange}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `rfq-${id}-error` : undefined}
        className={`${inputClass} ${error ? errorInputClass : ""}`}
        placeholder={placeholder ?? `Your ${label.toLowerCase()}`}
      />
      {error ? (
        <p id={`rfq-${id}-error`} className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
