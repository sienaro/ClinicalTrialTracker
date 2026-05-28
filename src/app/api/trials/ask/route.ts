import { NextResponse, type NextRequest } from "next/server";
import { generateText, GeminiNotConfiguredError } from "@/lib/gemini";

const MAX_CONTEXT = 7000;
const MAX_QUESTION = 500;
const MAX_HISTORY = 6;

type ChatTurn = { role: "user" | "assistant"; content: string };

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

  const question = String(body.question ?? "").trim().slice(0, MAX_QUESTION);
  if (!question) {
    return NextResponse.json({ error: "Question is required" }, { status: 400 });
  }

  const title = String(body.title ?? "").slice(0, 500);
  const eligibilityText = String(body.eligibilityText ?? "").slice(0, MAX_CONTEXT);
  const briefSummary = String(body.briefSummary ?? "").slice(0, MAX_CONTEXT);

  const historyRaw = Array.isArray(body.history) ? body.history : [];
  const history: ChatTurn[] = historyRaw
    .filter((t): t is ChatTurn => isPlainObject(t) && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(-MAX_HISTORY)
    .map((t) => ({ role: t.role, content: String(t.content).slice(0, 1000) }));

  const historyText = history.length
    ? "\n\nCONVERSATION SO FAR:\n" + history.map((t) => `${t.role === "user" ? "Patient" : "Assistant"}: ${t.content}`).join("\n")
    : "";

  const system = `You are a careful, friendly assistant that answers a patient's questions about ONE specific clinical trial, using only the trial information provided. Rules:
- Ground every answer in the provided trial text. If the answer isn't in the text, say you don't see that detail and suggest contacting the study team.
- Never give medical advice or tell the patient whether they personally qualify with certainty — explain what the criteria say and that only the study team can confirm.
- Be concise (2-5 sentences). Plain language. No markdown headings.`;

  const prompt = `TRIAL: ${title}

SUMMARY:
${briefSummary || "(not provided)"}

ELIGIBILITY CRITERIA:
${eligibilityText || "(not provided)"}${historyText}

PATIENT QUESTION: ${question}

Answer the patient's question based only on the trial information above.`;

  try {
    const answer = await generateText(prompt, system);
    return NextResponse.json({ answer: answer.trim() }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: "AI chat requires GEMINI_API_KEY" }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "AI chat failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
