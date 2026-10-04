import { ComingSoon } from "@/components/ComingSoon";
import { requireRole } from "@/lib/auth";

export default async function StudentHome() {
  const profile = await requireRole("student");
  return <ComingSoon profile={profile} />;
}
