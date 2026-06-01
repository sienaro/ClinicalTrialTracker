import { scoreTrials, type MatchLabel } from "@/lib/matchTrials";
import { generateJson, GeminiNotConfiguredError } from "@/lib/gemini";
import { fixtures, type Fixture, type GroundTruth } from "@/eval/fixtures";

export type MethodVerdict = {
  score: number;
  label: MatchLabel;
  reasons?: string[];
};

export type EvalRow = {
  id: string;
  category: string;
  patient: string;
  trialTitle: string;
  groundTruth: GroundTruth;
  rationale: string;
  keyword: MethodVerdict;
  ai: MethodVerdict | null;
  /** True if the method's verdict agrees with the ground truth (only set for non-borderline). */
  keywordCorrect: boolean | null;
  aiCorrect: boolean | null;
};

export type AggregateMetrics = {
  n: number;
  tp: number;
  fp: number;
  tn: number;
  fn: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1: number;
  /** Percent of "should exclude" cases the method actively labels as "unlikely". */
  exclusionCatchRate: number;
  exclusionTotal: number;
  exclusionCaught: number;
  meanScoreAppropriate: number;
  meanScoreInappropriate: number;
  /** Bigger = method better separates good matches from bad. */
  scoreSeparation: number;
};

export type EvalResult = {
  fixturesCount: number;
  ranAt: string;
  rows: EvalRow[];
  keyword: AggregateMetrics;
  ai: AggregateMetrics | null;
  aiUnavailableReason?: string;
};

export type ReliabilityRow = {
  id: string;
  scores: number[];
  mean: number;
  stdev: number;
  labelAgreement: boolean; // all runs returned the same label
};

function fmtPatient(p: Fixture["patient"]): string {
  const parts = [p.condition];
  if (typeof p.age === "number") parts.push(`age ${p.age}`);
  if (p.sex && p.sex !== "any") parts.push(p.sex);
  return parts.join(", ");
}

/** Map a method's verdict + ground truth into a binary correctness call. Returns null for borderline. */
function isCorrect(label: MatchLabel | undefined, gt: GroundTruth): boolean | null {
  if (gt === "borderline") return null;
  if (!label) return null;
  const predictedPositive = label === "possible";
  return gt === "appropriate" ? predictedPositive : !predictedPositive;
}

function runKeywordOnFixture(fx: Fixture): MethodVerdict {
  const [scored] = scoreTrials([fx.trial], {
    condition: fx.patient.condition,
    age: fx.patient.age,
    sex: fx.patient.sex,
    referenceText: fx.patient.sessionNotes,
  });
  return { score: scored.score, label: scored.label, reasons: scored.reasons };
}

const AI_SYSTEM = `You are an expert clinical trial eligibility analyst. You will be given SEVERAL independent (patient, trial) pairs and must score EACH pair INDEPENDENTLY. Pay special attention to EXCLUSION criteria — they OVERRIDE matching condition terms. Return only the requested JSON.`;

function normalizeVerdict(raw: { score?: unknown; label?: unknown; reasons?: unknown }): MethodVerdict {
  const score = Math.max(0, Math.min(100, Math.round(Number(raw.score) || 0)));
  const rawLabel = raw.label;
  const label: MatchLabel =
    rawLabel === "possible" || rawLabel === "unclear" || rawLabel === "unlikely"
      ? rawLabel
      : score >= 62
        ? "possible"
        : score <= 35
          ? "unlikely"
          : "unclear";
  return {
    score,
    label,
    reasons: Array.isArray(raw.reasons) ? raw.reasons.map(String).slice(0, 4) : [],
  };
}

function fixtureBlock(fx: Fixture, idx: number): string {
  const ageLine = typeof fx.patient.age === "number" ? `${fx.patient.age} years` : "not provided";
  const notesLine = fx.patient.sessionNotes ? `\n  Additional context: ${fx.patient.sessionNotes}` : "";
  return `=== PAIR ${idx + 1} (id: ${fx.id}) ===
PATIENT:
  Condition: ${fx.patient.condition}
  Age: ${ageLine}
  Sex: ${fx.patient.sex}${notesLine}
TRIAL:
  Title: ${fx.trial.title}
  Listed conditions: ${fx.trial.conditions.join(", ") || "Not specified"}
  Eligibility criteria:
${fx.trial.eligibilityText}`;
}

/** One Gemini call for ALL fixtures, returning verdicts by fixture id. */
async function runAiOnAllFixtures(fxs: Fixture[]): Promise<Map<string, MethodVerdict>> {
  const pairsText = fxs.map(fixtureBlock).join("\n\n");
  const prompt = `Below are ${fxs.length} independent (patient, trial) pairs. Score each pair INDEPENDENTLY of the others.

${pairsText}

Return a JSON array with exactly ${fxs.length} entries, one per pair, in the same order. Each entry must be:
{ "id": "<pair id exactly as given>", "score": integer 0-100, "label": "possible" | "unclear" | "unlikely", "reasons": ["...short reason 1...", "...short reason 2..."] }

Rules:
- "possible" = score >= 62; "unclear" = 36-61; "unlikely" <= 35
- Score the patient's specific fit against this specific trial's criteria.
- If an EXCLUSION criterion applies to the patient, that trial should be "unlikely".
- Reference specific eligibility lines in "reasons".

Return ONLY the raw JSON array, no markdown.`;

  type Entry = { id?: string; score?: unknown; label?: unknown; reasons?: unknown };
  const raw = await generateJson<Entry[]>(prompt, AI_SYSTEM);

  const map = new Map<string, MethodVerdict>();
  if (!Array.isArray(raw)) return map;
  for (const entry of raw) {
    if (entry && typeof entry === "object" && typeof entry.id === "string") {
      map.set(entry.id, normalizeVerdict(entry));
    }
  }
  return map;
}

