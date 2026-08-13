# Memory Gallery — Deployment Checklist

This package keeps the existing Memory Gallery UI and interaction model intact and prepares the project for Supabase + GitHub + Vercel.

## A. Supabase

1. Create a Supabase project.
2. Create a Storage bucket named `memories`.
3. Set the bucket to **Public**.
4. Configure an appropriate upload size limit and image MIME types in the bucket settings.
5. Open SQL Editor and run `supabase-setup.sql`.
6. Confirm `public.memories` is exposed to the Data API.
7. Copy the project URL and **Publishable key**.
8. Put those two values in `supabase-config.js`.

### Database

`public.memories`

- `id` uuid primary key
- `title` text nullable
- `storage_path` text not null
- `created_at` timestamptz not null

Anonymous access:

- SELECT: allowed
- INSERT: allowed
- UPDATE: denied
- DELETE: denied

Storage:

- Public retrieval: enabled by public bucket
- Anonymous INSERT into `memories`: allowed
- Anonymous UPDATE: denied
- Anonymous DELETE: denied

## B. Local verification

Open `index.html` through a local HTTP server rather than relying on `file://` if the browser blocks module/CDN/network behavior.

Verify:

1. Empty gallery loads.
2. Upload one image.
3. Image appears in the grid.
4. Viewer preserves original aspect ratio.
5. Title is optional; empty title produces no caption.
6. Refresh keeps the image.
7. Open the same site on another device and confirm the image appears.
8. Upload a second image from the other device and confirm chronological ordering.

## C. GitHub

Create a repository and push the contents of this folder.

The repository can safely contain the Supabase **Publishable** key because it is a browser key and RLS is the security boundary. Never commit a Supabase Secret/service-role key.

## D. Vercel

Import the GitHub repository into Vercel and deploy it as a static site.

No build command or framework is required.

Recommended settings:

- Framework Preset: Other / static
- Build Command: leave empty
- Output Directory: `.`
- Install Command: leave empty

`vercel.json` is included only for clean URL behavior; there is no application routing requirement.

## E. Important security boundary

This project intentionally allows anonymous public uploads because that is part of the Memory Gallery product requirement. Before treating the site as a hardened public production service, consider adding server-side abuse controls such as authentication, rate limiting, upload quotas, or a Supabase Edge Function. Do not solve this by exposing a Secret/service-role key in the browser.

## F. Current known limitation

The browser upload flow performs two independent operations:

1. upload the image to Storage
2. insert metadata into `public.memories`

If step 2 fails after step 1 succeeds, an orphaned Storage object can remain. The current public RLS model intentionally does not grant anonymous delete, so the browser cannot clean up that orphan itself. A later hardened version can move the write transaction behind a server-side Edge Function if needed.

This limitation does not change the current UI and does not require redesigning the gallery.
