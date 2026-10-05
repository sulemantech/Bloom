"use server";

import { createClient as createPlainClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { CONSENT_VERSION, getCurrentProfile, normalizeUsername, studentEmail, USERNAME_PATTERN } from "@/lib/auth";
import { supabasePublishableKey, supabaseUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type ActionState = { status: "idle" | "ok" | "error"; message?: string; detail?: string };

type Enums = Database["public"]["Enums"];
type AgeGroup = Enums["age_group"];
type AppRole = Enums["app_role"];
type SubmissionType = Enums["submission_type"];

const AGE_GROUPS: AgeGroup[] = ["explorer", "builder"];
const ADULT_ROLES: AppRole[] = ["parent", "mentor", "admin"];
const SUBMISSION_TYPES: SubmissionType[] = ["text", "file", "link", "text_and_file"];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MIN_PASSWORD = 8;

const str = (formData: FormData, key: string, max = 200) => String(formData.get(key) ?? "").trim().slice(0, max);

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

function validBirthYear(year: number) {
  const thisYear = new Date().getFullYear();
  return Number.isInteger(year) && year >= thisYear - 19 && year <= thisYear - 10;
}

/** Record an auth-side admin action (password reset, deactivation…) against the signed-in admin. */
async function logAction(action: string, entityId: string) {
  const supabase = await createClient();
  await supabase.rpc("log_admin_action", { p_action: action, p_entity: "profiles", p_entity_id: entityId });
}

// ---------------------------------------------------------------------------
// Groups and members
// ---------------------------------------------------------------------------

export async function createCohort(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const name = str(formData, "name", 80);
  const startDate = str(formData, "startDate");
  const timezone = str(formData, "timezone") || "Asia/Karachi";
  if (!name) return { status: "error", message: "nameRequired" };
  if (startDate && !DATE_PATTERN.test(startDate)) return { status: "error", message: "badDate" };
  if (!validTimeZone(timezone)) return { status: "error", message: "badTimeZone" };

  const supabase = await createClient();
  const { data: program } = await supabase.from("programs").select("id, organization_id").order("created_at").limit(1).single();
  if (!program) return { status: "error", message: "failed" };

  const { data, error } = await supabase
    .from("cohorts")
    .insert({
      name,
      program_id: program.id,
      organization_id: program.organization_id,
      start_date: startDate || null,
      timezone,
      schedule: { weekday: 6, start: "11:00", end: "12:30" },
    })
    .select("id")
    .single();
  if (error || !data) return { status: "error", message: "failed" };
  redirect(`/admin/groups/${data.id}`);
}

export async function updateCohort(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = str(formData, "cohortId");
  const name = str(formData, "name", 80);
  const startDate = str(formData, "startDate");
  const timezone = str(formData, "timezone");
  const weekday = Number(formData.get("weekday"));
  const start = str(formData, "start");
  const end = str(formData, "end");
  if (!name) return { status: "error", message: "nameRequired" };
  if (startDate && !DATE_PATTERN.test(startDate)) return { status: "error", message: "badDate" };
  if (!validTimeZone(timezone)) return { status: "error", message: "badTimeZone" };
  if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || end <= start) {
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

export async function deleteCohort(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = str(formData, "cohortId");
  const confirmation = str(formData, "confirm", 80);
  const supabase = await createClient();
  const { data: cohort } = await supabase.from("cohorts").select("name").eq("id", id).single();
  if (!cohort || confirmation !== cohort.name) return { status: "error", message: "confirmMismatch" };
  const { count } = await supabase.from("submissions").select("*", { count: "exact", head: true }).eq("cohort_id", id);
  if (count) return { status: "error", message: "groupHasWork" };

  const { error } = await supabase.from("cohorts").delete().eq("id", id);
  if (error) return { status: "error", message: "failed" };
  redirect("/admin/groups");
}

export async function addMember(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const cohortId = str(formData, "cohortId");
  const userId = str(formData, "userId");
  const role = formData.get("role") === "mentor" ? "mentor" : "student";
  const ageGroup = str(formData, "ageGroup") as AgeGroup;
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

export async function updateMembership(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = str(formData, "membershipId");
  const ageGroup = str(formData, "ageGroup") as AgeGroup;
  const feeRaw = str(formData, "fee");
  const fee = feeRaw ? Number(feeRaw) : null;
  const discount = str(formData, "discount", 60) || null;
  const payment = str(formData, "payment") || "unpaid";
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
  const { error } = await supabase.from("memberships").delete().eq("id", str(formData, "membershipId"));
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** Admin adds a student for a parent who signed the paper/WhatsApp consent form. */
export async function createStudent(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const fullName = str(formData, "fullName", 80);
  const username = normalizeUsername(str(formData, "username", 30));
  const password = String(formData.get("password") ?? "");
  const birthYear = Number(formData.get("birthYear"));
  const parentId = str(formData, "parentId");
  const cohortId = str(formData, "cohortId");
  const ageGroup = str(formData, "ageGroup") as AgeGroup;
  const consentSigned = formData.get("consentSigned") === "on";
  if (!fullName) return { status: "error", message: "nameRequired" };
  if (!USERNAME_PATTERN.test(username)) return { status: "error", message: "usernameInvalid" };
  if (password.length < MIN_PASSWORD) return { status: "error", message: "passwordShort" };
  if (!validBirthYear(birthYear)) return { status: "error", message: "birthYearInvalid" };
  if (!parentId) return { status: "error", message: "pickParent" };
  if (!consentSigned) return { status: "error", message: "consentRequired" };
  if (cohortId && !AGE_GROUPS.includes(ageGroup)) return { status: "error", message: "pickAgeGroup" };

  const supabase = await createClient();
  const { data: parent } = await supabase.from("profiles").select("id, role, timezone").eq("id", parentId).single();
  if (parent?.role !== "parent") return { status: "error", message: "pickParent" };

  const service = createAdminClient();
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email: studentEmail(username),
    password,
    email_confirm: true,
    app_metadata: { role: "student", username },
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    const taken = createError?.code === "email_exists" || createError?.status === 422;
    return { status: "error", message: taken ? "usernameTaken" : "failed" };
  }
  const studentId = created.user.id;

  try {
    const { error: profileError } = await service
      .from("profiles")
      .update({ role: "student", username, full_name: fullName, birth_year: birthYear, timezone: parent.timezone, organization_id: admin.organization_id })
      .eq("id", studentId);
    if (profileError) throw profileError;
    // Recorded with the admin's session (RLS: admins manage links and consents), so the log names them.
    const { error: linkError } = await supabase.from("guardian_links").insert({ parent_id: parentId, student_id: studentId });
    if (linkError) throw linkError;
    const { error: consentError } = await supabase
      .from("consents")
      .insert({ student_id: studentId, parent_id: parentId, type: "platform", version: CONSENT_VERSION });
    if (consentError) throw consentError;
    if (cohortId) {
      const { error: memberError } = await supabase
        .from("memberships")
        .insert({ cohort_id: cohortId, user_id: studentId, role: "student", age_group: ageGroup });
      if (memberError) throw memberError;
    }
  } catch (error) {
    await service.auth.admin.deleteUser(studentId);
    console.error("createStudent failed", error);
    return { status: "error", message: "failed" };
  }

  redirect(`/admin/people/${studentId}`);
}

/** Invite a parent, mentor or admin by email (or, in development, create them with a temporary password). */
export async function createAdult(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const email = str(formData, "email").toLowerCase();
  const fullName = str(formData, "fullName", 80);
  const role = str(formData, "role") as AppRole;
  const cohortId = str(formData, "cohortId") || null;
  const tempPassword = String(formData.get("tempPassword") ?? "");
  const devMode = process.env.ENABLE_DEV_PASSWORD_LOGIN === "true";
  if (!EMAIL_PATTERN.test(email)) return { status: "error", message: "badEmail" };
  if (!fullName) return { status: "error", message: "nameRequired" };
  if (!ADULT_ROLES.includes(role)) return { status: "error", message: "failed" };
  if (tempPassword && (!devMode || tempPassword.length < MIN_PASSWORD)) return { status: "error", message: "badTempPassword" };

  const service = createAdminClient();
  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const created = tempPassword
    ? await service.auth.admin.createUser({ email, password: tempPassword, email_confirm: true, user_metadata: { full_name: fullName } })
    : await service.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName }, redirectTo: `${origin}/auth/callback` });
  if (created.error || !created.data.user) {
    const exists = created.error?.code === "email_exists" || created.error?.status === 422;
    return { status: "error", message: exists ? "emailExists" : "inviteFailed", detail: exists ? undefined : created.error?.message };
  }
  const userId = created.data.user.id;

  await service.auth.admin.updateUserById(userId, { app_metadata: { role } });
  await service.from("profiles").update({ role, full_name: fullName, organization_id: admin.organization_id }).eq("id", userId);

  const supabase = await createClient();
  await supabase.from("invitations").insert({ email, role, cohort_id: cohortId, invited_by: admin.id, organization_id: admin.organization_id });
  if ((role === "mentor" || role === "admin") && cohortId) {
    await supabase.from("memberships").insert({ cohort_id: cohortId, user_id: userId, role: "mentor" });
  }

  redirect(`/admin/people/${userId}?created=${tempPassword ? "password" : "invited"}`);
}

/** Edit a person's details. Role and username changes are mirrored into their sign-in account. */
export async function updatePerson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = str(formData, "userId");
  const fullName = str(formData, "fullName", 80);
  const role = str(formData, "role") as AppRole;
  const username = normalizeUsername(str(formData, "username", 30));
  const birthYearRaw = str(formData, "birthYear");
  const birthYear = birthYearRaw ? Number(birthYearRaw) : null;
  const country = str(formData, "country", 60);
  const timezone = str(formData, "timezone", 60);
  const email = str(formData, "email").toLowerCase();
  const prefersFemale = formData.get("prefersFemaleMentor") === "on";

  const supabase = await createClient();
  const { data: person } = await supabase.from("profiles").select("role, username").eq("id", id).single();
  if (!person) return { status: "error", message: "failed" };
  const isStudent = person.role === "student";

  if (!fullName) return { status: "error", message: "nameRequired" };
  if (timezone && !validTimeZone(timezone)) return { status: "error", message: "badTimeZone" };
  if (isStudent) {
    if (!USERNAME_PATTERN.test(username)) return { status: "error", message: "usernameInvalid" };
    if (birthYear === null || !validBirthYear(birthYear)) return { status: "error", message: "birthYearInvalid" };
  } else {
    if (!ADULT_ROLES.includes(role)) return { status: "error", message: "failed" };
    if (!EMAIL_PATTERN.test(email)) return { status: "error", message: "badEmail" };
    if (id === admin.id && role !== "admin") return { status: "error", message: "cantDemoteSelf" };
  }

  const service = createAdminClient();
  // Sign-in account first: a username is the student's sign-in address, an adult's email theirs.
  if (isStudent && username !== person.username) {
    const { error } = await service.auth.admin.updateUserById(id, {
      email: studentEmail(username),
      email_confirm: true,
      app_metadata: { role: "student", username },
    });
    if (error) return { status: "error", message: error.code === "email_exists" || error.status === 422 ? "usernameTaken" : "failed" };
  }
  if (!isStudent) {
    const { data: authUser } = await service.auth.admin.getUserById(id);
    if (authUser.user && authUser.user.email !== email) {
      const { error } = await service.auth.admin.updateUserById(id, { email, email_confirm: true });
      if (error) return { status: "error", message: error.code === "email_exists" || error.status === 422 ? "emailExists" : "failed" };
      await logAction("email_changed", id);
    }
  }

  const { error } = await supabase.rpc("admin_update_profile", {
    p_user: id,
    p_full_name: fullName,
    p_role: isStudent ? "student" : role,
    p_username: isStudent ? username : "",
    p_birth_year: isStudent ? birthYear! : (null as unknown as number),
    p_country: country,
    p_timezone: timezone,
    p_prefers_female_mentor: prefersFemale,
  });
  if (error) {
    const known: Record<string, string> = {
      "Remove this person from the groups they mentor first": "removeFromGroupsFirst",
      "There must always be at least one admin": "lastAdmin",
    };
    return { status: "error", message: known[error.message] ?? "failed" };
  }
  if (!isStudent && role !== person.role) await service.auth.admin.updateUserById(id, { app_metadata: { role } });

  refresh();
  return { status: "ok" };
}

