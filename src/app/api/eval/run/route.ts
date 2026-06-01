import { NextResponse, type NextRequest } from "next/server";
import { runEval, runReliability } from "@/eval/harness";

// The main eval is one batched Gemini call (~5-15s). Reliability is up to 9
// sequential calls with a ~7s spacing to respect the free-tier 10 RPM limit,
// so we allow 120s when reliability is requested.
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const skipAi = req.nextUrl.searchParams.get("skipAi") === "1";
  const includeReliability = req.nextUrl.searchParams.get("reliability") === "1";

  try {
    const evaluation = await runEval({ skipAi });
    let reliability = null;
    if (includeReliability && evaluation.ai && !evaluation.aiUnavailableReason) {
      try {
        reliability = await runReliability();
      } catch (e) {
        // Don't fail the whole run if reliability hits an issue.
        reliability = null;
        console.warn("Reliability run failed:", e);
      }
    }
    return NextResponse.json(
      { evaluation, reliability },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Eval failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
