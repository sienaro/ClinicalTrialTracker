import { NextResponse, type NextRequest } from "next/server";
import { generateJson, GeminiNotConfiguredError } from "@/lib/gemini";

const MAX_CHARS = 6000;

type QuestionsResult = { questions: string[] };

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

  const title = String(body.title ?? "").slice(0, 500);
  const eligibilityText = String(body.eligibilityText ?? "").slice(0, MAX_CHARS);
  const briefSummary = String(body.briefSummary ?? "").slice(0, MAX_CHARS);
  const condition = String(body.condition ?? "").slice(0, 200);
  const langInstruction = String(body.languageInstruction ?? "").slice(0, 400);

  if (!title && !eligibilityText) {
    return NextResponse.json({ error: "Not enough trial info" }, { status: 400 });
  }

  const prompt = `A patient is considering this clinical trial and will speak with a doctor or the study coordinator. Generate a short list of smart, specific questions the patient should ask, grounded in this trial's details.

TRIAL: ${title}
${condition ? `PATIENT'S CONDITION: ${condition}` : ""}
SUMMARY: ${briefSummary || "(not provided)"}
ELIGIBILITY CRITERIA: ${eligibilityText || "(not provided)"}

Generate 5-7 questions that:
- Help the patient understand whether they qualify (reference real criteria where useful)
- Cover practical concerns: time commitment, visits, procedures, risks, costs/insurance, placebo, what happens after
- Are specific to THIS trial where possible, not generic

Return a JSON object: { "questions": ["...", "..."] }. ${langInstruction} Return ONLY the raw JSON, no markdown. The "questions" key stays in English.`;

  try {
    const data = await generateJson<QuestionsResult>(prompt);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: "Question generator requires GEMINI_API_KEY" }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "Question generator failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
