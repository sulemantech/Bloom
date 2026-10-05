"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { askBloom, planBloomPath, suggestBloomPaths, type AiFailure, type BloomSuggestion } from "@/lib/ai";
import { getCurrentProfile } from "@/lib/auth";
import { bloomContext, hasConsent, loadBloomPaths } from "@/lib/data/bloom";
import { loadStudentOverview } from "@/lib/data/overview";
import { stageForWeek } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export type BloomState = { status: "idle" | "ok" | "error"; message?: string };
export type SuggestState = BloomState & { suggestions?: BloomSuggestion[] };

const DEPTHS = ["quick", "standard", "deep"] as const;
const TASK_STATUSES = ["todo", "doing", "done"] as const;
const KINDS = ["learn", "do", "reflect"] as const;
const PATH_STATUSES = ["active", "completed", "archived"] as const;

const str = (formData: FormData, key: string, max = 200) => String(formData.get(key) ?? "").trim().slice(0, max);
const oneOf = <T extends string>(list: readonly T[], value: string, fallback: T): T => (list.includes(value as T) ? (value as T) : fallback);

async function requireStudent() {
  const profile = await getCurrentProfile();
  return profile?.role === "student" ? profile : null;
}

async function hasBloomAiConsent(studentId: string) {
  return hasConsent(await createClient(), studentId, "bloom_ai");
}

async function aiContext(studentId: string) {
  const supabase = await createClient();
  const [overview, paths] = await Promise.all([loadStudentOverview(supabase, studentId), loadBloomPaths(supabase, studentId)]);
  return { overview, context: bloomContext(overview, paths) };
}

const aiError = (reason: AiFailure) => ({ status: "error" as const, message: `ai.${reason}` });

export async function suggestPaths(_prev: SuggestState, formData: FormData): Promise<SuggestState> {
  const student = await requireStudent();
  if (!student) return { status: "error", message: "notAllowed" };
  if (!(await hasBloomAiConsent(student.id))) return { status: "error", message: "ai.noConsent" };

  const { context } = await aiContext(student.id);
  const result = await suggestBloomPaths(context, str(formData, "interest", 300));
  if (!result.ok) return aiError(result.reason);
  return { status: "ok", suggestions: result.suggestions };
}

export async function createPath(_prev: BloomState, formData: FormData): Promise<BloomState> {
  const student = await requireStudent();
  if (!student) return { status: "error", message: "notAllowed" };

  const title = str(formData, "title", 120);
  const goal = str(formData, "goal", 1000);
  const depth = oneOf(DEPTHS, str(formData, "depth"), "standard");
  const wantsAi = formData.get("useAi") === "on";
  if (!title) return { status: "error", message: "titleRequired" };

  const supabase = await createClient();
  const { overview, context } = await aiContext(student.id);

  let plan: { summary: string; tasks: { kind: (typeof KINDS)[number]; title: string; details: string }[] } | null = null;
  if (wantsAi) {
    if (!(await hasBloomAiConsent(student.id))) return { status: "error", message: "ai.noConsent" };
    const result = await planBloomPath(context, { title, goal, depth });
    if (!result.ok) return aiError(result.reason);
    plan = result.data;
  }

  const week = overview?.week ?? null;
  const stage = overview && week ? stageForWeek(overview.stages, Math.min(Math.max(week, 1), overview.program.weeks)) : undefined;
  const { data: path, error } = await supabase
    .from("bloom_paths")
    .insert({
      student_id: student.id,
      cohort_id: overview?.cohort.id ?? null,
      title,
      goal,
      depth,
      stage_key: stage?.key ?? null,
      summary: plan?.summary ?? "",
      ai_generated: Boolean(plan),
    })
    .select("id")
    .single();
  if (error || !path) return { status: "error", message: "failed" };

  if (plan?.tasks.length) {
    const { error: taskError } = await supabase.from("bloom_tasks").insert(
      plan.tasks.slice(0, 10).map((task, i) => ({
        path_id: path.id,
        student_id: student.id,
        position: i + 1,
        kind: task.kind,
        title: task.title.slice(0, 160),
        details: task.details.slice(0, 6000),
      })),
    );
    if (taskError) console.error("Bloom tasks insert failed", taskError);
  }

  redirect(`/student/bloom/${path.id}`);
}

