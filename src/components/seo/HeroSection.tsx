import Image from "next/image";
import type { AssignedImage, SectionBlock, SeoPage } from "@/types/seo";
import { getSectionImage } from "@/lib/seo/imageResolver";
import { Paragraphs, SectionCta } from "./shared";

/**
 * Hero — full-width dark band. H1 comes from the hero block (falling back to
 * the page's h1/title), body and CTA from the block, and the backdrop image
 * from assigned_images (primary hero image preferred by the resolver).
 */
export function HeroSection({
  section,
  page,
  assignedImages,
}: {
  section: SectionBlock;
  page: SeoPage;
  assignedImages: AssignedImage[];
}) {
  const heading = section.heading || section.title || page.h1 || page.title;
  const image = getSectionImage("hero", assignedImages);

  return (
    <section id="hero" className="relative overflow-hidden bg-neutral-950 text-white">
      {image?.image_url ? (
        <>
          <Image
            src={image.image_url}
            alt={image.alt ?? ""}
            fill
            priority
            sizes="100vw"
            className="pointer-events-none object-cover opacity-30"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-neutral-950/30"
          />
        </>
      ) : null}

      <div className="relative mx-auto max-w-6xl px-6 py-24 sm:py-32">
        {heading ? (
          <h1 className="max-w-4xl text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
            {heading}
          </h1>
        ) : null}

        {section.body ? (
          <div className="mt-6 max-w-2xl space-y-4 text-lg leading-relaxed text-neutral-300">
            <Paragraphs text={section.body} />
          </div>
        ) : null}

        <div className="mt-10">
          <SectionCta block={section} variant="light" />
        </div>
      </div>
    </section>
  );
}