export async function resetStudentPassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = str(formData, "userId");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { status: "error", message: "passwordShort" };
  const supabase = await createClient();
  const { data: person } = await supabase.from("profiles").select("role").eq("id", id).single();
  if (person?.role !== "student") return { status: "error", message: "failed" };

  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
  if (error) return { status: "error", message: "failed" };
  await logAction("password_reset", id);
  return { status: "ok", message: "passwordReset" };
}

/** Email an adult a one-time sign-in link (e.g. they lost the invitation). */
export async function sendSignInLink(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = str(formData, "userId");
  const { data: authUser } = await createAdminClient().auth.admin.getUserById(id);
  const email = authUser.user?.email;
  if (!email || email.endsWith(".invalid")) return { status: "error", message: "failed" };

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const anon = createPlainClient(supabaseUrl(), supabasePublishableKey(), { auth: { persistSession: false } });
  const { error } = await anon.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });
  if (error) return { status: "error", message: "inviteFailed", detail: error.message };
  await logAction("sign_in_link_sent", id);
  return { status: "ok", message: "linkSent" };
}

/** Deactivate (block sign-in) or reactivate an account. */
export async function setAccountActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = str(formData, "userId");
  const active = formData.get("active") === "true";
  if (id === admin.id) return { status: "error", message: "cantDeactivateSelf" };

  const { error } = await createAdminClient().auth.admin.updateUserById(id, { ban_duration: active ? "none" : "876000h" });
  if (error) return { status: "error", message: "failed" };
  await logAction(active ? "account_reactivated" : "account_deactivated", id);
  refresh();
  return { status: "ok", message: active ? "reactivated" : "deactivated" };
}

