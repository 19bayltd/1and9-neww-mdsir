import Link from "next/link";
import { type LandingPageData, type InternalLink } from "@/lib/landing";
import { SectionHeading } from "./_shared";

/**
 * Internal Links section. The RPC returns internal_links as an object keyed by
 * link group (e.g. related_products, related_countries). Each group becomes a
 * column of clean anchor links. Renders nothing if there are no links.
 */
export function InternalLinks({ data }: { data: LandingPageData }) {
  const groups = data.internal_links ?? {};
  const entries = Object.entries(groups).filter(
    ([, links]) => Array.isArray(links) && links.length > 0
  );
  if (entries.length === 0) return null;

  const prettyGroup = (key: string) =>
    key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <section className="border-t border-neutral-200 bg-neutral-50">
      <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
        <SectionHeading eyebrow="Explore More">Related Manufacturing Pages</SectionHeading>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([group, links]) => (
            <div key={group}>
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
                {prettyGroup(group)}
              </h3>
              <ul className="space-y-2">
                {(links as InternalLink[]).map((link, i) => (
                  <li key={link.slug ?? i}>
                    <Link
                      href={link.slug ? `/${link.slug}` : "#"}
                      className="text-sm text-neutral-700 underline underline-offset-4 hover:text-neutral-900"
                    >
                      {link.anchor || link.slug}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
