# Test Plan — www2 (Expo React Native)

Purpose
- Define automated and manual tests to validate the `www2` React Native (Expo) implementation of Quran Quiz.
- Provide repeatable steps to verify integrity across iOS, Android and Web targets.

Scope
- Smoke tests: project builds, DB seeding from `www/q.json`, main navigation, and quiz generation.
- Integration tests: profile persistence, questionnaire generation (DB -> quiz), Firebase auth + profile sync (optional, requires config).
- Regression checklist: critical features from the original app (DB import, txt/txts functions, sim2/sim3 counts, profile study parts).

Test environments
- Local dev: Linux/macOS/Windows running Expo CLI and web build.
- Device/emulator: Android Emulator, iOS Simulator (macOS required), physical devices via Expo Go.
- CI: GitHub Actions (recommended) with web smoke runs; EAS CI for Android/iOS builds if available.

Prerequisites
- Node.js (>=16), `npm` or `pnpm`.
- Expo CLI for local app runs and simulators.
- If testing Firebase sync: set env vars or fill `src/services/firebase.ts` with project config.

Quick smoke commands
```bash
cd www2
npm install
npm run start   # opens Expo DevTools
# Web
npm run web
# Native (require native toolchain or EAS)
npm run android
npm run ios
```

Automated test commands
```bash
cd www2
npm run test
npm run test:watch
```

Smoke test checklist (fast, manual)
1. Start the app (`npm run start`). Open Web or Expo Go.
2. Home screen loads and shows the targets note.
3. Tap `Seed DB (partial)` — confirm no errors and that the DB is marked seeded.
4. Navigate to `Quiz` — confirm questions render and choices are tappable. (If DB seeded correctly, questions are generated from DB; otherwise fallback sample appears.)
5. Tap `Sign In (anon)` (if Firebase configured) and verify no errors.
6. Tap `Sync Profile to Cloud` (if signed in) and verify remote write succeeds.

DB seeding verification (detailed)
- Expected: `seedDatabaseIfNeeded()` creates table `q` and `metadata.seeded=1` and inserts rows from `www/q.json` in batches.
- Manual verification on device/emulator:
  - Use an SQLite viewer (Device file explorer) to inspect `qq.db` and query `SELECT COUNT(*) FROM q;` — count should be > 0 and match roughly the number of rows in `www/q.json`.
  - On web, open DevTools -> Application -> IndexedDB (not applicable) — the web target uses bundled Tailwind; DB seeding is for native.

Functional tests (integration)
- IDB.txt / txts: pick a start index and verify `IDB.txt(start, n, 'ayaMark')` returns `n` strings and includes aya marks when available.
- sim2cnt / sim3cnt: call `IDB.sim2cnt(idx)` for a known index (from original `q.json`) and verify returned integers match expected values (compare with `www/q.json` fields if you parse it).
- Questionnaire service: call `createNQuestionsFromProfile(10)` and verify each question's `text` is non-empty and `choices` length is 4.

Acceptance criteria
- App launches on Web and shows the Home screen.
- `Seed DB` completes without unhandled exceptions and `q` table contains rows.
- Quiz screen shows questions generated from DB (or fallback sample) and choices respond to taps.
- Profile store persists between app restarts (`useProfileStore` values survive reloads).
- If Firebase configured: anonymous sign-in succeeds and profile read/write works (no schema faults).

Regression checklist (compare against `www/_model_` behaviors)
- `IDB.txt` and `IDB.txts` produce the same ordering/format as the original `IDB.txt`/`Q.txts` used by `questionnaire.js`.
- `sim2cnt`/`sim3cnt` return counts consistent with `q.json` fields `sim2`/`sim3`.
- `Profile.getSparsePoint` mapping produces valid start indexes inside the selected study parts.

Automated test suggestions (future)
- Unit: add Jest to run pure-TS tests for `utils`, `constants`, `questionnaireService` logic.
- Integration: use Detox or Appium for E2E on emulators to seed DB, navigate, and exercise quiz flows.
- CI: add a GitHub Action job to run `npm run web` and a headless smoke check (Puppeteer) to ensure Home page loads.

Notes & troubleshooting
- Large `q.json` import may take time on first run — the seeder batches inserts; be patient on-device.
- If web target is used for quick verification of UI only, remember the SQLite seeder runs only in native/expo environment; web will fallback to sample questions.

Contact / debugging tips
- To inspect DB on Android emulator: use `adb exec-out "run-as host.exp.exponent cat /data/data/host.exp.exponent/databases/qq.db" > qq.db` and open with SQLite browser.
- To speed local checks, temporarily reduce batch size in `src/db/initDb.ts` and seed a subset of rows.

Sign-off
- Once smoke and functional tests pass, mark verification as complete in the repo TODOs and run a short manual regression before any production build.
