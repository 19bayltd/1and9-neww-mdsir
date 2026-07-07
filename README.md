# 1 & 9 Apparel — PSEO Frontend

Next.js frontend that renders programmatic-SEO (PSEO) landing pages for
**1 & 9 Apparel**, a Bangladesh-based B2B custom apparel manufacturer.

All landing-page content is fetched at request time from a Supabase RPC
(`get_landing_page_view`). **No page content is hardcoded** — the frontend only
knows the section order and layout.

## Stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- `@supabase/supabase-js`
- ESLint, `src/` directory

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in real values
npm run dev
```

Environment variables (`.env.local`, git-ignored):

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon / publishable key (never the service-role key) |
| `NEXT_PUBLIC_SITE_URL` | Canonical site origin |

## How it works

`src/app/[slug]/page.tsx` is the dynamic landing route. For a URL like
`/custom-t-shirt-manufacturer-usa` it calls:

```ts
supabase.rpc("get_landing_page_view", { page_slug: slug })
```

and renders these sections in order, each mapped to a content block key:

Hero · Intro · Manufacturing Overview · Customization Options · Why 1 & 9 Apparel ·
Production Process · Buyer Solutions · Related Products · RFQ / Instant Quote · FAQ

Error handling:

- RPC error → 503-style UI ("Landing page data is temporarily unavailable."),
  real error logged to the server console.
- No page found → `notFound()` (404).

## Key files

- `src/lib/supabase.ts` — Supabase client (anon key, env-validated)
- `src/lib/landing.ts` — defensive RPC types + fetch helper
- `src/app/[slug]/page.tsx` — dynamic landing page + all sections

## Test locally

```bash
npm run dev
```

Open http://localhost:3000/custom-t-shirt-manufacturer-usa
