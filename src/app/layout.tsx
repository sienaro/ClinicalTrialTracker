import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NavShell } from "@/components/NavShell";
import { Providers } from "@/components/Providers";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Clinical Trial Tracker",
  description:
    "Search recruiting clinical trials on ClinicalTrials.gov with optional local context files and exploratory match ranking. Not medical advice.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen antialiased`}>
        <Providers>
          <NavShell>{children}</NavShell>
        </Providers>
      </body>
    </html>
  );
}