export async function addTask(_prev: BloomState, formData: FormData): Promise<BloomState> {
  const student = await requireStudent();
  if (!student) return { status: "error", message: "notAllowed" };
  const pathId = str(formData, "pathId");
  const title = str(formData, "title", 160);
  if (!title) return { status: "error", message: "titleRequired" };

  const supabase = await createClient();
  const { count } = await supabase.from("bloom_tasks").select("*", { count: "exact", head: true }).eq("path_id", pathId);
  const { error } = await supabase.from("bloom_tasks").insert({
    path_id: pathId,
    student_id: student.id,
    position: (count ?? 0) + 1,
    kind: oneOf(KINDS, str(formData, "kind"), "do"),
    title,
    details: str(formData, "details", 6000),
  });
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok", message: "taskAdded" };
}

export async function updateTask(_prev: BloomState, formData: FormData): Promise<BloomState> {
  const student = await requireStudent();
  if (!student) return { status: "error", message: "notAllowed" };
  const taskId = str(formData, "taskId");
  const status = oneOf(TASK_STATUSES, str(formData, "status"), "todo");
  const reflection = str(formData, "reflection", 4000);

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("bloom_tasks")
    .update({ status, reflection: reflection || null })
    .eq("id", taskId)
    .eq("student_id", student.id)
    .select("path_id")
    .single();
  if (error || !task) return { status: "error", message: "failed" };

  // Finishing the last task completes the path; reopening a task reopens it.
  const { data: siblings } = await supabase.from("bloom_tasks").select("status").eq("path_id", task.path_id);
  const allDone = (siblings ?? []).length > 0 && (siblings ?? []).every((s) => s.status === "done");
  const { data: path } = await supabase.from("bloom_paths").select("status").eq("id", task.path_id).single();
  if (path && path.status !== "archived") {
    const next = allDone ? "completed" : "active";
    if (next !== path.status) await supabase.from("bloom_paths").update({ status: next }).eq("id", task.path_id);
  }

  refresh();
  return { status: "ok", message: status === "done" ? (allDone ? "pathDone" : "taskDone") : "saved" };
}

export async function setPathStatus(_prev: BloomState, formData: FormData): Promise<BloomState> {
  const student = await requireStudent();
  if (!student) return { status: "error", message: "notAllowed" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("bloom_paths")
    .update({ status: oneOf(PATH_STATUSES, str(formData, "status"), "active") })
    .eq("id", str(formData, "pathId"))
    .eq("student_id", student.id);
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}

export async function deletePath(_prev: BloomState, formData: FormData): Promise<BloomState> {
  const student = await requireStudent();
  if (!student) return { status: "error", message: "notAllowed" };
  const supabase = await createClient();
  const { error } = await supabase.from("bloom_paths").delete().eq("id", str(formData, "pathId")).eq("student_id", student.id);
  if (error) return { status: "error", message: "failed" };
  redirect("/student/bloom");
}

export async function askQuestion(_prev: BloomState, formData: FormData): Promise<BloomState> {
  const student = await requireStudent();
  if (!student) return { status: "error", message: "notAllowed" };
  const pathId = str(formData, "pathId");
  const taskId = str(formData, "taskId") || null;
  const question = str(formData, "question", 1000);
  if (!question) return { status: "error", message: "questionRequired" };
  if (!(await hasBloomAiConsent(student.id))) return { status: "error", message: "ai.noConsent" };

  const supabase = await createClient();
  const [{ data: path }, { context }] = await Promise.all([
    supabase.from("bloom_paths").select("title, bloom_tasks(id, title, details)").eq("id", pathId).eq("student_id", student.id).single(),
    aiContext(student.id),
  ]);
  if (!path) return { status: "error", message: "failed" };
  const task = taskId ? path.bloom_tasks.find((t) => t.id === taskId) : undefined;

  const result = await askBloom(context, { path: path.title, task: task?.title ?? null, taskDetails: task?.details ?? null }, question);
  if (!result.ok) return aiError(result.reason);

  const { error } = await supabase
    .from("bloom_questions")
    .insert({ path_id: pathId, task_id: task?.id ?? null, student_id: student.id, question, answer: result.text });
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}
