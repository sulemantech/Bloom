import { ComingSoon } from "@/components/ComingSoon";
import { requireRole } from "@/lib/auth";

export default async function MentorHome() {
  const profile = await requireRole("mentor");
  return <ComingSoon profile={profile} />;
}
