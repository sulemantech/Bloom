import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Supabase client with the secret key. It bypasses row-level security, so use it only for
 * privileged server actions (creating a child's account, inviting mentors, deleting data)
 * after checking the caller's permissions yourself.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing environment variable SUPABASE_SECRET_KEY");

  return createClient<Database>(supabaseUrl(), secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
