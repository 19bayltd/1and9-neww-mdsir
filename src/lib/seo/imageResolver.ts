import type { AssignedImage } from "@/types/seo";

/**
 * Resolve the assigned image for a page section.
 *
 * `assigned_images` is the database-driven image system: each row links an
 * image_library entry (with a section_target like "hero", "factory",
 * "quality", "products", "customization") to the page. Section keys from
 * section_blocks map onto those targets below; sections without a mapping
 * simply render without an image.
 */

/** section_blocks.section_key → image_library.section_target */
const SECTION_TARGET_MAP: Record<string, string> = {
  hero: "hero",
  manufacturing_overview: "factory",
  why_choose_us: "quality",
  related_products: "products",
  customization_options: "customization",
};

export function getSectionImage(
  sectionKey: string,
  assignedImages: AssignedImage[] | null | undefined
): AssignedImage | null {
  if (!assignedImages || assignedImages.length === 0) return null;

  // Unmapped keys fall through to a direct target match so new targets added
  // in the DB (with matching section keys) work without a frontend change.
  const target = SECTION_TARGET_MAP[sectionKey] ?? sectionKey;

  const matches = assignedImages
    .filter(
      (img) =>
        Boolean(img.image_url) &&
        (img.section_target === target || img.section_name === target)
    )
    .sort((a, b) => (a.display_order ?? 999) - (b.display_order ?? 999));

  if (matches.length === 0) return null;

  // The hero slot prefers its designated primary image.
  if (target === "hero") {
    const primary = matches.find((img) => img.is_primary === true);
    if (primary) return primary;
  }

  return matches[0];
}
