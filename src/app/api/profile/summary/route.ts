import { NextResponse, type NextRequest } from "next/server";
import { generateJson, GeminiNotConfiguredError } from "@/lib/gemini";

const MAX_NOTES = 12_000;

type HealthSummary = {
  overview: string;
  conditions: string[];
  demographics: string;
  considerations: string[];
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const condition = String(body.condition ?? "").slice(0, 200);
  const age = String(body.age ?? body.ageInput ?? "").slice(0, 8);
  const sex = String(body.sex ?? "").slice(0, 16);
  const notes = String(body.sessionNotes ?? "").slice(0, MAX_NOTES);

  if (!condition && !notes) {
    return NextResponse.json({ error: "Add a condition or context notes first." }, { status: 400 });
  }

  const prompt = `You are a clinical intake assistant. Summarize the following patient profile into a clear, neutral clinical overview that will be used to help find relevant clinical trials. Do NOT give medical advice or diagnoses; only organize and restate what is provided.

PRIMARY CONDITION / TOPIC: ${condition || "(not provided)"}
AGE: ${age || "(not provided)"}
SEX: ${sex || "(not provided)"}
MEDICAL CONTEXT / PROBLEM LIST / NOTES:
${notes || "(none provided)"}

Return a JSON object with exactly these fields:
- "overview": 2-3 sentence neutral clinical overview of this person's situation for trial-matching purposes.
- "conditions": array of the distinct active health conditions you can identify (deduplicated, plain names). Empty array if none clear.
- "demographics": one short sentence stating age/sex if known.
- "considerations": array of 2-4 short, neutral factors that could affect clinical trial eligibility or matching (e.g., comorbidities, age band, treatment history) — only those supported by the input.

Be faithful to the input; do not invent conditions. Return ONLY the raw JSON object, no markdown.`;

  try {
    const summary = await generateJson<HealthSummary>(prompt);
    return NextResponse.json({ summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: "AI summary requires GEMINI_API_KEY" }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "AI summary failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
