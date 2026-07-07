import Link from "next/link";

/**
 * Placeholder home page.
 *
 * The real product is the dynamic PSEO route at /[slug]. This index just
 * points to a few sample landing pages during Step 1–6 development.
 */

const SAMPLE_PAGES = [
  { slug: "custom-t-shirt-manufacturer-usa", label: "Custom T-Shirt Manufacturer USA" },
  { slug: "custom-hoodie-manufacturer-usa", label: "Custom Hoodie Manufacturer USA" },
  { slug: "t-shirt-manufacturer-canada", label: "T-Shirt Manufacturer Canada" },
  { slug: "t-shirt-manufacturer-australia", label: "T-Shirt Manufacturer Australia" },
  { slug: "private-label-t-shirt-manufacturer", label: "Private Label T-Shirt Manufacturer" },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-neutral-500">
        1 &amp; 9 Apparel
      </span>
      <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
        PSEO Landing Pages
      </h1>
      <p className="mt-4 text-base leading-relaxed text-neutral-600">
        Bangladesh-based B2B custom apparel manufacturer. Every landing page below is
        rendered dynamically from Supabase — no page content is hardcoded.
      </p>
      <ul className="mt-8 divide-y divide-neutral-200 border-y border-neutral-200">
        {SAMPLE_PAGES.map((p) => (
          <li key={p.slug}>
            <Link
              href={`/${p.slug}`}
              className="flex items-center justify-between py-4 text-neutral-900 hover:text-neutral-600"
            >
              <span className="font-medium">{p.label}</span>
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
