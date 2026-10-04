import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getCurrentProfile, HOME_PATH } from "@/lib/auth";

/** After a successful sign-in, send the user to their role's home page. */
export async function redirectHome(request: NextRequest) {
  const profile = await getCurrentProfile();
  const path = profile ? HOME_PATH[profile.role] : "/login?error=link";
  return NextResponse.redirect(new URL(path, request.url));
}

export function redirectLinkError(request: NextRequest) {
  return NextResponse.redirect(new URL("/login?error=link", request.url));
}
