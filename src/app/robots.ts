import type { MetadataRoute } from "next";

/**
 * /robots.txt — Next.js Metadata Route.
 *
 * Without this file the request fell through to the /[slug] dynamic route,
 * fired a wasted get_seo_page_render RPC call with p_slug "robots.txt" and
 * returned an HTML 404. Host resolution mirrors the sitemap index route
 * (src/app/sitemap.xml/route.ts → NEXT_PUBLIC_SITE_URL); the domain is not
 * hardcoded a second time.
 */

/** Base site origin without a trailing slash (same rule as the sitemap index). */
function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}

export default function robots(): MetadataRoute.Robots {
  const base = siteBaseUrl();
  return {
    rules: [{ userAgent: "*", allow: "/" }],
    // Omit the Sitemap line rather than emit a relative/broken URL if the
    // env var is missing — same defensive posture as the sitemap routes.
    sitemap: base ? `${base}/sitemap.xml` : undefined,
  };
}
