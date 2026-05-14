import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clinical Trial Tracker (demo)",
  description:
    "Class project: explore recruiting trials with synthetic profiles. Not medical advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
