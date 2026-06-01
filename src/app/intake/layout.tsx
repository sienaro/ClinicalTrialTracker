import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Talk to the assistant — Clinical Trial Tracker",
  description:
    "Describe your situation in plain language and let the AI assistant interview you, build your profile, and search recruiting clinical trials.",
};

export default function IntakeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
