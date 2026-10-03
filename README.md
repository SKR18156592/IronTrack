# IronTrack PWA 🏋️‍♂️

IronTrack is an installable, offline-first workout tracker. Plan a weekly training split, log sets
at the gym, and track progress over time. Your data syncs across devices through Supabase.

## Features

- **Workout planner:** an editable weekly microcycle, custom days and sections, custom exercises
  and equipment variations, saved set presets, supersets, and reordering throughout.
- **Session logging:** weight, reps, set tag, and RIR per set, with a rest timer (beeps and
  haptics), session timer, notes, and a progress bar. One exercise is open at a time and the next
  opens when you finish it. Each set shows what you did last time on the same equipment, and
  beating it earns a "↑" or "PR" badge. An in-progress session is saved on the
  device, so it survives a reload or the OS closing the app.
- **History & analytics:** session log, per-exercise history, estimated 1RM trends, volume per
  muscle group, a muscle recovery heatmap, and a shareable stats card.
- **Nutrition:** daily calorie and macro targets from your profile, activity level and goal (lose,
  maintain or gain, at a chosen rate), with a little more on workout days. Today's plan follows your
  schedule, and the example meal plan scales its portions to your targets. A daily log tracks food
  (from the food list, or a whole planned meal at once), water and body weight against those targets;
  logging your weight updates your profile, so the targets follow it. Edit the plan (meals, foods,
  amounts) to make it your own, and add your own foods for the plan and the log.
  A Progress card charts your body weight with a 7-day average and its rate per week, suggests a
  calorie adjustment when the trend doesn't match your goal (applied with one tap), and sums up the
  last 7 days of eating and training. Set your usual training time to see when to have your pre- and
  post-workout meals.
- **Tools:** TDEE, 1RM, and plate calculators.
- **Offline-first:** everything works without a connection. Changes sync when you're back online.
- **Multi-device sync (optional):** sign in with email and password, and changes reach your other
  devices via Supabase Realtime. Without an account, everything stays on the device.
- **Backup:** export history as JSON or CSV, or export and import a full backup.

## Tech stack

| Layer         | Used                                                                                                            |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| App           | Vanilla HTML, CSS, and JavaScript as ES modules (no framework)                                                  |
| Libraries     | `@supabase/supabase-js@2`, `canvas-confetti`, `lucide` (bundled from npm)                                       |
| Local storage | IndexedDB for workout history and the nutrition log; `localStorage` for everything else (keys prefixed `iron_`) |
| Backend       | Supabase: Auth (email and password), Postgres, Realtime                                                         |
| Offline       | Service worker (`src/sw.js`, Workbox via `vite-plugin-pwa`) + web app manifest                                  |
| Tooling       | Vite (dev server and bundling), Vitest + happy-dom (unit tests), Playwright (smoke tests), ESLint               |

## Project structure

