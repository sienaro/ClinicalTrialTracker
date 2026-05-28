import { NextResponse, type NextRequest } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TrialSummary } from "@/lib/clinicalTrialsGov";

const MAX_ELIGIBILITY_CHARS = 2500;
const MAX_TRIALS = 25;
const MAX_NOTES_CHARS = 3000;
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

type ProfileInput = {
  condition: string;
  age?: number;
  sex: string;
  sessionNotes?: string;
};

export type RankedEntry = {
  nctId: string;
  score: number;
  label: "possible" | "unclear" | "unlikely";
  reasons: string[];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured — AI ranking unavailable" },
      { status: 503 },
    );
  }

  let body: { profile: ProfileInput; trials: TrialSummary[] };
  try {
    body = (await req.json()) as { profile: ProfileInput; trials: TrialSummary[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { profile, trials } = body;
  if (!isPlainObject(profile) || typeof profile.condition !== "string" || !Array.isArray(trials) || trials.length === 0) {
    return NextResponse.json({ error: "Missing or invalid profile.condition or trials" }, { status: 400 });
  }

  const cappedTrials = trials.slice(0, MAX_TRIALS);

  const trialsSection = cappedTrials
    .map((t, i) => {
      const elig = (t.eligibilityText ?? "").slice(0, MAX_ELIGIBILITY_CHARS);
      return [
        `--- Trial ${i + 1} ---`,
        `NCT ID: ${t.nctId}`,
        `Title: ${t.title}`,
        `Listed Conditions: ${t.conditions.join(", ") || "Not specified"}`,
        `Eligibility Criteria:\n${elig || "Not provided"}`,
      ].join("\n");
    })
    .join("\n\n");

  const notesLine = profile.sessionNotes?.trim()
    ? `\nAdditional patient context (from medical records):\n${profile.sessionNotes.slice(0, MAX_NOTES_CHARS)}`
    : "";

  const prompt = `You are an expert clinical trial eligibility analyst. Given a patient profile and a list of recruiting clinical trials, analyze how well the patient might match each trial based on its eligibility criteria.

PATIENT PROFILE:
- Primary condition / search topic: ${profile.condition}
- Age: ${profile.age != null ? String(profile.age) + " years" : "not provided"}
- Sex: ${profile.sex}${notesLine}

CLINICAL TRIALS:
${trialsSection}

For each trial, return a structured assessment as a JSON array. Each element must have:
- "nctId": the exact NCT ID string from the trial above
- "score": integer 0–100 (0 = clearly excluded or irrelevant, 100 = very strong match across all criteria)
- "label": exactly one of "possible" (score ≥ 62), "unclear" (score 36–61), or "unlikely" (score ≤ 35)
- "reasons": array of 2–4 concise strings explaining the key factors (reference specific eligibility criteria, age/sex requirements, or condition relevance)

Guidelines:
- Condition relevance is most important — is the patient's condition what the trial is actually studying?
- Check explicit age and sex requirements in eligibility text
- Use the additional context (if provided) to identify relevant inclusion/exclusion criteria
- Be specific: cite actual criteria that drove your score
- "possible" = meaningful evidence of a match; "unlikely" = clear mismatch or exclusion; "unclear" = ambiguous

Return ONLY the raw JSON array, no markdown, no code fences, no extra text.`;

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
      generationConfig: { responseMimeType: "application/json" },
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    let ranked: RankedEntry[];
    try {
      const parsed: unknown = JSON.parse(text);
      if (!Array.isArray(parsed)) throw new Error("Expected JSON array");
      ranked = parsed as RankedEntry[];
    } catch {
      return NextResponse.json({ error: "AI returned unexpected format" }, { status: 502 });
    }

    return NextResponse.json(
      { ranked },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "AI ranking failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
