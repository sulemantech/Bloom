import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";

export default async function ParentLayout({ children }: LayoutProps<"/parent">) {
  const profile = await requireRole("parent");
  return <AppShell profile={profile}>{children}</AppShell>;
}
