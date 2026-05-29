import type { Sex } from "@/lib/clinicalTrialsGov";

export const PROFILE_PREFILL_STORAGE_KEY = "ctt_profile_prefill_v1";

export type ProfilePrefill = {
  condition?: string;
  ageInput?: string;
  sex?: Sex;
  sessionNotes?: string;
  location?: string;
  radiusMiles?: number;
  /** When true, home dashboard runs one recruiting search after applying the rest of the prefill. */
  autoSearch?: boolean;
};

export function saveProfilePrefill(prefill: ProfilePrefill): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(PROFILE_PREFILL_STORAGE_KEY, JSON.stringify(prefill));
  } catch {
    // Quota or privacy mode — ignore
  }
}

/** Read and remove prefill so it is only applied once. */
export function consumeProfilePrefill(): ProfilePrefill | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(PROFILE_PREFILL_STORAGE_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(PROFILE_PREFILL_STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const o = parsed as Record<string, unknown>;
    const out: ProfilePrefill = {};
    if (typeof o.condition === "string") out.condition = o.condition;
    if (typeof o.ageInput === "string") out.ageInput = o.ageInput;
    if (o.sex === "any" || o.sex === "male" || o.sex === "female") out.sex = o.sex;
    if (typeof o.sessionNotes === "string") out.sessionNotes = o.sessionNotes;
    if (typeof o.location === "string") out.location = o.location;
    if (typeof o.radiusMiles === "number") out.radiusMiles = o.radiusMiles;
    if (typeof o.autoSearch === "boolean") out.autoSearch = o.autoSearch;
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}
