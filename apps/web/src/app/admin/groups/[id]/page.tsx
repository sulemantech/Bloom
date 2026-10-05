import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddMemberForm, CohortSettingsForm, MembershipForm, RemoveMentorButton } from "../../forms";

export const metadata: Metadata = { title: "Group settings" };

type Schedule = { weekday?: number; start?: string; end?: string } | null;

export default async function AdminGroupPage({ params }: PageProps<"/admin/groups/[id]">) {
  const { id } = await params;
  const profile = await requireRole("admin");
  const t = await getTranslations("adminGroup");
  const supabase = await createClient();

  const [{ data: cohort }, { data: members }, { data: people }, { data: allStudentMemberships }] = await Promise.all([
    supabase.from("cohorts").select("id, name, start_date, timezone, schedule").eq("id", id).maybeSingle(),
    supabase
      .from("memberships")
      .select("id, role, age_group, fee_amount, discount_reason, paid_at, refunded_at, user:profiles(id, full_name, username)")
      .eq("cohort_id", id),
    supabase.from("profiles").select("id, role, full_name, username").order("full_name"),
    supabase.from("memberships").select("user_id").eq("role", "student"),
  ]);
  if (!cohort) notFound();

  const memberList = members ?? [];
  const students = memberList.filter((m) => m.role === "student" && m.user);
  const mentors = memberList.filter((m) => m.role === "mentor" && m.user);
  const inAnyGroup = new Set((allStudentMemberships ?? []).map((m) => m.user_id));
  const freeStudents = (people ?? [])
    .filter((p) => p.role === "student" && !inAnyGroup.has(p.id))
    .map((p) => ({ id: p.id, label: `${p.full_name} (${p.username})` }));
  const freeMentors = (people ?? [])
    .filter((p) => (p.role === "mentor" || p.role === "admin") && !mentors.some((m) => m.user!.id === p.id))
    .map((p) => ({ id: p.id, label: p.full_name || p.id }));

  return (
    <AppShell profile={profile}>
      <Link href="/admin" className="text-sm font-medium text-info">← {t("back")}</Link>
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display-tight text-[28px] leading-tight">{cohort.name}</h1>
        <Link href={`/mentor/groups/${id}`} className="btn btn-secondary px-4 py-2 text-sm">{t("openMentorView")}</Link>
      </header>

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="font-display-tight text-lg">{t("settings")}</h2>
        <CohortSettingsForm cohort={{ ...cohort, schedule: cohort.schedule as Schedule }} />
      </section>

      <section className="card flex flex-col gap-4 p-5" aria-labelledby="students-heading">
        <h2 id="students-heading" className="font-display-tight text-lg">{t("students", { count: students.length })}</h2>
        <ul className="flex flex-col divide-y divide-border">
          {students.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 py-3">
              <span className="flex flex-wrap items-center gap-2 font-medium">
                {m.user!.full_name}
                <span className="text-[13px] font-normal text-soft">{m.user!.username}</span>
                <Badge tone={m.refunded_at ? "neutral" : m.paid_at ? "lime" : "coral"}>
                  {m.refunded_at ? t("refunded") : m.paid_at ? t("paid") : t("unpaid")}
                </Badge>
              </span>
              <MembershipForm membership={m} />
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">{t("addStudent")}</p>
          <AddMemberForm cohortId={id} role="student" people={freeStudents} />
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5" aria-labelledby="mentors-heading">
        <h2 id="mentors-heading" className="font-display-tight text-lg">{t("mentors", { count: mentors.length })}</h2>
        <ul className="flex flex-col divide-y divide-border">
          {mentors.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <span className="font-medium">{m.user!.full_name}</span>
              <RemoveMentorButton membershipId={m.id} />
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">{t("addMentor")}</p>
          <AddMemberForm cohortId={id} role="mentor" people={freeMentors} />
        </div>
      </section>
    </AppShell>
  );
}
