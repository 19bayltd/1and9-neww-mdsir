import type { AssignedImage, SectionBlock } from "@/types/seo";
import { getSectionImage } from "@/lib/seo/imageResolver";
import { SectionCopy, SectionCta, SectionImage, SectionShell } from "./shared";

/** Why choose us — trust copy beside the assigned quality image. */
export function WhyChooseUsSection({
  section,
  assignedImages,
}: {
  section: SectionBlock;
  assignedImages: AssignedImage[];
}) {
  const image = getSectionImage("why_choose_us", assignedImages);

  return (
    <SectionShell id="why-choose-us">
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
