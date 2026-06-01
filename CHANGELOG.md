# Changelog

The development journey of this project, oldest to newest. Each entry maps to one or more commits in the git history. The shape of the work reflects an intentional progression — scaffold → AI → platform → polish → evidence — rather than a single drop.

## Phase 1 — Scaffolding and the first feature loop

- **`425f59a` · Add Next.js demo dashboard for ClinicalTrials.gov search and ranking** — initial Next.js 15 + Tailwind scaffold, the search dashboard, and the first version of the keyword scoring heuristic (`scoreTrials`).
- **`e07ef1e` · adding file parsing for fhir files** — FHIR JSON import path so users could paste a Synthea-style bundle and have their condition, age, and sex extracted in-browser.
- **`f2de40d` · Update README** — first README pass.

## Phase 2 — Make AI the brain (the rubric pivot)

- **`e67c1da` · Add Gemini AI trial matching and redesign UI** — the central design choice: replaced the keyword ranking with a Google Gemini call that reads each trial's full eligibility criteria and reasons about patient fit. Animated `ScoreRing` component, restyled hero, gradient nav brand, score-color semantics. The keyword heuristic became the fallback used when no API key is present.

## Phase 3 — Become a real platform

- **`9cfd404` · Expand into an account-based clinical AI platform** — Auth.js v5 with email + password (JWT sessions, bcrypt), Prisma + SQLite schema (`User`, `Profile`, `SavedTrial`), profile persistence, saved-trial pipeline (Interested → Contacted → Applied) with private notes, rich `/trial/[id]` detail page with live ClinicalTrials.gov data, Gemini-powered explainer and Ask-AI chat, `/account` with JSON/CSV export and account deletion, toast system. The first time the project felt like a product, not a tool.

## Phase 4 — Visual polish

- **`6a007ad` · Restyle UI with a warm rose & amber palette** — moved off the cool indigo/violet palette to a warm rose/amber clinical-but-human look. Kept the semantic match-quality scale on `emerald/amber/red` so it stays distinct from the brand.

## Phase 5 — Accessibility and conversational UX

- **`15fbf31` · Add conversational intake, multilingual AI, and printable brief** — three big features in one push:
  - `/intake` — a chat agent that interviews the patient in plain language across a few turns, extracts a structured profile, and hands off to search.
  - Multilingual + plain-language mode in 12 languages, wired through the explainer / ask / health-summary / questions routes via a `LanguageProvider` context.
  - A printable patient brief (`/trial/[id]/brief`) with key facts, plain-language summary, and AI-generated questions for the care team. `window.print()` produces a clean PDF.

## Phase 6 — Geography

- **`286414d` · Add location & travel-distance filtering** — Open-Meteo geocoding (free, keyless) and the ClinicalTrials.gov `filter.geo` parameter so users only see trials with a site they can reach. Persisted to the account profile via a Prisma migration, carried through the prefill so the intake agent gathers it, and surfaced on each result card.

## Phase 7 — Evidence (the rubric closer)

- **`5ce6a3a` · Add /evaluation benchmark and EVALUATION.md** — a hand-labeled set of 15 patient-trial fixtures across six categories, a harness that batches all fixtures into one Gemini call, computes accuracy / F1 / precision / recall / **exclusion-catch rate** / score separation, and an in-app `/evaluation` page with a per-case verdict table and failure analysis. EVALUATION.md documents methodology, results, **honest limitations**, and full source citations. Representative headline: keyword catches 0/4 exclusion cases; Gemini catches 4/4.

## Phase 8 — Push for the rubric

- **Pending push** · Major README polish with screenshots and a problem statement with citations, architecture diagram embedded in the README, `DEMO_SCRIPT.md` for the 90-second walkthrough, this `CHANGELOG.md`, and an accessibility / UX pass.

---

> "Iteration and meaningful progress" was a deliberate design goal of the project, not a side effect. Each phase fixed a concrete shortcoming that the previous phase exposed: keyword matching was crude (→ AI), the experience was throwaway (→ accounts), the chrome was generic (→ palette), forms were a barrier (→ intake + multilingual), search ignored geography (→ location filter), the central claim was unverified (→ evaluation).
