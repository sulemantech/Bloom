"use server";

import { refresh } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type ActionState = { status: "idle" | "ok" | "error"; message?: string };

type UploadedFile = { path: string; name: string; type: string; size: number };

const MAX_BODY = 10_000;

/** A student submits work for an activity. Files are uploaded to storage by the browser first. */
export async function submitWork(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "student") return { status: "error", message: "notAllowed" };

  const activityId = String(formData.get("activityId") ?? "");
  const cohortId = String(formData.get("cohortId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, MAX_BODY);
  const linkUrl = String(formData.get("linkUrl") ?? "").trim();
  let files: UploadedFile[] = [];
  try {
    files = JSON.parse(String(formData.get("files") ?? "[]"));
  } catch {
    return { status: "error", message: "failed" };
  }

  if (linkUrl && !/^https?:\/\/\S+$/i.test(linkUrl)) return { status: "error", message: "badLink" };
  if (!body && !linkUrl && files.length === 0) return { status: "error", message: "empty" };
  // Files must sit in this student's folder for this cohort (storage policies enforce it too).
  const prefix = `${cohortId}/${profile.id}/`;
  if (files.some((f) => !f.path.startsWith(prefix))) return { status: "error", message: "failed" };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("student_id", profile.id)
    .eq("cohort_id", cohortId)
    .maybeSingle();

  const { data: submission, error } = await supabase
    .from("submissions")
    .insert({
      activity_id: activityId,
      cohort_id: cohortId,
      student_id: profile.id,
      project_id: project?.id ?? null,
      body,
      link_url: linkUrl || null,
    })
    .select("id")
    .single();
  if (error || !submission) return { status: "error", message: "failed" };

  if (files.length > 0) {
    const { error: filesError } = await supabase.from("submission_files").insert(
      files.map((f) => ({
        submission_id: submission.id,
        storage_path: f.path,
        file_name: f.name.slice(0, 200),
        mime_type: f.type || null,
        size_bytes: f.size,
      })),
    );
    if (filesError) return { status: "error", message: "failed" };
  }

  refresh();
  return { status: "ok" };
}

type ProjectArea = Database["public"]["Enums"]["project_area"];
type ProjectStatus = Database["public"]["Enums"]["project_status"];
const AREAS: ProjectArea[] = ["technology", "design", "business", "social_impact", "undecided"];
const STATUSES: ProjectStatus[] = ["exploring", "chosen", "building", "presenting", "done"];

/** A student creates or updates their one project record for the cohort. */
export async function saveProject(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const profile = await getCurrentProfile();
  if (profile?.role !== "student") return { status: "error", message: "notAllowed" };

  const cohortId = String(formData.get("cohortId") ?? "");
  const area = String(formData.get("area") ?? "undecided") as ProjectArea;
  const status = String(formData.get("status") ?? "exploring") as ProjectStatus;
  const title = String(formData.get("title") ?? "").trim().slice(0, 120) || null;
  const problem = String(formData.get("problem") ?? "").trim().slice(0, 2000) || null;
  if (!AREAS.includes(area) || !STATUSES.includes(status)) return { status: "error", message: "failed" };

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("projects")
    .select("id")
    .eq("student_id", profile.id)
    .eq("cohort_id", cohortId)
    .maybeSingle();

  const { error } = existing
    ? await supabase.from("projects").update({ area, status, title, problem }).eq("id", existing.id)
    : await supabase.from("projects").insert({ student_id: profile.id, cohort_id: cohortId, area, status, title, problem });
  if (error) return { status: "error", message: "failed" };

  refresh();
  return { status: "ok" };
}