export async function linkGuardian(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const parentId = str(formData, "parentId");
  const studentId = str(formData, "studentId");
  if (!parentId || !studentId) return { status: "error", message: "pickPerson" };
  const supabase = await createClient();
  const { data: people } = await supabase.from("profiles").select("id, role").in("id", [parentId, studentId]);
  const roles = new Map((people ?? []).map((p) => [p.id, p.role]));
  if (roles.get(parentId) !== "parent" || roles.get(studentId) !== "student") return { status: "error", message: "pickPerson" };

  const { error } = await supabase.from("guardian_links").insert({ parent_id: parentId, student_id: studentId });
  if (error) return { status: "error", message: error.code === "23505" ? "alreadyLinked" : "failed" };
  refresh();
  return { status: "ok" };
}

export async function unlinkGuardian(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const linkId = str(formData, "linkId");
  const supabase = await createClient();
  const { data: link } = await supabase.from("guardian_links").select("student_id").eq("id", linkId).single();
  if (!link) return { status: "error", message: "failed" };
  const { count } = await supabase.from("guardian_links").select("*", { count: "exact", head: true }).eq("student_id", link.student_id);
  if ((count ?? 0) <= 1) return { status: "error", message: "lastGuardian" };

  const { error } = await supabase.from("guardian_links").delete().eq("id", linkId);
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}

