import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // The repo root has its own package-lock.json (Supabase CLI); the app's root is this folder.
  turbopack: { root: path.join(__dirname) },
};

export default withNextIntl(nextConfig);
