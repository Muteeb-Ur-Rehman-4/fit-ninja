# Fit Ninja

Free calorie and macro tracker. Scan a barcode (Open Food Facts), log food, and watch the day fill a 3D figure
feet-up: carbs amber, then protein tomato, then fat green. Installable phone PWA and desktop web app.

Stack: Next.js (App Router), React, TypeScript, Tailwind CSS v4, react-three-fiber/three, optional Supabase, hand-written service worker.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production (service worker only registers in production)
npm run lint && npx tsc --noEmit
```

Without any configuration everything is saved on the device (localStorage).

## Figure assets

`public/assets/human.json` and `human-look.json` (about 8 MB, MakeHuman CC0) are loaded lazily and cached by the service worker.
Regenerate from `reference/body-assets` with `node scripts/convert-assets.mjs`. Icons: `node scripts/make-icons.mjs`.

## Optional: accounts and sync (Supabase free tier)

1. Create a project, run [supabase/schema.sql](supabase/schema.sql) in the SQL editor (table plus row level security: users only touch their own row).
2. Authentication → Providers: enable Email and, optionally, Google. Add your site URL to the redirect list.
3. Copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

Sync stores one JSON snapshot per user; the newest of device and cloud wins on sign-in.

## Optional: packaged-food search by name

Open Food Facts blocks browser CORS on text search (barcode lookups work directly). Deploy the tiny proxy:

```bash
npx wrangler deploy worker/off-search-proxy.js --name fit-ninja-off --compatibility-date 2025-01-01
```

Set `NEXT_PUBLIC_OFF_SEARCH_PROXY` to the worker URL.

## Deploy

Any static-friendly host works (Vercel, Cloudflare Pages, Netlify): build command `npm run build`, add the env vars above if used. HTTPS is required for camera and service worker.

## Privacy

No data is sold. Photos for "Match a photo" are read on the device by MediaPipe and never uploaded (the model and wasm are downloaded from a CDN on first use).

## Not verified yet

Camera scanning, real-photo pose matching, Supabase auth/sync, and service-worker install/offline were not exercised (the dev browser blocks camera and service workers, and no keys were available).
