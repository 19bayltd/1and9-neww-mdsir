/**
 * SectionShell — the reference layout's body-section frame.
 *
 * Left column: big numbered label ("01", "02" … or a glyph like "?") with a
 * bold uppercase section title. Right column: the section content. Thin top
 * border between sections; white or lightly tinted background. On mobile the
 * label stacks above the content.
 */
export function SectionShell({
  id,
  number,
  title,
  tinted = false,
  children,
}: {
  id: string;
  /** Display marker from DB order — "01", "02" … or "?" for FAQ. Omit to hide. */
  number?: string | null;
  title: string;
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`border-t border-neutral-200 ${tinted ? "bg-neutral-50" : "bg-white"}`}
    >
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-14 sm:py-16 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-12">
        {/* Label column */}
        <div className="flex items-start gap-4 lg:flex-col lg:gap-2">
          {number ? (
            <span
              aria-hidden
              className="font-mono text-5xl font-black leading-none tracking-tight text-[#FFC400] sm:text-6xl"
            >
              {number}
            </span>
          ) : null}
          <h2 className="pt-1 text-sm font-extrabold uppercase leading-snug tracking-wide text-neutral-900">
            {title}
          </h2>
        </div>

        {/* Content column */}
        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}