/** Single-fixture call (for reliability variance measurements). */
async function runAiOnFixtureSingle(fx: Fixture): Promise<MethodVerdict> {
  const map = await runAiOnAllFixtures([fx]);
  const v = map.get(fx.id);
  if (!v) throw new Error("Gemini returned no verdict for fixture");
  return v;
}

function aggregate(rows: EvalRow[], pick: "keyword" | "ai"): AggregateMetrics {
  const binary = rows
    .filter((r) => r.groundTruth !== "borderline")
    .map((r) => {
      const verdict = pick === "keyword" ? r.keyword : r.ai;
      return verdict ? { truth: r.groundTruth === "appropriate", verdict, category: r.category } : null;
    })
    .filter((x): x is { truth: boolean; verdict: MethodVerdict; category: string } => x !== null);

  let tp = 0,
    fp = 0,
    tn = 0,
    fn = 0;
  for (const { truth, verdict } of binary) {
    const pred = verdict.label === "possible";
    if (truth && pred) tp++;
    else if (!truth && pred) fp++;
    else if (!truth && !pred) tn++;
    else fn++;
  }
  const n = binary.length;
  const accuracy = n ? (tp + tn) / n : 0;
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;

  const appropriate = binary.filter((x) => x.truth);
  const inappropriate = binary.filter((x) => !x.truth);
  const meanScoreAppropriate = appropriate.length
    ? appropriate.reduce((s, x) => s + x.verdict.score, 0) / appropriate.length
    : 0;
  const meanScoreInappropriate = inappropriate.length
    ? inappropriate.reduce((s, x) => s + x.verdict.score, 0) / inappropriate.length
    : 0;

  const exclusion = binary.filter((x) => x.category === "exclusion");
  const exclusionCaught = exclusion.filter((x) => x.verdict.label === "unlikely").length;
  const exclusionCatchRate = exclusion.length ? exclusionCaught / exclusion.length : 0;

  return {
    n,
    tp,
    fp,
    tn,
    fn,
    accuracy,
    precision,
    recall,
    f1,
    exclusionCatchRate,
    exclusionTotal: exclusion.length,
    exclusionCaught,
    meanScoreAppropriate,
    meanScoreInappropriate,
    scoreSeparation: meanScoreAppropriate - meanScoreInappropriate,
  };
}

export async function runEval(opts?: { skipAi?: boolean }): Promise<EvalResult> {
  let aiUnavailableReason: string | undefined;
  let aiVerdicts: Map<string, MethodVerdict> = new Map();

  if (!opts?.skipAi) {
    try {
      aiVerdicts = await runAiOnAllFixtures(fixtures);
    } catch (err) {
      if (err instanceof GeminiNotConfiguredError) {
        aiUnavailableReason = "GEMINI_API_KEY is not configured.";
      } else {
        aiUnavailableReason = err instanceof Error ? err.message : "Unknown error from Gemini.";
      }
    }
  }

  const rows: EvalRow[] = fixtures.map((fx) => {
    const kw = runKeywordOnFixture(fx);
    const ai = aiVerdicts.get(fx.id) ?? null;
    return {
      id: fx.id,
      category: fx.category,
      patient: fmtPatient(fx.patient),
      trialTitle: fx.trial.title,
      groundTruth: fx.groundTruth,
      rationale: fx.rationale,
      keyword: kw,
      ai,
      keywordCorrect: isCorrect(kw.label, fx.groundTruth),
      aiCorrect: ai ? isCorrect(ai.label, fx.groundTruth) : null,
    };
  });

  return {
    fixturesCount: fixtures.length,
    ranAt: new Date().toISOString(),
    rows,
    keyword: aggregate(rows, "keyword"),
    ai: rows.some((r) => r.ai) ? aggregate(rows, "ai") : null,
    aiUnavailableReason,
  };
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

/**
 * Run a small subset of fixtures repeatedly to quantify Gemini run-to-run variance.
 *
 * Each repetition is its own Gemini call (so the runs are genuinely independent),
 * with a delay between calls to stay under the free-tier 10 RPM limit.
 */
export async function runReliability(
  times = 3,
  ids = ["exclusion-prior-insulin", "t2d-clean-match", "age-young-vs-older-t2d"],
): Promise<ReliabilityRow[]> {
  const subset = fixtures.filter((f) => ids.includes(f.id));
  const out: ReliabilityRow[] = [];
  let callIdx = 0;
  for (const fx of subset) {
    const scores: number[] = [];
    const labels: MatchLabel[] = [];
    for (let i = 0; i < times; i++) {
      // Stay under Gemini's 10 RPM free-tier limit: ~7s between calls is safe.
      if (callIdx > 0) await sleep(7000);
      callIdx++;
      try {
        const v = await runAiOnFixtureSingle(fx);
        scores.push(v.score);
        labels.push(v.label);
      } catch {
        // Skip remaining repeats if Gemini fails (likely rate limit).
        break;
      }
    }
    const mean = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
    const variance = scores.length
      ? scores.reduce((s, x) => s + (x - mean) * (x - mean), 0) / scores.length
      : 0;
    out.push({
      id: fx.id,
      scores,
      mean,
      stdev: Math.sqrt(variance),
      labelAgreement: labels.length > 0 && labels.every((l) => l === labels[0]),
    });
  }
  return out;
}
