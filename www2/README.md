# qq-net (www2) — Expo React Native

This folder contains the new React Native (Expo) rewrite for the Quran Quiz app.

Getting started (after installing Expo CLI):

```bash
cd www2
npm install
npm run start
```

Next steps:
- Install dependencies (see `package.json`)
- Configure `tailwindcss` / `nativewind`
- Implement DB seeding from `q.json`
- Port models and create Zustand stores
- Install dependencies (see `package.json`)
- Configure `tailwindcss` / `nativewind`
- Seed the SQLite DB from the repository `www/q.json` on first run (the app will do this automatically)
- Port models and create Zustand stores

Targets
- iOS, Android: run via Expo CLI (`npm run ios` / `npm run android`) or Expo Application Services
- Web: `npm run web` (Tailwind/PostCSS applied)

Notes
- Fill Firebase credentials in `src/services/firebase.ts` before using remote sync.
- The seeder imports `www/q.json` and writes into a local `qq.db` using `expo-sqlite`.
- For large imports the seeder batches inserts; initial runs may take time.

Quick start
```bash
cd www2
npm install
npm run start
# then open Expo DevTools, or
npm run web
```
