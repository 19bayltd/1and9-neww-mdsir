import type { AssignedImage, SectionBlock } from "@/types/seo";
import { getSectionImage } from "@/lib/seo/imageResolver";
import { SectionCopy, SectionCta, SectionImage, SectionShell } from "./shared";

/** Customization options — assigned customization image beside the copy. */
export function CustomizationSection({
  section,
  assignedImages,
}: {
  section: SectionBlock;
  assignedImages: AssignedImage[];
}) {
  const image = getSectionImage("customization_options", assignedImages);

  return (
    <SectionShell id="customization-options" tinted>
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