```text
irontrack-pwa/
├── index.html                 # Markup; loads src/styles.css and src/main.js
├── src/
│   ├── main.js                # Startup, event listeners, service worker registration
│   ├── actions.js             # Dispatches data-on-* attributes to exported functions
│   ├── dialog.js              # In-app confirm and alert dialogs
│   ├── styles.css             # All app styles
│   ├── sync.js                # Supabase client, auth, upload/download, realtime
│   ├── history-merge.js       # Pure workout-history merge (by session id + tombstones)
│   ├── session-draft.js       # In-progress workout draft (survives reloads)
│   ├── list-store.js          # Lists kept in IndexedDB with an in-memory copy (history, nutrition log)
│   ├── history-store.js       # Workout history (a list store)
│   ├── row-sync.js            # Syncs a list as one table row per record (pull, push, deletions)
│   ├── session-sync.js        # Workout history through row-sync, plus the one-time history move
│   ├── nutrition-log.js       # Daily food, water and weight log, synced through row-sync
│   ├── meal-plans.js          # Your own foods and meal plans (or the example plan)
│   ├── nutrition-insights.js  # Weight trend, calorie adjustment, weekly summary, meal timing
│   ├── settings-merge.js      # Builds the user_sync row and merges settings per key
│   ├── performance.js         # Last time's numbers and PRs per exercise and equipment
│   ├── nutrition-targets.js   # BMR, TDEE, goal-based calorie and macro targets, meal plan scaling
│   ├── model.js               # Workout split built from the catalog + local customizations
│   ├── storage.js             # localStorage helpers, escaping
│   ├── sw.js                  # Service worker: offline caching (built to dist/sw.js)
│   ├── ui.js                  # Toasts, tabs, theme, sounds, full UI refresh
│   ├── data/                  # Exercise catalog, nutrition plans, body artwork
│   └── render/                # One module per screen or feature
├── tests/                     # Vitest unit tests
├── e2e/                       # Playwright smoke tests
├── public/
│   ├── manifest.webmanifest   # PWA manifest
│   └── *.png, *.svg           # App icons
├── supabase/
│   └── user_sync.sql          # The tables, RLS policies, and realtime setup the app uses
├── vite.config.js             # Vite + vite-plugin-pwa (service worker build)
└── package.json               # Vite scripts
```

## Getting started

### Prerequisites

