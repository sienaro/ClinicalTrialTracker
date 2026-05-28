import type { Sex, TrialSummary } from "@/lib/clinicalTrialsGov";

export type MatchLabel = "possible" | "unclear" | "unlikely";

export type ScoredTrial = TrialSummary & {
  score: number;
  label: MatchLabel;
  reasons: string[];
  /** Derived from eligibility text + profile; used for optional client-side filtering (not official eligibility). */
  matchSignals: {
    sexConflict: boolean;
    ageLikelyOutside: boolean;
  };
};

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 2),
  );
}

function ageWindowFromText(text: string): { min?: number; max?: number } {
  const lower = text.toLowerCase();
  const range = lower.match(/(\d{1,3})\s*(?:to|-|–)\s*(\d{1,3})\s*years?/);
  if (range) {
    const a = Number(range[1]);
    const b = Number(range[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { min: Math.min(a, b), max: Math.max(a, b) };
    }
  }
  const minOnly = lower.match(/(?:>=|≥|at least|minimum|min\.?)\s*(\d{1,3})\s*years?/);
  if (minOnly) {
    const n = Number(minOnly[1]);
    if (Number.isFinite(n)) return { min: n };
  }
  const maxOnly = lower.match(/(?:<=|≤|up to|maximum|max\.?)\s*(\d{1,3})\s*years?/);
  if (maxOnly) {
    const n = Number(maxOnly[1]);
    if (Number.isFinite(n)) return { max: n };
  }
  return {};
}

function sexMentionConflicts(text: string, sex: Exclude<Sex, "any">): boolean {
  const lower = text.toLowerCase();
  if (sex === "male") {
    return /\bfemale\b|\bwomen\b|\bgirls?\b/.test(lower) && !/\bmales?\b|\bmen\b|\bboys?\b/.test(lower);
  }
  return /\bmales?\b|\bmen\b|\bboys?\b/.test(lower) && !/\bfemale\b|\bwomen\b|\bgirls?\b/.test(lower);
}

/** When we can parse an age rule from eligibility text, is the patient clearly outside it? */
function ageLikelyOutsideWindow(age: number, eligibilityText: string): boolean {
  const win = ageWindowFromText(eligibilityText);
  if (win.min !== undefined && win.max !== undefined) {
    return age < win.min || age > win.max;
  }
  if (win.min !== undefined) return age < win.min;
  if (win.max !== undefined) return age > win.max;
  return false;
}

export function computeMatchSignals(
  trial: TrialSummary,
  profile: { age?: number; sex: Sex },
): { sexConflict: boolean; ageLikelyOutside: boolean } {
  const sexConflict =
    profile.sex !== "any" && sexMentionConflicts(trial.eligibilityText, profile.sex as Exclude<Sex, "any">);
  const ageLikelyOutside =
    typeof profile.age === "number" &&
    Number.isFinite(profile.age) &&
    ageLikelyOutsideWindow(profile.age, trial.eligibilityText);
  return { sexConflict, ageLikelyOutside };
}

export function scoreTrials(
  trials: TrialSummary[],
  profile: { condition: string; age?: number; sex: Sex; referenceText?: string },
): ScoredTrial[] {
  const condTokens = tokenize(profile.condition);
  const refTokens = profile.referenceText?.trim() ? tokenize(profile.referenceText) : new Set<string>();
  const scored = trials.map((trial) => {
    const reasons: string[] = [];
    let score = 40;

    const sexConflict =
      profile.sex !== "any" && sexMentionConflicts(trial.eligibilityText, profile.sex as Exclude<Sex, "any">);
    const ageLikelyOutside =
      typeof profile.age === "number" &&
      Number.isFinite(profile.age) &&
      ageLikelyOutsideWindow(profile.age, trial.eligibilityText);

    const haystack = [
      trial.title,
      trial.conditions.join(" "),
      trial.eligibilityText,
    ]
      .join(" ")
      .toLowerCase();

    const trialTokens = tokenize(haystack);
    let overlap = 0;
    for (const t of condTokens) {
      if (trialTokens.has(t)) overlap += 1;
    }
    if (overlap > 0) {
      score += Math.min(30, overlap * 6);
      reasons.push(`Overlapping keywords between your condition and the trial text (${overlap}).`);
    } else {
      reasons.push("Few obvious keyword overlaps with your condition text.");
    }

    if (refTokens.size > 0) {
      let refOverlap = 0;
      for (const t of refTokens) {
        if (trialTokens.has(t)) refOverlap += 1;
      }
      if (refOverlap > 0) {
        score += Math.min(12, refOverlap * 2);
        reasons.push(
          `Additional overlap between uploaded or pasted reference text and this trial (${refOverlap} terms).`,
        );
      }
    }

    if (typeof profile.age === "number" && Number.isFinite(profile.age)) {
      const win = ageWindowFromText(trial.eligibilityText);
      if (win.min !== undefined && win.max !== undefined) {
        if (profile.age >= win.min && profile.age <= win.max) {
          score += 15;
          reasons.push(`Eligibility text suggests an age range ${win.min}-${win.max} that includes ${profile.age}.`);
        } else {
          score -= 10;
          reasons.push(
            `Parsed age hint ${win.min}-${win.max} from eligibility text may not include age ${profile.age} (rough parse).`,
          );
        }
      } else if (win.min !== undefined && profile.age >= win.min) {
        score += 8;
        reasons.push(`Eligibility text may require minimum age ${win.min} (rough parse).`);
      } else if (win.max !== undefined && profile.age <= win.max) {
        score += 8;
        reasons.push(`Eligibility text may require maximum age ${win.max} (rough parse).`);
      } else {
        reasons.push("Could not confidently parse an age window from eligibility text.");
      }
    } else {
      reasons.push("Add an age to improve rough eligibility hints.");
    }

    if (profile.sex !== "any") {
      if (sexConflict) {
        score -= 25;
        reasons.push("Eligibility text mentions the other sex prominently; treat as a red flag for this demo.");
      } else {
        reasons.push("No obvious sex-based conflict detected in a quick text scan (not reliable).");
      }
    }

    score = Math.max(0, Math.min(100, Math.round(score)));

    let label: MatchLabel = "unclear";
    if (score >= 62) label = "possible";
    if (score <= 35) label = "unlikely";

    return { ...trial, score, label, reasons, matchSignals: { sexConflict, ageLikelyOutside } };
  });

  return scored.sort((a, b) => b.score - a.score);
}
