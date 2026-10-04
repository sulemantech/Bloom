import "server-only";
import { createClient } from "@/lib/supabase/server";

/** A flag set for the cohort wins over the global flag; missing flags are off. */
export async function isEnabled(key: string, cohortId?: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("feature_flags")
    .select("cohort_id, enabled")
    .eq("key", key);

  const flags = data ?? [];
  const cohortFlag = cohortId ? flags.find((f) => f.cohort_id === cohortId) : undefined;
  const globalFlag = flags.find((f) => f.cohort_id === null);
  return (cohortFlag ?? globalFlag)?.enabled ?? false;
}
