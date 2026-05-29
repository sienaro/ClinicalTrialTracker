import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

const MAX_CONDITION = 120;
const MAX_AGE = 4;
const MAX_NOTES = 24_000;
const SEXES = new Set(["any", "male", "female"]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const profile = await prisma.profile.findUnique({ where: { userId: session.user.id } });
  return NextResponse.json(
    {
      profile: profile
        ? {
            condition: profile.condition,
            ageInput: profile.ageInput,
            sex: profile.sex,
            sessionNotes: profile.sessionNotes,
            location: profile.location,
            travelRadius: profile.travelRadius,
          }
        : null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: NextRequest) {
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

  const condition = String(body.condition ?? "").slice(0, MAX_CONDITION);
  const ageInput = String(body.ageInput ?? "").slice(0, MAX_AGE);
  const sexRaw = String(body.sex ?? "any");
  const sex = SEXES.has(sexRaw) ? sexRaw : "any";
  const sessionNotes = String(body.sessionNotes ?? "").slice(0, MAX_NOTES);
  const location = String(body.location ?? "").slice(0, 120);
  let travelRadius = 100;
  if (typeof body.travelRadius === "number" && Number.isFinite(body.travelRadius)) {
    travelRadius = Math.min(1000, Math.max(5, Math.round(body.travelRadius)));
  }

  const data = { condition, ageInput, sex, sessionNotes, location, travelRadius };
  await prisma.profile.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });

  return NextResponse.json({ ok: true });
}
