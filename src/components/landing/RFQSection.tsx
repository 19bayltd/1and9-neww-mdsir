"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

/**
 * RFQ / Instant Quote section with a real submit.
 *
 * On submit it inserts a row into the public `quote_requests` table using the
 * anon Supabase client (never the service role). The table stores products and
 * countries as entity IDs, not free text, so the buyer's typed Product and
 * Country are preserved inside the `message` field.
 *
 * Note: we intentionally do NOT chain `.select()` — the table's RLS grants
 * `anon` INSERT but no SELECT, so returning the inserted row would be blocked
 * (Postgres 42501). A plain insert (`return=minimal`) is what the policy allows.
 */

type SubmitState = "idle" | "submitting" | "success" | "error";

type FieldErrors = {
  product?: string;
  quantity?: string;
  email?: string;
};

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
  const title = heading || "Request an Instant Quote";
  const intro =
    body ||
    "Send your requirements and our merchandising team replies with pricing and lead time within one business day.";
  const cta = ctaLabel || "Request Bulk Quote";

  const [values, setValues] = useState({
    product: "",
    quantity: "",
    country: "",
    company: "",
    email: "",
    phone: "",
    message: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [state, setState] = useState<SubmitState>("idle");

  const update =
    (field: keyof typeof values) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    // Free-text product/country are preserved in the message body since the
    // table keys them by entity id, not text.
    const composedMessage = [
      `Product: ${values.product.trim()}`,
      `Country: ${values.country.trim() || "—"}`,
      values.message.trim() ? `\n${values.message.trim()}` : "",
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
  const errorInputClass = "border-red-400 focus:border-red-400";

  return (
    <section id="rfq" className="border-t border-neutral-200 bg-neutral-900 text-white">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-400">
          Instant Quote
        </span>
        <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
        <p className="mt-3 max-w-2xl text-base leading-relaxed text-neutral-300 sm:text-lg">
          {intro}
        </p>

        {state === "success" ? (
          <div
            role="status"
            className="mt-10 rounded-lg border border-neutral-700 bg-neutral-800 p-8 text-center"
          >
            <p className="text-lg font-semibold text-white">
              Quote request received. Our team will contact you shortly.
            </p>
          </div>
        ) : (
          <form className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={handleSubmit} noValidate>
            {state === "error" ? (
              <div
                role="alert"
                className="sm:col-span-2 rounded-md border border-red-400 bg-red-950/40 px-4 py-3 text-sm text-red-200"
              >
                Something went wrong. Please try again.
              </div>
            ) : null}

            <Field
              id="product"
              label="Product"
              required
              value={values.product}
              onChange={update("product")}
              error={errors.product}
              inputClass={inputClass}
              errorInputClass={errorInputClass}
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
              errorInputClass={errorInputClass}
            />
            <Field
              id="country"
              label="Country"
              value={values.country}
              onChange={update("country")}
              inputClass={inputClass}
              errorInputClass={errorInputClass}
            />
            <Field
              id="company"
              label="Company Name"
              value={values.company}
              onChange={update("company")}
              inputClass={inputClass}
              errorInputClass={errorInputClass}
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
              errorInputClass={errorInputClass}
            />
            <Field
              id="phone"
              label="Phone"
              type="tel"
              value={values.phone}
              onChange={update("phone")}
              inputClass={inputClass}
              errorInputClass={errorInputClass}
            />

            <div className="sm:col-span-2">
              <label htmlFor="rfq-message" className="mb-1.5 block text-sm font-medium text-neutral-300">
                Message
              </label>
              <textarea
                id="rfq-message"
                name="message"
                rows={4}
                value={values.message}
                onChange={update("message")}
                className={inputClass}
                placeholder="Tell us about your order — sizes, colours, decoration, target date."
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={state === "submitting"}
                className="inline-flex w-full items-center justify-center rounded-md bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto"
              >
                {state === "submitting" ? "Submitting…" : cta}
              </button>
            </div>
          </form>
        )}
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
  errorInputClass,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  required?: boolean;
  error?: string;
  inputClass: string;
  errorInputClass: string;
}) {
  return (
    <div>
      <label htmlFor={`rfq-${id}`} className="mb-1.5 block text-sm font-medium text-neutral-300">
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
        placeholder={`Your ${label.toLowerCase()}`}
      />
      {error ? (
        <p id={`rfq-${id}-error`} className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
