import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/AppShell";
import { StepBadge } from "@/components/course";
import { AGE_GROUP_TONE, Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { tr } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import { ActivityForm, DeleteActivityButton } from "../forms";

export const metadata: Metadata = { title: "Programme" };

export default async function ProgrammePage() {
  await requireRole("admin");
  const t = await getTranslations("adminProgramme");
  const supabase = await createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("id, name, weeks, stages(id, position, key, name, summary, week_from, week_to, activities(id, week, position, title, instructions, age_group, submission_type))")
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const stages = [...(program?.stages ?? [])].sort((a, b) => a.position - b.position);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro", { name: tr(program?.name), weeks: program?.weeks ?? 8 })} />

      {stages.map((stage) => {
        const weeks = Array.from({ length: stage.week_to - stage.week_from + 1 }, (_, i) => stage.week_from + i);
        const activities = [...stage.activities].sort((a, b) => a.week - b.week || a.position - b.position);
        return (
          <section key={stage.id} className="card flex flex-col gap-4 p-5" aria-labelledby={`stage-${stage.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 id={`stage-${stage.id}`} className="flex items-center gap-2">
                <StepBadge stageKey={stage.key} name={`${stage.position}. ${tr(stage.name)}`} />
              </h2>
              <span className="text-[13px] text-soft">{t("weeks", { from: stage.week_from, to: stage.week_to, count: activities.length })}</span>
            </div>
            {tr(stage.summary) && <p className="text-sm text-muted">{tr(stage.summary)}</p>}

            <ul className="flex flex-col divide-y divide-border">
              {activities.map((a) => (
                <li key={a.id} className="py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2">
                      <span className="flex flex-col">
                        <span className="font-medium">{tr(a.title)}</span>
                        <span className="text-[13px] text-soft">{t("weekLabel", { week: a.week })} · {t(`submissionTypes.${a.submission_type}`)}</span>
                      </span>
                      <span className="flex items-center gap-2">
                        {a.age_group ? <Badge tone={AGE_GROUP_TONE[a.age_group]}>{t(`ageGroups.${a.age_group}`)}</Badge> : <Badge>{t("both")}</Badge>}
                        <span className="text-sm font-medium text-info">{t("edit")}</span>
                      </span>
                    </summary>
                    <div className="mt-4 flex flex-col gap-3 rounded-xl bg-surface-2 p-4">
                      <ActivityForm
                        stageId={stage.id}
                        weeks={weeks}
                        activity={{ ...a, title: tr(a.title), instructions: tr(a.instructions) }}
                      />
                      <DeleteActivityButton activityId={a.id} />
                    </div>
                  </details>
                </li>
              ))}
            </ul>

            <details className="rounded-xl border border-dashed border-border p-4">
              <summary className="cursor-pointer text-sm font-medium text-info">+ {t("addActivity")}</summary>
              <div className="mt-3">
                <ActivityForm stageId={stage.id} weeks={weeks} />
              </div>
            </details>
          </section>
        );
      })}
    </>
  );
}
