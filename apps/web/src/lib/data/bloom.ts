import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BloomContext } from "@/lib/ai";
import type { LearnerState } from "@/lib/bloom/learner";
import type { StudentOverview } from "@/lib/data/overview";
import type { Database } from "@/lib/supabase/database.types";
import { stageForWeek, tr } from "@/lib/programme";

type Client = SupabaseClient<Database>;

const PATH_FIELDS =
  "id, title, goal, summary, stage_key, depth, status, ai_generated, mentor_note, mentor_note_at, completed_at, created_at, updated_at, mentor:profiles!bloom_paths_mentor_note_by_fkey(full_name), bloom_tasks(id, position, kind, title, details, status, reflection, feeling, planned_only, adaptation, adapted_from, check_questions, check_answers, check_review, completed_at)";

/** A student's learning paths with their tasks (RLS decides who can read them). */
export async function loadBloomPaths(supabase: Client, studentId: string) {
  const { data } = await supabase
    .from("bloom_paths")
    .select(PATH_FIELDS)
    .eq("student_id", studentId)
    .order("created_at", { ascending: false });

  return (data ?? []).map((p) => {
    const tasks = [...p.bloom_tasks].sort((a, b) => a.position - b.position);
    const done = tasks.filter((t) => t.status === "done").length;
    return { ...p, tasks, done, total: tasks.length };
  });
}

export type BloomPath = Awaited<ReturnType<typeof loadBloomPaths>>[number];

/** One path with tasks and questions, or null if the viewer can't see it. */
export async function loadBloomPath(supabase: Client, pathId: string) {
  const [{ data: path }, { data: questions }] = await Promise.all([
    supabase.from("bloom_paths").select(`student_id, ${PATH_FIELDS}`).eq("id", pathId).maybeSingle(),
    supabase.from("bloom_questions").select("id, task_id, question, answer, created_at").eq("path_id", pathId).order("created_at"),
  ]);
  if (!path) return null;
  const tasks = [...path.bloom_tasks].sort((a, b) => a.position - b.position);
  return { ...path, tasks, done: tasks.filter((t) => t.status === "done").length, total: tasks.length, questions: questions ?? [] };
}

/** An active parental consent (e.g. "bloom_ai": the student may use the AI guide). */
export async function hasConsent(supabase: Client, studentId: string, type: Database["public"]["Enums"]["consent_type"]) {
  const { data } = await supabase
    .from("consents")
    .select("id")
    .eq("student_id", studentId)
    .eq("type", type)
    .is("revoked_at", null)
    .limit(1);
  return (data ?? []).length > 0;
}

/** Totals for dashboards: paths, tasks done, questions asked. */
export function bloomStats(paths: BloomPath[]) {
  return {
    paths: paths.length,
    active: paths.filter((p) => p.status === "active").length,
    completed: paths.filter((p) => p.status === "completed").length,
    tasksDone: paths.reduce((n, p) => n + p.done, 0),
    tasksTotal: paths.reduce((n, p) => n + p.total, 0),
  };
}

/** What the AI is told about the student: age group, step, project and earlier topics. Never names. */
export function bloomContext(overview: StudentOverview | null, paths: { title: string }[], learner?: LearnerState): BloomContext {
  const week = overview?.week ?? null;
  const focusWeek = overview && week !== null ? Math.min(Math.max(week, 1), overview.program.weeks) : null;
  const stage = overview && focusWeek ? stageForWeek(overview.stages, focusWeek) : undefined;
  const project = overview?.project;
  return {
    ageGroup: overview?.membership.age_group ?? null,
    step: stage ? tr(stage.name) : null,
    week: focusWeek,
    project: project ? { area: project.area, title: project.title, problem: project.problem, status: project.status } : null,
    previousPaths: paths.slice(0, 12).map((p) => p.title),
    ...(learner ? { learner } : {}),
  };
}

// ---------------------------------------------------------------------------
// Timeline: everything a student has done, newest first
// ---------------------------------------------------------------------------

export type TimelineEvent = {
  id: string;
  at: string;
  kind:
    | "submitted"
    | "reviewed_done"
    | "reviewed_changes"
    | "feedback"
    | "card"
    | "project"
    | "path_started"
    | "path_completed"
    | "task_done"
    | "question";
  title: string;
  detail?: string;
  href?: string;
  /** True when the student did it (used for "last active"). */
  byStudent: boolean;
};

/**
 * Merge course work, mentor feedback, progress cards and Bloom activity into one list.
 * `bloomHref` builds a link to a path for the viewer's role; omit to show no links.
 */
