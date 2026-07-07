import { supabase } from "@/lib/supabase";

/**
 * /sitemaps/<group>.xml — per-group URL sitemap.
 *
 * e.g. /sitemaps/manufacturer.xml resolves to sitemap_group = "manufacturer".
 *
 * The `get_sitemap_pages` RPC returns ALL published, indexable pages across
 * every group (draft/noindex pages are already excluded server-side), so we
 * filter to the requested group in code. Groups are not hardcoded — any group
 * that has at least one URL renders; unknown/empty groups return 404.
 */

// Render on demand — reflects live published data, not build time.
export const dynamic = "force-dynamic";

type SitemapPageRow = {
  slug?: string | null;
  canonical_url?: string | null;
  page_type?: string | null;
  sitemap_group?: string | null;
  updated_at?: string | null;
  priority_score?: number | null;
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

/** Only allow absolute http(s) URLs — drops null / relative / broken canonicals. */
function isValidLoc(url?: string | null): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/** Normalise a timestamp to a W3C/ISO <lastmod> value, or null if unusable. */
function toLastmod(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ group: string }> }
) {
  const { group } = await params;
  const sitemapGroup = decodeURIComponent(group).replace(/\.xml$/i, "");

  const { data, error } = await supabase.rpc("get_sitemap_pages");

  if (error) {
    console.error(`[get_sitemap_pages] RPC error for group "${sitemapGroup}":`, error);
    return new Response("Sitemap temporarily unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const rows = (Array.isArray(data) ? (data as SitemapPageRow[]) : [])
    .filter((r) => r.sitemap_group === sitemapGroup)
    .filter((r) => isValidLoc(r.canonical_url));

  // Unknown group or a group with no indexable URLs → 404.
  if (rows.length === 0) {
    return new Response("Sitemap not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const urls = rows
    .map((row) => {
      const loc = escapeXml(row.canonical_url as string);
      const lastmod = toLastmod(row.updated_at);
      const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : "";
      return `  <url>\n    <loc>${loc}</loc>${lastmodTag}\n  </url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}
