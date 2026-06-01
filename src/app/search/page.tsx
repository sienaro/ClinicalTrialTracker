import type { Metadata } from "next";
import { Dashboard } from "@/components/Dashboard";

export const metadata: Metadata = {
  title: "Search — Clinical Trial Tracker",
  description:
    "Find recruiting clinical trials matched to your profile by Google Gemini, filtered to your area and the distance you'll travel.",
};

export default function SearchPage() {
  return <Dashboard />;
}
