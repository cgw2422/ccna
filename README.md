# CCNA Cards

A mobile-first, installable (PWA) flashcard app for **Jeremy's IT Lab CCNA** — import the whole Anki deck at once, organize it by study day, and control exactly which days feed your daily study session. Spaced repetition uses **FSRS** (via [`ts-fsrs`](https://github.com/open-spaced-repetition/ts-fsrs)).

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · PostgreSQL · Prisma 6 · Railway

---

## Features

| Area | What it does |
| --- | --- |
| **Study Plan** | Every Jeremy day is **Active**, **Review Only** or **Paused**. Activate All / Set All Review Only / Pause All / Select Range (e.g. Day 1–20), with Undo. Search by topic or day number, filter by status. Changes apply to the very next card. |
| **Study** | Full-screen card, `SHOW ANSWER`, then `AGAIN / HARD / GOOD / EASY` with the next interval on each button. Progress `12 / 48`, day/topic label, Undo, keyboard shortcuts on desktop (Space, 1–4, Z). |
| **Spaced repetition** | FSRS with 1m/10m learning steps, configurable target retention, fuzzing. Per-card state, difficulty, stability, due date, reps, lapses, last review. |
| **Import** | CSV, TSV, Anki “Notes in Plain Text” (.txt, reads `#separator`/`#html`/`#guid column`/… headers) and **Anki .apkg** (legacy and modern zstd format, images included). Column-mapping screen, preview, day detection summary, chunked import for thousands of cards. |
| **Day detection** | Tags/deck names like `Day1`, `Day01`, `Day_1`, `Day-1`, `day1`, `Day 05 - VLANs`, `CCNA::Day_05` → **Day N**. Decks without days fall back to `Section N` / `Lesson N` / `Chapter N` / `Module N` (e.g. Flackbox). No match → **Unassigned** (assign in bulk from the card browser). |
| **Anki rendering** | `.apkg` cards are rendered with the deck's own card templates, like Anki: one card per Anki card (cloze c1/c2… become separate cards), `{{FrontSide}}`/conditionals/filters, and Image Occlusion (built-in and the *Image Occlusion Enhanced* add-on) with masks over the image. |
| **Duplicates** | Same Anki GUID (unchanged → skipped, changed → updated), same question+answer → skipped, same question/different answer → update / add / skip (your choice). Updating never touches review progress. |
| **Stats** | Learned, unseen, due, reviews today/week, accuracy, streak, 14-day activity, mastery by day (tap for details), performance by CCNA domain, **Weak Areas** + `STUDY WEAK AREAS`. |
| **Custom Study** | Specific days, a day range, a CCNA domain, weak cards, missed cards, due cards (or review ahead), random — temporary sessions that never change the Study Plan. |
| **Card browser** | Search; filter by day, domain, status (new/learning/learned/due/weak) and source; card detail with review history; edit; bulk-assign Unassigned cards to a day. |
| **Data export** | Settings → Data: full JSON (cards, day assignments + statuses, review history, settings, imports) or CSV (cards + progress). |
| **PWA** | Manifest, icons (incl. maskable + Apple touch icon), standalone mode, safe-area aware layout, service worker for the app shell, light/dark/system theme. |

### Study logic

`START STUDYING` builds the queue live on every card:

1. Learning/relearning cards that are due now (from Active **and** Review Only days)
2. Due review cards (Active **and** Review Only days), up to the daily review limit
3. New cards from **Active** days only, up to the daily new-card limit (course order or randomized)
4. Learning cards due in the next 20 minutes, so a session can finish

Paused days contribute nothing. Pausing only changes a row in `UserStudyDayState` — progress and review history are never deleted, so switching back restores everything.

---

## Architecture

```
prisma/schema.prisma        data model (content separate from per-user progress)
prisma/seed.ts              idempotent seed: CCNA domains (+ optional first user with demo days)
src/proxy.ts                auth gate (Next 16 "proxy", formerly middleware)
src/lib/
  auth.ts                   email/password (bcrypt), DB-backed sessions, httpOnly cookie
  study/fsrs.ts             FSRS scheduling + interval previews + mastery score
  study/queue.ts            Study Plan → allowed days → due counts / next card
  study/session.ts          sessions, answering, undo
  study/stats.ts            aggregates (per day, per domain, streak, weak cards)
  study/custom.ts           custom-study card selection
  import/                   day detection, CSV/TSV/Anki-text parser, .apkg reader, chunked commit
  content/                  HTML sanitizing, hashing, rendering (CLI monospace, code, cloze, images)
  storage/                  object-storage abstraction (local disk / S3-compatible)
src/app/(app)/              Home · Study · Plan · Stats · Settings · Cards (bottom-nav screens)
src/app/session/[id]        full-screen flashcard UI
src/app/api/                study, import, media, export, health
```

**Data model highlights**

