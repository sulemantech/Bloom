import "server-only";
import { createClient } from "@/lib/supabase/server";
import { resolveFlag } from "./flags-rule";

export const BLOOM_V2 = "bloom_v2";

/** A flag set for the cohort wins over the global flag; missing flags are off. */
export async function isEnabled(key: string, cohortId?: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_flags")
    .select("cohort_id, enabled")
    .eq("key", key);

  return resolveFlag(data ?? [], cohortId);
}

/** Bloom v2 is rolled out per group: a student follows their current group (as in loadStudentOverview). */
export async function bloomV2Enabled(studentId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("memberships")
    .select("cohort_id")
    .eq("user_id", studentId)
    .eq("role", "student")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return isEnabled(BLOOM_V2, membership?.cohort_id);
}
