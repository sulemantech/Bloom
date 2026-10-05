import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { ActivityRow, ProgressBar, StepBadge, WeekHeadline, WeekStrip } from "@/components/course";
import { SessionsCard } from "@/components/Sessions";
import { AGE_GROUP_TONE, AREA_TONE, Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { loadStudentOverview } from "@/lib/data/overview";
import { tr } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My course" };

export default async function StudentHome() {
  const profile = await requireRole("student");
  const t = await getTranslations("student");
  const supabase = await createClient();
  const overview = await loadStudentOverview(supabase, profile.id);

  if (!overview) {
    return (
      <AppShell profile={profile}>
        <h1 className="font-display-tight text-[28px]">{t("hello", { name: profile.full_name })}</h1>
        <p className="card p-6 text-muted">{t("noGroup")}</p>
      </AppShell>
    );
  }

  const { cohort, membership, activities, statuses, stats, project, week, stages } = overview;
  // Before the start (or with no start date), show week 1; after the end, show the last week.
  const focusWeek = week === null || week === 0 ? 1 : Math.min(week, overview.program.weeks);
  const thisWeek = activities.filter((a) => a.week === focusWeek);
  const overdue = activities.filter((a) => statuses.get(a.id) === "overdue");

  return (
    <AppShell profile={profile}>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-soft">{cohort.name}</span>
          {membership.age_group && (
            <Badge tone={AGE_GROUP_TONE[membership.age_group]}>{t(`ageGroups.${membership.age_group}`)}</Badge>
          )}
        </div>
        <h1 className="font-display-tight text-[28px] leading-tight">{t("hello", { name: profile.full_name })}</h1>
        <WeekHeadline overview={overview} />
        <WeekStrip overview={overview} />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card flex flex-col gap-4 self-start p-5 lg:col-span-2" aria-labelledby="week-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="week-heading" className="font-display-tight text-lg">{t("thisWeek", { week: focusWeek })}</h2>
          </div>
          {thisWeek.length === 0 ? (
            <p className="text-sm text-muted">{t("nothingThisWeek")}</p>
          ) : (
            <ul className="-mx-3 flex flex-col">
              {thisWeek.map((a) => (
                <ActivityRow key={a.id} href={`/student/activities/${a.id}`} title={tr(a.title)} week={a.week} status={statuses.get(a.id)!} />
              ))}
            </ul>
          )}
          {overdue.length > 0 && (
            <div className="rounded-xl bg-coral/10 p-4">
              <p className="mb-1 text-sm font-medium text-danger">{t("catchUp", { count: overdue.length })}</p>
              <ul className="-mx-3 flex flex-col">
                {overdue.map((a) => (
                  <ActivityRow key={a.id} href={`/student/activities/${a.id}`} title={tr(a.title)} week={a.week} status="overdue" />
                ))}
              </ul>
            </div>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className="card flex flex-col gap-4 p-5" aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="label-caps text-soft">{t("progress")}</h2>
            <ProgressBar value={stats.done} max={stats.total} label={t("doneOf", { done: stats.done, total: stats.total })} />
            <p className="text-[13px] text-soft">{t("submittedOf", { submitted: stats.submitted, total: stats.total })}</p>
          </section>

          <section className="card flex flex-col gap-3 p-5" aria-labelledby="project-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="project-heading" className="label-caps text-soft">{t("myProject")}</h2>
              <Link href="/student/project" className="text-sm font-medium text-info">
                {project ? t("edit") : t("start")}
              </Link>
            </div>
            {project ? (
              <>
                <p className="font-display-tight text-lg">{project.title || t("untitled")}</p>
                <Badge tone={AREA_TONE[project.area]}>{t(`areas.${project.area}`)}</Badge>
                {project.problem && <p className="line-clamp-3 text-sm text-muted">{project.problem}</p>}
              </>
            ) : (
              <p className="text-sm text-muted">{t("noProject")}</p>
            )}
          </section>

          <SessionsCard sessions={overview.sessions} timeZone={cohort.timezone} />
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="all-heading">
        <h2 id="all-heading" className="label-caps text-soft">{t("allWeeks")}</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {stages.map((stage) => {
            const stageActivities = activities.filter((a) => a.stage_key === stage.key);
            return (
              <div key={stage.id} className="card flex flex-col gap-2 p-5">
                <div className="flex items-center justify-between gap-2">
                  <StepBadge stageKey={stage.key} name={`${stage.position}. ${tr(stage.name)}`} />
                  <span className="text-[13px] text-soft">{t("weeks", { from: stage.week_from, to: stage.week_to })}</span>
                </div>
                <p className="text-sm text-muted">{tr(stage.summary)}</p>
                <ul className="-mx-3 flex flex-col">
                  {stageActivities.map((a) => (
                    <ActivityRow key={a.id} href={`/student/activities/${a.id}`} title={tr(a.title)} week={a.week} status={statuses.get(a.id)!} />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
