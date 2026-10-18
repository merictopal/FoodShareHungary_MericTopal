# FoodShare Hungary

Source code for the BSc thesis **"Design and Development of FoodShare Hungary – A Location-Based Food Sharing Platform for Students"**
(University of Pécs, Faculty of Engineering and Information Technology · Author: Meriç Topal (E1WU52) · Supervisor: Peter Novak).

This README is written for an examiner who receives only this repository (clone or ZIP) and wants to understand the
system and reproduce the development setup on another computer. There is **no live deployment**.

---

## Contents

1. [Project overview](#1-project-overview)
2. [Architecture](#2-architecture)
3. [Prerequisites and verified versions](#3-prerequisites-and-verified-versions)
4. [Setup guide](#4-setup-guide)
5. [Accounts: first admin, students, restaurants](#5-accounts-first-admin-students-restaurants)
6. [Configuration / environment variables](#6-configuration--environment-variables)
7. [External services and what works without them](#7-external-services-and-what-works-without-them)
8. [Testing](#8-testing)
9. [Known limitations](#9-known-limitations)
10. [Thesis](#10-thesis)
11. [Further documentation in this repository](#11-further-documentation-in-this-repository)

---

## 1. Project overview

FoodShare Hungary is a location-based platform through which restaurants share surplus meals (free or discounted) with
students. It has three roles:

| Role | Client | What the role does |
|---|---|---|
| **Student** (beneficiary) | Android app (`FoodShareMobile/`) | Registers (e-mail/password or Google), uploads a verification document (student ID, +65 age card or social-support card), browses nearby offers on a list/map, gets personalised recommendations, claims a meal and receives a QR code, collects XP/levels, sees an in-app notification inbox |
| **Restaurant** | Android app (`FoodShareMobile/`) | Applies for an account (stays *pending* until an admin approves it), sets its location, creates offers, verifies a student's pickup by scanning the QR code or typing the code manually, appears on the leaderboard |
| **Administrator** | Web dashboard (`admin-dashboard/`); the mobile app also has a small admin screen | Approves/rejects pending students and restaurants (with 5-minute links to the uploaded documents), suspends accounts, cancels offers, reads statistics and the security audit log |

**Main workflow**

1. A verified restaurant creates an offer (`free` or `discount`, quantity, description, optional image).
   Students are notified (in-app inbox row + Firebase push if configured).
2. A verified student sees offers sorted by distance (PostGIS) and a recommended list, and claims an offer.
   The backend reserves one unit with an atomic conditional `UPDATE` and returns a unique QR code
   (one claim per student per offer, enforced by a database constraint).
3. At pickup the restaurant scans the QR code (camera) or enters it manually. The backend validates the claim
   exactly once (a second scan is refused).
4. Rewards: the student gets XP (1 level per 100 XP) and the restaurant gets leaderboard points
   (20 for a free offer, 10 for a discount offer) plus a "meals shared" count.

Offers are only claimable on the day they were created (Europe/Budapest time).

**Recommendations** are a *deterministic hybrid scoring* approach, not machine learning: user-based collaborative
filtering (cosine similarity over a user × restaurant matrix of validated claims, computed with scikit-learn's
`cosine_similarity`) is one signal, combined with the student's own restaurant affinity, proximity, popularity, freshness
and offer value using fixed weights, followed by a one-offer-per-restaurant re-ranking. Students without history get a
cold-start ranking (proximity, popularity, freshness, value). Details: [`docs/recommendations.md`](docs/recommendations.md).

**Status.** This is a **development-stage MVP**. It was developed and tested locally on Windows 11 with the backend,
PostgreSQL/PostGIS and the admin dashboard running on the developer machine, and the mobile app running on an
**Android emulator** (`Pixel_7` AVD). It has **not** been deployed to production and has **not** been tested on iOS
or on physical Android devices. The current technical state and recorded test evidence are maintained in
[`PROJECT_STATE.md`](PROJECT_STATE.md).

---

## 2. Architecture

```
┌──────────────────────────┐        HTTP/JSON (axios)        ┌──────────────────────────────┐
│ FoodShareMobile          │ ──────────────────────────────▶ │ backend (Flask REST API)      │
│ React Native + TS        │   API_URL (emulator: 10.0.2.2)  │ /api/*  JWT auth, roles       │
│ students + restaurants   │                                 │ SQLAlchemy + GeoAlchemy2      │──▶ PostgreSQL + PostGIS
└──────────────────────────┘                                 │                               │
┌──────────────────────────┐        HTTP/JSON (axios)        │                               │──▶ AWS S3 (optional)
│ admin-dashboard          │ ──────────────────────────────▶ │                               │──▶ Firebase Cloud Messaging (optional)
│ React + Vite + Tailwind  │   http://127.0.0.1:5000/api     │                               │──▶ Gmail SMTP (optional)
└──────────────────────────┘                                 └──────────────────────────────┘──▶ Google token verification (optional)
```

| Component | Folder | Stack (from the repository) |
|---|---|---|
| Mobile app | `FoodShareMobile/` | React Native 0.83.4 (bare CLI project), React 19.2.0, TypeScript, React Navigation 7, axios, react-native-maps, react-native-vision-camera (QR scanning), @react-native-firebase (messaging), @react-native-google-signin, react-native-dotenv |
| REST API | `backend/` | Python, Flask 3.0, Flask-SQLAlchemy / SQLAlchemy 2.0, GeoAlchemy2, PyJWT (HS256), Flask-Limiter, Flask-Cors, boto3, firebase-admin, google-auth, pandas + scikit-learn (recommendations) |
| Database | — | PostgreSQL with the PostGIS extension (restaurant location stored as `geom`, SRID 4326, plus `lat`/`lng`) |
| Admin dashboard | `admin-dashboard/` | React 19, Vite 8, Tailwind CSS 3, TypeScript, recharts, react-router |

**Authentication.** Login returns a short-lived access JWT (15 min) and a refresh JWT (7 days), both HS256 signed with
`JWT_SECRET_KEY`. Every protected route re-reads the user's role and status from the database. Rate limits are kept in
memory (Flask-Limiter): 200/day and 50/hour by default (per account for authenticated requests, otherwise per IP) and
5/minute per IP on credential endpoints. Restarting the backend resets them.

**External services used by the code**

| Service | Used for | Code |
|---|---|---|
| AWS S3 | Storing offer images, restaurant/profile pictures (public prefixes) and verification documents (private prefixes, admins get 5-minute pre-signed URLs) | `backend/app/services/storage_service.py` |
| Firebase Cloud Messaging | Push notifications: new offers to students, "claim verified" to restaurants. Backend sends with `firebase-admin`; the app registers its FCM token | `backend/app/services/notification_service.py`, `FoodShareMobile/src/api/notifications.ts`, `src/context/AuthContext.tsx` |
| Google Sign-In | Student sign-in with a Google account; the backend verifies the Google ID token against `GOOGLE_WEB_CLIENT_ID` | `backend/app/services/auth_service.py` (`google_login`), `FoodShareMobile/src/context/AuthContext.tsx` |
| Google Maps (Android SDK) | Map of offers in the student app (`react-native-maps`) | `FoodShareMobile/android/app/build.gradle` (`MAPS_API_KEY`), `AndroidManifest.xml` |
| SMTP (Gmail, `smtp.gmail.com:587`) | E-mailing a 6-digit password-reset code | `backend/app/services/auth_service.py` (`send_forgot_password_email`) |

### Repository structure

Only folders/files that are part of the repository are shown (dependencies, build output and local secrets are git-ignored).

```
.
├── backend/                     Flask REST API
│   ├── app/
│   │   ├── __init__.py          app factory create_app(): config, JWT_SECRET_KEY check, CORS, limiter,
│   │   │                        blueprints, JSON error handlers, db.create_all()
│   │   ├── models/              users, restaurant_profiles, audit_logs (user.py); offers, claims (offer.py);
│   │   │                        notifications, leaderboard (stats.py)
│   │   ├── routes/              auth_routes, student_routes, restaurant_routes, admin_routes, upload_routes
│   │   ├── services/            auth, qr (offers/claims/verification), recommendation, notification, storage
│   │   └── utils/               decorators (role/ownership checks), validators, constants, geo
│   ├── migrations/              4 idempotent SQL migrations (for databases created before these changes)
│   ├── tests/                   pytest: smoke/, edge/, writes/, conftest.py, helpers.py
│   ├── config.py                configuration classes (reads backend/.env)
│   ├── run.py                   development server entry point
│   ├── requirements.txt         Python dependencies
│   ├── pytest.ini               pytest configuration (markers smoke/edge/writes)
│   ├── test_api.py              legacy live-server API test (2 tests)
│   ├── Procfile                 (not used for the local setup; see Known limitations)
│   └── .env.example             template for backend/.env
├── FoodShareMobile/             React Native app (students + restaurants)
│   ├── src/
│   │   ├── api/                 axios client with token refresh, API modules
│   │   ├── components/          shared UI components
│   │   ├── constants/           theme, translations (en.ts, hu.ts, tr.ts)
│   │   ├── context/             AuthContext (session, Google Sign-In, FCM token)
│   │   ├── navigation/          auth / app stacks
│   │   ├── screens/             auth/, student/, restaurant/, admin/
│   │   └── utils/
│   ├── __tests__/               Jest tests
│   ├── android/                 Android project (Gradle)
│   ├── ios/                     iOS project (not tested)
│   ├── package.json
│   └── .env.example             template for FoodShareMobile/.env
├── admin-dashboard/             React + Vite + Tailwind admin panel
│   ├── src/                     api/client.ts, pages/ (Login, Dashboard, PendingDocs, Users, Restaurants,
│   │                            Offers, AuditLogs), App.tsx
│   └── package.json
├── docs/                        short per-domain technical notes (auth, claims, qr, documents, location, ...)
├── scripts/run_checks.py        quality gate: backend smoke+edge tests + TypeScript error ratchet
├── .claude/                     development-tool configuration (push hook, rules, launch configs,
│                                hooks/tsc-baseline.json used by run_checks.py)
├── CLAUDE.md                    repository conventions
├── PROJECT_STATE.md             current technical state, test evidence, open issues
└── SCHEDULE.md                  project schedule
```

---

## 3. Prerequisites and verified versions

The repository pins only some versions. The table separates what the repository requires from what was actually
used to verify this README (Windows 11 machine, 2026-10-18).

| Tool | Required by the repository | Verified with |
|---|---|---|
| Python | not pinned; verify compatibility with the packages in `backend/requirements.txt` | **3.13.3** |
| PostgreSQL | not pinned | **16.11** |
| PostGIS | not pinned (extension must be available to the server) | **3.6.1** |
| Node.js | mobile: `"engines": {"node": ">=20"}`; admin: Vite 8 requires `^20.19.0 \|\| >=22.12.0` | **22.14.0** |
| npm | lock files are `package-lock.json` (npm) | **10.9.2** |
| JDK (Android build) | not pinned in the repository | **JDK 17** (`JAVA_HOME`) |
| Android SDK | `compileSdkVersion 36`, `targetSdkVersion 36`, `minSdkVersion 24`, build-tools `36.0.0`, NDK `27.1.12297006`, Kotlin `2.1.20` (`FoodShareMobile/android/build.gradle`) | SDK platforms 35/36, build-tools 36.0.0, NDK 27.1.12297006 |
| Gradle | wrapper `gradle-9.0.0` (`android/gradle/wrapper/gradle-wrapper.properties`) | wrapper 9.0.0 |
| Android emulator | — | AVD `Pixel_7` (PROJECT_STATE.md: Android 13 / API 33, x86_64, Google Play image) |
| Android Studio | needed for SDK/emulator management; version not pinned | — |

For the general React Native Android toolchain follow the official guide
<https://reactnative.dev/docs/set-up-your-environment> (React Native CLI, Android). iOS is not covered (not tested).

---

## 4. Setup guide

Commands are shown for **PowerShell (Windows)**, the platform the project was developed and verified on.
Where a POSIX shell differs, the bash variant is given as well. All paths are relative to the repository root.

Start order for a full local run: **database → backend → admin dashboard → Metro + Android app**.

### 4.1 Database (PostgreSQL + PostGIS)

The repository has **no seed data and no SQL schema dump**. The schema is created by the backend itself:
`create_app()` calls SQLAlchemy `db.create_all()` on start-up, which creates all 7 tables
(`users`, `restaurant_profiles`, `offers`, `claims`, `leaderboard`, `notifications`, `audit_logs`) including
the unique constraints and the spatial index. You only have to create an empty database with PostGIS enabled.

These are **manual PostgreSQL steps** (no project script exists for them). `foodshare_db` is the database name used
during development; any name works as long as `DEV_DATABASE_URL` matches. If `psql` is not on your `PATH`, call it
from your PostgreSQL installation's `bin` folder.

```powershell
psql -U postgres -h 127.0.0.1 -d postgres -c "CREATE DATABASE foodshare_db;"
psql -U postgres -h 127.0.0.1 -d foodshare_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Then continue with the backend (4.2). **After the backend has started once** (tables exist), apply the SQL migrations
in `backend/migrations/`. They were written for the original development database; on a fresh database created by
`db.create_all()` they are no-ops (they only print "already exists, skipping" notices) but are safe to run:

```powershell
psql -U postgres -h 127.0.0.1 -d foodshare_db -v ON_ERROR_STOP=1 -f backend/migrations/2026-09-29_claims_unique_user_offer.sql
psql -U postgres -h 127.0.0.1 -d foodshare_db -v ON_ERROR_STOP=1 -f backend/migrations/2026-09-29_leaderboard_unique_restaurant.sql
psql -U postgres -h 127.0.0.1 -d foodshare_db -v ON_ERROR_STOP=1 -f backend/migrations/2026-09-29_restaurant_geom_backfill_index.sql
psql -U postgres -h 127.0.0.1 -d foodshare_db -v ON_ERROR_STOP=1 -f backend/migrations/2026-10-02_users_password_reset.sql
```

> Running the migrations **before** the first backend start fails (`relation "claims" does not exist`), because the
> tables do not exist yet.

### 4.2 Backend (Flask API)

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1          # bash: source venv/bin/activate   (Windows Git Bash: source venv/Scripts/activate)
python -m pip install -r requirements.txt
Copy-Item .env.example .env          # bash: cp .env.example .env
```

If PowerShell refuses to run `Activate.ps1` (execution policy), either allow it for the current window with
`Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` or skip activation and call the venv interpreter directly
(`.\venv\Scripts\python.exe` instead of `python`). (Not reproducible on the verification machine, whose shell already
allowed the script.)

Edit `backend/.env` and set at least:

- `JWT_SECRET_KEY` – a long random value (the app **refuses to start** without it), e.g. generate one with
  `python -c "import secrets; print(secrets.token_urlsafe(48))"`.
- `DEV_DATABASE_URL` – e.g. `postgresql://postgres:YOUR_DATABASE_PASSWORD@127.0.0.1/foodshare_db`.
- `SECRET_KEY` – any random value.

Leave the optional values (AWS, SMTP, Google) **empty** unless you have real credentials (see section 7).
All variables are described in section 6.

Start the development server (from `backend/`, with the virtual environment active):

```powershell
$env:PYTHONIOENCODING = "utf-8"      # recommended on Windows: the server prints emoji status lines
python run.py
```

- Listens on **`http://127.0.0.1:5000`** (`BACKEND_HOST` / `BACKEND_PORT` override this) with the `development`
  config (`FLASK_CONFIG`). The Werkzeug debugger is only enabled on a loopback host.
- The first start in a fresh environment can take 10–20 seconds (imports of pandas/scikit-learn).
- Expected start-up messages without optional services: `⚠️ Firebase initialization error: ... firebase-service-account.json`
  (push disabled) – this is not fatal.
- Quick check: `http://127.0.0.1:5000/api/offers` returns HTTP 200 with a JSON list (`[]` while there are no claimable offers).
- Alternative entry point (also verified): `python -m flask run` from `backend/` (auto-discovers the `app` package,
  default `127.0.0.1:5000`, debugger off).
- Run **only one** backend on port 5000.

### 4.3 Admin dashboard

```powershell
cd admin-dashboard
npm ci                # installs exactly the versions in package-lock.json
npm run dev           # Vite dev server
```

- Open **`http://localhost:5173`** (use `localhost`, not `127.0.0.1`: the backend's default CORS whitelist is
  `http://localhost:5173,http://localhost:8081`; change it with `CORS_ORIGINS`).
- The dashboard has **no environment variables**. The API base URL is hard-coded in
  `admin-dashboard/src/api/client.ts` as `http://127.0.0.1:5000/api`, so the backend must run on that address.
- Log in with an **admin** account (section 5). Non-admin accounts are rejected.
- Production build: `npm run build` runs `tsc -b && vite build` and **currently fails** because of one existing
  TypeScript error (`src/pages/Dashboard.tsx(214,37): error TS6133: 'entry' is declared but its value is never read`).
  `npx vite build` (without the type check) succeeds and writes `dist/`. The dev server is not affected.

### 4.4 Mobile app (Android)

1. **Install JavaScript dependencies**

   ```powershell
   cd FoodShareMobile
   npm ci --legacy-peer-deps
   ```

   `--legacy-peer-deps` is currently required: a plain `npm ci` stops with `ERESOLVE` because the dev dependency
   `@types/react@~18.2.45` conflicts with the optional peer dependency `@types/react@^19.1.0` of
   `@react-native/new-app-screen@0.83.1`. The flag installs exactly the versions in `package-lock.json`.

2. **Environment file** – copy the template and fill it in (section 6):

   ```powershell
   Copy-Item .env.example .env       # bash: cp .env.example .env
   ```

   `API_URL` must point at the backend. For the **Android emulator** use `http://10.0.2.2:5000/api`:
   `10.0.2.2` is the emulator's alias for the host computer's `127.0.0.1`, so it reaches the backend's default
   loopback bind without further configuration. The values are compiled into the JavaScript bundle by
   `react-native-dotenv` (Babel plugin), so restart Metro after changing `.env`; if old values persist, start it with
   `npx react-native start --reset-cache`.

3. **Firebase configuration file** – place your own Firebase Android config at
   `FoodShareMobile/android/app/google-services.json` (git-ignored, not included). It must belong to a Firebase
   project with an Android app whose package name is **`com.foodsharemobile`**. The Gradle plugin
   `com.google.gms.google-services` is applied in `android/app/build.gradle`, and that plugin requires this file,
   so the Android build is expected to fail without it (this failure case was not tested here).

4. **Google Maps key** – `MAPS_API_KEY` is read at build time by `android/app/build.gradle` (from the
   `MAPS_API_KEY` environment variable or `FoodShareMobile/.env`) and injected into `AndroidManifest.xml`. The
   template leaves it empty; without a key the build prints `WARNING: MAPS_API_KEY is not set` and the map shows no
   tiles.

5. **Android SDK location** – Gradle must find the Android SDK (with NDK `27.1.12297006` installed through the SDK
   Manager). Either set the environment variable `ANDROID_HOME` to the SDK folder (on Windows usually
   `%LOCALAPPDATA%\Android\Sdk`), or create the git-ignored file `FoodShareMobile/android/local.properties` with
   `sdk.dir=<path to the SDK>` (Android Studio writes this file when it opens the `android/` project). With
   `ANDROID_HOME` pointing at the wrong folder and no `local.properties`, a fresh clone fails with
   `NDK is not installed` (observed during verification).

6. **Start an emulator** (e.g. from Android Studio's Device Manager), then run Metro and the app in two terminals:

   ```powershell
   cd FoodShareMobile
   npx react-native start            # Metro bundler (same as: npm start)
   ```

   ```powershell
   cd FoodShareMobile
   npx react-native run-android      # builds the debug APK and installs it on the running emulator (same as: npm run android)
   ```

**Physical Android device (not tested):** `run.py` binds to `127.0.0.1` by default. A device on the LAN would need
`BACKEND_HOST=0.0.0.0` for the backend and `API_URL=http://<your-computer-LAN-IP>:5000/api` in the app (cleartext HTTP
is allowed by `android:usesCleartextTraffic="true"` in the manifest).

**iOS:** an `ios/` project exists, but no `GoogleService-Info.plist` is provided and iOS was never built or tested.

---

## 5. Accounts: first admin, students, restaurants

The repository contains **no seed accounts and no demo credentials**. Accounts are created as follows.

**Administrator (manual bootstrap).** Public registration never creates admins (`role: "admin"` → HTTP 400).
Register a normal account first (in the app, or via the API below), then promote it in the database:

```powershell
psql -U postgres -h 127.0.0.1 -d foodshare_db -c "UPDATE users SET role='admin', verification_status='verified' WHERE email='admin@example.com';"
```

(Replace the e-mail with the one you registered.) The account can then log in to the admin dashboard.

**Restaurant.** Register in the app and choose the restaurant role (the app requires an address). The
account starts as `pending` and cannot log in (HTTP 403 "Account Pending") until an admin approves it in the
dashboard (**Pending Docs** / Pending Verifications → approve). After login the restaurant should set its location on
its dashboard ("Use my current location"); distances and the map use this location.

**Student.** Register in the app (or with Google, if configured). New students are `unverified` and can browse but
**cannot claim** meals (HTTP 403 "Verification Required"). The student uploads a verification document in the app
(Profile → Security → **UPLOAD ID**, document types student ID / +65 age card / social-support card). The account
becomes `pending`, and an admin approves it in the dashboard. Without AWS credentials the document is stored locally
in `backend/private_uploads/` (git-ignored) and the admin sees a signed 5-minute link.

**Registering through the API** (alternative to the app, e.g. for the first admin), with the backend running:

```powershell
$body = @{ name = "Admin"; email = "admin@example.com"; password = "CHOOSE_A_PASSWORD"; role = "student" } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:5000/api/auth/register -ContentType "application/json" -Body $body
```

```bash
curl -X POST http://127.0.0.1:5000/api/auth/register -H "Content-Type: application/json" \
  -d '{"name":"Admin","email":"admin@example.com","password":"CHOOSE_A_PASSWORD","role":"student"}'
```

A restaurant registration additionally sends `"role": "restaurant"`, `"business_name"`, `"address"` and optionally
`"lat"`/`"lng"`. Registration and login share the rate limit of 5 requests per minute per IP (HTTP 429 when exceeded).

---

## 6. Configuration / environment variables

Only variables that are actually read by the code are listed. Real values belong in the git-ignored `.env` files;
the committed `.env.example` files contain placeholders only.

### Backend – `backend/.env` (template: [`backend/.env.example`](backend/.env.example))

Loaded by `python-dotenv` in `config.py`; variables already set in the process environment take precedence.

| Variable | Component | Purpose | Required? | Example |
|---|---|---|---|---|
| `JWT_SECRET_KEY` | backend | Signs access/refresh JWTs and signed document links; start-up fails without it | **Yes** | `YOUR_LONG_RANDOM_JWT_SECRET` |
| `DEV_DATABASE_URL` | backend | SQLAlchemy URL of the database (development config, the default) | **Yes** | `postgresql://postgres:YOUR_DATABASE_PASSWORD@127.0.0.1/foodshare_db` |
| `SECRET_KEY` | backend | Flask secret key (`config.py` has a hard-coded fallback) | Recommended | `YOUR_FLASK_SECRET_KEY` |
| `GOOGLE_WEB_CLIENT_ID` | backend | Expected audience of Google ID tokens; Google login answers 503 without it | Optional | `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` |
| `AWS_ACCESS_KEY_ID` | backend | S3 access key; without both keys uploads are stored locally | Optional | `YOUR_AWS_ACCESS_KEY_ID` |
| `AWS_SECRET_ACCESS_KEY` | backend | S3 secret key | Optional | `YOUR_AWS_SECRET_ACCESS_KEY` |
| `AWS_REGION` | backend | S3 region | Optional (with S3) | `YOUR_AWS_REGION` |
| `AWS_BUCKET_NAME` | backend | S3 bucket name | Optional (with S3) | `YOUR_S3_BUCKET_NAME` |
| `SMTP_EMAIL` | backend | Gmail sender address for password-reset codes | Optional | `YOUR_SENDER_ADDRESS@gmail.com` |
| `SMTP_APP_PASSWORD` | backend | Gmail app password for that sender | Optional | `YOUR_GMAIL_APP_PASSWORD` |
| `CORS_ORIGINS` | backend | Comma-separated allowed browser origins | Optional (default `http://localhost:5173,http://localhost:8081`) | `http://localhost:5173` |
| `FLASK_CONFIG` | backend (`run.py`) | `development` (default) or `production` | Optional | `development` |
| `BACKEND_HOST` | backend (`run.py`) | Bind address of the dev server | Optional (default `127.0.0.1`) | `127.0.0.1` |
| `BACKEND_PORT` | backend (`run.py`) | Port of the dev server | Optional (default `5000`) | `5000` |
| `DATABASE_URL` | backend | Database URL used only by the `production` config | Only with `FLASK_CONFIG=production` | `postgresql://USER:YOUR_DATABASE_PASSWORD@HOST/DBNAME` |

Not an environment variable, but required for push notifications: the Firebase service-account key file
**`backend/firebase-service-account.json`** (git-ignored; path is fixed in `notification_service.py`).

Test/tooling variables (set them in the shell, **not** in `.env`):

| Variable | Used by | Purpose |
|---|---|---|
| `FS_ALLOW_WRITES=1` | `backend/tests/writes/*` | Enables the opt-in write tests (section 8) |
| `FOODSHARE_PYTHON` | `scripts/run_checks.py` | Python interpreter used for the backend tests (default: the one running the script) |

### Mobile app – `FoodShareMobile/.env` (template: [`FoodShareMobile/.env.example`](FoodShareMobile/.env.example))

| Variable | Component | Purpose | Required? | Example |
|---|---|---|---|---|
| `API_URL` | mobile (`src/api/client.ts`, via `@env`) | Backend base URL | **Yes** | `http://10.0.2.2:5000/api` (Android emulator) |
| `GOOGLE_WEB_CLIENT_ID` | mobile (`src/context/AuthContext.tsx`, via `@env`) | OAuth Web client ID passed to `GoogleSignin.configure` (same value as the backend's) | For Google Sign-In | `YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com` |
| `MAPS_API_KEY` | Android build (`android/app/build.gradle`) | Google Maps SDK for Android key, injected into the manifest | For map tiles | `YOUR_GOOGLE_MAPS_ANDROID_API_KEY` |

Plus the git-ignored file **`FoodShareMobile/android/app/google-services.json`** (Firebase Android config, section 4.4).

### Admin dashboard

No environment variables are read. The backend URL is hard-coded in `admin-dashboard/src/api/client.ts`.

---

## 7. External services and what works without them

Verified: with **only** `JWT_SECRET_KEY` and `DEV_DATABASE_URL` set (no AWS, Firebase, SMTP or Google configuration),
the backend starts and the complete core workflow works through the API: registration, admin approval, document
upload (local storage), offer creation, offer list with distances, recommendations, claim, QR verification,
leaderboard, history, admin statistics.

| Service | Feature that uses it | Configuration needed | App starts without it? | Works without it | Unavailable without it |
|---|---|---|---|---|---|
| **AWS S3** | Image and document uploads | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, `AWS_BUCKET_NAME` | Yes | Uploads fall back to local storage: documents in `backend/private_uploads/` (served to admins only through signed, expiring links), public images in `backend/app/static/uploads/` (both git-ignored) | Cloud storage only; nothing user-visible is lost on a single machine |
| **Firebase Cloud Messaging** | Push notifications for new offers / verified claims | Backend: `backend/firebase-service-account.json`. App: `android/app/google-services.json` | Backend: yes (logs `Firebase initialization error`). App: the Android build requires `google-services.json` (see 4.4) | In-app notification inbox rows are still written for students | Push notifications |
| **Google Sign-In** | "Sign in with Google" for students | `GOOGLE_WEB_CLIENT_ID` in both `.env` files; a matching OAuth setup in Google Cloud (Android client for `com.foodsharemobile` with the signing certificate's SHA-1 – a Google requirement, not configured in this repository) | Yes | E-mail/password registration and login | Google login (backend answers HTTP 503 "Google sign-in is not available right now.") |
| **Google Maps** | Offer map in the student app | `MAPS_API_KEY` | Yes (build prints a warning) | Offer list, distances, everything else | Map tiles (the map renders without tiles) |
| **SMTP (Gmail)** | Password-reset code e-mail | `SMTP_EMAIL`, `SMTP_APP_PASSWORD` | Yes | Everything else. `POST /api/auth/forgot-password` still answers with the same generic message (to avoid revealing whether an account exists) | Password reset: no e-mail is sent, so the user never receives the code |

---

## 8. Testing

Overview of what each suite needs:

| Suite | Command (from) | Needs DB | Writes to DB | Needs running backend | External services | Emulator |
|---|---|---|---|---|---|---|
| Quality gate | `python scripts/run_checks.py --all` (root) | yes | no | no | no | no |
| Backend smoke + edge | `python -m pytest -m "smoke or edge"` (`backend/`) | yes | **no** (read-only) | no (in-process) | no | no |
| Backend write tests | `FS_ALLOW_WRITES=1` + `python -m pytest tests/writes` (`backend/`) | yes | **yes** (creates and deletes test rows) | no (in-process) | no (see note) | no |
| Live API test | `python -m pytest test_api.py` (`backend/`) | yes | **yes** (leaves a user behind) | **yes**, on `127.0.0.1:5000` | no | no |
| Mobile Jest | `npm test` (`FoodShareMobile/`) | no | no | no | no | no |
| TypeScript checks | `npx tsc --noEmit` / `npx tsc -b --noEmit` | no | no | no | no | no |
| Lint | `npm run lint` (each frontend) | no | no | no | no | no |

The backend tests need the packages from `requirements.txt` plus pytest (`python -m pip install pytest`; verified
with pytest 9.0.3 and 9.1.1) and a configured `backend/.env`. There are **no automated tests for the admin dashboard**, and the
emulator/UI checks recorded in `PROJECT_STATE.md` were performed manually (not an automated suite).

### 8.1 Quality gate

```powershell
python scripts/run_checks.py          # backend always; frontends only if changed vs. upstream
python scripts/run_checks.py --all    # everything
```

Runs `pytest -m "smoke or edge"` in `backend/` and a TypeScript *ratchet*: the number of `tsc` errors per frontend
must not exceed `.claude/hooks/tsc-baseline.json` (admin 1, mobile 14). Requires `npx` on `PATH`.
Exit code 0 = green, 1 = a check failed, 2 = a check could not run.

### 8.2 Backend smoke and edge tests (read-only)

```powershell
cd backend
python -m pytest -m "smoke or edge"
```

In-process Flask test client, tokens are minted locally (no login calls), the limiter is disabled. The tests **only
read** the database. Several tests pick existing rows (a `student`, an `admin`, a verified `restaurant`, a legacy
`user`) and are **skipped** if such a row does not exist, so on an empty database create the accounts from section 5
first. The `student` fixture is the `role='student'` account with the lowest id; it must be **verified**, otherwise the
4 cases of `test_claim_rejects_non_numeric_offer_id` fail (the claim is refused with 403 before the id is checked;
observed during verification). One test is an intentional strict `xfail` pinning a known bug (`GET /api/leaderboard` is registered twice).

### 8.3 Backend write tests (opt-in, modify the database)

```powershell
cd backend
$env:FS_ALLOW_WRITES = "1"; python -m pytest tests/writes; Remove-Item Env:FS_ALLOW_WRITES
```

```bash
cd backend && FS_ALLOW_WRITES=1 python -m pytest tests/writes
```

They insert rows marked with `@fs-test.local` e-mails / `[TEST]` titles and delete them again. Run them against a
**separate, disposable database** (point `DEV_DATABASE_URL` at it), not against a database with real users:
some flows create offers, which notify the student accounts present in the database (push notifications are only
sent if Firebase is configured and those accounts have FCM tokens). Some assertions expect that no other offers from
the same day exist in that database.

### 8.4 Live API test (`backend/test_api.py`)

```powershell
# terminal 1: backend running on 127.0.0.1:5000 (python run.py)
cd backend
python -m pytest test_api.py
```

Two `requests`-based tests against `http://127.0.0.1:5000/api/auth` (register + login). It is **not** collected by
default (`pytest.ini` has `testpaths = tests`). Each run registers a new `testbot_<random>@student.hu` student that is
**not removed**, so use a disposable database.

### 8.5 Mobile app (Jest, TypeScript, lint)

```powershell
cd FoodShareMobile
npm test               # Jest
npx tsc --noEmit       # TypeScript
npm run lint           # ESLint
```

### 8.6 Admin dashboard (TypeScript, lint, build)

```powershell
cd admin-dashboard
npx tsc -b --noEmit
npm run lint
npm run build          # currently fails (1 TypeScript error), see 4.3
npx vite build         # bundle without type check
```

### 8.7 Results observed while verifying this README (2026-10-18)

Verification simulated a fresh clone: a throwaway copy containing **only the files that are committed** (no `.env`,
no `node_modules`, no `venv`, no Firebase files), set up by following sections 4 and 5 – new virtual environment
(`pip install -r requirements.txt` + pytest), `.env` copied from `.env.example`, a **new, isolated database** created
with the `psql` commands of 4.1, schema from the first backend start, migrations applied afterwards, accounts created
with the commands of section 5. No AWS, SMTP, Google or Firebase service-account configuration was present.

| Check | Result |
|---|---|
| Backend install (`pip install -r requirements.txt`, `pip check`) | succeeds, no broken requirements (pip warns that the pinned GeoAlchemy2 0.18.3 is a yanked release; it installs and works) |
| Backend start (`python run.py`), `GET /api/offers` | HTTP 200 `[]` after ~10 s on first start |
| Migrations via `psql -f` after first start | all 4 succeed |
| Account commands of section 5 (PowerShell register, bash `curl` register, `psql` admin promotion) | succeed |
| End-to-end API workflow (register → approve → document upload (local) → offer → claim → QR verify → leaderboard/history/stats) | 23/23 steps as expected |
| Backend smoke + edge | 239 passed, 1 skipped (no legacy `user` account), 1 xfailed (known bug) |
| Backend write tests | 53 passed |
| `test_api.py` (live backend on 127.0.0.1:5000) | 2 passed |
| Quality gate `run_checks.py --all` (developer database, read-only) | PASS: backend 240 passed / 1 xfailed; admin `tsc` 1 error (= baseline); mobile `tsc` 14 errors (= baseline) |
| Admin `npm ci` | succeeds |
| Admin `npm run build` | **fails** (1 TypeScript error); `npx vite build` succeeds |
| Admin TypeScript / lint | **1 error** / **12 errors** |
| Mobile `npm ci` | **fails with `ERESOLVE`**; `npm ci --legacy-peer-deps` succeeds (see 4.4) |
| Mobile Jest | 3 suites / 31 tests passed; **`__tests__/App.test.tsx` fails** (pre-existing: Jest is not configured for the ESM Firebase modules) |
| Mobile TypeScript / lint | **14 errors** / **14 errors, 57 warnings** |
| Android debug build (`gradlew assembleDebug` in `FoodShareMobile/android`, fresh copy, own `google-services.json`, empty `MAPS_API_KEY`) | BUILD SUCCESSFUL (6 min) with the documented Maps warning – after `ANDROID_HOME` pointed at the SDK folder (see 4.4 step 5) |
| Mobile release JS bundle (`npx react-native bundle --platform android --dev false ...`, developer checkout) | succeeds |
| Admin dashboard dev server + login against the backend (developer checkout) | works (opened in a browser) |
| `npx react-native run-android` / app on the emulator | **not re-run** for this README; emulator testing is recorded in `PROJECT_STATE.md` |

Not verifiable on the verification machine: a computer without the toolchain already installed (Python, Node,
PostgreSQL/PostGIS, JDK and Android SDK were present), PowerShell's default execution policy, and the behaviour with
real AWS, SMTP, Google Sign-In, Google Maps and Firebase credentials.

---|---|
| Backend smoke + edge | 239 passed, 1 skipped (no legacy `user` account), 1 xfailed (known bug) |
| Backend write tests | 53 passed |
| `test_api.py` (live backend on 127.0.0.1:5000) | 2 passed |
| Quality gate `run_checks.py --all` (developer database, read-only) | PASS: backend 240 passed / 1 xfailed; admin `tsc` 1 error (= baseline); mobile `tsc` 14 errors (= baseline) |
| Admin `npm ci` (clean copy, no `node_modules`) | succeeds |
| Mobile `npm ci` (clean copy) | **fails with `ERESOLVE`**; `npm ci --legacy-peer-deps` succeeds (see 4.4) |
| Mobile Jest | 3 suites / 31 tests passed; **`__tests__/App.test.tsx` fails** (pre-existing: Jest is not configured for the ESM Firebase modules) |
| Mobile TypeScript | **14 errors** (unchanged baseline) |
| Admin TypeScript | **1 error** (unchanged baseline) |
| Mobile lint | **14 errors, 57 warnings** |
| Admin lint | **12 errors** |
| Admin `npm run build` | **fails** (TypeScript error); `npx vite build` succeeds |
| Mobile release JS bundle (`npx react-native bundle --platform android --dev false ...`) | succeeds |
| Android debug build (`gradlew assembleDebug` in `FoodShareMobile/android`) | BUILD SUCCESSFUL (developer machine, with local `google-services.json` and `.env`) |
| Admin dashboard dev server + login against the backend | works (opened in a browser) |
| `npx react-native run-android` on the emulator | **not re-run** for this README; emulator testing is recorded in `PROJECT_STATE.md` |

---

## 9. Known limitations

Confirmed in the code / `PROJECT_STATE.md` at the time of writing:

- Development-stage MVP: local setup only, **no production deployment**; the `backend/Procfile` (`gunicorn app:app`)
  does not match the code (the `app` package exposes `create_app()`, not an `app` object) and was never used.
- Tested on an **Android emulator** only; **iOS and physical Android devices were not tested**.
- No server-side JWT revocation: tokens stay valid until they expire (access 15 min, refresh 7 days).
- Restaurants can create and delete offers, but **editing an existing offer is not implemented**.
- Suspension has **no unsuspend action** and overwrites the previous verification status.
- Pending claims never expire; offers expire at the end of the day they were created (Europe/Budapest).
- Admin approve/reject/suspend/cancel actions are not written to the audit log.
- Rate limits are in memory (reset on restart; not shared between processes).
- Push/inbox notification texts are not translated (the app UI is available in English, Hungarian and Turkish).
- `GET /api/leaderboard` is registered twice; the restaurant variant is unreachable (pinned by an `xfail` test).
- Existing tooling failures listed in 8.7: TypeScript errors (mobile 14, admin 1), lint errors, failing
  `App.test.tsx`, failing admin `npm run build`.

The full list of open issues is in [`PROJECT_STATE.md`](PROJECT_STATE.md) §7–§8.

---

## 10. Thesis

This repository contains the source code corresponding to the BSc thesis

> **Design and Development of FoodShare Hungary – A Location-Based Food Sharing Platform for Students**
> Author: Meriç Topal (E1WU52) · Supervisor: Peter Novak
> University of Pécs, Faculty of Engineering and Information Technology

The thesis document itself is not part of this repository.

---

## 11. Further documentation in this repository

- [`PROJECT_STATE.md`](PROJECT_STATE.md) – current technical state, recorded test evidence, open issues.
- [`docs/`](docs/) – short technical notes per domain: [`auth.md`](docs/auth.md), [`claims.md`](docs/claims.md),
  [`qr.md`](docs/qr.md), [`documents.md`](docs/documents.md), [`location.md`](docs/location.md),
  [`recommendations.md`](docs/recommendations.md), [`notifications.md`](docs/notifications.md),
  [`admin.md`](docs/admin.md), [`testing.md`](docs/testing.md), [`thesis.md`](docs/thesis.md).
- [`CLAUDE.md`](CLAUDE.md) – repository conventions (API error format, roles, security rules).
