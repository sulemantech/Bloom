"use server";

import { refresh } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import {
  CONSENT_VERSION,
  getCurrentProfile,
  normalizeUsername,
  studentEmail,
  USERNAME_PATTERN,
} from "@/lib/auth";

export type FormState = { status: "idle" | "ok" | "error"; message?: string };

const MIN_PASSWORD = 8;

/** A parent creates their child's account and records consent. */
export async function addChild(_prev: FormState, formData: FormData): Promise<FormState> {
  const parent = await getCurrentProfile();
  if (parent?.role !== "parent") return { status: "error", message: "notAllowed" };

  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = normalizeUsername(String(formData.get("username") ?? ""));
  const password = String(formData.get("password") ?? "");
  const birthYear = Number(formData.get("birthYear"));
  const consent = formData.get("consent") === "on";

  const thisYear = new Date().getFullYear();
  if (!fullName) return { status: "error", message: "nameRequired" };
  if (!USERNAME_PATTERN.test(username)) return { status: "error", message: "usernameInvalid" };
  if (password.length < MIN_PASSWORD) return { status: "error", message: "passwordShort" };
  if (!Number.isInteger(birthYear) || birthYear < thisYear - 19 || birthYear > thisYear - 10) {
    return { status: "error", message: "birthYearInvalid" };
  }
  if (!consent) return { status: "error", message: "consentRequired" };

  const admin = createAdminClient();
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: studentEmail(username),
    password,
    email_confirm: true,
    app_metadata: { role: "student", username },
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    const taken = createError?.code === "email_exists" || createError?.status === 422;
    return { status: "error", message: taken ? "usernameTaken" : "createFailed" };
  }
  const studentId = created.user.id;

  try {
    // Set explicitly: Supabase applies app_metadata after the insert trigger has run.
    const { error: profileError } = await admin
      .from("profiles")
      .update({
        role: "student",
        username,
        full_name: fullName,
        birth_year: birthYear,
        timezone: parent.timezone,
        organization_id: parent.organization_id,
      })
      .eq("id", studentId);
    if (profileError) throw profileError;

    const { error: linkError } = await admin
      .from("guardian_links")
      .insert({ parent_id: parent.id, student_id: studentId });
    if (linkError) throw linkError;

    // Recorded with the parent's own session, so row-level security confirms who consented.
    const supabase = await createClient();
    const { error: consentError } = await supabase
      .from("consents")
      .insert({ student_id: studentId, parent_id: parent.id, type: "platform", version: CONSENT_VERSION });
    if (consentError) throw consentError;
  } catch (error) {
    await admin.auth.admin.deleteUser(studentId);
    console.error("addChild failed", error);
    return { status: "error", message: "createFailed" };
  }

  refresh();
  return { status: "ok" };
}

/** Only a child's parent can set a new password for them. */
export async function resetChildPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parent = await getCurrentProfile();
  if (parent?.role !== "parent") return { status: "error", message: "notAllowed" };

  const studentId = String(formData.get("studentId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { status: "error", message: "passwordShort" };

  // Row-level security only returns the link if this parent really is linked to the student.
  const supabase = await createClient();
  const { data: link } = await supabase
    .from("guardian_links")
    .select("id")
    .eq("parent_id", parent.id)
    .eq("student_id", studentId)
    .maybeSingle();
  if (!link) return { status: "error", message: "notAllowed" };

  const { error } = await createAdminClient().auth.admin.updateUserById(studentId, { password });
  if (error) return { status: "error", message: "resetFailed" };
  return { status: "ok" };
}

type ConsentType = Database["public"]["Enums"]["consent_type"];
const TOGGLEABLE: ConsentType[] = ["ai", "public_portfolio", "media"];

/** A parent grants or withdraws an optional consent for their child. */
export async function setConsent(_prev: FormState, formData: FormData): Promise<FormState> {
  const parent = await getCurrentProfile();
  if (parent?.role !== "parent") return { status: "error", message: "notAllowed" };

  const studentId = String(formData.get("studentId") ?? "");
  const type = String(formData.get("type") ?? "") as ConsentType;
  const grant = formData.get("grant") === "true";
  if (!TOGGLEABLE.includes(type)) return { status: "error", message: "notAllowed" };

  const supabase = await createClient();
  const { error } = grant
    ? await supabase.from("consents").insert({ student_id: studentId, parent_id: parent.id, type, version: CONSENT_VERSION })
    : await supabase
        .from("consents")
        .update({ revoked_at: new Date().toISOString() })
        .eq("student_id", studentId)
        .eq("type", type)
        .is("revoked_at", null);
  if (error) return { status: "error", message: "consentFailed" };

  refresh();
  return { status: "ok" };
}
