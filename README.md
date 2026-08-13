# Memory Gallery — Supabase-connected prototype

Pure HTML + CSS + vanilla JavaScript. The existing visual design and interaction model are preserved.

## What changed

The prototype now uses Supabase as the cloud source of truth:

- `public.memories` stores memory metadata.
- The `memories` Storage bucket stores original image files.
- Gallery reads are chronological (`created_at` ascending).
- Uploads are persisted to Storage + Database.
- Original image URLs are used by both the square grid and immersive viewer.
- No delete/update controls or public delete/update policies were added.
- No login/authentication was added.

## 1. Create the Storage bucket

In Supabase Dashboard → Storage → New Bucket:

- Name: `memories`
- Public bucket: **ON**
- Allowed MIME types: `image/*` (or explicitly allow the image formats you want)
- Choose a file-size limit appropriate for the collection; 50 MB is a reasonable starting point for this prototype.

The public bucket is intentional: the gallery is public, and the viewer needs direct access to original images. Upload authorization is still controlled by the Storage RLS policy.

## 2. Create the database + policies

Open Supabase SQL Editor and run:

`supabase-setup.sql`

The resulting table is:

- `id` — uuid, primary key, default `gen_random_uuid()`
- `title` — text, nullable
- `storage_path` — text, required
- `created_at` — timestamptz, default `now()`

The anonymous browser client receives only:

- Database SELECT: allowed
- Database INSERT: allowed
- Database UPDATE: not allowed
- Database DELETE: not allowed
- Storage INSERT into `memories`: allowed
- Storage UPDATE/DELETE: not allowed

## 3. Make sure the table is exposed to the Data API

In Supabase Project Settings → Data API, make sure the `public.memories` table is exposed. The SQL file also grants `SELECT, INSERT` to the `anon` role.

## 4. Add your browser-safe Supabase credentials

Open `supabase-config.js` and replace:

- `YOUR_SUPABASE_PROJECT_URL`
- `YOUR_SUPABASE_PUBLISHABLE_KEY`

Use the project URL and **Publishable key** from the Supabase dashboard. Do **not** put a Secret / `service_role` key in this file.

The project uses the browser CDN build of `@supabase/supabase-js@2`, so no npm install is required.

## 5. Run

Open `index.html`. The gallery should initially be empty. Once a memory is uploaded, it is stored in Supabase and will appear on another device using the same project.

If the credentials are still placeholders, the page intentionally remains usable as an empty prototype and logs the configuration problem to the browser console.

## Existing behavior preserved

- Responsive 3-column gallery
- Square thumbnail crop
- Empty-state presentation
- Liquid-glass + button
- Upload sheet
- Original-ratio immersive viewer
- Blurred same-image viewer background
- Adaptive caption fade
- Shared-element transitions
- Reverse transition
- Pull-to-dismiss at viewer boundaries
- Safe-area/mobile behavior
- Delete control remains hidden
- No mock memories

## Text editing

Open `index.html` and search for:

`✏️ EDIT TEXT`

Every existing marker remains available for quick customization.
