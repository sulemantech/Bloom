import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader } from "@/components/AppShell";
import { WeekHeadline } from "@/components/course";
import { Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { currentWeek, formatDate } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import { CreateCohortForm } from "../forms";

export const metadata: Metadata = { title: "Groups" };

export default async function GroupsPage() {
  await requireRole("admin");
  const t = await getTranslations("admin");
  const supabase = await createClient();
  const [{ data: cohorts }, { data: memberships }] = await Promise.all([
    supabase.from("cohorts").select("id, name, start_date, timezone, program_id, program:programs(weeks), created_at").order("created_at"),
    supabase.from("memberships").select("cohort_id, role, paid_at, refunded_at"),
  ]);
  const { data: stages } = await supabase.from("stages").select("id, program_id, key, name, week_from, week_to").order("position");

  return (
    <>
      <PageHeader title={t("groupsTitle")} description={t("groupsIntro")} />

      {(cohorts ?? []).length === 0 ? (
        <EmptyState title={t("noGroups")} body={t("noGroupsBody")} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(cohorts ?? []).map((c) => {
            const inGroup = (memberships ?? []).filter((m) => m.cohort_id === c.id);
            const students = inGroup.filter((m) => m.role === "student");
            const mentors = inGroup.length - students.length;
            const unpaid = students.filter((m) => !m.paid_at && !m.refunded_at).length;
            const weeks = c.program?.weeks ?? 8;
            return (
              <li key={c.id}>
                <Link href={`/admin/groups/${c.id}`} className="card flex h-full flex-col gap-2 p-5 transition-colors hover:border-cyan">
                  <span className="font-display-tight text-lg">{c.name}</span>
                  <span className="text-sm text-muted">
                    {c.start_date ? t("starts", { date: formatDate(c.start_date, c.timezone) }) : t("startTbc")}
                  </span>
                  <WeekHeadline
                    overview={{ stages: (stages ?? []).filter((s) => s.program_id === c.program_id), program: { weeks }, week: currentWeek(c.start_date, c.timezone, weeks), cohort: c }}
                  />
                  <span className="mt-auto flex flex-wrap gap-2 pt-1 text-[13px]">
                    <Badge>{t("studentsCount", { count: students.length })}</Badge>
                    {mentors === 0 ? <Badge tone="coral">{t("noMentorBadge")}</Badge> : <Badge>{t("mentorsCount", { count: mentors })}</Badge>}
                    {unpaid > 0 && <Badge tone="coral">{t("unpaidCount", { count: unpaid })}</Badge>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <section id="new" className="card flex scroll-mt-6 flex-col gap-3 p-5" aria-labelledby="new-heading">
        <h2 id="new-heading" className="font-display-tight text-lg">{t("newGroup")}</h2>
        <CreateCohortForm />
      </section>
    </>
  );
}
