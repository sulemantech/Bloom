import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader, Section, Stat } from "@/components/AppShell";
import { LastActive } from "@/components/bloom";
import { WeekHeadline } from "@/components/course";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/lib/auth";
import { daysSince, loadLastActive } from "@/lib/data/bloom";
import { loadCohortProgress, loadMyCohorts } from "@/lib/data/cohort";
import { formatDateTime, tr } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Dashboard" };

export default async function MentorHome() {
  const profile = await requireRole("mentor", "admin");
  const t = await getTranslations("mentor");
  const supabase = await createClient();
  const cohorts = await loadMyCohorts(supabase, profile.id, profile.role === "admin");
  const groups = (await Promise.all(cohorts.map((c) => loadCohortProgress(supabase, c.id)))).flatMap((g) => (g ? [g] : []));
  const lastActive = await loadLastActive(supabase, groups.flatMap((g) => g.students.map((s) => s.profile.id)));

  const toReview = groups
    .flatMap((g) => g.toReview.map((r) => ({ ...r, cohort: g.cohort })))
    .sort((a, b) => a.submission.submitted_at.localeCompare(b.submission.submitted_at));

  // Students who may need a nudge: behind on work, or quiet for a week.
  const attention = groups
    .flatMap((g) =>
      g.students.map((s) => ({ ...s, cohort: g.cohort, last: lastActive.get(s.profile.id) ?? null })),
    )
    .filter((s) => s.overdue >= 2 || (daysSince(s.last) ?? 99) >= 7)
    .sort((a, b) => b.overdue - a.overdue);

  const studentCount = groups.reduce((n, g) => n + g.students.length, 0);

  return (
    <>
      <PageHeader title={t("dashboardTitle", { name: profile.full_name.split(" ")[0] || "" })} description={t("dashboardIntro")} />

      {groups.length === 0 ? (
        <EmptyState title={t("noGroups")} />
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <li><Stat value={groups.length} label={t("stats.groups")} /></li>
            <li><Stat value={studentCount} label={t("stats.students")} /></li>
            <li><Stat value={toReview.length} label={t("stats.toReview")} tone={toReview.length ? "warning" : undefined} /></li>
            <li><Stat value={attention.length} label={t("stats.attention")} tone={attention.length ? "danger" : undefined} /></li>
          </ul>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="card flex flex-col gap-3 p-5" aria-labelledby="review-heading">
              <h2 id="review-heading" className="font-display-tight text-lg">
                {t("toReview")} <span className="tabular-nums text-soft">({toReview.length})</span>
              </h2>
              {toReview.length === 0 ? (
                <p className="text-sm text-muted">{t("allReviewed")}</p>
              ) : (
                <ul className="-mx-3 flex flex-col">
                  {toReview.slice(0, 12).map(({ submission, student, activity, cohort }) => (
                    <li key={submission.id}>
                      <Link
                        href={`/mentor/groups/${cohort.id}/students/${student.id}#activity-${submission.activity_id}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="font-medium">{student.full_name}</span>
                          <span className="truncate text-[13px] text-soft">
                            {activity ? `${t("weekShort", { week: activity.week })} · ${tr(activity.title)}` : ""}
                            {groups.length > 1 ? ` · ${cohort.name}` : ""}
                          </span>
                        </span>
                        <span className="shrink-0 text-[12px] text-soft">{formatDateTime(submission.submitted_at, cohort.timezone)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="card flex flex-col gap-3 p-5" aria-labelledby="attention-heading">
              <h2 id="attention-heading" className="font-display-tight text-lg">{t("attentionTitle")}</h2>
              {attention.length === 0 ? (
                <p className="text-sm text-muted">{t("attentionNone")}</p>
              ) : (
                <ul className="-mx-3 flex flex-col">
                  {attention.slice(0, 12).map((s) => (
                    <li key={s.profile.id}>
                      <Link
                        href={`/mentor/groups/${s.cohort.id}/students/${s.profile.id}`}
                        className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 hover:bg-surface-2"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="font-medium">{s.profile.full_name}</span>
                          <span className="text-[13px]">
                            <LastActive at={s.last} />
                          </span>
                        </span>
                        {s.overdue > 0 && <Badge tone="coral">{t("overdueCount", { count: s.overdue })}</Badge>}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <Section title={t("myGroups")} id="groups">
            <ul className="grid gap-3 sm:grid-cols-2">
              {groups.map((g) => (
                <li key={g.cohort.id}>
                  <Link href={`/mentor/groups/${g.cohort.id}`} className="card flex h-full flex-col gap-2 p-5 transition-colors hover:border-cyan">
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-display-tight text-lg">{g.cohort.name}</span>
                      <Icon name="chevron" className="text-soft" />
                    </span>
                    <WeekHeadline overview={g} />
                    <span className="flex flex-wrap gap-2">
                      <Badge>{t("students", { count: g.students.length })}</Badge>
                      {g.toReview.length > 0 && <Badge tone="sun">{t("reviewCount", { count: g.toReview.length })}</Badge>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}
    </>
  );
}
