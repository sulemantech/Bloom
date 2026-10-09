import "server-only";
import { createClient } from "@/lib/supabase/server";
import { FEATURES, type FeatureKey } from "./features";
import { resolveFlag } from "./flags-rule";

export const BLOOM_V2 = "bloom_v2";

/** A setting for the group wins over the one for everyone; with neither, the feature's default (lib/features). */
export async function isEnabled(key: FeatureKey, cohortId?: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_flags")
    .select("cohort_id, enabled")
    .eq("key", key);

  // Global-only features (like the AI master switch) ignore group rows.
  return resolveFlag(data ?? [], FEATURES[key].scope === "group" ? cohortId : undefined, FEATURES[key].default);
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
