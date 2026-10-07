"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { askBloom, planBloomPath, reviewBloomAnswers, suggestBloomPaths, writeBloomStep, type AiFailure, type BloomPlan, type BloomSuggestion } from "@/lib/ai";
import { getCurrentProfile } from "@/lib/auth";
import { answeredChecks, lastFinishedStep, nextStepToWrite, stepWriterInput } from "@/lib/bloom/adaptive";
import { bloomContext, hasConsent, loadBloomPaths } from "@/lib/data/bloom";
import { loadLearnerState, recordReview } from "@/lib/data/learner";
import { loadStudentOverview } from "@/lib/data/overview";
import { bloomV2Enabled } from "@/lib/flags";
import { stageForWeek } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export type BloomState = { status: "idle" | "ok" | "error"; message?: string };
export type SuggestState = BloomState & { suggestions?: BloomSuggestion[] };

const DEPTHS = ["quick", "standard", "deep"] as const;
const TASK_STATUSES = ["todo", "doing", "done"] as const;
const KINDS = ["learn", "do", "reflect"] as const;
const PATH_STATUSES = ["active", "completed", "archived"] as const;
const FEELINGS = ["too_easy", "just_right", "too_hard"] as const;

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
  const learner = await loadLearnerState(supabase, studentId, overview);
  return { overview, context: bloomContext(overview, paths, learner) };
}

const aiError = (reason: AiFailure) => ({ status: "error" as const, message: `ai.${reason}` });

export async function suggestPaths(_prev: SuggestState, formData: FormData): Promise<SuggestState> {
  const student = await requireStudent();
  if (!student) return { status: "error", message: "notAllowed" };
  if (!(await hasBloomAiConsent(student.id))) return { status: "error", message: "ai.noConsent" };

  const { context } = await aiContext(student.id);
  const result = await suggestBloomPaths(student.id, context, str(formData, "interest", 300));
  if (!result.ok) return aiError(result.reason);
  return { status: "ok", suggestions: result.data };
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

  let plan: BloomPlan | null = null;
  if (wantsAi) {
    if (!(await hasBloomAiConsent(student.id))) return { status: "error", message: "ai.noConsent" };
    // In Bloom v2 groups only step 1 is written now; Spark writes each later step when the student
    // gets there, from how the last one went.
    const outline = await bloomV2Enabled(student.id);
    const result = await planBloomPath(student.id, context, { title, goal, depth }, { outline });
    if (!result.ok) return aiError(result.reason);
    plan = result.data;
  }

  const week = overview?.week ?? null;
  const stage = overview && week ? stageForWeek(overview.stages, Math.min(Math.max(week, 1), overview.program.weeks)) : undefined;
  // The path and its steps are saved in one transaction: a bad step fails the whole path instead of
  // leaving an empty one. Steps the model returned without a title are dropped first.
  const tasks = (plan?.tasks ?? [])
    .map((task) => ({
      kind: task.kind,
      title: task.title.trim().slice(0, 160),
      details: task.details.slice(0, 6000),
      planned_only: task.planned_only,
      check_questions: task.check_questions ?? [],
    }))
    .filter((task) => task.title)
    .slice(0, 10);
  const { data: pathId, error } = await supabase.rpc("create_bloom_path", {
    p_title: title,
    p_goal: goal,
    p_depth: depth,
    p_summary: plan?.summary ?? "",
    p_ai_generated: Boolean(plan),
    p_tasks: tasks,
    p_cohort: overview?.cohort.id,
    p_stage_key: stage?.key,
  });
  if (error || !pathId) {
    if (error) console.error("Bloom path create failed", error);
    return { status: "error", message: "failed" };
  }

  redirect(`/student/spark/${pathId}`);
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
  // Only touch the note and feeling when the form showed them, so finishing a step never wipes them.
  const reflection = formData.has("reflection") ? str(formData, "reflection", 4000) || null : undefined;
  const feeling = formData.has("feeling") ? (FEELINGS.find((f) => f === str(formData, "feeling")) ?? null) : undefined;
  // Answers to the step's checks, in question order. New answers clear any earlier review.
  const answers = formData.has("answer") ? formData.getAll("answer").slice(0, 5).map((a) => String(a).trim().slice(0, 1000)) : undefined;

  const supabase = await createClient();
  const { data: task, error } = await supabase
    .from("bloom_tasks")
    .update({
      status,
      ...(reflection === undefined ? {} : { reflection }),
      ...(feeling === undefined ? {} : { feeling }),
      ...(answers === undefined ? {} : { check_answers: answers, check_review: null }),
    })
    .eq("id", taskId)
    .eq("student_id", student.id)
    .select("path_id")
    .single();
  if (error || !task) return { status: "error", message: "failed" };

  // The database keeps the path's status in step with its steps (bloom_tasks_sync_path).
  const { data: path } = await supabase.from("bloom_paths").select("status").eq("id", task.path_id).single();
  const pathDone = path?.status === "completed";

  // Finishing a step lets Spark write the next outline step from how this one went. If it can't
  // right now, the step keeps its aim and the student can ask again ("Write this step").
  let message = status === "done" ? (pathDone ? "pathDone" : "taskDone") : "saved";
  if (status === "done") {
    // Spark writes the next step (reviewing these answers in the same call); with no step to
    // write, it reviews the answers on their own.
    const written = pathDone ? "none" : await writePlannedStep(student.id, task.path_id, taskId);
    if (written === "written") message = "stepWritten";
    else if (written !== "none") message = "taskDoneNextLater";
    else if ((await reviewAnswers(student.id, task.path_id, taskId)) === "reviewed") message = pathDone ? "pathDoneReviewed" : "answersReviewed";
  }

  refresh();
  return { status: "ok", message };
}

