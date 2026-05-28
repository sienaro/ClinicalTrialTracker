import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

function safeParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function csvCell(value: unknown): string {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { profile: true, savedTrials: { orderBy: { createdAt: "desc" } } },
  });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const format = req.nextUrl.searchParams.get("format");

  if (format === "csv") {
    const header = ["nctId", "title", "status", "score", "label", "conditions", "notes", "url", "savedAt"];
    const rows = user.savedTrials.map((t) =>
      [
        t.nctId,
        t.title,
        t.status,
        t.score ?? "",
        t.label ?? "",
        safeParseArray(t.conditions).join("; "),
        t.notes,
        t.url,
        t.createdAt.toISOString(),
      ]
        .map(csvCell)
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="saved-trials.csv"',
        "Cache-Control": "no-store",
      },
    });
  }

  const data = {
    exportedAt: new Date().toISOString(),
    account: { email: user.email, name: user.name, createdAt: user.createdAt },
    profile: user.profile
      ? {
          condition: user.profile.condition,
          ageInput: user.profile.ageInput,
          sex: user.profile.sex,
          sessionNotes: user.profile.sessionNotes,
        }
      : null,
    savedTrials: user.savedTrials.map((t) => ({
      nctId: t.nctId,
      title: t.title,
      conditions: safeParseArray(t.conditions),
      score: t.score,
      label: t.label,
      reasons: safeParseArray(t.reasons),
      status: t.status,
      notes: t.notes,
      url: t.url,
      savedAt: t.createdAt,
    })),
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": 'attachment; filename="clinical-trial-tracker-data.json"',
      "Cache-Control": "no-store",
    },
  });
}
