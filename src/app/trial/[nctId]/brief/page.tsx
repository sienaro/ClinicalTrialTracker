import { notFound } from "next/navigation";
import { fetchStudyDetail } from "@/lib/clinicalTrialsGov";
import { BriefContent } from "@/components/BriefContent";

export default async function TrialBriefPage({ params }: { params: Promise<{ nctId: string }> }) {
  const { nctId } = await params;
  const trial = await fetchStudyDetail(nctId);
  if (!trial) notFound();

  const ageRange =
    trial.minimumAge || trial.maximumAge
      ? `${trial.minimumAge ?? "Any"} – ${trial.maximumAge ?? "Any"}`
      : "Not specified";

  const facts = [
    { label: "Status", value: trial.overallStatus.replace(/_/g, " ") },
    { label: "Phase", value: trial.phases.length ? trial.phases.join(", ").replace(/_/g, " ") : "N/A" },
    { label: "Enrollment", value: typeof trial.enrollmentCount === "number" ? `${trial.enrollmentCount} participants` : "—" },
    { label: "Sponsor", value: trial.leadSponsor ?? "—" },
    { label: "Age range", value: ageRange },
    { label: "Sex", value: trial.sex ?? "All" },
  ];

  return (
    <BriefContent
      nctId={trial.nctId}
      title={trial.title}
      conditions={trial.conditions}
      briefSummary={trial.briefSummary ?? ""}
      eligibilityText={trial.eligibilityText ?? ""}
      url={trial.url}
      facts={facts}
      locationCount={trial.locations.length}
    />
  );
}
