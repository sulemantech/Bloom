import { ComingSoon } from "@/components/ComingSoon";
import { requireRole } from "@/lib/auth";

export default async function AdminHome() {
  const profile = await requireRole("admin");
  return <ComingSoon profile={profile} />;
}
