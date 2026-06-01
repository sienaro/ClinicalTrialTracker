# Evaluation & Evidence

This document presents a small but honest benchmark of the project's core claim:

> **Google Gemini reads eligibility criteria and ranks clinical-trial matches more accurately than a keyword-overlap baseline — especially on _exclusion_ criteria, where keyword matching is fundamentally blind.**

A live, runnable version of this benchmark is built into the app at **[`/evaluation`](src/app/evaluation/page.tsx)** — click "Run benchmark" and the numbers below are recomputed against the current Gemini model in ~5 seconds.

---

## Methodology

### The benchmark

A hand-labeled set of **15 patient–trial pairs** lives in [`src/eval/fixtures.ts`](src/eval/fixtures.ts). Each fixture pairs a synthetic patient profile (condition, age, sex, optional medical context) with a synthetic-but-realistic ClinicalTrials.gov-shaped trial (title, listed conditions, eligibility criteria), plus a ground-truth label (`appropriate` / `inappropriate` / `borderline`) and a human-readable rationale for that label.

Fixtures are deliberately constructed across six categories so that the "correct" answer requires no clinical judgment beyond what the eligibility text literally says:

| Category | n | Tests |
|---|---|---|
| `clear-match` | 3 | Both methods should easily succeed |
| `age-gate` | 3 | Explicit age windows in the criteria |
| `sex-gate` | 2 | Sex restrictions |
| `exclusion` | 4 | **The headline cases** — trial *excludes* a thing the patient *has* (e.g., trial excludes prior insulin use; patient is on insulin) |
| `irrelevant` | 2 | Patient and trial conditions don't overlap |
| `borderline` | 1 | Deliberately ambiguous — excluded from binary metrics |

### Methods compared

1. **Keyword heuristic** — the existing [`scoreTrials()`](src/lib/matchTrials.ts) function: token-overlap between condition/context and trial text, plus regex-based age/sex checks. The fallback path used when no API key is set.
2. **Gemini AI** — `gemini-2.5-flash-lite` via the Google Generative AI SDK, with a prompt that instructs the model to read inclusion *and* exclusion criteria carefully and score each pair independently (see [`harness.ts`](src/eval/harness.ts)). All 15 fixtures are batched into **one** Gemini call to stay under the 10 RPM free-tier limit.

### Metrics

- **Accuracy / Precision / Recall / F1** vs ground truth on the 14 non-borderline cases. A method's verdict is treated as "predicted positive" iff it returned `"possible"`.
- **Exclusion-catch rate** — the headline: of the 4 cases with an explicit exclusion the patient violates, what fraction does the method correctly label `"unlikely"` (not just "not possible" — actively flag)?
- **Score separation** — mean score of true matches minus mean score of true non-matches. Bigger gap = better discrimination, independent of the label thresholds.
- **Reliability** — the harness can also re-run a small subset of fixtures multiple times to quantify Gemini's run-to-run score variance (LLMs are stochastic). Toggle "Include reliability check" on the `/evaluation` page.

---

## Results

From a representative run against `gemini-2.5-flash-lite`:

| Metric | Keyword heuristic | Gemini AI |
|---|---:|---:|
| Accuracy | **79%** (11/14) | **100%** (14/14) |
| F1 score | **0.57** | **1.00** |
| Precision | 50% (2/4) | 100% (3/3) |
| Recall | 67% (2/3) | 100% (3/3) |
| **Exclusion-catch rate** | **0%** (0/4 caught) | **100%** (4/4 caught) |
| Score separation | +7 (means 41 vs 34) | **+92** (means 95 vs 3) |

### Headline finding

The keyword baseline **caught zero of the four exclusion cases**. In each one, the patient has a condition or treatment history that is explicitly listed under "Exclusion Criteria" — so the trial is not a fit — but the keyword method sees the shared term ("insulin", "diabetes", "SSRI", "chemotherapy") between the patient profile and the trial text and **rewards the overlap**, ranking those trials high. Gemini reads the exclusion clause and correctly demotes all four.

The **+92 vs +7** score-separation result tells the same story numerically: Gemini's "appropriate" cases average ~95/100 and its "inappropriate" cases average ~3/100, so its raw scores discriminate well even before the label thresholds are applied. The keyword scores are nearly indistinguishable across truth classes.

