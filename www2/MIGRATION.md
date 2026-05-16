# Migration & Rollback — www2 (React Native / Expo)

Overview
- The new app lives in `www2/` and is a full React Native (Expo) rewrite.
- Data seeding: `www/q.json` is bundled in the repository and seeded into `expo-sqlite` database `qq.db` on first run.

Rollback strategy
- No destructive changes to existing `www/` web app. The old app remains intact.
- If the mobile app is unsuitable, stop distributing the mobile build and continue maintaining `www/`.
- For local data rollback: the mobile DB is local to the device (`qq.db`). Deleting it resets local progress.

Firebase & Remote Data
- Remote profile sync uses Firebase Realtime Database. Configure your Firebase credentials in `src/services/firebase.ts`.
- Remote schema matches the minimal profile format; adapt `Profile` store persistence if you change schema.

Notes
- iOS/Android targets use Expo Managed workflow; native modules must be supported by Expo or added via EAS builds.
- Web target uses React Native for Web and Tailwind via PostCSS; ensure `postcss.config.js` and `tailwind.config.js` are honored by your build environment.

If you want, I can:
- Add an EAS build configuration and CI jobs for iOS/Android
- Create a small script to export/import `qq.db` for debugging

*** End Patch