const STEP_FIELDS = "id, position, kind, title, details, status, reflection, feeling, planned_only, check_questions, check_answers, check_review";

/**
 * Has Spark write the path's next outline step (see lib/bloom/adaptive), from how `finishedId` (the
 * step just finished) went, and review that step's check answers. "none" when no step is waiting:
 * every step is written, or an earlier step isn't done yet.
 */
async function writePlannedStep(studentId: string, pathId: string, finishedId?: string): Promise<"written" | "none" | AiFailure> {
  const supabase = await createClient();
  const [{ data: path }, { data: questions }] = await Promise.all([
    supabase.from("bloom_paths").select(`title, goal, summary, depth, bloom_tasks(${STEP_FIELDS})`).eq("id", pathId).eq("student_id", studentId).single(),
    supabase.from("bloom_questions").select("task_id, question, answer").eq("path_id", pathId).order("created_at"),
  ]);
  if (!path) return "failed";
  const target = nextStepToWrite(path.bloom_tasks);
  if (!target) return "none";
  if (!(await hasBloomAiConsent(studentId))) return "noConsent";

  const { context } = await aiContext(studentId);
  const input = stepWriterInput(path, path.bloom_tasks, questions ?? [], target.id, finishedId);
  const source = lastFinishedStep(path.bloom_tasks, target.id, finishedId);
  const result = await writeBloomStep(studentId, context, oneOf(DEPTHS, path.depth, "standard"), input);
  if (!result.ok) return result.reason;

  // Only an outline step is replaced, so a double click can't overwrite a step already written.
  const { error } = await supabase
    .from("bloom_tasks")
    .update({
      title: result.data.title,
      details: result.data.details.slice(0, 6000),
      adaptation: result.data.adaptation,
      adapted_from: source?.id ?? null,
      check_questions: result.data.check_questions,
      planned_only: false,
    })
    .eq("id", target.id)
    .eq("student_id", studentId)
    .eq("planned_only", true);
  if (error) return "failed";

  if (source && result.data.review && !source.check_review) {
    const { error: reviewError } = await supabase
      .from("bloom_tasks")
      .update({ check_review: result.data.review })
      .eq("id", source.id)
      .eq("student_id", studentId);
    if (!reviewError) await recordReview(supabase, studentId, { ...source, path_id: pathId, check_review: result.data.review });
  }
  return "written";
}

/** Has Spark review a finished step's check answers on their own (see reviewBloomAnswers). */
async function reviewAnswers(studentId: string, pathId: string, taskId: string): Promise<"reviewed" | "none" | AiFailure> {
  const supabase = await createClient();
  const { data: path } = await supabase
    .from("bloom_paths")
    .select(`title, bloom_tasks(${STEP_FIELDS})`)
    .eq("id", pathId)
    .eq("student_id", studentId)
    .eq("bloom_tasks.id", taskId)
    .single();
  const task = path?.bloom_tasks[0];
  if (!path || !task || task.check_review) return "none";
  const checks = answeredChecks(task);
  if (!checks.some((c) => c.answer)) return "none";
  if (!(await hasBloomAiConsent(studentId))) return "noConsent";

  const { context } = await aiContext(studentId);
  const result = await reviewBloomAnswers(studentId, context, { path: path.title, title: task.title, details: task.details, checks });
  if (!result.ok) return result.reason;
  const { error } = await supabase.from("bloom_tasks").update({ check_review: result.data }).eq("id", task.id).eq("student_id", studentId);
  if (error) return "failed";
  await recordReview(supabase, studentId, { ...task, path_id: pathId, check_review: result.data });
  return "reviewed";
}

/** "Write this step": retry when Spark couldn't write the next step as the last one was finished. */
export async function writeNextStep(_prev: BloomState, formData: FormData): Promise<BloomState> {
  const student = await requireStudent();
  if (!student) return { status: "error", message: "notAllowed" };
  const result = await writePlannedStep(student.id, str(formData, "pathId"));
  if (result === "none") return { status: "ok" };
  if (result !== "written") return aiError(result);
  refresh();
  return { status: "ok", message: "stepReady" };
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
  redirect("/student/spark");
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

  const result = await askBloom(student.id, context, { path: path.title, task: task?.title ?? null, taskDetails: task?.details ?? null }, question);
  if (!result.ok) return aiError(result.reason);

  const { error } = await supabase
    .from("bloom_questions")
    .insert({ path_id: pathId, task_id: task?.id ?? null, student_id: student.id, question, answer: result.data });
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}
