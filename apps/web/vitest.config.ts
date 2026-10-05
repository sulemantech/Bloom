import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for pure logic in src/lib. Database rules are tested with pgTAP (supabase/tests).
export default defineConfig({
  resolve: { alias: { "@": path.join(__dirname, "src") } },
  test: { include: ["src/**/*.test.ts"] },
});
