import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { StatusBadge, StepBadge, SubmissionCard } from "@/components/course";
import { requireRole } from "@/lib/auth";
import { loadStudentOverview, signFiles } from "@/lib/data/overview";
import { tr } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import { SubmitForm } from "../../SubmitForm";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage({ params }: PageProps<"/student/activities/[id]">) {
  const { id } = await params;
  const profile = await requireRole("student");
  const t = await getTranslations("student");
  const supabase = await createClient();
  const overview = await loadStudentOverview(supabase, profile.id);
  if (!overview) redirect("/student");

  const activity = overview.activities.find((a) => a.id === id);
  if (!activity) notFound();
  const stage = overview.stages.find((s) => s.key === activity.stage_key);
  const submissions = overview.submissions.filter((s) => s.activity_id === id);
  const status = overview.statuses.get(id)!;
  const fileUrls = await signFiles(supabase, submissions.flatMap((s) => s.submission_files.map((f) => f.storage_path)));

  return (
    <AppShell profile={profile}>
      <Link href="/student" className="text-sm font-medium text-info">← {t("back")}</Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {stage && <StepBadge stageKey={stage.key} name={tr(stage.name)} />}
          <span className="text-sm text-soft">{t("weekLabel", { week: activity.week })}</span>
          <StatusBadge status={status} />
        </div>
        <h1 className="font-display-tight text-[28px] leading-tight">{tr(activity.title)}</h1>
      </header>

      <section className="card p-6" aria-label={t("instructions")}>
        <p className="label-caps mb-2 text-soft">{t("instructions")}</p>
        <p className="whitespace-pre-wrap text-base">{tr(activity.instructions)}</p>
      </section>

      {status !== "done" && (
        <SubmitForm
          activityId={activity.id}
          cohortId={overview.cohort.id}
          studentId={profile.id}
          submissionType={activity.submission_type}
          isResubmission={submissions.length > 0}
        />
      )}

      {submissions.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="history-heading">
          <h2 id="history-heading" className="label-caps text-soft">{t("yourSubmissions")}</h2>
          {submissions.map((s) => (
            <SubmissionCard key={s.id} submission={s} fileUrls={fileUrls} timeZone={overview.cohort.timezone} />
          ))}
        </section>
      )}
    </AppShell>
  );
}
