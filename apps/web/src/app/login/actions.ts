"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile, HOME_PATH, studentEmail } from "@/lib/auth";
import { demoCredentials } from "@/lib/demo";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Parents, mentors and admins: email sign-in link. Only existing (invited) accounts get one. */
export async function sendSignInLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_PATTERN.test(email)) return { status: "error", message: "invalidEmail" };

  const origin = (await headers()).get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });

  // Same answer whether or not the account exists, so the form can't be used to find out who has one.
  if (error && error.status === 429) return { status: "error", message: "tooManyRequests" };
  return { status: "sent" };
}

/** Students: username and password set by their parent. */
export async function studentSignIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!username || !password) return { status: "error", message: "missingFields" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: studentEmail(username), password });
  if (error) {
    return { status: "error", message: error.status === 429 ? "tooManyRequests" : "wrongCredentials" };
  }

  const profile = await getCurrentProfile();
  redirect(profile ? HOME_PATH[profile.role] : "/");
}

/** Development only: email + password for adults. Off unless ENABLE_DEV_PASSWORD_LOGIN=true. */
export async function devPasswordSignIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (process.env.ENABLE_DEV_PASSWORD_LOGIN !== "true") return { status: "error", message: "wrongCredentials" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { status: "error", message: "missingFields" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { status: "error", message: "wrongCredentials" };

  const profile = await getCurrentProfile();
  redirect(profile ? HOME_PATH[profile.role] : "/");
}

/** One-click sign-in as a demo account (see lib/demo). The password never reaches the browser. */
export async function demoSignIn(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const account = demoCredentials(String(formData.get("account") ?? ""));
  if (!account) return { status: "error", message: "demoUnavailable" };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(account);
  if (error) return { status: "error", message: "demoUnavailable" };

  const profile = await getCurrentProfile();
  redirect(profile ? HOME_PATH[profile.role] : "/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
