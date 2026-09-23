---

# IronTrack PWA 🏋️‍♂️💪

A production-ready, cross-platform workout tracker built with **React 18**, **Vite 5**, **Tailwind CSS**, and **Supabase**. It is designed as a fully installable Progressive Web App (PWA) that works offline and syncs your data in real-time across iOS, Android, macOS, Windows, and Linux.

---

## ✨ Features

* **Multi-Auth Options:** Supports Email magic-link / email + password authentication, plus phone-number (SMS OTP) fallback.
* **Real-Time Sync:** Instant multi-device data sync via [Supabase Realtime](https://github.com/SKR18156592/IronTrack?utm_source=gemini).
* **Offline-First PWA:** Built with a service worker and caching strategy for reliable offline usage.
* **Dark Cyberpunk UI:** Mobile-first responsive interface optimized for gym environments.
* **Full CRUD Capabilities:** Manage your workouts, exercises, and sets effortlessly.
* **Row-Level Security (RLS):** Enforced on every table to ensure user data privacy and security.

---

## 📁 Project Structure

```text
irontrack-pwa/
├── public/              # PWA manifest and SVG icons
├── src/
│   ├── components/      # React UI components
│   ├── hooks/           # useSyncWorkouts realtime sync hook
│   ├── stores/          # Supabase DB helpers
│   ├── AuthContext.jsx  # Auth state and email/phone helpers
│   ├── App.jsx          # Main app shell
│   └── main.jsx         # Entry point
├── supabase/schema.sql  # Database schema + RLS + realtime
├── vite.config.js       # Vite + React configuration
├── tailwind.config.js   # Custom iron/neon theme
└── index.html           # iOS PWA meta tags

```

---

## 🛠️ Local Setup

1. **Clone the repository and copy the environment template:**
```bash
git clone https://github.com/SKR18156592/IronTrack.git
cd IronTrack
cp .env.example .env

```


2. **Configure your environment variables in `.env`:**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

```


3. **Install dependencies:**
```bash
npm install

```


4. **Apply the database schema:**
* Go to your Supabase Dashboard → **SQL Editor** → **New Query**.
* Paste the contents of `supabase/schema.sql` and run it.


5. **Configure Supabase Auth:**
* Enable **Email** and **Phone** providers under *Authentication → Providers*.
* For email, enable standard email sign-in and/or magic links (set your Site URL and redirect URLs accordingly).
* For phone, configure your SMS provider (e.g., Twilio).


6. **Start the development server:**
```bash
npm run dev

```


7. **Build for production:**
```bash
npm run build
npm run preview

```



---

## 📱 PWA Installation

### iOS Safari

1. Open the deployed URL in Safari.
2. Tap the **Share** button.
3. Select **Add to Home Screen**.

### Android Chrome

1. Open the URL in Chrome.
2. Tap the three-dot menu and select **Add to Home screen**.

### Desktop Chrome/Edge

1. Open the URL.
2. Click the install icon in the address bar or use the in-app **Install** banner.

---

## 🚀 Deployment

You can deploy this project instantly on modern static hosting providers:

* **[Vercel](https://github.com/SKR18156592/IronTrack?utm_source=gemini)**: Import the repository, set the build command to `npm run build`, output directory to `dist`, and add your `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables.
* **Netlify**: Connect your GitHub repo, use `npm run build` with publish directory `dist`, and configure your Supabase environment variables.
* **Cloudflare Pages**: Connect the repository with build command `npm run build` and output directory `dist`.

> **Note:** A PWA install prompt only appears on **HTTPS** with a valid manifest and service worker. Ensure HTTPS is enabled on your custom domain host dashboard.

---

## 📄 Notes

* The service worker uses a manual Workbox-style script in `public/sw.js` and is registered with `workbox-window` inside `src/main.jsx`.
* Built-in workouts follow a 3-day default routine based on the original single-file prototype.
* While Node 18 may log minor `EBADENGINE` warnings due to certain Supabase/Workbox packages, the app builds and runs successfully (Node 20+ is recommended for production CI).

---

## 👨‍💻 Author

Built by [SKR18156592](https://github.com/SKR18156592?utm_source=gemini).