/** Permanently delete an account. Students take their files with them; parents must have no children left. */
export async function deletePerson(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = str(formData, "userId");
  const confirmation = str(formData, "confirm").toLowerCase();
  if (id === admin.id) return { status: "error", message: "cantDeleteSelf" };

  const supabase = await createClient();
  const service = createAdminClient();
  const { data: person } = await supabase.from("profiles").select("id, role, username").eq("id", id).single();
  if (!person) return { status: "error", message: "failed" };
  const { data: authUser } = await service.auth.admin.getUserById(id);
  const expected = person.role === "student" ? person.username : authUser.user?.email;
  if (!expected || confirmation !== expected.toLowerCase()) return { status: "error", message: "confirmMismatch" };

  if (person.role === "parent") {
    const { count } = await supabase.from("guardian_links").select("*", { count: "exact", head: true }).eq("parent_id", id);
    if (count) return { status: "error", message: "parentHasChildren" };
  }
  if (person.role === "admin") {
    const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true }).eq("role", "admin");
    if ((count ?? 0) <= 1) return { status: "error", message: "lastAdmin" };
  }

  if (person.role === "student") {
    const { data: memberships } = await service.from("memberships").select("cohort_id").eq("user_id", id);
    for (const { cohort_id } of memberships ?? []) {
      const folder = `${cohort_id}/${id}`;
      const { data: files } = await service.storage.from("submissions").list(folder, { limit: 1000 });
      if (files?.length) await service.storage.from("submissions").remove(files.map((f) => `${folder}/${f.name}`));
    }
  }

  await logAction("account_deleted", id);
  const { error } = await service.auth.admin.deleteUser(id);
  if (error) return { status: "error", message: "failed" };
  redirect("/admin/people?deleted=1");
}

