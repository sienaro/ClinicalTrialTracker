const CT_BASE = "https://clinicaltrials.gov/api/v2/studies";

export type Sex = "any" | "male" | "female";

export type TrialSearchRequest = {
  condition: string;
  pageSize?: number;
  pageToken?: string;
};

export type TrialSummary = {
  nctId: string;
  title: string;
  overallStatus: string;
  conditions: string[];
  eligibilityText: string;
  url: string;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

export function normalizeStudy(study: unknown): TrialSummary | null {
  const root = asRecord(study);
  if (!root) return null;

  const protocol = asRecord(root.protocolSection);
  if (!protocol) return null;

  const identification = asRecord(protocol.identificationModule);
  const status = asRecord(protocol.statusModule);
  const conditions = asRecord(protocol.conditionsModule);
  const eligibility = asRecord(protocol.eligibilityModule);

  const nctId = asString(identification?.nctId);
  const briefTitle = asString(identification?.briefTitle);
  const officialTitle = asString(identification?.officialTitle);
  const overallStatus = asString(status?.overallStatus) ?? "UNKNOWN";

  if (!nctId) return null;

  const title = briefTitle ?? officialTitle ?? nctId;
  const eligibilityText = asString(eligibility?.eligibilityCriteria) ?? "";

  return {
    nctId,
    title,
    overallStatus,
    conditions: asStringArray(conditions?.conditions),
    eligibilityText,
    url: `https://clinicaltrials.gov/study/${nctId}`,
  };
}

export function buildStudiesUrl(params: TrialSearchRequest): string {
  const url = new URL(CT_BASE);
  const trimmed = params.condition.trim();
  url.searchParams.set("query.cond", trimmed);
  url.searchParams.set("filter.overallStatus", "RECRUITING");
  url.searchParams.set("pageSize", String(params.pageSize ?? 20));
  if (params.pageToken) {
    url.searchParams.set("pageToken", params.pageToken);
  }
  return url.toString();
}

export async function fetchRecruitingStudies(
  params: TrialSearchRequest,
): Promise<{ studies: TrialSummary[]; nextPageToken?: string }> {
  const url = buildStudiesUrl(params);
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ClinicalTrialTracker-class-demo/0.1 (educational; contact: course)",
    },
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    throw new Error(`ClinicalTrials.gov returned ${res.status}`);
  }

  const json: unknown = await res.json();
  const root = asRecord(json);
  const studiesRaw = root?.studies;
  const nextPageToken = asString(root?.nextPageToken);

  if (!Array.isArray(studiesRaw)) {
    return { studies: [] };
  }

  const studies = studiesRaw
    .map(normalizeStudy)
    .filter((s): s is TrialSummary => s !== null);

  return { studies, nextPageToken };
}
