# Clinical Trial Tracker

Web-first class project for exploring **recruiting** studies on [ClinicalTrials.gov](https://clinicaltrials.gov/) with a **demo-only ranking** layer. Use **synthetic personas only**; do not enter real medical records.

## Prerequisites

- Node.js 20+ recommended (18+ should work)

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## What this demo does

- Sends a **server-side** request to the public ClinicalTrials.gov v2 API (no API key, no paid services).
- Validates JSON input sizes/fields on `/api/trials/search`.
- Marks API responses with `Cache-Control: no-store` so browsers do not cache trial payloads.
- Adds basic security headers in `next.config.ts` (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`).
- Keeps **profile + session notes in the browser tab only** (React state). Refreshing clears them. The server does not persist uploads or notes.

## What it does *not* do (yet)

- No authenticated accounts, encryption at rest for PHI, or HIPAA-grade controls — this is intentional for a coursework sandbox.
- No medical record upload pipeline (would need threat modeling, virus scanning, encryption, retention policy, and legal review before real data).
- Ranking is a **keyword / rough age scan** for class discussion, **not** clinical eligibility.

## Repo remote

This clone is configured for:

`https://github.com/sienaro/ClinicalTrialTracker.git`

If you still need to attach a remote:

```bash
git remote add origin https://github.com/sienaro/ClinicalTrialTracker.git
```

## Scripts

| Command        | Purpose                 |
| -------------- | ----------------------- |
| `npm run dev`  | Local development       |
| `npm run build`| Production build        |
| `npm run start`| Run production server   |
| `npm run lint` | ESLint (`next/core-web-vitals`) |
