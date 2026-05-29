import { NextResponse, type NextRequest } from "next/server";
import { fetchRecruitingStudies } from "@/lib/clinicalTrialsGov";
import { geocodePlace } from "@/lib/geocode";

const MAX_CONDITION_LEN = 120;
const MIN_CONDITION_LEN = 2;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type")?.split(";")[0]?.trim();
  if (contentType !== "application/json") {
    return NextResponse.json(
      { error: "Content-Type must be application/json" },
      { status: 415 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "JSON body must be an object" }, { status: 400 });
  }

  const condition = body.condition;
  if (typeof condition !== "string") {
    return NextResponse.json({ error: "`condition` must be a string" }, { status: 400 });
  }

  const trimmed = condition.trim();
  if (trimmed.length < MIN_CONDITION_LEN) {
    return NextResponse.json({ error: "Condition is too short" }, { status: 400 });
  }
  if (trimmed.length > MAX_CONDITION_LEN) {
    return NextResponse.json({ error: "Condition is too long" }, { status: 400 });
  }

  let pageSize = 20;
  if (body.pageSize !== undefined) {
    if (typeof body.pageSize !== "number" || !Number.isInteger(body.pageSize)) {
      return NextResponse.json({ error: "`pageSize` must be an integer" }, { status: 400 });
    }
    pageSize = Math.min(50, Math.max(5, body.pageSize));
  }

  let pageToken: string | undefined;
  if (body.pageToken !== undefined) {
    if (typeof body.pageToken !== "string") {
      return NextResponse.json({ error: "`pageToken` must be a string" }, { status: 400 });
    }
    if (body.pageToken.length > 512) {
      return NextResponse.json({ error: "`pageToken` is too long" }, { status: 400 });
    }
    pageToken = body.pageToken;
  }

  // Optional location filtering: geocode a free-text place + radius into a geo filter.
  let geo: { lat: number; lon: number; radiusMiles: number } | undefined;
  let resolvedLocation: string | undefined;
  const locationRaw = typeof body.location === "string" ? body.location.trim().slice(0, 120) : "";
  if (locationRaw.length >= 2) {
    let radiusMiles = 100;
    if (typeof body.radiusMiles === "number" && Number.isFinite(body.radiusMiles)) {
      radiusMiles = Math.min(1000, Math.max(5, Math.round(body.radiusMiles)));
    }
    const point = await geocodePlace(locationRaw);
    if (!point) {
      return NextResponse.json(
        { error: `Could not find a location matching “${locationRaw}”. Try a city or “City, State”.` },
        { status: 400 },
      );
    }
    geo = { lat: point.lat, lon: point.lon, radiusMiles };
    resolvedLocation = point.label;
  }

  try {
    const { studies, nextPageToken } = await fetchRecruitingStudies({
      condition: trimmed,
      pageSize,
      pageToken,
      geo,
    });

    return NextResponse.json(
      { studies, nextPageToken, resolvedLocation },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