- `Card` holds only content (sanitized HTML front/back, tags, source, Anki GUID, original tags/deck, import batch). It never stores review status.
- `UserCardProgress` (one row per user × card) holds the FSRS state: `state, due, stability, difficulty, reps, lapses, lastReview, …`. No row = unseen.
- `Review` is the immutable review log (also stores a snapshot for Undo).
- `StudyDay` (day number + editable title) belongs to a `Deck`; `UserStudyDayState` stores each user's Active/Review Only/Paused choice; `StudyDayDomain` links days to `CcnaDomain`s.
- `ImportBatch` tracks every import (file, date, counts); `MediaAsset` tracks images whose bytes live in object storage, never in Postgres.
- Users own decks, so more accounts can be added later without schema changes.

---

## Local development

Requirements: Node 20.9+ (22 recommended) and PostgreSQL 14+.

```bash
cp .env.example .env            # set DATABASE_URL
npm install
npx prisma migrate dev          # create tables
SEED_USER_EMAIL=you@example.com SEED_USER_PASSWORD='a-long-password' npm run db:seed   # optional
npm run dev                     # http://localhost:3000
```

If you don't seed a user, open `/register` — registration is always open while the database has **no users**, so the first account is yours. New accounts start with sample “Jeremy-style” days (Day 1–12) so you can try everything; remove them in Settings → Data (or tick “Remove demo cards” when importing).

Checks:

```bash
npm run typecheck
npm test                                   # unit tests (day detection, parsing, rendering)
npx tsx scripts/verify-study-logic.ts      # integration check of Active/Review Only/Paused rules (needs DATABASE_URL)
npm run build
```

---

## Deploying to Railway

The repo includes `railway.json`, which tells Railway to:

- **build** with `npm run build` (`prisma generate && next build`)
- **start** with `npm run start`, which runs `prisma migrate deploy && prisma db seed` (both idempotent) and then `next start` on Railway's `$PORT` — so the database schema is always up to date before the app serves requests
- health-check `GET /api/health`

### Step by step

1. **Push this repo to GitHub.**
2. In Railway: **New Project → Deploy from GitHub repo** → pick this repo.
3. In the project canvas: **+ Create → Database → Add PostgreSQL**.
4. Open the app service → **Variables** and add:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference variable — pick it from the dropdown) |
   | `SEED_USER_EMAIL` | your email (optional — creates your account on first deploy) |
   | `SEED_USER_PASSWORD` | a strong password (optional; remove both after first deploy if you like) |
   | `ALLOW_REGISTRATION` | `false` (default). The first account can always register; set `true` to allow more. |
   | `STORAGE_DIR` | `/data/media` (see step 5) |

5. **Image storage** (needed for `.apkg` images / uploaded card images). Choose one:
   - **Railway Volume (simplest):** right-click the app service → **Attach Volume**, mount path `/data`. Keep `STORAGE_DRIVER` unset (`local`) and `STORAGE_DIR=/data/media`.
   - **S3-compatible bucket** (Railway Bucket, Cloudflare R2, AWS S3, …): set `STORAGE_DRIVER=s3`, `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (and `S3_FORCE_PATH_STYLE=true` if your provider needs it).
6. App service → **Settings → Networking → Generate Domain**.
7. Deploy (Railway redeploys automatically on every push). The deploy logs should show `All migrations have been successfully applied` (or `No pending migrations`) and `✓ CCNA domains` before `Ready`.
8. Open the domain on your phone, log in (or `/register` for the first account), then **Add to Home Screen** (iOS Safari: Share → Add to Home Screen; Android Chrome: menu → Install app).

### Environment variables

| Name | Required | Default | Purpose |
| --- | --- | --- | --- |
| `DATABASE_URL` | ✅ | — | PostgreSQL connection string |
| `ALLOW_REGISTRATION` | | `false` | Allow sign-ups after the first user exists |
| `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` | | — | Seed creates this user (with demo days) if missing |
| `SEED_DEMO_IF_EMPTY` | | `true` | Re-add demo cards for the seed user when their deck is empty |
| `STORAGE_DRIVER` | | `local` | `local` or `s3` |
| `STORAGE_DIR` | | `./storage` | Directory for `local` storage (use a Volume on Railway) |
| `S3_BUCKET`, `S3_REGION`, `S3_ENDPOINT`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE` | for `s3` | | S3-compatible storage |

### Schema changes

```bash
npx prisma migrate dev --name describe_change   # locally; commit prisma/migrations
git push                                         # the app runs prisma migrate deploy on start
```

---

## Importing Jeremy's deck

1. In Anki desktop: **File → Export…**
   - **Anki Deck Package (.apkg)** — easiest, includes images, or
   - **Notes in Plain Text (.txt)** with *Include HTML and media references*, *Include tags*, *Include deck name* and *Include unique identifier* ticked.
2. In the app: **Settings → Import cards**, choose the file.
3. Check the column mapping (Question → Front, Answer → Back, Tags → Tags; deck name and GUID are pre-mapped for Anki exports) and the detected days.
4. Import. You'll see *New cards / Duplicates skipped / Updated / Unassigned*.
5. Open **Study Plan**, set the days you've covered to Active, upcoming days to Paused, and start studying.

Re-importing an updated export is safe: unchanged cards are skipped and changed cards are updated in place, keeping your progress. Images referenced by text exports can be uploaded later under **Settings → Card images** (matched by filename).

Imported days get default titles from Jeremy's course outline (and CCNA domains); edit any title or domain by tapping the day in the Study Plan — the flashcards themselves are never modified.
