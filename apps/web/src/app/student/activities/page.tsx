import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/AppShell";
import { ActivityRow, ProgressBar, StepBadge, WeekStrip } from "@/components/course";
import { requireRole } from "@/lib/auth";
import { loadStudentOverview } from "@/lib/data/overview";
import { tr } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Activities" };

export default async function StudentActivities() {
  const profile = await requireRole("student");
  const t = await getTranslations("student");
  const supabase = await createClient();
  const overview = await loadStudentOverview(supabase, profile.id);
  if (!overview) redirect("/student");
  const { stages, activities, statuses, stats } = overview;

  return (
    <>
      <PageHeader title={t("allWeeks")} description={t("activitiesIntro")}>
        <WeekStrip overview={overview} />
      </PageHeader>
      <div className="card p-5">
        <ProgressBar value={stats.done} max={stats.total} label={t("doneOf", { done: stats.done, total: stats.total })} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {stages.map((stage) => {
          const stageActivities = activities.filter((a) => a.stage_key === stage.key);
          const done = stageActivities.filter((a) => statuses.get(a.id) === "done").length;
          return (
            <section key={stage.id} className="card flex flex-col gap-2 p-5">
              <div className="flex items-center justify-between gap-2">
                <StepBadge stageKey={stage.key} name={`${stage.position}. ${tr(stage.name)}`} />
                <span className="text-[13px] text-soft">
                  {t("weeks", { from: stage.week_from, to: stage.week_to })} · {done}/{stageActivities.length}
                </span>
              </div>
              <p className="text-sm text-muted">{tr(stage.summary)}</p>
              <ul className="-mx-3 flex flex-col">
                {stageActivities.map((a) => (
                  <ActivityRow key={a.id} href={`/student/activities/${a.id}`} title={tr(a.title)} week={a.week} status={statuses.get(a.id)!} />
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
