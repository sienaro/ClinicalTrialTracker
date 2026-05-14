"use client";

import { usePathname } from "next/navigation";
import { SiteNav } from "@/components/SiteNav";

export function NavShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  return (
    <>
      <SiteNav pathname={pathname} />
      {children}
    </>
  );
}
