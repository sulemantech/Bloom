import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BloomPathList, LastActive, Timeline } from "@/components/bloom";
import { ProgressBar, StatusBadge, StepBadge, SubmissionCard } from "@/components/course";
import { AGE_GROUP_TONE, AREA_TONE, Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { bloomStats, loadTimeline } from "@/lib/data/bloom";
import { loadStudentOverview, signFiles } from "@/lib/data/overview";
import { tr } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import { ProgressCardForm, ReviewForm } from "../../../../forms";
import { AiDraftButton } from "../../../../AiDraftButton";

export const metadata: Metadata = { title: "Student" };

export default async function MentorStudentPage({
  params,
  searchParams,
}: PageProps<"/mentor/groups/[cohortId]/students/[studentId]">) {
  const { cohortId, studentId } = await params;
  const { week: weekParam } = await searchParams;
  await requireRole("mentor", "admin");
  const t = await getTranslations("mentorStudent");
  const supabase = await createClient();

  const [overview, { data: student }, { data: parents }, { data: cards }] = await Promise.all([
    loadStudentOverview(supabase, studentId),
    supabase.from("profiles").select("id, full_name, username, prefers_female_mentor").eq("id", studentId).maybeSingle(),
    supabase.from("guardian_links").select("parent:profiles!guardian_links_parent_id_fkey(full_name)").eq("student_id", studentId),
    supabase.from("progress_cards").select("*").eq("student_id", studentId).eq("cohort_id", cohortId).order("week"),
  ]);
  if (!overview || !student || overview.cohort.id !== cohortId) notFound();

  const { activities, statuses, submissions, project, stats, program, week, stages } = overview;
  const fileUrls = await signFiles(supabase, submissions.flatMap((s) => s.submission_files.map((f) => f.storage_path)));
  const defaultWeek = week === null || week === 0 ? 1 : Math.min(week, program.weeks);
  const requested = Number(weekParam);
  const cardWeek = Number.isInteger(requested) && requested >= 1 && requested <= program.weeks ? requested : defaultWeek;
  const card = (cards ?? []).find((c) => c.week === cardWeek);
  const weeks = Array.from({ length: program.weeks }, (_, i) => i + 1);
  const base = `/mentor/groups/${cohortId}/students/${studentId}`;
  const { events, lastActive, paths } = await loadTimeline(supabase, studentId, overview, {
    bloomHref: (id) => `${base}/spark/${id}`,
    activityHref: (id) => `${base}#activity-${id}`,
  });
  const bloom = bloomStats(paths);

  return (
    <>
      <Link href={`/mentor/groups/${cohortId}`} className="text-sm font-medium text-info">← {t("back", { group: overview.cohort.name })}</Link>

      <header className="flex flex-col gap-2">
        <h1 className="font-display-tight text-[28px] leading-tight">{student.full_name}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          {overview.membership.age_group && (
            <Badge tone={AGE_GROUP_TONE[overview.membership.age_group]}>{t(`ageGroups.${overview.membership.age_group}`)}</Badge>
          )}
          <span>{t("username", { username: student.username ?? "" })}</span>
          {(parents ?? []).length > 0 && (
            <span>· {t("parents", { names: (parents ?? []).map((p) => p.parent?.full_name).filter(Boolean).join(", ") })}</span>
          )}
          {student.prefers_female_mentor && <Badge tone="violet">{t("femaleMentor")}</Badge>}
          <span>
            · <LastActive at={lastActive} />
          </span>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card flex flex-col gap-3 p-5">
          <h2 className="label-caps text-soft">{t("progress")}</h2>
          <ProgressBar value={stats.done} max={stats.total} label={t("doneOf", { done: stats.done, total: stats.total })} />
          <p className="text-[13px] text-soft">{t("overdue", { count: stats.overdue })}</p>
        </section>
        <section className="card flex flex-col gap-2 p-5">
          <h2 className="label-caps text-soft">{t("project")}</h2>
          {project ? (
            <>
              <p className="font-display-tight text-lg">{project.title || t("untitled")}</p>
              <div className="flex flex-wrap gap-2">
                <Badge tone={AREA_TONE[project.area]}>{t(`areas.${project.area}`)}</Badge>
                <Badge>{t(`projectStatus.${project.status}`)}</Badge>
              </div>
              {project.problem && <p className="text-sm text-muted">{project.problem}</p>}
            </>
          ) : (
            <p className="text-sm text-muted">{t("noProject")}</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card flex flex-col gap-3 p-5 lg:col-span-3" aria-labelledby="bloom-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="bloom-heading" className="font-display-tight text-lg">
              <span aria-hidden="true" className="text-ai">✦ </span>
              {t("bloom")}
            </h2>
            <span className="text-[13px] text-soft">{t("bloomSummary", { paths: bloom.paths, done: bloom.tasksDone, total: bloom.tasksTotal })}</span>
          </div>
          <p className="text-[13px] text-soft">{t("bloomHint")}</p>
          <BloomPathList paths={paths} hrefFor={(id) => `${base}/spark/${id}`} />
        </section>
        <section className="card flex flex-col gap-3 p-5 lg:col-span-2" aria-labelledby="journey-heading">
          <h2 id="journey-heading" className="font-display-tight text-lg">{t("journey")}</h2>
          <Timeline events={events} timeZone={overview.cohort.timezone} limit={12} />
        </section>
      </div>

      <section className="card flex flex-col gap-4 p-5" aria-labelledby="card-heading" id="progress-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="card-heading" className="font-display-tight text-lg">{t("progressCard")}</h2>
          {card && (
            <Badge tone={card.status === "approved" ? "lime" : "violet"}>
              {card.status === "approved" ? (card.viewed_at ? t("cardSeen") : t("cardSent")) : t("cardDraft")}
            </Badge>
          )}
        </div>
        <nav className="flex flex-wrap gap-1" aria-label={t("chooseWeek")}>
          {weeks.map((w) => {
            const c = (cards ?? []).find((x) => x.week === w);
            return (
              <Link
                key={w}
                href={`?week=${w}#progress-card`}
                aria-current={w === cardWeek ? "page" : undefined}
                className={`rounded-full px-3 py-1 text-sm tabular-nums ${
                  w === cardWeek ? "bg-text text-bg" : c?.status === "approved" ? "bg-lime/15 text-success" : c ? "bg-violet/10 text-ai" : "bg-surface-2 text-muted"
                }`}
              >
                {t("weekShort", { week: w })}
              </Link>
            );
          })}
        </nav>
        <p className="text-[13px] text-soft">{t("cardHint")}</p>
        <ProgressCardForm
          studentId={studentId}
          cohortId={cohortId}
          week={cardWeek}
          initialBody={card?.body ?? ""}
          approved={card?.status === "approved"}
          aiDraftSlot={<AiDraftButton studentId={studentId} cohortId={cohortId} week={cardWeek} />}
        />
      </section>

      <section className="flex flex-col gap-4" aria-labelledby="work-heading">
        <h2 id="work-heading" className="label-caps text-soft">{t("work")}</h2>
        {stages.map((stage) => (
          <div key={stage.id} className="flex flex-col gap-3">
            <StepBadge stageKey={stage.key} name={`${stage.position}. ${tr(stage.name)}`} />
            {activities
              .filter((a) => a.stage_key === stage.key)
              .map((a) => {
                const subs = submissions.filter((s) => s.activity_id === a.id);
                const [latest, ...older] = subs;
                return (
                  <div key={a.id} id={`activity-${a.id}`} className="flex scroll-mt-6 flex-col gap-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium">
                        <span className="text-soft">{t("weekShort", { week: a.week })} · </span>
                        {tr(a.title)}
                      </p>
                      <StatusBadge status={statuses.get(a.id)!} />
                    </div>
                    {latest ? (
                      <SubmissionCard
                        submission={latest}
                        fileUrls={fileUrls}
                        timeZone={overview.cohort.timezone}
                        footer={<ReviewForm submissionId={latest.id} />}
                      />
                    ) : (
                      <p className="text-sm text-soft">{t("notSubmitted")}</p>
                    )}
                    {older.length > 0 && (
                      <details>
                        <summary className="cursor-pointer text-sm text-info">{t("olderVersions", { count: older.length })}</summary>
                        <div className="mt-2 flex flex-col gap-2">
                          {older.map((s) => (
                            <SubmissionCard key={s.id} submission={s} fileUrls={fileUrls} timeZone={overview.cohort.timezone} />
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
          </div>
        ))}
      </section>
    </>
  );
}
