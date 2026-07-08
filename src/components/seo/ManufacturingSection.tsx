import type { AssignedImage, SectionBlock } from "@/types/seo";
import { getSectionImage } from "@/lib/seo/imageResolver";
import { SectionCopy, SectionCta, SectionImage, SectionShell } from "./shared";

/** Manufacturing overview — copy beside the assigned factory image. */
export function ManufacturingSection({
  section,
  assignedImages,
}: {
  section: SectionBlock;
  assignedImages: AssignedImage[];
}) {
  const image = getSectionImage("manufacturing_overview", assignedImages);

  return (
    <SectionShell id="manufacturing-overview">
      <div
        className={`grid items-center gap-10 ${image ? "lg:grid-cols-2 lg:gap-16" : ""}`}
      >
        <div>
          <SectionCopy block={section} />
          <div className="mt-8">
            <SectionCta block={section} />
          </div>
        </div>
        <SectionImage image={image} />
      </div>
    </SectionShell>
  );
}
