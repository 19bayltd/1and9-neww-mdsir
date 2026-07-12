"use client";

import Link from "next/link";

/**
 * Error boundary for the dynamic SEO landing route.
 *
 * The page component throws on RPC failure (SEO_RENDER_UPSTREAM_UNAVAILABLE)
 * so the response carries a real 5xx status for crawlers instead of a
 * cacheable 200. This boundary renders the same "503 · Service Unavailable"
 * visual the route showed before — markup and Tailwind classes unchanged.
 */
export default function LandingPageError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 text-neutral-900">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-400">
          503 · Service Unavailable
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Landing page data is temporarily unavailable.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-neutral-600">
          We couldn&apos;t load this page right now. Please try again in a few moments.
        </p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center justify-center rounded-md border border-neutral-300 px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:border-neutral-900"
        >
          Return home
        </Link>
      </div>
    </main>
  );
}