// ---------------------------------------------------------------------------
// Programme
// ---------------------------------------------------------------------------

function readActivity(formData: FormData) {
  return {
    title: str(formData, "title", 120),
    instructions: str(formData, "instructions", 4000),
    week: Number(formData.get("week")),
    position: Number(formData.get("position") || 0),
    ageGroup: (str(formData, "ageGroup") || null) as AgeGroup | null,
    submissionType: str(formData, "submissionType") as SubmissionType,
  };
}

async function validateActivity(stageId: string, a: ReturnType<typeof readActivity>) {
  if (!a.title || !a.instructions) return "activityTextRequired";
  if (a.ageGroup && !AGE_GROUPS.includes(a.ageGroup)) return "pickAgeGroup";
  if (!SUBMISSION_TYPES.includes(a.submissionType)) return "failed";
  const supabase = await createClient();
  const { data: stage } = await supabase.from("stages").select("week_from, week_to").eq("id", stageId).single();
  if (!stage || !Number.isInteger(a.week) || a.week < stage.week_from || a.week > stage.week_to) return "weekOutsideStep";
  return null;
}

export async function updateActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = str(formData, "activityId");
  const stageId = str(formData, "stageId");
  const a = readActivity(formData);
  const problem = await validateActivity(stageId, a);
  if (problem) return { status: "error", message: problem };

  const supabase = await createClient();
  const { data: current } = await supabase.from("activities").select("title, instructions").eq("id", id).single();
  const merge = (json: unknown, text: string) => ({ ...((json as Record<string, string>) ?? {}), en: text });
  const { error } = await supabase
    .from("activities")
    .update({
      title: merge(current?.title, a.title),
      instructions: merge(current?.instructions, a.instructions),
      week: a.week,
      position: a.position,
      age_group: a.ageGroup,
      submission_type: a.submissionType,
    })
    .eq("id", id);
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}

export async function createActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const stageId = str(formData, "stageId");
  const a = readActivity(formData);
  const problem = await validateActivity(stageId, a);
  if (problem) return { status: "error", message: problem };

  const supabase = await createClient();
  const { error } = await supabase.from("activities").insert({
    stage_id: stageId,
    title: { en: a.title },
    instructions: { en: a.instructions },
    week: a.week,
    position: a.position,
    age_group: a.ageGroup,
    submission_type: a.submissionType,
  });
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok", message: "activityAdded" };
}

export async function deleteActivity(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  if (!admin) return { status: "error", message: "notAllowed" };

  const id = str(formData, "activityId");
  const supabase = await createClient();
  const { count } = await supabase.from("submissions").select("*", { count: "exact", head: true }).eq("activity_id", id);
  if (count) return { status: "error", message: "activityHasWork" };
  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) return { status: "error", message: "failed" };
  refresh();
  return { status: "ok" };
}
