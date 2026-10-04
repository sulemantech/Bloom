import type { EmailOtpType } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirectHome, redirectLinkError } from "../finish";

// Token-hash email link: works on any device (e.g. requested on a laptop, opened on a phone).
// Needs the Supabase email templates to link to /auth/confirm?token_hash={{ .TokenHash }}&type=...
const TYPES: EmailOtpType[] = ["email", "magiclink", "invite", "recovery", "email_change", "signup"];

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as EmailOtpType | null;
  if (!tokenHash || !type || !TYPES.includes(type)) return redirectLinkError(request);

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return redirectLinkError(request);

  return redirectHome(request);
}
