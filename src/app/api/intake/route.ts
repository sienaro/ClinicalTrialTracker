import { NextResponse, type NextRequest } from "next/server";
import { generateJson, GeminiNotConfiguredError } from "@/lib/gemini";

const MAX_TURNS = 24;
const MAX_LEN = 1200;

type ChatTurn = { role: "user" | "assistant"; content: string };

type IntakeResult = {
  reply: string;
  ready: boolean;
  profile?: {
    condition?: string;
    ageInput?: string;
    sex?: "male" | "female" | "any";
    sessionNotes?: string;
    location?: string;
  };
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

  const rawMessages = Array.isArray(body.messages) ? body.messages : [];
  const messages: ChatTurn[] = rawMessages
    .filter((t): t is ChatTurn => isPlainObject(t) && (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(-MAX_TURNS)
    .map((t) => ({ role: t.role, content: String(t.content).slice(0, MAX_LEN) }));

  if (messages.length === 0) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  const langInstruction = String(body.languageInstruction ?? "").slice(0, 400);

  const transcript = messages.map((m) => `${m.role === "user" ? "Patient" : "Assistant"}: ${m.content}`).join("\n");

  const system = `You are a warm, careful clinical-trial intake assistant. Your job is to interview a patient in a natural, friendly conversation to gather just enough information to search for relevant clinical trials. You are NOT a doctor and must not give medical advice or diagnoses.

Gather, over a few short turns:
1. Their main condition or diagnosis (required)
2. Their age (optional but helpful)
3. Their sex (optional; only as relevant to eligibility — map to male/female/any)
4. Their location — city/state — and roughly how far they'd travel (optional; helps find nearby trials)
5. Any other relevant context: other conditions, current medications, prior treatments

Rules:
- Ask only ONE question at a time. Keep messages short and kind.
- Acknowledge what they said before asking the next thing.
- Once you have at least the main condition AND have given them a chance to share age/sex/context (roughly 2-4 exchanges), set ready=true.
- When ready, write a brief friendly wrap-up reply (e.g., "Great — let me find recruiting trials for ...") and fill the profile.
- ${langInstruction || "Respond in clear English."}`;

  const prompt = `Conversation so far:
${transcript}

Based on the conversation, decide the assistant's next message. Return a JSON object with:
- "reply": the assistant's next message to the patient (a single follow-up question, OR a short wrap-up if ready).
- "ready": boolean — true only when you have the main condition and have gathered enough to search.
- "profile": object (include only when ready=true) with:
   - "condition": the main condition/topic as a short search phrase
   - "ageInput": age as a numeric string, or "" if unknown
   - "sex": "male", "female", or "any"
   - "location": their city/state if given (e.g. "Boston, MA"), else ""
   - "sessionNotes": a concise plain-text summary of the other context gathered (other conditions, meds, history)

Return ONLY the raw JSON object, no markdown. The JSON keys stay in English.`;

  try {
    const data = await generateJson<IntakeResult>(prompt, system);
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof GeminiNotConfiguredError) {
      return NextResponse.json({ error: "The intake assistant requires GEMINI_API_KEY" }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "Intake assistant failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
