import "server-only";
import type { User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthInfo = { email: string; lastSignInAt: string | null; bannedUntil: string | null; invitedAt: string | null };

/** Every auth user's email and sign-in state (admins only; call after checking the role). */
export async function loadAuthInfo(): Promise<Map<string, AuthInfo>> {
  const service = createAdminClient();
  const all: User[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    all.push(...data.users);
    if (data.users.length < 1000) break;
  }
  return new Map(
    all.map((u) => [
      u.id,
      {
        email: u.email ?? "",
        lastSignInAt: u.last_sign_in_at ?? null,
        bannedUntil: (u as User & { banned_until?: string | null }).banned_until ?? null,
        invitedAt: u.invited_at ?? null,
      },
    ]),
  );
}

export function isDeactivated(info: AuthInfo | undefined) {
  return Boolean(info?.bannedUntil && Date.parse(info.bannedUntil) > Date.now());
}

/** Students' placeholder sign-in addresses aren't real emails, so don't show them. */
export function displayEmail(email: string | undefined) {
  return email && !email.endsWith(".invalid") ? email : "";
}
