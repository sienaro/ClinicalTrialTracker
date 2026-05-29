export type GeoPoint = { lat: number; lon: number; label: string };

/** Single Open-Meteo lookup for an exact name string. */
async function lookup(name: string): Promise<GeoPoint | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  let res: Response;
  try {
    res = await fetch(url.toString(), { next: { revalidate: 0 } });
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return null;
  }

  const results = (json as { results?: unknown }).results;
  if (!Array.isArray(results) || results.length === 0) return null;

  const r = results[0] as {
    latitude?: unknown;
    longitude?: unknown;
    name?: unknown;
    admin1?: unknown;
    country_code?: unknown;
  };
  const lat = typeof r.latitude === "number" ? r.latitude : undefined;
  const lon = typeof r.longitude === "number" ? r.longitude : undefined;
  if (lat === undefined || lon === undefined) return null;

  const parts = [r.name, r.admin1, r.country_code].filter(
    (p): p is string => typeof p === "string" && p.length > 0,
  );
  return { lat, lon, label: parts.join(", ") || name };
}

/**
 * Geocode a free-text place (city, "City, State", ZIP, etc.) to coordinates using the
 * Open-Meteo geocoding API — free, no API key, global coverage.
 *
 * Open-Meteo's name search dislikes suffixes like ", MA", so we try the full string
 * first, then progressively fall back to the city portion before a comma.
 */
export async function geocodePlace(query: string): Promise<GeoPoint | null> {
  const q = query.trim();
  if (q.length < 2) return null;

  const candidates = [q];
  if (q.includes(",")) {
    const city = q.split(",")[0]?.trim();
    if (city && city.length >= 2) candidates.push(city);
  }

  for (const candidate of candidates) {
    const hit = await lookup(candidate);
    if (hit) {
      // Preserve the user's fuller label (e.g. "Boston, MA") when we fell back to the city.
      return candidate === q ? hit : { ...hit, label: q };
    }
  }
  return null;
}
