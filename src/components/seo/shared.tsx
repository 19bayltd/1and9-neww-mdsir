import Image from "next/image";
import type { AssignedImage, SectionBlock } from "@/types/seo";

/**
 * Shared presentational primitives for the SEO sections.
 * Internal to src/components/seo — not page-level sections themselves.
 */

/** Split a plain-text body into paragraphs on newlines. */
export function Paragraphs({
  text,
  className,
}: {
  text?: string | null;
  className?: string;
}) {
  if (!text) return null;
  const parts = text
    .split(/\n+/)
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

/** Standard white section frame: top hairline, centered container. */
export function SectionShell({
  id,
  tinted = false,
  children,
}: {
  id: string;
  tinted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      className={`border-t border-neutral-200 ${tinted ? "bg-neutral-50" : "bg-white"}`}
    >
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">{children}</div>
    </section>
  );
}

/** Section heading + body, straight from the RPC block. Renders nothing it doesn't have. */
export function SectionCopy({
  block,
  center = false,
}: {
  block: SectionBlock;
  center?: boolean;
}) {
  const heading = block.heading || block.title;
  if (!heading && !block.body) return null;
  return (
    <div className={center ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      {heading ? (
        <h2 className="text-2xl font-semibold tracking-tight text-neutral-950 sm:text-3xl">
          {heading}
        </h2>
      ) : null}
      {block.body ? (
        <div className="mt-4 space-y-4 text-base leading-relaxed text-neutral-600 sm:text-lg">
          <Paragraphs text={block.body} />
        </div>
      ) : null}
    </div>
  );
}

/** CTA button driven entirely by the block's cta_label + cta_url. */
export function SectionCta({
  block,
  variant = "dark",
  className = "",
}: {
  block: SectionBlock;
  variant?: "dark" | "light";
  className?: string;
}) {
  if (!block.cta_label || !block.cta_url) return null;
  const styles =
    variant === "dark"
      ? "bg-neutral-950 text-white hover:bg-neutral-800"
      : "bg-white text-neutral-950 hover:bg-neutral-200";
  return (
    <a
      href={block.cta_url}
      className={`inline-flex items-center justify-center rounded-md px-6 py-3 text-sm font-semibold tracking-wide transition-colors ${styles} ${className}`}
    >
      {block.cta_label}
      <span aria-hidden className="ml-2">
        →
      </span>
    </a>
  );
}

/** Assigned image rendered as a clean card via next/image. Null-safe. */
export function SectionImage({
  image,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority = false,
  className = "",
}: {
  image: AssignedImage | null;
  sizes?: string;
  priority?: boolean;
  className?: string;
}) {
  if (!image?.image_url) return null;
  return (
    <div
      className={`relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-neutral-100 ring-1 ring-neutral-200 ${className}`}
    >
      <Image
        src={image.image_url}
        alt={image.alt ?? ""}
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
