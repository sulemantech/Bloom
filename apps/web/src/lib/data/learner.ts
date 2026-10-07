import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { checkQuestions } from "@/lib/bloom/adaptive";
import { applyReview, conceptKey, learnerState, type LearnerState } from "@/lib/bloom/learner";
import { pathAnchors } from "@/lib/data/bloom";
import type { StudentOverview } from "@/lib/data/overview";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/**
 * The course activity the student most needs: the most pressing activity a path could serve
 * (lib/bloom/anchor), so "next need" and path anchors always agree.
 */
export function courseNeed(overview: StudentOverview | null): { title: string; week: number; overdue: boolean } | null {
  const pick = pathAnchors(overview).find((a) => a.kind === "activity");
  return pick ? { title: pick.label, week: pick.week!, overdue: pick.urgent === "overdue" } : null;
}

/** What Spark knows about a student's learning (RLS decides who can read it). */
export async function loadLearnerState(supabase: Client, studentId: string, overview: StudentOverview | null): Promise<LearnerState> {
  const [{ data: concepts }, { data: steps }] = await Promise.all([
    supabase.from("spark_concepts").select("key, label, status, struggle_count, nailed_count, updated_at").eq("student_id", studentId),
    supabase
      .from("bloom_tasks")
      .select("feeling, check_answers, check_review")
      .eq("student_id", studentId)
      .eq("status", "done")
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(3),
  ]);
  return learnerState(concepts ?? [], steps ?? [], courseNeed(overview));
}

/**
 * Turns a reviewed step into learner-state evidence (lib/bloom/learner applyReview), as the student.
 * Logging only on failure: the review itself is already saved.
 */
export async function recordReview(
  supabase: Client,
  studentId: string,
  task: { id: string; path_id: string; check_questions: unknown; check_answers: unknown; check_review: unknown },
) {
  const keys = checkQuestions(task.check_questions).flatMap((q) => (q.idea ? [conceptKey(q.idea)] : [])).filter(Boolean);
  if (!keys.length) return;
  const { data: existing } = await supabase
    .from("spark_concepts")
    .select("key, label, status, struggle_count, nailed_count")
    .eq("student_id", studentId)
    .in("key", keys);
  const changed = applyReview(existing ?? [], task);
  if (!changed.length) return;
  const { error } = await supabase.from("spark_concepts").upsert(
    changed.map((c) => ({
      student_id: studentId,
      key: c.key,
      label: c.label,
      status: c.status,
      struggle_count: c.struggle_count,
      nailed_count: c.nailed_count,
      last_path_id: task.path_id,
      last_task_id: task.id,
    })),
    { onConflict: "student_id,key" },
  );
  if (error) console.error("Spark learner state update failed:", error.message);
}
