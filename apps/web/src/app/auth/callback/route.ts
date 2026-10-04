import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { redirectHome, redirectLinkError } from "../finish";

// Default Supabase email link (PKCE): works when opened in the browser that requested it.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return redirectLinkError(request);

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return redirectLinkError(request);

  return redirectHome(request);
}
