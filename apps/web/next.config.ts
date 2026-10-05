import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // The repo root has its own package-lock.json (Supabase CLI); the app's root is this folder.
  turbopack: { root: path.join(__dirname) },
  // Dev only: let phones and other machines on the LAN load the dev scripts. Without this,
  // Next blocks them, the page never hydrates and forms fall back to plain HTML posts.
  allowedDevOrigins: ["192.168.100.70"],
  // Bloom is shown as Spark; old /bloom links and bookmarks still work.
  async redirects() {
    return [
      { source: "/student/bloom/:path*", destination: "/student/spark/:path*", permanent: true },
      { source: "/parent/children/:id/bloom/:path*", destination: "/parent/children/:id/spark/:path*", permanent: true },
      {
        source: "/mentor/groups/:cohortId/students/:studentId/bloom/:path*",
        destination: "/mentor/groups/:cohortId/students/:studentId/spark/:path*",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