- Node.js 22.12+ (`.nvmrc` pins 22)
- A [Supabase](https://supabase.com/dashboard) project

### 1. Set up the database

In the Supabase dashboard, open **SQL Editor** and run `supabase/user_sync.sql`. It:

- creates the `user_sync` table (one row per user, for settings and profile), or adds any missing
  columns to an existing one
- creates the `workout_sessions` table (one row per logged session)
- creates the `nutrition_log` table (one row per food, water or body weight entry)
- enables Row-Level Security so each signed-in user can only read and write their own rows
- adds `user_sync` to the `supabase_realtime` publication

The script is idempotent, so it's safe to re-run.

### 2. Enable email sign-in

Under **Authentication → Providers**, enable **Email**. Email and password is the only sign-in
method the app uses. If "Confirm email" is on, new users must confirm their address before signing in.

### 3. Point the app at your project

Copy `.env.example` to `.env.local` and set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
(**Project Settings → API**). Vite builds them into the bundle. Without them, the app uses the project
hard-coded at the top of `src/sync.js`. The anon key is public by design: Row-Level Security protects
the data, so never put the `service_role` key here.

### 4. Run it

```bash
npm install
npm run dev       # dev server
npm run build     # static build into dist/
npm run preview   # serve the build locally
npm test          # unit tests (Vitest)
npm run lint      # ESLint
npm run format    # Prettier (CI runs npm run format:check)
npm run test:e2e  # smoke tests in a browser against the production build (Playwright)
```

Before the first `npm run test:e2e`, install its browser once: `npx playwright install chromium`.

GitHub Actions (`.github/workflows/ci.yml`) runs lint, a formatting check, unit tests, the build and the smoke tests on
every pull request and every push to `main`. If the smoke tests fail, the run uploads the Playwright
report as an artifact.

## How it works

### Data and sync

Data on the device is the source of truth, so the app works fully offline. Workout history lives in
IndexedDB (`history-store.js`), which isn't limited to ~5 MB. The app loads it into memory at
startup and writes changes back in the background; history saved in `localStorage` by older versions
is moved over on first load. Everything else is small and stays in `localStorage`. When you're signed
in, workout sessions are mirrored to `workout_sessions` (one row each) and everything else to your
`user_sync` row:

- **Upload:** every edit marks the data as unsynced and schedules an upload (debounced by 800 ms).
  The app uploads only the sessions the cloud doesn't have in their current form: it keeps a
  fingerprint of each session's last synced version. Deleted sessions are uploaded as rows with
  `deleted = true`, so they don't reappear; once the cloud has a deletion, the device forgets it.
  Then it writes the `user_sync` row, but only if a setting changed and only if the row hasn't
  changed since it read it; otherwise it retries. When only sessions changed, a Realtime broadcast
  tells the other devices to pull.
- **Download:** the app pulls on startup, on sign-in, on focus, when the app becomes visible, when the
  device comes back online, every 30 seconds, and whenever Realtime reports a change to `user_sync`.
  It fetches only sessions changed since its last pull (by the server-set `updated_at`, re-reading a
  minute back to be safe). Unsynced local edits are uploaded first, so they're never overwritten.
- **Conflicts:** sessions logged on two devices while they were out of sync are both kept. If a
  session was changed on both, the unsynced local version wins; a deletion always wins. All other
  data (settings, presets, custom exercises) merges per setting: each device keeps a fingerprint of
  every setting as of its last sync, and before uploading it takes the changes another device made
  since then, so an upload never undoes them. If both devices changed the same setting, the
  uploading device's version wins. Deletions sync too: a setting removed on one device is removed
  on the others.
- **Upgrading:** older versions kept the whole history in `user_sync.history`. The first time a
  device syncs on this version, it merges that column in and uploads it as `workout_sessions` rows.
  After that the column is ignored. Run the updated `supabase/user_sync.sql` before deploying.
- **Nutrition log:** synced the same way as workout sessions, one `nutrition_log` row per entry. If
  that table doesn't exist yet, the log stays on the device and everything else still syncs; it uploads
  once `supabase/user_sync.sql` has been run.
- **Shared devices:** signing out, or signing in as a different user, clears the previous account's
  local data.

### Offline caching

`npm run build` builds the service worker from `src/sw.js` and fills in the list of every file in
`dist/` (the hashed bundles included), each with a revision. The worker precaches that list on
install, so `index.html` and the scripts it loads always come from the same build. A new deploy
installs as a new worker that downloads only the files that changed; the app switches to it on the
next launch. There is no cache version to bump by hand.

- **Page loads:** the precached `index.html`, so the app starts offline.
- **Google Fonts:** cached the first time the page loads them under the worker (stale-while-revalidate).
  Until then, offline launches use fallback fonts.
- **Supabase requests:** never cached.

The dev server doesn't run the worker. To try offline behavior, use `npm run build && npm run preview`.

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
- **Environment variables (optional):** `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, to build
  against a different Supabase project than the default in `src/sync.js`.

Serve the site from the domain root: the service worker and manifest use root-relative paths (`/sw.js`, `/`).

## Code notes

- Event handlers are data attributes, not inline `on*` attributes:
  `data-on-click="fn"` (or `data-on-change`, `-input`, `-submit`, `-keydown`, `-focusin`) calls the
  exported function `fn`, with arguments from `data-args` (built with `args()` in templates). See
  `src/actions.js`. The function must be exported from one of the modules `src/main.js` registers;
  `tests/actions.test.js` fails if the markup names one that isn't.
- Use `confirmDialog()` / `alertDialog()` from `src/dialog.js` instead of `confirm()` / `alert()`.
- Modules import each other freely, so don't call another module's functions while a module is
  still loading. Do that work in `init()` in `src/main.js` instead.

## Limitations

- If IndexedDB can't be opened (some private-browsing modes), history falls back to `localStorage`
  and its ~5 MB limit. The app then warns when a change can't be saved.
- The `user_sync` row (settings, presets and the profile photo) is uploaded whole whenever a setting
  changes. It doesn't grow with your history, so it stays small.

## License

MIT

The muscle recovery figure's body artwork comes from
[react-native-body-highlighter](https://github.com/HichamELBSI/react-native-body-highlighter)
(MIT, © 2022 ELABBASSI Hicham). Its license is in `src/data/body-art.js`.

## Author

Maintained by **[Suman Kumar Raj](https://github.com/SKR18156592)**.
