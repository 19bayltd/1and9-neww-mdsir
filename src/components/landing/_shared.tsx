/**
 * Shared presentational primitives for the landing sections.
 * Internal to src/components/landing — not a page-level section itself.
 */

/**
 * DB-driven block CTA — the exact anchor GenericBlock rendered inline before.
 * Shows only when BOTH cta_label and cta_url are present (the DB CHECK
 * enforces the pair, but the renderer stays defensive); otherwise renders
 * nothing, so pages with null CTA columns are pixel-identical to before.
 */
export function BlockCta({
  label,
  url,
}: {
  label?: string | null;
  url?: string | null;
}) {
  if (!label || !url) return null;
  return (
    <a
      href={url}
      className="mt-6 inline-flex items-center text-sm font-bold text-neutral-900 underline underline-offset-4 hover:text-neutral-600"
    >
      {label} →
    </a>
  );
}

/** Split a plain-text body into paragraphs on blank lines / newlines. */
export function Paragraphs({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) {
  if (!text) return null;
  const parts = text
    .split(/\n{1,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (
        <p key={i} className={className}>
          {p}
        </p>
      ))}
    </>
  );
}

export function SectionHeading({
  eyebrow,
  children,
}: {
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {eyebrow ? (
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
          {eyebrow}
        </span>
      ) : null}
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{children}</h2>
    </div>
  );
}
