import type { Sex } from "@/lib/clinicalTrialsGov";
import type { ProfilePrefill } from "@/lib/profilePrefill";

const MAX_REGISTRY_CONDITION_LEN = 120;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function ageFromBirthDate(bd: string): number | undefined {
  const m = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/.exec(bd.trim());
  if (!m) return undefined;
  const y = Number(m[1]);
  const mo = m[2] ? Number(m[2]) - 1 : 0;
  const d = m[3] ? Number(m[3]) : 1;
  if (!Number.isFinite(y)) return undefined;
  const birth = new Date(y, mo, d);
  if (Number.isNaN(birth.getTime())) return undefined;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const mDiff = today.getMonth() - birth.getMonth();
  if (mDiff < 0 || (mDiff === 0 && today.getDate() < birth.getDate())) age -= 1;
  if (age < 0 || age > 130) return undefined;
  return age;
}

function mapGender(g: string | undefined): Sex | undefined {
  const v = g?.toLowerCase();
  if (v === "male") return "male";
  if (v === "female") return "female";
  if (v === "other" || v === "unknown" || v === "undetermined") return "any";
  return undefined;
}

function codingDisplays(code: unknown): string[] {
  const rec = asRecord(code);
  if (!rec) return [];
  const out: string[] = [];
  const text = rec.text;
  if (typeof text === "string" && text.trim()) out.push(text.trim());
  const coding = rec.coding;
  if (Array.isArray(coding)) {
    for (const c of coding) {
      const cr = asRecord(c);
      const d = cr?.display;
      if (typeof d === "string" && d.trim()) out.push(d.trim());
    }
  }
  return out;
}

function conditionTextsFromResource(resource: Record<string, unknown>): string[] {
  if (resource.resourceType !== "Condition") return [];
  return codingDisplays(resource.code);
}

/** Drop resolved / inactive problems so Synthea history does not drive search. */
function conditionIsActiveForRanking(resource: Record<string, unknown>): boolean {
  const cs = resource.clinicalStatus;
  const rec = asRecord(cs);
  if (!rec) return true;
  if (typeof rec.text === "string" && /resolved|inactive|remission|entered\s*in\s*error/i.test(rec.text)) {
    return false;
  }
  const coding = rec.coding;
  if (!Array.isArray(coding)) return true;
  for (const c of coding) {
    const code = asRecord(c)?.code;
    if (typeof code !== "string") continue;
    if (/^(resolved|inactive|remission|entered-in-error)$/i.test(code.trim())) return false;
  }
  return true;
}

/** Prefer registry-friendly wording (ClinicalTrials.gov query is plain text). */
function normalizeRegistryConditionLabel(raw: string): string {
  let s = raw.trim();
  s = s.replace(/\s+\(disorder\)\s*$/i, "");
  s = s.replace(/\s+\(finding\)\s*$/i, "");
  s = s.replace(/\s+\(situation\)\s*$/i, "");
  s = s.replace(/\s+\(morphologic abnormality\)\s*$/i, "");
  s = s.replace(/\s+\(event\)\s*$/i, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > MAX_REGISTRY_CONDITION_LEN) s = s.slice(0, MAX_REGISTRY_CONDITION_LEN).trim();
  return s;
}

