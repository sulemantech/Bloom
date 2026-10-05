import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { activityStatus, currentWeek, forAgeGroup, latestByActivity, type ActivityStatus } from "@/lib/programme";

type Client = SupabaseClient<Database>;

/**
 * Everything about one student's course, as visible to the current viewer (RLS applies):
 * their group, the programme's activities for their age group, submissions with files and
 * feedback, their project and the group's class sessions.
 */
export async function loadStudentOverview(supabase: Client, studentId: string) {
  const { data: membership } = await supabase
    .from("memberships")
    .select(
      "id, cohort_id, age_group, cohort:cohorts(id, name, start_date, timezone, schedule, program:programs(id, name, weeks))",
    )
    .eq("user_id", studentId)
    .eq("role", "student")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const cohort = membership?.cohort;
  const program = cohort?.program;
  if (!membership || !cohort || !program) return null;

  const [{ data: stages }, { data: submissions }, { data: project }, { data: sessions }] = await Promise.all([
    supabase
      .from("stages")
      .select(
        "id, position, key, name, summary, week_from, week_to, activities(id, week, position, title, instructions, age_group, submission_type)",
      )
      .eq("program_id", program.id)
      .order("position"),
    supabase
      .from("submissions")
      .select(
        "id, activity_id, body, link_url, status, submitted_at, submission_files(id, storage_path, file_name, mime_type, size_bytes), feedback(id, body, created_at, mentor:profiles(full_name))",
      )
      .eq("student_id", studentId)
      .eq("cohort_id", cohort.id)
      .order("submitted_at", { ascending: false }),
    supabase.from("projects").select("*").eq("student_id", studentId).eq("cohort_id", cohort.id).maybeSingle(),
    supabase.from("sessions").select("*").eq("cohort_id", cohort.id).order("starts_at"),
  ]);

  const stageList = stages ?? [];
  const activities = forAgeGroup(
    stageList.flatMap((s) => s.activities.map((a) => ({ ...a, stage_key: s.key }))),
    membership.age_group,
  ).sort((a, b) => a.week - b.week || a.position - b.position);

  const week = currentWeek(cohort.start_date, cohort.timezone, program.weeks);
  const submissionList = submissions ?? [];
  const latest = latestByActivity(submissionList);
  const statuses = new Map<string, ActivityStatus>(
    activities.map((a) => [a.id, activityStatus(a, latest.get(a.id), week)]),
  );

  const done = activities.filter((a) => statuses.get(a.id) === "done").length;
  const submitted = activities.filter((a) => latest.has(a.id)).length;
  const overdue = activities.filter((a) => statuses.get(a.id) === "overdue").length;

  return {
    membership,
    cohort,
    program,
    stages: stageList,
    activities,
    submissions: submissionList,
    latest,
    statuses,
    project,
    sessions: sessions ?? [],
    week,
    stats: { total: activities.length, done, submitted, overdue },
  };
}

export type StudentOverview = NonNullable<Awaited<ReturnType<typeof loadStudentOverview>>>;

/** Short-lived links for private submission files (RLS on storage decides access). */
export async function signFiles(supabase: Client, paths: string[]) {
  if (paths.length === 0) return new Map<string, string>();
  const { data } = await supabase.storage.from("submissions").createSignedUrls(paths, 60 * 10);
  return new Map((data ?? []).flatMap((d) => (d.path && d.signedUrl ? [[d.path, d.signedUrl] as const] : [])));
}
