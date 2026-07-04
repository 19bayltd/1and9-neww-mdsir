import { supabase } from "@/lib/supabase";

/**
 * /sitemap.xml — sitemap index.
 *
 * Lists one <sitemap> entry per group returned by the deterministic Supabase
 * RPC `get_sitemap_index`. Groups are NOT hardcoded — whatever the RPC returns
 * is what we emit. The individual sitemap group files (/sitemaps/*.xml) are a
 * later step; this route only builds the index that points at them.
 */

// Render on demand — the index reflects live published data, not build time.
export const dynamic = "force-dynamic";

type SitemapIndexRow = {
  sitemap_group?: string | null;
  url_count?: number | null;
  latest_updated_at?: string | null;
  sitemap_path?: string | null;
};

/** Escape the five XML predefined entities so values are safe inside markup. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Base site origin without a trailing slash (sitemap_path already starts with "/"). */
function siteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
}

/** Normalise a timestamp to a W3C/ISO <lastmod> value, or null if unusable. */
function toLastmod(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET() {
  const { data, error } = await supabase.rpc("get_sitemap_index");

  if (error) {
    console.error("[get_sitemap_index] RPC error:", error);
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const base = siteBaseUrl();
  const rows = (Array.isArray(data) ? (data as SitemapIndexRow[]) : []).filter(
    (r) => r.sitemap_path
  );

  const entries = rows
    .map((row) => {
      const loc = escapeXml(`${base}${row.sitemap_path}`);
      const lastmod = toLastmod(row.latest_updated_at);
      const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
      return `  <sitemap>\n    <loc>${loc}</loc>${lastmodTag}\n  </sitemap>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</sitemapindex>
`;

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
