# IronTrack PWA 🏋️‍♂️

IronTrack is an installable, offline-first workout tracker. Plan a weekly training split, log sets
at the gym, and track progress over time. Your data syncs across devices through Supabase.

## Features

- **Workout planner:** an editable weekly microcycle, custom days and sections, custom exercises
  and equipment variations, saved set presets, supersets, and reordering throughout.
- **Session logging:** weight, reps, set tag, and RIR per set, with a rest timer (beeps and
  haptics), session timer, notes, and a progress bar. An in-progress session is saved on the
  device, so it survives a reload or the OS closing the app.
- **History & analytics:** session log, per-exercise history, estimated 1RM trends, volume per
  muscle group, a muscle recovery heatmap, and a shareable stats card.
- **Tools:** TDEE, 1RM, and plate calculators, plus a rest-day and workout-day nutrition plan.
- **Offline-first:** everything works without a connection. Changes sync when you're back online.
- **Multi-device sync:** sign in with email and password, and changes reach your other devices via
  Supabase Realtime.
- **Backup:** export history as JSON or CSV, or export and import a full backup.

## Tech stack

| Layer | Used |
|---|---|
| App | Vanilla HTML, CSS, and JavaScript as ES modules (no framework) |
| Libraries | `@supabase/supabase-js@2`, `canvas-confetti` (loaded from jsDelivr) |
| Local storage | `localStorage` (keys prefixed `iron_`) |
| Backend | Supabase: Auth (email and password), Postgres, Realtime |
| Offline | Service worker (`public/sw.js`) + web app manifest |
| Tooling | Vite (dev server and bundling), Vitest + happy-dom (unit tests) |

## Project structure

```text
irontrack-pwa/
├── index.html                 # Markup and styles; loads src/main.js
├── src/
│   ├── main.js                # Startup, event listeners, service worker registration
│   ├── sync.js                # Supabase client, auth, upload/download, realtime
│   ├── history-merge.js       # Pure workout-history merge (by session id + tombstones)
│   ├── session-draft.js       # In-progress workout draft (survives reloads)
│   ├── model.js               # Workout split built from the catalog + local customizations
│   ├── storage.js             # localStorage helpers, escaping
│   ├── ui.js                  # Toasts, tabs, theme, sounds, full UI refresh
│   ├── data/                  # Built-in exercise catalog and nutrition plans
│   └── render/                # One module per screen or feature
├── tests/                     # Vitest unit tests
├── public/
│   ├── sw.js                  # Service worker: offline caching
│   ├── manifest.webmanifest   # PWA manifest
│   └── *.png, *.svg           # App icons
├── supabase/
│   └── user_sync.sql          # The table, RLS policies, and realtime setup the app uses
└── package.json               # Vite scripts
```

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/dashboard) project

### 1. Set up the database

In the Supabase dashboard, open **SQL Editor** and run `supabase/user_sync.sql`. It:

- creates the `user_sync` table (one row per user), or adds any missing columns to an existing one
- enables Row-Level Security so each signed-in user can only read and write their own row
- adds the table to the `supabase_realtime` publication

The script is idempotent, so it's safe to re-run.

### 2. Enable email sign-in

Under **Authentication → Providers**, enable **Email**. Email and password is the only sign-in
method the app uses. If "Confirm email" is on, new users must confirm their address before signing in.

### 3. Point the app at your project

Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` at the top of `src/sync.js`
(**Project Settings → API**). The anon key is public by design: Row-Level Security protects the
data, so never put the `service_role` key here.

### 4. Run it

```bash
npm install
npm run dev       # dev server
npm run build     # static build into dist/
npm run preview   # serve the build locally
npm test          # unit tests
```

## How it works

### Data and sync

`localStorage` is the source of truth. The app reads and writes it directly, so it works fully
offline. When you're signed in, the data is mirrored to your `user_sync` row:

- **Upload:** every edit marks the data as unsynced and schedules an upload (debounced by 800 ms).
  Before writing, the app reads the cloud row, merges workout history by session ID, and writes only
  if the row hasn't changed since it read it. Otherwise it merges again and retries. Sessions
  logged on two devices while they were out of sync are both kept. Deleted sessions are recorded as
  tombstones so they don't reappear.
- **Download:** the app pulls on startup, on sign-in, on focus, when the app becomes visible, when the
  device comes back online, every 30 seconds, and whenever Realtime reports a change. Unsynced local
  edits are uploaded first, so they're never overwritten.
- **Conflicts:** workout history is merged. All other data (settings, presets, custom exercises) is
  last-write-wins at the row level. Deletions sync too: a key that disappears from the cloud row
  is removed on other devices.
- **Shared devices:** signing out, or signing in as a different user, clears the previous account's
  local data.

### Offline caching

The service worker caches the app shell, icons, and the CDN scripts and fonts on install. The
bundled JavaScript has hashed file names, so after loading, the page sends those URLs to the worker to cache.

- **Page loads:** network-first, falling back to the cached `index.html`.
- **Other assets:** stale-while-revalidate.
- **Supabase requests:** never cached.

When changing a CDN URL in `index.html`, update `CDN_ASSETS` in `public/sw.js` to match. When
changing cached assets, bump `CACHE_NAME` in `public/sw.js`.

## Installing the app

PWA install requires HTTPS (or `localhost`).

- **iOS (Safari):** Share → **Add to Home Screen**
- **Android (Chrome):** menu → **Install app**
- **Desktop (Chrome / Edge):** the install icon in the address bar

## Deployment

The build is a static site, so any static host works (Vercel, Netlify, Cloudflare Pages, GitHub
Pages, …):

- **Build command:** `npm run build`
- **Publish directory:** `dist`
- **Environment variables:** none needed. The Supabase settings live in `src/sync.js`.

Serve the site from the domain root: the service worker and manifest use root-relative paths (`/sw.js`, `/`).

## Code notes

- The markup uses inline `onclick`/`onchange` handlers, so `src/main.js` copies the exported
  functions of the UI-facing modules onto `window`. Any new function called from a handler must
  be exported from one of those modules.
- Modules import each other freely, so don't call another module's functions while a module is
  still loading. Do that work in `init()` in `src/main.js` instead.

## Limitations

- `localStorage` holds about 5 MB per origin. Profile photos are downscaled to 256 px, but a very
  long history can still hit that limit. The app then warns that changes weren't saved, and you
  should export a full backup.
- Each sync uploads the whole data set, so sync payloads grow with your history.

## License

MIT

## Author

Maintained by **[Suman Kumar Raj](https://github.com/SKR18156592)**.
