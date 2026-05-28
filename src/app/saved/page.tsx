import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { SavedTrialsList, type SavedTrialView } from "@/components/SavedTrialsList";

function safeParseArray(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export default async function SavedPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/saved");
  }

  const rows = await prisma.savedTrial.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  const trials: SavedTrialView[] = rows.map((r) => ({
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
  }));

  return <SavedTrialsList initialTrials={trials} />;
}
