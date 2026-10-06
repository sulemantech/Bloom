import "server-only";
import { studentEmail } from "@/lib/auth";

/**
 * One-click demo sign-in, so people can try the app without being given a password. The accounts
 * are created by `npm run seed:demo`; their passwords stay in server env vars (DEMO_*_PASSWORD).
 *
 *   ENABLE_DEMO_LOGIN=true            show the "Try the demo" buttons (e.g. on a public demo site)
 *   DEMO_LOGIN_ROLES=student,parent   which accounts to offer (default: student, parent, mentor)
 *
 * ENABLE_DEV_PASSWORD_LOGIN=true (development) also shows them. Never enable either where real
 * families sign in.
 */
export const DEMO_ACCOUNTS = {
  student: { email: studentEmail("demo.student"), passwordEnv: "DEMO_STUDENT_PASSWORD" },
  parent: { email: "parent.demo@example.com", passwordEnv: "DEMO_PARENT_PASSWORD" },
  mentor: { email: "mentor.demo@example.com", passwordEnv: "DEMO_MENTOR_PASSWORD" },
  admin: { email: "admin.demo@example.com", passwordEnv: "DEMO_ADMIN_PASSWORD" },
} as const;

export type DemoRole = keyof typeof DEMO_ACCOUNTS;

const ROLES = Object.keys(DEMO_ACCOUNTS) as DemoRole[];
const DEFAULT_ROLES: DemoRole[] = ["student", "parent", "mentor"];

/** The demo accounts to offer: switched on, listed in DEMO_LOGIN_ROLES and with a password set. */
export function demoRoles(): DemoRole[] {
  const on = process.env.ENABLE_DEMO_LOGIN === "true" || process.env.ENABLE_DEV_PASSWORD_LOGIN === "true";
  if (!on) return [];
  const listed = process.env.DEMO_LOGIN_ROLES?.split(",").map((r) => r.trim().toLowerCase());
  const wanted = listed?.length ? ROLES.filter((r) => listed.includes(r)) : DEFAULT_ROLES;
  return wanted.filter((r) => Boolean(process.env[DEMO_ACCOUNTS[r].passwordEnv]));
}

/** Email and password for an offered demo account, or null. */
export function demoCredentials(role: string): { email: string; password: string } | null {
  const offered = demoRoles().find((r) => r === role);
  if (!offered) return null;
  return { email: DEMO_ACCOUNTS[offered].email, password: process.env[DEMO_ACCOUNTS[offered].passwordEnv]! };
}
