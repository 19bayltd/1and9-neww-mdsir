"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import type { SectionBlock, SeoPage } from "@/types/seo";
import { Paragraphs } from "./shared";

/**
 * RFQ — dark quote panel. Heading, body and button label come from the RPC
 * block; the form itself is generic product UI (field labels, not SEO copy).
 *
 * Submit inserts a row into public.quote_requests via the anon Supabase
 * client. Product / Country / extra requirements are composed into the
 * `message` field (the table has no columns for them as free text). We do NOT
 * chain `.select()` — RLS grants anon INSERT but no SELECT.
 */

type SubmitState = "idle" | "submitting" | "success" | "error";

type FieldErrors = {
  product?: string;
  quantity?: string;
  email?: string;
};

export function RFQSection({
  section,
  page,
}: {
  section: SectionBlock;
  page: SeoPage;
}) {
  const [values, setValues] = useState({
    product: "",
    quantity: "",
    country: "",
    requirements: "",
    company: "",
    email: "",
    phone: "",
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

    const composedMessage = [
      `Product: ${values.product.trim()}`,
      `Country: ${values.country.trim() || "—"}`,
      values.requirements.trim() ? `\n${values.requirements.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { error } = await supabase.from("quote_requests").insert({
      source_page_id: page.id ?? null,
      source_slug: page.slug ?? null,
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
    "w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-sm text-white placeholder-neutral-500 focus:border-white focus:outline-none";
  const labelClass = "mb-1.5 block text-sm font-medium text-neutral-300";
  const errorInputClass = "border-red-400 focus:border-red-400";

  return (
    <section id="rfq" className="border-t border-neutral-200 bg-neutral-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          {/* Copy column — RPC content only */}
          <div>
            {section.heading || section.title ? (
              <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {section.heading || section.title}
              </h2>
            ) : null}
            {section.body ? (
              <div className="mt-4 space-y-4 text-base leading-relaxed text-neutral-300 sm:text-lg">
                <Paragraphs text={section.body} />
              </div>
            ) : null}
          </div>

          {/* Form column */}
          <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-6 sm:p-8">
            {state === "success" ? (
              <div
                role="status"
                className="flex min-h-[20rem] flex-col items-center justify-center text-center"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-neutral-950">
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
                <p className="mt-5 text-xl font-semibold">Quote request received.</p>
                <p className="mt-2 max-w-sm text-sm leading-relaxed text-neutral-400">
                  Your request is with our merchandising team — expect a reply within one
                  business day.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate aria-label="Request a quote">
                {state === "error" ? (
                  <div
                    role="alert"
                    className="mb-5 rounded-md border border-red-400 bg-red-950/40 px-4 py-3 text-sm text-red-200"
                  >
                    Something went wrong. Please try again.
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
                  />
                  <Field
                    id="quantity"
                    label="Quantity (pcs)"
                    type="number"
                    required
                    value={values.quantity}
                    onChange={update("quantity")}
                    error={errors.quantity}
                    inputClass={inputClass}
                    labelClass={labelClass}
                    errorInputClass={errorInputClass}
                  />
                  <Field
                    id="country"
                    label="Country"
                    value={values.country}
                    onChange={update("country")}
                    inputClass={inputClass}
                    labelClass={labelClass}
                    errorInputClass={errorInputClass}
                  />
                  <Field
                    id="company"
                    label="Company"
                    value={values.company}
                    onChange={update("company")}
                    inputClass={inputClass}
                    labelClass={labelClass}
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
                    labelClass={labelClass}
                    errorInputClass={errorInputClass}
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
                  />
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
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={state === "submitting"}
                  className="mt-7 inline-flex w-full items-center justify-center rounded-md bg-white px-6 py-3.5 text-sm font-semibold tracking-wide text-neutral-950 transition-colors hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {state === "submitting"
                    ? "Submitting…"
                    : section.cta_label || "Request a Quote"}
                </button>
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
}: {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  error?: string;
  inputClass: string;
  labelClass: string;
  errorInputClass: string;
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
      />
      {error ? (
        <p id={`rfq-${id}-error`} className="mt-1.5 text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
