import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const STATUSES = new Set(["interested", "contacted", "applied"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string").slice(0, 50);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const rows = await prisma.savedTrial.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const trials = rows.map((r) => ({
    id: r.id,
    nctId: r.nctId,
    title: r.title,
    conditions: safeParseArray(r.conditions),
    eligibilityText: r.eligibilityText,
    url: r.url,
    score: r.score,
    label: r.label,
    reasons: safeParseArray(r.reasons),
    status: r.status,
    notes: r.notes,
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ trials }, { headers: { "Cache-Control": "no-store" } });
}

function safeParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isPlainObject(body)) {
    return NextResponse.json({ error: "Body must be an object" }, { status: 400 });
  }

  const nctId = String(body.nctId ?? "").trim().slice(0, 32);
  if (!nctId) {
    return NextResponse.json({ error: "nctId is required" }, { status: 400 });
  }

  const title = String(body.title ?? "").slice(0, 500);
  const conditions = JSON.stringify(toStringArray(body.conditions));
  const eligibilityText = String(body.eligibilityText ?? "").slice(0, 20_000);
  const url = String(body.url ?? "").slice(0, 500);
  const reasons = JSON.stringify(toStringArray(body.reasons));
  const score =
    typeof body.score === "number" && Number.isFinite(body.score)
      ? Math.max(0, Math.min(100, Math.round(body.score)))
      : null;
  const label = typeof body.label === "string" ? body.label.slice(0, 20) : null;
  const statusRaw = String(body.status ?? "interested");
  const status = STATUSES.has(statusRaw) ? statusRaw : "interested";

  const saved = await prisma.savedTrial.upsert({
    where: { userId_nctId: { userId: session.user.id, nctId } },
    update: { title, conditions, eligibilityText, url, reasons, score, label },
    create: {
      userId: session.user.id,
      nctId,
      title,
      conditions,
      eligibilityText,
      url,
      reasons,
      score,
      label,
      status,
    },
  });

  return NextResponse.json({ id: saved.id, status: saved.status }, { status: 201 });
}
