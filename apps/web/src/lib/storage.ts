import "server-only";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "submissions";
const SIGNED_URL_SECONDS = 60 * 10;

/** Storage path convention, matched by the storage policies: <cohort_id>/<student_id>/<file>. */
export function submissionFilePath(cohortId: string, studentId: string, fileName: string) {
  const safeName = fileName.replace(/[^\w.\-]+/g, "_");
  return `${cohortId}/${studentId}/${crypto.randomUUID()}-${safeName}`;
}

/** Short-lived link to a private file; row-level security decides whether the user may see it. */
export async function signedFileUrl(path: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_SECONDS);
  return error ? null : data.signedUrl;
}
