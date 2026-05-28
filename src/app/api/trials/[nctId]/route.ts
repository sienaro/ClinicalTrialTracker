import { NextResponse, type NextRequest } from "next/server";
import { fetchStudyDetail } from "@/lib/clinicalTrialsGov";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ nctId: string }> }) {
  const { nctId } = await params;
  try {
    const detail = await fetchStudyDetail(nctId);
    if (!detail) {
      return NextResponse.json({ error: "Trial not found" }, { status: 404 });
    }
    return NextResponse.json({ detail }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load trial";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
