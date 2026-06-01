import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Evaluation — Does Gemini beat keyword matching?",
  description:
    "A live, hand-labeled benchmark comparing AI vs keyword ranking on 15 patient-trial pairs. Run it yourself in ~5 seconds.",
};

export default function EvaluationLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
