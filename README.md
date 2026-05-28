# Clinical Trial Tracker

A Next.js web app that matches patients with recruiting clinical trials from [ClinicalTrials.gov](https://clinicaltrials.gov/). **Google Gemini AI** is the core of the matching engine — it reads each trial's full eligibility criteria and reasons about patient fit, rather than relying on keyword overlap.

## How it works

1. **Enter a condition** (or import a FHIR JSON patient bundle for richer context)
2. The app fetches **recruiting trials** from the ClinicalTrials.gov v2 API
3. **Gemini AI** analyzes each trial's eligibility text against the patient profile (age, sex, conditions, medical context) and returns a match score (0–100), a label (possible / unclear / unlikely), and a natural-language explanation
4. Results are ranked by AI score and can be filtered by sex conflict, age range, or match quality

All patient data stays in the browser tab — only the condition string and eligibility texts are sent to Gemini for analysis. No PHI leaves to ClinicalTrials.gov.

## AI integration

The AI ranking uses **Gemini 2.0 Flash** via the Google Generative AI SDK. The prompt sends the patient profile and each trial's eligibility criteria and asks Gemini to score and explain each match. If the API key is not configured, the app falls back to a keyword-overlap heuristic.

Without AI, matching is a basic token overlap between the condition string and trial text. With AI, Gemini reads lines like _"Inclusion: HbA1c between 7.5–11%, no prior insulin, aged 30–70"_ and judges fit against the real patient context.

## Prerequisites

- Node.js 20+ recommended (18+ should work)
- A free Google Gemini API key from [aistudio.google.com](https://aistudio.google.com)

## Setup

```bash
npm install
cp .env.local.example .env.local
# Edit .env.local and paste your GEMINI_API_KEY
npm run dev
```

Open `http://localhost:3000`.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | Recommended | Enables AI-powered trial ranking. Free tier at [aistudio.google.com](https://aistudio.google.com) — 1,500 requests/day. Without this, keyword-based fallback is used. |

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local development |
| `npm run build` | Production build |
| `npm run start` | Run production server |
| `npm run lint` | ESLint (`next/core-web-vitals`) |

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
