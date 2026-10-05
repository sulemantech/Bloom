"use server";

import { headers } from "next/headers";
import { refresh } from "next/cache";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type ActionState = { status: "idle" | "ok" | "error"; message?: string; detail?: string };

type AgeGroup = Database["public"]["Enums"]["age_group"];
const AGE_GROUPS: AgeGroup[] = ["explorer", "builder"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function requireAdmin() {
  const profile = await getCurrentProfile();
  return profile?.role === "admin" ? profile : null;
}

function validTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Create a group for the (single) programme. */
export async function createCohort(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const startDate = String(formData.get("startDate") ?? "");
  const timezone = String(formData.get("timezone") ?? "Asia/Karachi");
  if (!name) return { status: "error", message: "nameRequired" };
  if (startDate && !DATE_PATTERN.test(startDate)) return { status: "error", message: "badDate" };
  if (!validTimeZone(timezone)) return { status: "error", message: "badTimeZone" };

  const supabase = await createClient();
  const { data: program } = await supabase.from("programs").select("id, organization_id").order("created_at").limit(1).single();
  if (!program) return { status: "error", message: "failed" };

  const { error } = await supabase.from("cohorts").insert({
    name,
    program_id: program.id,
    organization_id: program.organization_id,
    start_date: startDate || null,
    timezone,
    schedule: { weekday: 6, start: "11:00", end: "12:30" },
  });
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}

/** Update a group's name, start date, time zone and weekly class time. */
export async function updateCohort(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = String(formData.get("cohortId") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const startDate = String(formData.get("startDate") ?? "");
  const timezone = String(formData.get("timezone") ?? "");
  const weekday = Number(formData.get("weekday"));
  const start = String(formData.get("start") ?? "");
  const end = String(formData.get("end") ?? "");
  if (!name) return { status: "error", message: "nameRequired" };
  if (startDate && !DATE_PATTERN.test(startDate)) return { status: "error", message: "badDate" };
  if (!validTimeZone(timezone)) return { status: "error", message: "badTimeZone" };
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end)) {
    return { status: "error", message: "badSchedule" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("cohorts")
    .update({ name, start_date: startDate || null, timezone, schedule: { weekday, start, end } })
    .eq("id", id);
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}

/** Add a student (with an age group) or a mentor to a group. */
export async function addMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const cohortId = String(formData.get("cohortId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const role = formData.get("role") === "mentor" ? "mentor" : "student";
  const ageGroup = String(formData.get("ageGroup") ?? "") as AgeGroup;
  if (!userId) return { status: "error", message: "pickPerson" };
  if (role === "student" && !AGE_GROUPS.includes(ageGroup)) return { status: "error", message: "pickAgeGroup" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("memberships")
    .insert({ cohort_id: cohortId, user_id: userId, role, age_group: role === "student" ? ageGroup : null });
  if (error) return { status: "error", message: error.code === "23505" ? "alreadyMember" : "failed" };
  refresh();
  return { status: "ok" };
}

/** Change a student's age group, fee and payment status. */
export async function updateMembership(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = String(formData.get("membershipId") ?? "");
  const ageGroup = String(formData.get("ageGroup") ?? "") as AgeGroup;
  const feeRaw = String(formData.get("fee") ?? "").trim();
  const fee = feeRaw ? Number(feeRaw) : null;
  const discount = String(formData.get("discount") ?? "").trim().slice(0, 60) || null;
  const payment = String(formData.get("payment") ?? "unpaid");
  if (!AGE_GROUPS.includes(ageGroup)) return { status: "error", message: "pickAgeGroup" };
  if (fee !== null && (!Number.isFinite(fee) || fee < 0)) return { status: "error", message: "badFee" };

  const supabase = await createClient();
  const { data: current } = await supabase.from("memberships").select("paid_at, refunded_at").eq("id", id).single();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("memberships")
    .update({
      age_group: ageGroup,
      fee_amount: fee,
      discount_reason: discount,
      paid_at: payment === "unpaid" ? null : current?.paid_at ?? now,
      refunded_at: payment === "refunded" ? current?.refunded_at ?? now : null,
    })
    .eq("id", id);
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}

export async function removeMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };
  const supabase = await createClient();
  const { error } = await supabase.from("memberships").delete().eq("id", String(formData.get("membershipId") ?? ""));
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}

/**
 * Invite a parent or mentor by email. With ENABLE_DEV_PASSWORD_LOGIN, an admin can instead
 * create the account with a temporary password (no email needed).
 */
export async function invitePerson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const fullName = String(formData.get("fullName") ?? "").trim().slice(0, 80);
  const role = String(formData.get("role") ?? "parent");
  const cohortId = String(formData.get("cohortId") ?? "") || null;
  const tempPassword = String(formData.get("tempPassword") ?? "");
  const devMode = process.env.ENABLE_DEV_PASSWORD_LOGIN === "true";
  if (!EMAIL_PATTERN.test(email)) return { status: "error", message: "badEmail" };
  if (!fullName) return { status: "error", message: "nameRequired" };
  if (role !== "parent" && role !== "mentor") return { status: "error", message: "failed" };
  if (tempPassword && (!devMode || tempPassword.length < 8)) return { status: "error", message: "badTempPassword" };

  const service = createAdminClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const created = tempPassword
    ? await service.auth.admin.createUser({ email, password: tempPassword, email_confirm: true, user_metadata: { full_name: fullName } })
    : await service.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo: `${origin}/auth/callback` });
  if (created.error || !created.data.user) {
    const message = created.error?.code === "email_exists" || created.error?.status === 422 ? "emailExists" : "inviteFailed";
    return { status: "error", message, detail: created.error?.message };
  }
  const userId = created.data.user.id;

  // Role via app_metadata (only the server can set it) plus the profile, for immediate effect.
  await service.auth.admin.updateUserById(userId, { app_metadata: { role } });
  await service.from("profiles").update({ role: role as "parent" | "mentor", full_name: fullName, organization_id: admin.organization_id }).eq("id", userId);

  const supabase = await createClient();
  await supabase.from("invitations").insert({ email, role: role as "parent" | "mentor", cohort_id: cohortId, invited_by: admin.id, organization_id: admin.organization_id });
  if (role === "mentor" && cohortId) {
    await supabase.from("memberships").insert({ cohort_id: cohortId, user_id: userId, role: "mentor" });
  }

  refresh();
  return { status: "ok", message: tempPassword ? "created" : "invited" };
}

/** Permanently delete a student's account, records and files (data-deletion requests). */
export async function deleteStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const studentId = String(formData.get("studentId") ?? "");
  const confirmation = String(formData.get("confirm") ?? "").trim().toLowerCase();
  const supabase = await createClient();
  const { data: student } = await supabase.from("profiles").select("id, role, username").eq("id", studentId).single();
  if (!student || student.role !== "student") return { status: "error", message: "failed" };
  if (!student.username || confirmation !== student.username) return { status: "error", message: "confirmMismatch" };

  const service = createAdminClient();
  const { data: memberships } = await service.from("memberships").select("cohort_id").eq("user_id", studentId);
  for (const { cohort_id } of memberships ?? []) {
    const folder = `${cohort_id}/${studentId}`;
    const { data: files } = await service.storage.from("submissions").list(folder, { limit: 1000 });
    if (files?.length) await service.storage.from("submissions").remove(files.map((f) => `${folder}/${f.name}`));
  }
  const { error } = await service.auth.admin.deleteUser(studentId);
  if (error) return { status: "error", message: "failed" };

  refresh();
  return { status: "ok", message: "deleted" };
}
