const CT_BASE = "https://clinicaltrials.gov/api/v2/studies";

export type Sex = "any" | "male" | "female";

export type GeoFilter = {
  lat: number;
  lon: number;
  radiusMiles: number;
};

export type TrialSearchRequest = {
  condition: string;
  pageSize?: number;
  pageToken?: string;
  geo?: GeoFilter;
};

/** Compact location for list display (city/state/country only). */
export type TrialSite = {
  city?: string;
  state?: string;
  country?: string;
};

export type TrialSummary = {
  nctId: string;
  title: string;
  overallStatus: string;
  conditions: string[];
  eligibilityText: string;
  url: string;
  /** A few sites for display; full list lives on the detail page. */
  sites: TrialSite[];
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
  const contactsLocations = asRecord(protocol.contactsLocationsModule);

  const nctId = asString(identification?.nctId);
  const briefTitle = asString(identification?.briefTitle);
  const officialTitle = asString(identification?.officialTitle);
  const overallStatus = asString(status?.overallStatus) ?? "UNKNOWN";

  if (!nctId) return null;

  const title = briefTitle ?? officialTitle ?? nctId;
  const eligibilityText = asString(eligibility?.eligibilityCriteria) ?? "";

  const locationsRaw = Array.isArray(contactsLocations?.locations) ? contactsLocations!.locations : [];
  const sites: TrialSite[] = locationsRaw.slice(0, 60).map((loc) => {
    const r = asRecord(loc);
    return {
      city: asString(r?.city),
      state: asString(r?.state),
      country: asString(r?.country),
    };
  });

  return {
    nctId,
    title,
    overallStatus,
    conditions: asStringArray(conditions?.conditions),
    eligibilityText,
    url: `https://clinicaltrials.gov/study/${nctId}`,
    sites,
  };
}

export type TrialLocation = {
  facility?: string;
  city?: string;
  state?: string;
  country?: string;
  status?: string;
};

export type TrialContact = {
  name?: string;
  role?: string;
  phone?: string;
  email?: string;
};

export type TrialDetail = TrialSummary & {
  officialTitle?: string;
  briefSummary?: string;
  detailedDescription?: string;
  phases: string[];
  studyType?: string;
  enrollmentCount?: number;
  startDate?: string;
  completionDate?: string;
  leadSponsor?: string;
  interventions: string[];
  minimumAge?: string;
  maximumAge?: string;
  sex?: string;
  healthyVolunteers?: string;
  locations: TrialLocation[];
  contacts: TrialContact[];
};

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export function normalizeStudyDetail(study: unknown): TrialDetail | null {
  const base = normalizeStudy(study);
  if (!base) return null;

  const root = asRecord(study);
  const protocol = asRecord(root?.protocolSection);
  const identification = asRecord(protocol?.identificationModule);
  const description = asRecord(protocol?.descriptionModule);
  const design = asRecord(protocol?.designModule);
  const eligibility = asRecord(protocol?.eligibilityModule);
  const sponsor = asRecord(protocol?.sponsorCollaboratorsModule);
  const arms = asRecord(protocol?.armsInterventionsModule);
  const contactsLocations = asRecord(protocol?.contactsLocationsModule);
  const status = asRecord(protocol?.statusModule);

  const phasesRaw = asStringArray(design?.phases);
  const enrollment = asRecord(design?.enrollmentInfo);

  const interventionsRaw = Array.isArray(arms?.interventions) ? arms!.interventions : [];
  const interventions = interventionsRaw
    .map((iv) => {
      const r = asRecord(iv);
      const name = asString(r?.name);
      const type = asString(r?.type);
      return name ? (type ? `${name} (${type.toLowerCase()})` : name) : undefined;
    })
    .filter((s): s is string => Boolean(s));

  const locationsRaw = Array.isArray(contactsLocations?.locations) ? contactsLocations!.locations : [];
  const locations: TrialLocation[] = locationsRaw.slice(0, 50).map((loc) => {
    const r = asRecord(loc);
    return {
      facility: asString(r?.facility),
      city: asString(r?.city),
      state: asString(r?.state),
      country: asString(r?.country),
      status: asString(r?.status),
    };
  });

  const contactsRaw = Array.isArray(contactsLocations?.centralContacts) ? contactsLocations!.centralContacts : [];
  const contacts: TrialContact[] = contactsRaw.slice(0, 10).map((c) => {
    const r = asRecord(c);
    return {
      name: asString(r?.name),
      role: asString(r?.role),
      phone: asString(r?.phone),
      email: asString(r?.email),
    };
  });

  const startStruct = asRecord(status?.startDateStruct);
  const completionStruct = asRecord(status?.completionDateStruct);

  return {
    ...base,
    officialTitle: asString(identification?.officialTitle),
    briefSummary: asString(description?.briefSummary),
    detailedDescription: asString(description?.detailedDescription),
    phases: phasesRaw,
    studyType: asString(design?.studyType),
    enrollmentCount: asNumber(enrollment?.count),
    startDate: asString(startStruct?.date),
    completionDate: asString(completionStruct?.date),
    leadSponsor: asString(asRecord(sponsor?.leadSponsor)?.name),
    interventions,
    minimumAge: asString(eligibility?.minimumAge),
    maximumAge: asString(eligibility?.maximumAge),
    sex: asString(eligibility?.sex),
    healthyVolunteers:
      typeof eligibility?.healthyVolunteers === "boolean"
        ? eligibility.healthyVolunteers
          ? "Accepts healthy volunteers"
          : "No healthy volunteers"
        : undefined,
    locations,
    contacts,
  };
}

export async function fetchStudyDetail(nctId: string): Promise<TrialDetail | null> {
  const clean = nctId.trim().toUpperCase();
  if (!/^NCT\d{4,}$/.test(clean)) return null;
  const res = await fetch(`${CT_BASE}/${clean}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ClinicalTrialTracker-class-demo/0.1 (educational; contact: course)",
    },
    next: { revalidate: 0 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`ClinicalTrials.gov returned ${res.status}`);
  const json: unknown = await res.json();
  return normalizeStudyDetail(json);
}

export function buildStudiesUrl(params: TrialSearchRequest): string {
  const url = new URL(CT_BASE);
  const trimmed = params.condition.trim();
  url.searchParams.set("query.cond", trimmed);
  url.searchParams.set("filter.overallStatus", "RECRUITING");
  url.searchParams.set("pageSize", String(params.pageSize ?? 20));
  if (params.geo) {
    const radius = Math.max(1, Math.min(1000, Math.round(params.geo.radiusMiles)));
    url.searchParams.set("filter.geo", `distance(${params.geo.lat},${params.geo.lon},${radius}mi)`);
  }
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
