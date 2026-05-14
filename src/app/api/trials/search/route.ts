import { NextResponse, type NextRequest } from "next/server";
import { fetchRecruitingStudies } from "@/lib/clinicalTrialsGov";

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

  try {
    const { studies, nextPageToken } = await fetchRecruitingStudies({
      condition: trimmed,
      pageSize,
      pageToken,
    });

    return NextResponse.json(
      { studies, nextPageToken },
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