export async function loadTimeline(
  supabase: Client,
  studentId: string,
  overview: StudentOverview | null,
  options: { bloomHref?: (pathId: string) => string; activityHref?: (activityId: string) => string } = {},
) {
  const [paths, { data: questions }, { data: cards }] = await Promise.all([
    loadBloomPaths(supabase, studentId),
    supabase.from("bloom_questions").select("id, path_id, question, created_at").eq("student_id", studentId),
    // Students can't read cards and parents only see approved ones: RLS filters this for us.
    supabase.from("progress_cards").select("id, week, approved_at").eq("student_id", studentId).eq("status", "approved"),
  ]);

  const events: TimelineEvent[] = [];
  const activityTitle = (id: string) => tr(overview?.activities.find((a) => a.id === id)?.title);

  for (const s of overview?.submissions ?? []) {
    const href = options.activityHref?.(s.activity_id);
    events.push({ id: `s-${s.id}`, at: s.submitted_at, kind: "submitted", title: activityTitle(s.activity_id), href, byStudent: true });
    for (const fb of s.feedback) {
      events.push({
        id: `f-${fb.id}`,
        at: fb.created_at,
        kind: s.status === "done" ? "reviewed_done" : s.status === "needs_changes" ? "reviewed_changes" : "feedback",
        title: activityTitle(s.activity_id),
        detail: fb.body,
        href,
        byStudent: false,
      });
    }
  }

  for (const c of cards ?? []) {
    if (c.approved_at) events.push({ id: `c-${c.id}`, at: c.approved_at, kind: "card", title: String(c.week), byStudent: false });
  }

  const project = overview?.project;
  if (project && (project.title || project.problem)) {
    events.push({ id: `p-${project.id}`, at: project.updated_at, kind: "project", title: project.title ?? "", byStudent: true });
  }

  const pathTitle = new Map(paths.map((p) => [p.id, p.title]));
  for (const p of paths) {
    const href = options.bloomHref?.(p.id);
    events.push({ id: `bp-${p.id}`, at: p.created_at, kind: "path_started", title: p.title, href, byStudent: true });
    if (p.completed_at) events.push({ id: `bc-${p.id}`, at: p.completed_at, kind: "path_completed", title: p.title, href, byStudent: true });
    for (const t of p.tasks) {
      if (t.completed_at) {
        events.push({ id: `bt-${t.id}`, at: t.completed_at, kind: "task_done", title: t.title, detail: p.title, href, byStudent: true });
      }
    }
  }
  for (const q of questions ?? []) {
    events.push({
      id: `bq-${q.id}`,
      at: q.created_at,
      kind: "question",
      title: q.question,
      detail: pathTitle.get(q.path_id),
      href: options.bloomHref?.(q.path_id),
      byStudent: true,
    });
  }

  events.sort((a, b) => b.at.localeCompare(a.at));
  const lastActive = events.find((e) => e.byStudent)?.at ?? null;
  return { events, lastActive, paths };
}

/** Most recent student activity per student (submissions and Bloom), for group tables. */
export async function loadLastActive(supabase: Client, studentIds: string[]) {
  const result = new Map<string, string>();
  if (studentIds.length === 0) return result;
  const [{ data: subs }, { data: tasks }, { data: paths }, { data: questions }] = await Promise.all([
    supabase.from("submissions").select("student_id, submitted_at").in("student_id", studentIds).order("submitted_at", { ascending: false }),
    supabase.from("bloom_tasks").select("student_id, updated_at").in("student_id", studentIds).order("updated_at", { ascending: false }),
    supabase.from("bloom_paths").select("student_id, created_at").in("student_id", studentIds).order("created_at", { ascending: false }),
    supabase.from("bloom_questions").select("student_id, created_at").in("student_id", studentIds).order("created_at", { ascending: false }),
  ]);
  const bump = (id: string, at: string) => {
    const current = result.get(id);
    if (!current || at > current) result.set(id, at);
  };
  for (const s of subs ?? []) bump(s.student_id, s.submitted_at);
  for (const t of tasks ?? []) bump(t.student_id, t.updated_at);
  for (const p of paths ?? []) bump(p.student_id, p.created_at);
  for (const q of questions ?? []) bump(q.student_id, q.created_at);
  return result;
}

/** Bloom totals per student (tasks done / total, active paths) for group tables. */
export async function loadBloomTotals(supabase: Client, studentIds: string[]) {
  const result = new Map<string, { done: number; total: number; paths: number }>();
  if (studentIds.length === 0) return result;
  const [{ data: tasks }, { data: paths }] = await Promise.all([
    supabase.from("bloom_tasks").select("student_id, status").in("student_id", studentIds),
    supabase.from("bloom_paths").select("student_id").in("student_id", studentIds).neq("status", "archived"),
  ]);
  for (const id of studentIds) result.set(id, { done: 0, total: 0, paths: 0 });
  for (const t of tasks ?? []) {
    const r = result.get(t.student_id)!;
    r.total++;
    if (t.status === "done") r.done++;
  }
  for (const p of paths ?? []) result.get(p.student_id)!.paths++;
  return result;
}

/** Days since a moment, for "active 3 days ago" labels. */
export function daysSince(iso: string | null | undefined, now = new Date()) {
  if (!iso) return null;
  return Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000);
}
