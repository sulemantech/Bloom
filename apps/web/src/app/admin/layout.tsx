import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const profile = await requireRole("admin");
  return <AppShell profile={profile}>{children}</AppShell>;
}
