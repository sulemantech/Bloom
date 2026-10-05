import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { activityStatus, currentWeek, forAgeGroup, latestByActivity, type ActivityStatus } from "@/lib/programme";

type Client = SupabaseClient<Database>;

/** A cohort with its students, the programme's activities and every student's latest status. */
export async function loadCohortProgress(supabase: Client, cohortId: string) {
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, name, start_date, timezone, schedule, program:programs(id, name, weeks)")
    .eq("id", cohortId)
    .maybeSingle();
  if (!cohort?.program) return null;

  const [{ data: members }, { data: stages }, { data: submissions }, { data: cards }, { data: sessions }] =
    await Promise.all([
      supabase
        .from("memberships")
        .select("id, role, age_group, paid_at, fee_amount, discount_reason, user:profiles(id, full_name, username, prefers_female_mentor)")
        .eq("cohort_id", cohortId),
      supabase
        .from("stages")
        .select("id, position, key, name, week_from, week_to, activities(id, week, position, title, age_group, submission_type)")
        .eq("program_id", cohort.program.id)
        .order("position"),
      supabase
        .from("submissions")
        .select("id, activity_id, student_id, status, submitted_at")
        .eq("cohort_id", cohortId)
        .order("submitted_at", { ascending: false }),
      supabase.from("progress_cards").select("id, student_id, week, status, viewed_at").eq("cohort_id", cohortId),
      supabase.from("sessions").select("*").eq("cohort_id", cohortId).order("starts_at"),
    ]);

  const week = currentWeek(cohort.start_date, cohort.timezone, cohort.program.weeks);
  const allActivities = (stages ?? [])
    .flatMap((s) => s.activities.map((a) => ({ ...a, stage_key: s.key })))
    .sort((a, b) => a.week - b.week || a.position - b.position);

  const memberList = members ?? [];
  const students = memberList
    .filter((m) => m.role === "student" && m.user)
    .map((m) => {
      const activities = forAgeGroup(allActivities, m.age_group);
      const own = (submissions ?? []).filter((s) => s.student_id === m.user!.id);
      const latest = latestByActivity(own);
      const statuses = new Map<string, ActivityStatus>(activities.map((a) => [a.id, activityStatus(a, latest.get(a.id), week)]));
      const count = (st: ActivityStatus) => activities.filter((a) => statuses.get(a.id) === st).length;
      return {
        membership: m,
        profile: m.user!,
        activities,
        statuses,
        latest,
        done: count("done"),
        overdue: count("overdue"),
        waiting: count("submitted"),
        total: activities.length,
      };
    })
    .sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name));

  // Latest submission per student+activity that is waiting for a mentor.
  const toReview = students
    .flatMap((s) =>
      [...s.latest.values()]
        .filter((sub) => sub.status === "submitted")
        .map((sub) => ({ submission: sub, student: s.profile, activity: allActivities.find((a) => a.id === sub.activity_id) })),
    )
    .sort((a, b) => a.submission.submitted_at.localeCompare(b.submission.submitted_at));

  return {
    cohort,
    program: cohort.program,
    stages: stages ?? [],
    week,
    allActivities,
    students,
    mentors: memberList.filter((m) => m.role === "mentor" && m.user),
    toReview,
    cards: cards ?? [],
    sessions: sessions ?? [],
  };
}

export type CohortProgress = NonNullable<Awaited<ReturnType<typeof loadCohortProgress>>>;

/** Cohorts the current user mentors (admins see all). */
export async function loadMyCohorts(supabase: Client, userId: string, isAdmin: boolean) {
  if (isAdmin) {
    const { data } = await supabase.from("cohorts").select("id, name, start_date, timezone").order("created_at");
    return data ?? [];
  }
  const { data } = await supabase
    .from("memberships")
    .select("cohort:cohorts(id, name, start_date, timezone)")
    .eq("user_id", userId)
    .eq("role", "mentor");
  return (data ?? []).flatMap((m) => (m.cohort ? [m.cohort] : []));
}
