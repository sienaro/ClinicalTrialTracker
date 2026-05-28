import { NextResponse, type NextRequest } from "next/server";
import { generateJson, GeminiNotConfiguredError } from "@/lib/gemini";

const MAX_CHARS = 6000;

type ExplainResult = {
  summary: string;
  goal: string;
  whatHappens: string[];
  whoFor: string;
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

  const title = String(body.title ?? "").slice(0, 500);
  const briefSummary = String(body.briefSummary ?? "").slice(0, MAX_CHARS);
  const eligibilityText = String(body.eligibilityText ?? "").slice(0, MAX_CHARS);

  if (!title && !briefSummary) {
    return NextResponse.json({ error: "Nothing to explain" }, { status: 400 });
  }

  const prompt = `You are a patient-friendly medical explainer. Rewrite this clinical trial information into plain language a non-expert patient can understand. Avoid jargon; when a medical term is unavoidable, briefly define it.

TRIAL TITLE: ${title}

OFFICIAL SUMMARY: ${briefSummary || "(not provided)"}

ELIGIBILITY CRITERIA (for context): ${eligibilityText.slice(0, 2500) || "(not provided)"}

Return a JSON object with exactly these fields:
- "summary": 1-2 sentence plain-language overview of what this study is.
- "goal": one sentence on what the researchers are trying to learn or prove.
- "whatHappens": array of 2-4 short bullet strings describing what participation likely involves (visits, tests, treatment) — only if inferable, otherwise general.
- "whoFor": one sentence describing, in plain terms, the kind of person this study is looking for.

Be accurate and do not invent specifics not supported by the text. Return ONLY the raw JSON object, no markdown.`;

  try {
    const data = await generateJson<ExplainResult>(prompt);
    return NextResponse.json({ explanation: data }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: "AI explainer requires GEMINI_API_KEY" }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "AI explainer failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
