"use server";

import { refresh } from "next/cache";
import { draftProgressCard } from "@/lib/ai";
import { getCurrentProfile } from "@/lib/auth";
import { loadStudentOverview } from "@/lib/data/overview";
import { loadLearnerState } from "@/lib/data/learner";
import { tr, zonedLocalToUtc } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type ActionState = { status: "idle" | "ok" | "error"; message?: string };

type SubmissionStatus = Database["public"]["Enums"]["submission_status"];

async function requireStaff() {
  const profile = await getCurrentProfile();
  return profile && (profile.role === "mentor" || profile.role === "admin") ? profile : null;
}

/** Feedback on a submission, optionally changing its status. RLS limits this to the cohort's mentors. */
export async function reviewSubmission(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const mentor = await requireStaff();
  if (!mentor) return { status: "error", message: "notAllowed" };

  const submissionId = String(formData.get("submissionId") ?? "");
  const body = String(formData.get("feedback") ?? "").trim().slice(0, 5000);
  const decision = String(formData.get("decision") ?? "comment");
  const status: SubmissionStatus | null =
    decision === "done" ? "done" : decision === "needs_changes" ? "needs_changes" : null;
  if (!body && !status) return { status: "error", message: "empty" };
  if (decision === "needs_changes" && !body) return { status: "error", message: "explainChanges" };

  const supabase = await createClient();
  if (body) {
    const { error } = await supabase.from("feedback").insert({ submission_id: submissionId, mentor_id: mentor.id, body });
    if (error) return { status: "error", message: "failed" };
  }
  if (status) {
    const { data, error } = await supabase.from("submissions").update({ status }).eq("id", submissionId).select("id");
    if (error || !data?.length) return { status: "error", message: "failed" };
  }

  refresh();
  return { status: "ok" };
}

/** Save a weekly progress card as a draft, or approve it so the parent can see it. */
export async function saveProgressCard(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const mentor = await requireStaff();
  if (!mentor) return { status: "error", message: "notAllowed" };

  const studentId = String(formData.get("studentId") ?? "");
  const cohortId = String(formData.get("cohortId") ?? "");
  const week = Number(formData.get("week"));
  const body = String(formData.get("body") ?? "").trim().slice(0, 5000);
  const approve = formData.get("intent") === "approve";
  if (!Number.isInteger(week) || week < 1) return { status: "error", message: "failed" };
  if (!body) return { status: "error", message: "emptyCard" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("progress_cards")
    .upsert(
      { student_id: studentId, cohort_id: cohortId, week, body, status: approve ? "approved" : "draft" },
      { onConflict: "student_id,cohort_id,week" },
    );
  if (error) return { status: "error", message: "failed" };

  refresh();
  return { status: "ok", message: approve ? "approved" : "draftSaved" };
}

/** Add a class session; the time is entered in the cohort's time zone. */
export async function addSession(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  if (!staff) return { status: "error", message: "notAllowed" };

  const cohortId = String(formData.get("cohortId") ?? "");
  const timeZone = String(formData.get("timeZone") ?? "Asia/Karachi");
  const local = String(formData.get("startsAt") ?? "");
  const title = String(formData.get("title") ?? "").trim().slice(0, 120) || null;
  const joinUrl = String(formData.get("joinUrl") ?? "").trim() || null;
  const recordingUrl = String(formData.get("recordingUrl") ?? "").trim() || null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return { status: "error", message: "badTime" };
  for (const url of [joinUrl, recordingUrl]) {
    if (url && !/^https?:\/\/\S+$/i.test(url)) return { status: "error", message: "badLink" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("sessions").insert({
    cohort_id: cohortId,
    starts_at: zonedLocalToUtc(local, timeZone),
    title,
    join_url: joinUrl,
    recording_url: recordingUrl,
  });
  if (error) return { status: "error", message: "failed" };

  refresh();
  return { status: "ok" };
}

/** Attach (or replace) the recording link of a past session. */
export async function setRecording(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  if (!staff) return { status: "error", message: "notAllowed" };

  const sessionId = String(formData.get("sessionId") ?? "");
  const recordingUrl = String(formData.get("recordingUrl") ?? "").trim();
  if (!/^https?:\/\/\S+$/i.test(recordingUrl)) return { status: "error", message: "badLink" };

  const supabase = await createClient();
  const { data, error } = await supabase.from("sessions").update({ recording_url: recordingUrl }).eq("id", sessionId).select("id");
  if (error || !data?.length) return { status: "error", message: "failed" };

  refresh();
  return { status: "ok" };
}

export type DraftState = { status: "idle" | "ok" | "error"; text?: string; message?: string };

/** AI-written draft of a weekly progress card. Needs a parent's active "ai" consent for the student. */
export async function draftCardWithAi(_prev: DraftState, formData: FormData): Promise<DraftState> {
  const staff = await requireStaff();
  if (!staff) return { status: "error", message: "notAllowed" };

  const studentId = String(formData.get("studentId") ?? "");
  const cohortId = String(formData.get("cohortId") ?? "");
  const week = Number(formData.get("week"));

  const supabase = await createClient();
  const { data: consent } = await supabase
    .from("consents")
    .select("id")
    .eq("student_id", studentId)
    .eq("type", "ai")
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (!consent) return { status: "error", message: "noConsent" };

  const overview = await loadStudentOverview(supabase, studentId);
  const { data: student } = await supabase.from("profiles").select("full_name").eq("id", studentId).maybeSingle();
  if (!overview || overview.cohort.id !== cohortId || !student) return { status: "error", message: "failed" };

  const stage = overview.stages.find((s) => week >= s.week_from && week <= s.week_to);
  const learner = await loadLearnerState(supabase, studentId, overview);
  const result = await draftProgressCard({
    studentFirstName: student.full_name.trim().split(/\s+/)[0] || "the student",
    ageGroup: overview.membership.age_group,
    week,
    totalWeeks: overview.program.weeks,
    stepName: stage ? tr(stage.name) : "",
    project: overview.project
      ? { area: overview.project.area, title: overview.project.title, problem: overview.project.problem, status: overview.project.status }
      : null,
    activities: overview.activities
      .filter((a) => a.week === week)
      .map((a) => {
        const latest = overview.latest.get(a.id);
        return {
          title: tr(a.title),
          status: overview.statuses.get(a.id) ?? "todo",
          submission: latest ? [latest.body, latest.link_url ? "(shared a link)" : "", latest.submission_files.length ? `(attached ${latest.submission_files.length} file(s))` : ""].filter(Boolean).join(" ") : null,
          feedback: latest?.feedback.map((f) => f.body) ?? [],
        };
      }),
    learning: { understands: learner.understands.slice(0, 3), practising: learner.strugglesWith.slice(0, 2).map((g) => g.idea) },
  }, { studentId, mentorId: staff.id });

  return result.ok ? { status: "ok", text: result.data } : { status: "error", message: result.reason };
}

/** A mentor's (or admin's) note on a student's Bloom learning path. Empty clears it. */
export async function saveBloomNote(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const mentor = await requireStaff();
  if (!mentor) return { status: "error", message: "notAllowed" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_bloom_mentor_note", {
    p_path: String(formData.get("pathId") ?? ""),
    p_note: String(formData.get("note") ?? "").slice(0, 2000),
  });
  if (error) return { status: "error", message: error.code === "42501" ? "notAllowed" : "failed" };
  refresh();
  return { status: "ok" };
}
