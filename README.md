# IronTrack PWA 🏋️‍♂️💪

**IronTrack** is a production-ready, cross-platform workout tracking application designed for performance and reliability. Built with a modern tech stack centered around **React 18**, **Vite 5**, **Tailwind CSS**, and **Supabase**, it functions as a fully installable Progressive Web App (PWA) supporting offline usage and real-time multi-device synchronization across iOS, Android, macOS, Windows, and Linux.

---

## 🚀 Key Features

* **Robust Authentication:** Secure access supporting Email/Password, Email Magic Links, and SMS OTP phone fallback via Supabase Auth.
* **Real-Time Synchronization:** Seamless, instant data syncing across multiple active devices powered by [Supabase Realtime](https://github.com/SKR18156592/IronTrack?utm_source=gemini).
* **Offline-First Architecture:** Integrated service worker and custom caching strategy ensuring uninterrupted usage even without network connectivity.
* **Modern Cyberpunk UI:** A responsive, mobile-first interface meticulously crafted for high-visibility and ease of use in gym environments.
* **Full CRUD Capabilities:** Efficiently manage custom workouts, log exercises, and track sets with high precision.
* **Enterprise-Grade Security:** Row-Level Security (RLS) rigorously enforced on all database tables to protect user privacy.

---

## 🏗️ Project Architecture

```text
irontrack-pwa/
├── public/              # PWA manifest, icons, and service worker assets
├── src/
│   ├── components/      # Modular React UI components
│   ├── hooks/           # Custom hooks (e.g., useSyncWorkouts for realtime sync)
│   ├── stores/          # Supabase client and data access helpers
│   ├── AuthContext.jsx  # Authentication provider & state management
│   ├── App.jsx          # Root application layout and routing
│   └── main.jsx         # Application entry point
├── supabase/schema.sql  # Database schema, RLS policies, and realtime triggers
├── vite.config.js       # Vite build & PWA configurations
├── tailwind.config.js   # Custom design system & theme tokens
└── index.html           # Document root & iOS PWA metadata

```

---

## 🛠️ Getting Started & Local Setup

### Prerequisites

* **Node.js** (v18+ recommended)
* **npm** or **yarn**
* A configured **Supabase** project

### Installation Steps

1. **Clone the repository:**
```bash
git clone https://github.com/SKR18156592/IronTrack.git
cd IronTrack

```


2. **Configure environment variables:**
Create a `.env` file in the root directory based on your environment template:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key

```


3. **Install dependencies:**
```bash
npm install

```


4. **Initialize the Database:**
* Navigate to your [Supabase Dashboard](https://www.google.com/search?q=https://app.supabase.com&utm_source=gemini).
* Open the **SQL Editor**, create a **New Query**, and paste the contents of `supabase/schema.sql`. Run the script to set up tables, security policies, and triggers.


5. **Configure Authentication Providers:**
* Go to **Authentication > Providers** in your Supabase dashboard.
* Enable **Email** (and/or Magic Link) and **Phone** authentication as required.


6. **Run the development server:**
```bash
npm run dev

```



---

## 📱 Installing as a Progressive Web App (PWA)

IronTrack can be installed natively onto your device for a standalone, app-like experience:

* **iOS (Safari):** Open the application URL, tap the **Share** button, and select **Add to Home Screen**.
* **Android (Chrome):** Open the application URL, open the browser menu (three dots), and select **Install App** or **Add to Home Screen**.
* **Desktop (Chrome / Edge):** Click the install icon located directly in the address bar.

---

## 🌐 Deployment

This project is optimized for deployment on modern static hosting platforms:

* **Vercel:** Import your repository, set the framework preset to **Vite**, and add your Supabase environment variables under project settings.
* **Netlify:** Connect the GitHub repository, set the build command to `npm run build` with the publish directory `dist`, and inject your environment variables.

> **Note:** PWA installation features require an active **HTTPS** connection and a valid service worker registration.

---

## 📄 License

Distributed under the [MIT License](https://opensource.org/licenses/MIT?utm_source=gemini). See `LICENSE` for more information.

---

## 👤 Author

Maintained by **[Suman Kumar Raj](https://github.com/SKR18156592?utm_source=gemini)**.
