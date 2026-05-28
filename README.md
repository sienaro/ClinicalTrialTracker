# Clinical Trial Tracker

A Next.js platform that matches patients with recruiting clinical trials from [ClinicalTrials.gov](https://clinicaltrials.gov/). **Google Gemini AI** is the core of the matching engine — it reads each trial's full eligibility criteria and reasons about patient fit, rather than relying on keyword overlap. Create an account to **save trials, track your application pipeline, and keep a reusable profile**.

## AI features

- **AI match ranking** — Gemini scores each recruiting trial (0–100) against the patient profile with plain-English reasons.
- **AI health snapshot** — turns a condition + context notes (or an imported FHIR problem list) into a structured clinical overview.
- **Plain-language explainer** — rewrites a trial's dense description into "what this is actually testing," who it's for, and what participation involves.
- **Ask AI about this trial** — a per-trial Q&A chat grounded only in that study's eligibility text.

## Platform features

- **Rich trial detail page** (`/trial/[NCTID]`) — phase, status, enrollment, sponsor, interventions, locations, and contacts pulled live from the ClinicalTrials.gov API.
- **Accounts** — email + password sign-in; profile and saved trials persist across visits.
- **Saved-trial pipeline** (`/saved`) — track trials as Interested → Contacted → Applied with private notes.
- **Account & data control** (`/account`) — export everything as JSON or CSV, or delete your account.

## How it works

1. **Enter a condition** (or import a FHIR JSON patient bundle for richer context)
2. The app fetches **recruiting trials** from the ClinicalTrials.gov v2 API
3. **Gemini AI** analyzes each trial's eligibility text against the patient profile (age, sex, conditions, medical context) and returns a match score (0–100), a label (possible / unclear / unlikely), and a natural-language explanation
4. Results are ranked by AI score and can be filtered by sex conflict, age range, or match quality
5. **Logged-in users** can save trials, mark them Interested → Contacted → Applied, add private notes, and keep their profile so it's prefilled next visit

## Accounts & data

- **Auth:** email + password via [Auth.js v5](https://authjs.dev) (JWT sessions, bcrypt-hashed passwords)
- **Storage:** local **SQLite** database via [Prisma](https://www.prisma.io/) (`User`, `Profile`, `SavedTrial`)
- **Privacy note:** unlike the guest (logged-out) experience, where everything stays in the browser tab, a logged-in account **stores your profile and saved trials in the app's database**. This is a deliberate trade-off for persistence — avoid entering highly sensitive personal health information. Trial eligibility texts (public data) and the saved profile are the only things written to the database; only the condition string and eligibility texts are ever sent to Gemini.

## AI integration

The AI ranking uses **Gemini 2.5 Flash Lite** (configurable via `GEMINI_MODEL`) through the Google Generative AI SDK. The prompt sends the patient profile and each trial's eligibility criteria and asks Gemini to score and explain each match. If the API key is not configured, the app falls back to a keyword-overlap heuristic.

Without AI, matching is a basic token overlap between the condition string and trial text. With AI, Gemini reads lines like _"Inclusion: HbA1c between 7.5–11%, no prior insulin, aged 30–70"_ and judges fit against the real patient context.

## Prerequisites

- Node.js 20+ recommended (18+ should work)
- A free Google Gemini API key from [aistudio.google.com](https://aistudio.google.com)

## Setup

```bash
npm install                       # also runs `prisma generate`
cp .env.local.example .env.local  # then fill in the values below

# Generate an Auth.js secret and paste it into .env.local as AUTH_SECRET:
openssl rand -base64 33

npx prisma migrate dev            # creates the local SQLite database (prisma/dev.db)
npm run dev
```

Open `http://localhost:3000`. Create an account from the **Sign up** link to use saved trials and a persistent profile.

## Environment variables

| Variable | Required | Where | Description |
|----------|----------|-------|-------------|
| `GEMINI_API_KEY` | Recommended | `.env.local` | Enables AI-powered trial ranking. Free tier at [aistudio.google.com](https://aistudio.google.com) — 1,500 requests/day. Without it, the keyword fallback is used. |
| `GEMINI_MODEL` | Optional | `.env.local` | Override the model (default `gemini-2.5-flash-lite`). |
| `AUTH_SECRET` | Yes (for accounts) | `.env.local` | Signs login sessions. Generate with `openssl rand -base64 33`. |
| `DATABASE_URL` | Yes | `.env` | SQLite location. Pre-set to `file:./dev.db`; committed because it's not a secret. |

> Secrets live in `.env.local` (gitignored). `.env` holds only the non-secret `DATABASE_URL`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development |
| `npm run build` | Production build (runs `prisma generate` first) |
| `npm run start` | Run production server |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
| `npm run db:migrate` | Apply Prisma migrations to the local SQLite DB |
| `npm run db:studio` | Open Prisma Studio to inspect data |

## Repository

Configured for: `https://github.com/sienaro/ClinicalTrialTracker.git`

```bash
git remote add origin https://github.com/sienaro/ClinicalTrialTracker.git
```

## Limitations

- Match scores are **exploratory heuristics**, not medical determinations — always verify on ClinicalTrials.gov
- The Gemini prompt caps eligibility text at 2,500 characters per trial; very long criteria may be truncated
- ClinicalTrials.gov is queried only by condition name (not age/sex filters), so the result set may include trials the patient cannot join — AI ranking surfaces the best fits from that set
- Free Gemini tier allows 15 requests/minute and 1,500/day, which is sufficient for demos but may throttle under heavy concurrent use
