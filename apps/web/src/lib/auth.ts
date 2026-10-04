import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Version of the consent text a parent agrees to; bump it when the privacy notice changes. */
export const CONSENT_VERSION = "2026-10-v1";

/** Students have no email; their account uses a reserved domain that can never receive mail. */
const STUDENT_EMAIL_DOMAIN = "students.youthidealab.invalid";

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._]{2,29}$/;

export function normalizeUsername(input: string) {
  return input.trim().toLowerCase();
}

export function studentEmail(username: string) {
  return `${normalizeUsername(username)}@${STUDENT_EMAIL_DOMAIN}`;
}

export const HOME_PATH: Record<AppRole, string> = {
  student: "/student",
  parent: "/parent",
  mentor: "/mentor",
  admin: "/admin",
};

/** The signed-in user's profile, or null. */
export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return null;

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", userId).single();
  return profile;
}

/** For pages: redirect to login when signed out, or to the user's own home for the wrong role. */
export async function requireRole(...roles: AppRole[]): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (!roles.includes(profile.role)) redirect(HOME_PATH[profile.role]);
  return profile;
}
