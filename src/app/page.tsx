import type { Metadata } from "next";
import { HomeChoice } from "@/components/HomeChoice";

export const metadata: Metadata = {
  title: "Clinical Trial Tracker — AI-matched trials in plain language",
  description:
    "Describe your situation in plain words. Gemini reads each recruiting trial's eligibility criteria and tells you, in any language, whether it might fit.",
};

export default function Home() {
  return <HomeChoice />;
}