function scoreConditionLabel(raw: string): number {
  const label = raw.trim();
  if (!label) return -1_000;
  const s = label.toLowerCase();
  let score = 40;

  if (/\(disorder\)/i.test(label)) score += 28;
  if (/\(finding\)/i.test(label)) score -= 35;
  if (/\(situation\)/i.test(label)) score -= 45;

  if (
    /medication review|full-time employment|part-time employment|not in labor force|received higher education|limited social contact|unemployed|risk activity involvement/i.test(
      s,
    )
  ) {
    score -= 55;
  }
  if (/social isolation|victim of|reports of violence|intimate partner/i.test(s)) score -= 25;
  if (/malignant|neoplasm|carcinoma|cancer|lymphoma|leukemia|melanoma|tumor/i.test(s)) score += 35;
  if (/diabetes|hypertension|hyperlipidemia|hypertriglyceridemia|metabolic syndrome|obesity|prediabetes|heart failure|copd|asthma|stroke|fibromyalgia|osteoarthritis|hepatitis|hiv|depression|anxiety|schizophrenia|bipolar|epilepsy|parkinson|alzheimer|psoriasis|atopic dermatitis|anemia|sleep apnea|chronic kidney|ckd|coronary|mi\b|myocardial/i.test(s)) {
    score += 22;
  }
  if (/diabetes mellitus|type 2 diabetes|type 1 diabetes/i.test(s)) score += 15;
  if (/sprain|pharyngitis|viral sinusitis|cough|fever|acute viral|burn injury|dental caries|gingivitis|loose dental|infection of tooth|covid|sars-cov-2|suspected disease caused/i.test(s)) {
    score -= 8;
  }
  if (label.length > 95) score -= 6;
  return score;
}

function collectResources(root: unknown): Record<string, unknown>[] {
  const rootRec = asRecord(root);
  if (!rootRec) return [];

  if (rootRec.resourceType === "Bundle" && Array.isArray(rootRec.entry)) {
    const out: Record<string, unknown>[] = [];
    for (const e of rootRec.entry) {
      const er = asRecord(e);
      const res = er?.resource;
      const rr = asRecord(res);
      if (rr) out.push(rr);
    }
    return out;
  }
  return [rootRec];
}

export type FhirTrialPrefillExtraction = {
  prefill: ProfilePrefill;
  summary: {
    patientFound: boolean;
    activeConditionLabels: number;
    primaryForRegistry: string | null;
    /** Original display before normalization, for transparency */
    primaryRaw: string | null;
    needsConditionFromUser: boolean;
  };
};

/**
 * Deterministic FHIR JSON analysis for trial discovery (Bundle or single resource).
 * No external APIs — tuned for Synthea-style exports and generic R4 JSON.
 */
export function extractFhirTrialPrefill(root: unknown): FhirTrialPrefillExtraction {
  const resources = collectResources(root);

  let sex: Sex | undefined;
  let ageInput: string | undefined;
  let patientFound = false;

  const activeLabels: string[] = [];

  for (const r of resources) {
    if (r.resourceType === "Patient") {
      patientFound = true;
      const g = mapGender(typeof r.gender === "string" ? r.gender : undefined);
      if (g) sex = g;
      if (typeof r.birthDate === "string") {
        const age = ageFromBirthDate(r.birthDate);
        if (age !== undefined) ageInput = String(age);
      }
    }
    if (r.resourceType === "Condition" && conditionIsActiveForRanking(r)) {
      for (const t of conditionTextsFromResource(r)) {
        activeLabels.push(t);
      }
    }
  }

  const unique = [...new Set(activeLabels.map((x) => x.trim()).filter(Boolean))];
  const scored = unique.map((text) => ({ text, score: scoreConditionLabel(text) }));
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.text.length - b.text.length;
  });

  const primaryRaw = scored[0]?.text ?? null;
  const primaryForRegistry = primaryRaw ? normalizeRegistryConditionLabel(primaryRaw) : null;
  const needsConditionFromUser = !primaryForRegistry || primaryForRegistry.trim().length < 2;

  const orderedForNotes = scored.map((s) => s.text);
  const noteBody = orderedForNotes.map((l) => `· ${l}`).join("\n");
  const sessionNotes =
    noteBody.length > 0
      ? `FHIR conditions (active, ranked for local matching; extracted in browser only):\n${noteBody}`.slice(0, 24_000)
      : undefined;

  const prefill: ProfilePrefill = {
    ...(primaryForRegistry && !needsConditionFromUser ? { condition: primaryForRegistry } : {}),
    ...(ageInput ? { ageInput } : {}),
    ...(sex ? { sex } : {}),
    ...(sessionNotes ? { sessionNotes } : {}),
  };

  return {
    prefill,
    summary: {
      patientFound,
      activeConditionLabels: unique.length,
      primaryForRegistry,
      primaryRaw,
      needsConditionFromUser,
    },
  };
}
