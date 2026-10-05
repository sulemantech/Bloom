import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState } from "@/components/AppShell";
import { Timeline } from "@/components/bloom";
import { ActivityRow, ProgressBar, WeekHeadline, WeekStrip } from "@/components/course";
import { SessionsCard } from "@/components/Sessions";
import { AGE_GROUP_TONE, AREA_TONE, Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/lib/auth";
import { loadTimeline } from "@/lib/data/bloom";
import { loadStudentOverview } from "@/lib/data/overview";
import { tr } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My course" };

export default async function StudentHome() {
  const profile = await requireRole("student");
  const t = await getTranslations("student");
  const supabase = await createClient();
  const overview = await loadStudentOverview(supabase, profile.id);
  const { events, paths } = await loadTimeline(supabase, profile.id, overview, {
    bloomHref: (id) => `/student/spark/${id}`,
    activityHref: (id) => `/student/activities/${id}`,
  });

  // The path to continue: the most recently started active one, and its next open task.
  const current = paths.find((p) => p.status === "active");
  const nextTask = current?.tasks.find((task) => task.status !== "done");

  const bloomCard = (
    <section className="relative flex flex-col gap-3 overflow-hidden rounded-2xl bg-ink-900 p-5 text-white" aria-labelledby="bloom-heading">
      <div className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-violet/35 blur-3xl" aria-hidden="true" />
      <h2 id="bloom-heading" className="label-caps relative flex items-center gap-2 text-lime">
        <Icon name="sparkle" size={16} />
        {t("bloomTitle")}
      </h2>
      {current ? (
        <div className="relative flex flex-col gap-2">
          <p className="font-display-tight text-lg leading-snug">{current.title}</p>
          {nextTask && <p className="text-sm text-mist">{t("bloomNext", { task: nextTask.title })}</p>}
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-lime to-cyan" style={{ width: `${current.total ? Math.round((current.done / current.total) * 100) : 0}%` }} />
          </div>
          <Link href={`/student/spark/${current.id}`} className="btn btn-primary mt-1 self-start px-4 py-2 text-sm">{t("bloomContinue")}</Link>
        </div>
      ) : (
        <div className="relative flex flex-col gap-2">
          <p className="text-sm text-mist">{t("bloomIntro")}</p>
          <Link href="/student/spark" className="btn btn-primary self-start px-4 py-2 text-sm">{t("bloomStart")}</Link>
        </div>
      )}
    </section>
  );

  if (!overview) {
    return (
      <>
        <h1 className="font-display-tight text-[28px]">{t("hello", { name: profile.full_name })}</h1>
        <EmptyState title={t("noGroupTitle")} body={t("noGroup")} />
        {bloomCard}
      </>
    );
  }

  const { cohort, membership, activities, statuses, stats, project, week } = overview;
  // Before the start (or with no start date), show week 1; after the end, show the last week.
  const focusWeek = week === null || week === 0 ? 1 : Math.min(week, overview.program.weeks);
  const thisWeek = activities.filter((a) => a.week === focusWeek);
  const overdue = activities.filter((a) => statuses.get(a.id) === "overdue");
  const needsChanges = activities.filter((a) => statuses.get(a.id) === "needs_changes");

  return (
    <>
      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-soft">{cohort.name}</span>
          {membership.age_group && <Badge tone={AGE_GROUP_TONE[membership.age_group]}>{t(`ageGroups.${membership.age_group}`)}</Badge>}
        </div>
        <h1 className="font-display-tight text-[28px] leading-tight">{t("hello", { name: profile.full_name.split(" ")[0] })}</h1>
        <WeekHeadline overview={overview} />
        <WeekStrip overview={overview} />
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <section className="card flex flex-col gap-4 p-5" aria-labelledby="week-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="week-heading" className="font-display-tight text-lg">{t("thisWeek", { week: focusWeek })}</h2>
              <Link href="/student/activities" className="text-sm font-medium text-info">{t("allActivities")}</Link>
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
            {(overdue.length > 0 || needsChanges.length > 0) && (
              <div className="rounded-xl bg-coral/10 p-4">
                <p className="mb-1 text-sm font-medium text-danger">{t("catchUp", { count: overdue.length + needsChanges.length })}</p>
                <ul className="-mx-3 flex flex-col">
                  {[...needsChanges, ...overdue].map((a) => (
                    <ActivityRow key={a.id} href={`/student/activities/${a.id}`} title={tr(a.title)} week={a.week} status={statuses.get(a.id)!} />
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="card flex flex-col gap-3 p-5" aria-labelledby="journey-heading">
            <h2 id="journey-heading" className="font-display-tight text-lg">{t("journey")}</h2>
            <Timeline events={events} timeZone={cohort.timezone} limit={8} emptyText={t("journeyEmpty")} />
          </section>
        </div>

        <div className="flex flex-col gap-4">
          {bloomCard}

          <section className="card flex flex-col gap-4 p-5" aria-labelledby="progress-heading">
            <h2 id="progress-heading" className="label-caps text-soft">{t("progress")}</h2>
            <ProgressBar value={stats.done} max={stats.total} label={t("doneOf", { done: stats.done, total: stats.total })} />
            <p className="text-[13px] text-soft">{t("submittedOf", { submitted: stats.submitted, total: stats.total })}</p>
          </section>

          <section className="card flex flex-col gap-3 p-5" aria-labelledby="project-heading">
            <div className="flex items-center justify-between gap-2">
              <h2 id="project-heading" className="label-caps text-soft">{t("myProject")}</h2>
              <Link href="/student/project" className="text-sm font-medium text-info">{project ? t("edit") : t("start")}</Link>
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
    </>
  );
}
