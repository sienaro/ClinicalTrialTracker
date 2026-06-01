# Demo Script — 90-second walkthrough

A tight script for a 1:30 screen recording that hits every rubric beat. Record in **QuickTime → File → New Screen Recording** (or OBS), trim the dead air, drop the video into the repo as `docs/demo.mp4` (or upload to YouTube and link it from the README).

> **Tone tip:** speak conversationally, like you're showing a friend something cool. Don't read it word-for-word.

---

## Before you record (one-time setup, ~2 min)

1. **Run the app** in a fresh terminal:
   ```bash
   npm run dev
   ```
2. **Make sure you're logged in** as a demo user so the *Saved* features show up:
   - Go to <http://localhost:3000/signup> and create `demo@example.com` / `password123` (or log in if you already did).
3. **Pre-load the eval page once** so the first run isn't cold:
   - Visit <http://localhost:3000/evaluation> and click **Run benchmark** once. It caches nothing — but it warms up Gemini and your nerves.
4. **Close all other tabs**, hide your dock, set your browser to **1280×800** if you can (matches the screenshots).
5. **Have these tabs ready in order**:
   1. <http://localhost:3000/> (home)
   2. <http://localhost:3000/intake>
   3. <http://localhost:3000/evaluation>

---

## The script (90 seconds, with timestamps)

### 0:00 – 0:10 · Hook + problem (one breath)

> *"Recruiting patients is the single biggest reason clinical trials fail. Eligibility criteria are dense, written for clinicians, and patients give up. So I built an AI that reads them for you — in any language — and tells you in plain words whether you might qualify."*

**Show:** Home page hero. Slow scroll down to the three cards.

---

### 0:10 – 0:25 · Conversational intake (the "wow")

**Click:** "Talk to the assistant" → land on `/intake`.

> *"Instead of a form, you describe your situation."*

**Type in the chat input** (or paste — fast, one shot):

```
I have type 2 diabetes, I'm 55, in Boston, on metformin.
```

**Wait** for the assistant's reply. If it asks a follow-up, answer:

```
That's all. Looking for trials nearby.
```

> *"It interviews you in a few short turns, then builds your profile."*

When the green "Ready to search" card appears, **click "Find my trials."**

---

### 0:25 – 0:45 · Ranked results, location + AI

You're now on `/search` with auto-search running.

> *"Here it pulls live recruiting trials from ClinicalTrials.gov — already filtered to within fifty miles of Boston — and Gemini ranks each one against my profile."*

**Show:** the score rings populating, the "stronger fit / worth review / weaker fit" pills, and an example "Why Gemini ranked this" expansion on the first card.

> *"Each card shows the AI's plain-English reasons — and flags age or sex conflicts it caught."*

---

### 0:45 – 1:00 · Trial detail — explainer + Ask-AI

**Click** "View details & ask AI" on any *Possible* (green) card.

> *"On the detail page, Gemini auto-generates a plain-language summary — what the study is actually testing, what participation involves, who it's for."*

**Click** one of the suggested chat prompts (e.g. *"Are there any age or health requirements?"*).

> *"And you can ask anything — grounded only in this trial's eligibility text, so it won't make things up. Want it in Spanish?"*

**Click** the language dropdown → choose **Español**. The explainer re-renders.

> *"Twelve languages, optional simple wording. That's the access angle."*

---

### 1:00 – 1:15 · Saved + brief

**Scroll** to the bottom of the detail page → **click "Printable brief & questions."**

> *"You can print a one-page brief — facts, plain language, and AI-generated questions to bring to your doctor."*

**Back to the trial card** → **click Save** → **then click Saved → "Eval" nav** is next. Actually first:

**Click** **Saved** in the nav.

> *"Saved trials live in an Interested → Contacted → Applied pipeline with private notes — your application tracker."*

---

### 1:15 – 1:28 · The proof (the rubric closer)

**Click** **Eval** in the nav.

> *"Last thing: does this actually beat keyword matching? I built a benchmark."*

**Click Run benchmark.** Wait ~5 seconds.

> *"Fifteen hand-labeled cases. Keyword baseline gets seventy-nine percent. Gemini gets a hundred. And on the four cases where the trial explicitly excludes something the patient has — the keyword method catches zero. Gemini catches all four."*

**Hover over the Exclusion-catch row** to land the point visually.

---

### 1:28 – 1:30 · Sign-off

> *"Code, eval, and full disclosure on the repo. Thanks for watching."*

**Cut.**

---

## What the recording proves (mapping to the rubric)

| Beat | Rubric category |
|---|---|
| Problem hook + plain-language + multilingual | **Problem & Insight** |
| Intake → search → detail → saved → brief end-to-end | **Execution & Technical Work** |
| The `/evaluation` benchmark with metrics on screen | **Evaluation & Evidence** |
| Smooth narration + clear UI + final closer | **Communication & Presentation** |
| (Companion: the README disclosure + EVALUATION.md) | **Process & Disclosure** |

---

## Editing tips

- **Hard cuts only** — no slow zooms or fades. Pace beats production value.
- **No audio music.** Just narration. The metric numbers should land in silence.
- **Trim mercilessly.** Aim for tight 90s; 2:00 is the upper limit before energy drops.
- **Show, then say.** Click first, then say what just happened. People watch motion, not your mouth.
- **Export at 1080p**, H.264, ≤ 30 MB if you can. GitHub allows up to 100 MB for direct upload.

When done, add to the README:

```md
## Demo

[Watch the 90-second walkthrough](docs/demo.mp4)
```
