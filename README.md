This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Tobermory POI Seed Import

The repo includes a one-time OpenStreetMap/Overpass importer for seeding Tobermory-area points of interest into the existing admin POI tables.

Dry-run first:

```bash
npm run import:pois:osm -- --category activity,viewpoint --limit 20
```

Review same-name multi-location candidates and export the full normalized set:

```bash
npm run import:pois:osm -- --category food --review-same-name --export-json tmp/food-review.json
```

Persist records only after reviewing the dry-run output:

```bash
npm run import:pois:osm -- --category activity,food,accommodation,logistics,viewpoint --write
```

Notes:

- Default search center is Tobermory at `45.25,-81.67` with a `25000` meter radius.
- Imported records are created as unpublished drafts.
- Re-runs skip records whose `source` already matches the OSM provenance value, such as `osm:node:7383274488`.
- `--review-same-name` reports records that share the same name so you can inspect address and coordinate differences before importing.
- `--export-json` writes the normalized candidate set plus the same-name review groups to a JSON file for inspection outside the terminal.
- Write mode requires `NEXT_PUBLIC_SUPABASE_URL` plus either `SUPABASE_SECRET_KEY` or `SUPABASE_SERVICE_ROLE_KEY` in the environment.
- Supported categories are `activity`, `food`, `accommodation`, `logistics`, and `viewpoint`.

## Supabase Media Storage

- The admin POI image flow uses a public Supabase Storage bucket named `poi-media`.
- Applying the migrations in `supabase/migrations/` provisions the bucket, reasserts its object policies, and repairs the repo-managed Security Advisor findings for `public.current_user_role()` and `public.poi_admin_view`.
- The remaining Security Advisor findings tied to PostGIS objects in the `public` schema, including `public.spatial_ref_sys`, are not fixable through a normal project migration once the extension owns those objects.
- Supabase documents the `postgis in public` cleanup as a separate maintenance or support-assisted backup-and-migrate operation, rather than a lightweight application migration.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
