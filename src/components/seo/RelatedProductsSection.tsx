import type { AssignedImage, SectionBlock } from "@/types/seo";
import { getSectionImage } from "@/lib/seo/imageResolver";
import { SectionCopy, SectionCta, SectionImage, SectionShell } from "./shared";

/** Related products — RPC copy beside the assigned products image. */
export function RelatedProductsSection({
  section,
  assignedImages,
}: {
  section: SectionBlock;
  assignedImages: AssignedImage[];
}) {
  const image = getSectionImage("related_products", assignedImages);

  return (
    <SectionShell id="related-products" tinted>
      <div
        className={`grid items-center gap-10 ${image ? "lg:grid-cols-2 lg:gap-16" : ""}`}
      >
        <SectionImage image={image} className="order-last lg:order-first" />
        <div>
          <SectionCopy block={section} />
          <div className="mt-8">
            <SectionCta block={section} />
          </div>
        </div>
      </div>
    </SectionShell>
  );
}
