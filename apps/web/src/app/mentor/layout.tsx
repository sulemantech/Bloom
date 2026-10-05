import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

/** Admins can open any group's mentor view; they keep their own admin menu. */
export default async function MentorLayout({ children }: LayoutProps<"/mentor">) {
  const profile = await requireRole("mentor", "admin");
  return <AppShell profile={profile}>{children}</AppShell>;
}