### Failure analysis

The `/evaluation` page surfaces every case each method got wrong on the most recent run, with the rationale. On the representative run shown above:

- **Keyword got wrong: 3 cases** — all four exclusion cases were *not* labeled `unlikely`; one age-gate case partially escaped the regex.
- **Gemini got wrong: 0 cases.**

---

## Limitations

This benchmark is honest evidence — not a clinical gold standard. Specifically:

- **Sample size is small** (~15 fixtures, 14 used for binary metrics). Confidence intervals would be wide; the absolute numbers should not be over-interpreted.
- **Fixtures are designed**, not sampled from a real distribution. They are intentionally constructed to expose the categories of mistakes we care about, and to have unambiguous ground truth. Real ClinicalTrials.gov eligibility text is messier than the synthetic versions, and real cases include many ambiguous edge cases this set does not cover.
- **Single evaluator.** Ground truth was assigned by the project author. No second reviewer or expert sign-off.
- **No real patients.** All profiles are synthetic.
- **Gemini is stochastic.** The reliability check on the `/evaluation` page makes run-to-run score variance visible; labels are usually stable, scores can drift by ±5–10 points.
- **Keyword baseline is the project's own fallback.** A more sophisticated rule-based system might do better; the comparison is meaningful because that's the actual baseline a user gets when they don't have an API key.
- **One model, one prompt.** Results are specific to `gemini-2.5-flash-lite` with the prompt in `harness.ts`. Other models or prompts would produce different numbers.

What this benchmark *does* establish: **on cases where the eligibility text literally contains an exclusion that the patient violates, the keyword heuristic fails systematically and Gemini does not.** That's enough to justify the design choice of AI as the primary ranker in the app.

---

## Reproducibility

To re-run this benchmark on your machine:

1. Set up the project per the main [README](README.md) (including `GEMINI_API_KEY` in `.env.local`).
2. Start the dev server (`npm run dev`).
3. Open `http://localhost:3000/evaluation`.
4. Click **Run benchmark** (optionally toggle the reliability check).

The full source is:

- Fixtures: [`src/eval/fixtures.ts`](src/eval/fixtures.ts)
- Metrics + harness: [`src/eval/harness.ts`](src/eval/harness.ts)
- Eval API route: [`src/app/api/eval/run/route.ts`](src/app/api/eval/run/route.ts)
- UI: [`src/app/evaluation/page.tsx`](src/app/evaluation/page.tsx)

---

## Citations & disclosure

### Data sources

- **ClinicalTrials.gov v2 REST API** — public trial registry; used for live search and detail data. Documentation: <https://clinicaltrials.gov/data-api/api>. The benchmark fixtures *do not* use real CT.gov records; they are synthetic but modeled on the same shape.
- **Open-Meteo Geocoding API** — used for converting user-entered locations to lat/lon for the radius filter. Free, keyless. Documentation: <https://open-meteo.com/en/docs/geocoding-api>.
- **FHIR R4 (Synthea-style bundles)** — supported as a profile-import format; structures match the public spec at <https://www.hl7.org/fhir/>.

### AI models & SDKs

- **Google Gemini** (`gemini-2.5-flash-lite` by default; configurable) via the **`@google/generative-ai`** SDK — used for trial ranking, the plain-language explainer, the Ask-AI chat, the intake agent, the health snapshot, the "questions for your care team" generator, and this evaluation harness.

### Libraries

- **Next.js 15** (App Router) — application framework.
- **Auth.js v5** (NextAuth) — authentication.
- **Prisma 6** + **SQLite** — local data persistence.
- **Tailwind CSS** — styling.
- **bcryptjs** — password hashing.

### AI assistance during development

This project was built collaboratively with the help of **Claude** (Anthropic, via Claude Code). Specifically, Claude assisted with architecture, scaffolding, refactors, and parts of the eval design and write-up. All design decisions, fixture authorship, ground-truth labels, and final code review were performed by the project author. Git history reflects the actual development sequence.

### Anything borrowed

This project was built from scratch (no fork). Where third-party APIs, SDKs, or libraries are used, they are listed above and attributed in code comments where relevant.
