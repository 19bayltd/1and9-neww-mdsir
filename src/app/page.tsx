import Link from "next/link";
import { supabase } from "@/lib/supabase";

/**
 * Index page — lists published SEO landing pages straight from the database.
 * The real product is the dynamic route at /[slug]; nothing here is hardcoded.
 */

// Render on demand so newly published pages appear without a rebuild.
export const dynamic = "force-dynamic";

type PageLink = { slug: string; title: string | null };

async function getPublishedPages(): Promise<PageLink[]> {
  const { data, error } = await supabase
    .from("seo_pages")
    .select("slug, title")
    .eq("status", "published")
    .order("id");

  if (error) {
    console.error("[seo_pages] list error:", error);
    return [];
  }
  return (data ?? []).filter((p): p is PageLink => Boolean(p.slug));
}

export default async function Home() {
  const pages = await getPublishedPages();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        1 &amp; 9 Apparel
      </span>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        Custom Apparel Manufacturing
      </h1>
      <p className="mt-4 text-base leading-relaxed text-neutral-600">
        B2B custom apparel manufacturer. Every page below is rendered dynamically from
        the database — no page content is hardcoded.
      </p>
      {pages.length > 0 ? (
        <ul className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
          {pages.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/${p.slug}`}
                className="flex items-center justify-between py-4 text-neutral-950 hover:text-neutral-600"
              >
                <span className="font-medium">{p.title || p.slug}</span>
                <span aria-hidden>→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
