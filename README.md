# Quran Quiz Net — اختبار القرآن

[![Tests](https://github.com/tarekeldeeb/quranquiznet/actions/workflows/www-tests.yml/badge.svg)](https://github.com/tarekeldeeb/quranquiznet/actions/workflows/www-tests.yml)
[![Live](https://img.shields.io/badge/live-app.quranquiz.net-0d2d4e)](https://app.quranquiz.net)
[![Version](https://img.shields.io/github/package-json/v/tarekeldeeb/quranquiznet?filename=www%2Fpackage.json&label=version)](www/package.json)
[![Platforms](https://img.shields.io/badge/platform-web%20%7C%20iOS%20%7C%20Android-blue)](#)
[![License](https://img.shields.io/badge/license-GPLv3%20%2F%20Commercial-informational)](#license)

Quran Quiz is an Arabic multiple-choice quiz game that tests Quran memorization
(ḥifẓ). It builds an on-device profile of the parts of the Quran you've memorized
and generates questions from *only* those parts, with deliberately confusable
("mutashābiha" — look-alike) wrong answers, so guessing from familiarity alone
doesn't work. It's free, works anonymously, and supports online daily quizzes,
a leaderboard, and live 1-on-1 matches.

![Quiz](https://raw.githubusercontent.com/tarekeldeeb/quranquiznet/master/resources/feature.png)

Quran Quiz Network is still in beta and constantly under development.

**[:white_check_mark: Try it online — app.quranquiz.net](https://app.quranquiz.net)**

No install required; it's a full Progressive Web App (installable, offline-capable).
Native iOS and Android apps are also in progress — see [Roadmap](#roadmap).

## Table of contents

- [Features](#features)
- [Try it online](#try-it-online)
- [Build locally](#build-locally)
- [Architecture](#architecture)
- [Contributing](#contributing)
- [License](#license)

## Features

- **Real-memorization quiz engine** — every question is built from the actual
  Quran text (Tanzil.net Uthmani script, ~77,900 words). Wrong answers are
  picked from genuinely similar ("mutashābiha") verses/words, not random noise,
  so the quiz tests recall rather than pattern recognition.
- **Personal study profile** — the Quran is split into 50 trackable study parts
  (plus a "last 5 juz'" bucket learners typically start with). Mark the parts
  you've memorized and the quiz only draws questions from those; scores, streaks,
  and per-part accuracy are tracked locally and (optionally) synced online.
- **Rank & progress system** — a four-tier rank ladder (مبتدئ → مجتهد → حافظ →
  متقن) driven by score, plus milestone celebrations (confetti, khatam star)
  as parts move from unstudied to mastered.
- **Daily quiz & leaderboard** — a shared quiz rotates every 24 hours (server-
  driven via a Cloud Function), with a live "اليوم" leaderboard, a monthly
  top-10, and your own rank shown against nearby competitors.
- **Live 1v1 PvP** — challenge another player (or "الحافظ", an honest bot) to a
  real-time ghost race over the intersection of both players' memorized parts;
  matches are deterministic (seed-based) so no question data ever needs to be
  transmitted, only scores.
- **Works anonymously, syncs when you want** — start instantly as a guest; sign
  in with Google or Facebook later to back up progress and appear on the
  leaderboard under your name.
- **Bilingual-friendly, RTL-first UI** — Arabic UI and Quran text rendered with
  the Madina Mushaf font (via `quran-madina-html`/`quran-madina-react`),
  dark-themed by default.
- **One codebase, three platforms** — Expo Router screens run unmodified on
  web, iOS, and Android.

## Try it online

The live web app is hosted at **[app.quranquiz.net](https://app.quranquiz.net)**
(Firebase Hosting, project `quranquiznet-3a54c`). It's a static, installable PWA —
no account required to start playing.

## Build locally

Requires Node.js 22+ and npm.

```bash
git clone https://github.com/tarekeldeeb/quranquiznet.git
cd quranquiznet/www
npm install

# Firebase config — copy the example and fill in your own project's values
# (Firebase Console → Project Settings → Your apps → Web app → Config)
cp .env.example .env

# Local dev server (web) — served at http://localhost:8081
npx expo start --web --port 8081

# Or run on a device/simulator
npx expo start                # then choose iOS / Android
```

Other useful commands (run from `www/`):

```bash
npx tsc --noEmit               # type check
npm test                       # unit tests (Jest, watch mode)
npm run lint                   # ESLint
npx expo export --clear        # production web build → www/dist
firebase deploy --only hosting # deploy the web build
```

The Quran word database (`q.json`, ~78k words, shipped zipped) is generated
from the root of the repo with:

```bash
python db_maker.py             # downloads Tanzil.net Uthmani text → q.json + q.json.zip
```

See [`CLAUDE.md`](CLAUDE.md) for the full command reference, including native
builds, Cloud Functions deployment, and Android/iOS signing notes.

## Architecture

```
quranquiznet/
├── www/                # Expo SDK 52 + Expo Router v4 app — web, iOS, Android
│   ├── app/             # File-based routes (screens)
│   └── src/              # Services, state, models, components, DB layer
├── functions/           # Firebase Cloud Functions (2nd gen)
├── appengine/            # Legacy cron trigger (App Engine, calls the Functions)
├── db_maker.py           # Generates q.json from Tanzil.net
├── q.json                # Quran word database (generated, checked in)
├── database.rules.json   # Realtime Database security rules
└── firebase.json         # Hosting / RTDB / Functions config
```

### Client (`www/`)

- **Expo Router (`app/`)** — file-based routing with three route groups:
  - `(onboarding)/` — first-run tutorial (slides, level setup).
  - `(auth)/` — sign-in screen (Google / Facebook / anonymous guest), privacy.
  - `(app)/` — the bottom-tab app shell: `me` (dashboard), `quiz`, `league`,
    `pvp`, `map`, plus a few settings/legacy routes.
  - `app/index.tsx` decides where to land the user (onboarding vs. auth vs.
    `(app)/me`) based on auth state and a persisted onboarding flag.
- **State (`src/stores/profileStore.ts`)** — a single Zustand store holding
  the whole user profile (50 study parts, level, scores, streak, social
  identity), persisted to `AsyncStorage` and mirrored to Firebase RTDB
  (`/users/{uid}`) for signed-in users.
- **Quiz engine (`src/services/questionnaireService.ts`, `src/models/`)** —
  a seeded-random question generator (`seedrandom`) that picks a target word
  from the user's checked study parts and constructs confusable
  ("mutashābiha") multiple-choice options from the word DB.
- **Quran word database (`src/db/`)** — platform-split: `expo-sqlite` on
  native, an in-memory JSON store on web (`.web.ts` variants, auto-selected
  by Metro). Both read from the same generated `q.json`.
- **Quran text rendering (`src/components/QuranText.*`)** — platform-split
  wrappers around `quran-madina-react` (native) / `quran-madina-html` (web,
  self-hosted under `public/quran-madina/` for offline-capable, same-origin
  loading — see `scripts/sync-madina-assets.mjs`).
- **Firebase (`src/services/firebase.ts`)** — Firebase JS SDK v10 (modular):
  anonymous + Google/Facebook auth (web popup flow; native uses
  `expo-auth-session` via `src/services/nativeOAuth.ts`), profile sync, and
  daily-quiz/PvP reads & writes against the Realtime Database. Config is
  injected entirely through `EXPO_PUBLIC_FIREBASE_*` env vars — no secrets in
  source.
- **Live PvP (`src/services/pvpService.ts`)** — matches are *deterministic*:
  two clients that agree on `{seed, level, scope}` compute the identical
  question sequence locally, so RTDB only ever carries a match's metadata,
  players' running scores, and the final result — never question content.
  Matchmaking uses an RTDB queue with `onDisconnect()` cleanup; a scheduled
  Cloud Function purges any orphaned queue entries/matches that slip through.
- **Styling & animation** — a shared design-token theme (`src/theme/tokens.ts`),
  React Native Reanimated v3 for transitions, forced RTL layout, Amiri +
  PlexArabic + Uthmani fonts.

### Backend

- **Firebase Hosting** serves the static web export (`www/dist`) with a SPA
  rewrite and long-cache headers for hashed assets.
- **Realtime Database** — `/users/{uid}` (private profiles, owner read/write
  only), `/daily/` (rotating daily quiz + submissions + monthly leaderboard),
  `/pvp/queue` and `/pvp/matches` (live matchmaking). Rules in
  `database.rules.json` require `auth != null` for anything beyond a user's
  own profile — even anonymous sign-in satisfies this.
- **Cloud Functions (2nd gen, `functions/index.js`)**:
  - `dailysched` (every 24h) — rotates the daily quiz, archives yesterday's
    top 5, rolls them into the monthly leaderboard.
  - `weeklysched` (every 168h) — deletes stale anonymous Firebase accounts and
    purges orphaned PvP queue entries/match records.
  - Scheduled functions require the Blaze plan; on the free plan `/daily/head`
    can end up empty.
- **`appengine/`** is a legacy App Engine cron trigger kept for the same
  scheduling job pre-dating the 2nd-gen Cloud Functions scheduler; the
  Firebase Functions above are the source of truth today.

## Roadmap

- Native iOS/Android builds (Expo/EAS) with native Google/Facebook sign-in.
- Expanding live PvP beyond the current bot + 1v1 phase.

Track in-flight work via [open issues](https://github.com/tarekeldeeb/quranquiznet/issues)
and recent commits.

## Contributing

Contributions are welcome — bug reports, translations, quiz-content fixes, and
code all help.

1. **Reporting a problem?** Use the [issue template](ISSUE_TEMPLATE.md): note
   the app version (Settings tab), whether you were signed in anonymously,
   and clear repro steps. The app also has a built-in "report a bad question"
   flow for content issues specifically.
2. **Sending a PR:**
   - Fork the repo and branch from `master`.
   - Work under `www/`; run `npm install` first.
   - Match the existing code style — TypeScript strict mode, no unnecessary
     comments, small focused diffs.
   - Before opening a PR, make sure these all pass from `www/`:
     ```bash
     npx tsc --noEmit
     npm run lint
     npm run test:ci
     ```
   - CI (`.github/workflows/www-tests.yml`) runs lint + tests on every push
     and PR that touches `www/`.
   - Keep secrets out of commits — `www/.env`, `GoogleService-Info.plist`, and
     `google-services.json` are gitignored; use `.env.example` as the template.
3. Read [`CLAUDE.md`](CLAUDE.md) for the fuller architecture/command reference
   if you're using an AI coding assistant, or just as a deeper-dive doc.

## License

Dual-licensed:
- [GPLv3](LICENSE-GPL3)
- [Commercial license](LICENSE-commercial) — for use cases incompatible with
  the GPL's copyleft terms.

See [`LICENSE`](LICENSE) for details.
