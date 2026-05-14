import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  // Avoid picking up an unrelated lockfile in a parent directory (e.g. $HOME/package-lock.json).
  outputFileTracingRoot: projectRoot,
  async redirects() {
    return [
      { source: "/add/fhir", destination: "/fhir", permanent: true },
      { source: "/add/pdf", destination: "/", permanent: true },
      { source: "/add/manual", destination: "/", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
