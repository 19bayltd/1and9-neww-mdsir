/**
 * Shared presentational primitives for the landing sections.
 * Internal to src/components/landing — not a page-level section itself.
 */

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
