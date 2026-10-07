import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { LastActive } from "@/components/bloom";
import { WeekHeadline, WeekStrip } from "@/components/course";
import { AGE_GROUP_TONE, Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { loadBloomTotals, loadLastActive } from "@/lib/data/bloom";
import { loadOpenGaps } from "@/lib/data/learner";
import { loadCohortProgress, type CohortProgress } from "@/lib/data/cohort";
import { formatDateTime, isPast, tr } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import { RecordingForm, SessionForm } from "../../forms";

export const metadata: Metadata = { title: "Group" };

type StudentRow = CohortProgress["students"][number];

/** Colour of a student's week cell: all done, something overdue, waiting for review, or open. */
function weekCell(student: StudentRow, week: number) {
  const items = student.activities.filter((a) => a.week === week);
  const statuses = items.map((a) => student.statuses.get(a.id));
  const done = statuses.filter((s) => s === "done").length;
  let tone = "bg-surface-2 text-soft";
  if (items.length && done === items.length) tone = "bg-lime/20 text-success";
  else if (statuses.some((s) => s === "overdue" || s === "needs_changes")) tone = "bg-coral/15 text-danger";
  else if (statuses.some((s) => s === "submitted")) tone = "bg-sun/20 text-warning";
  return { label: `${done}/${items.length}`, tone };
}

export default async function GroupPage({ params }: PageProps<"/mentor/groups/[cohortId]">) {
  const { cohortId } = await params;
  const profile = await requireRole("mentor", "admin");
  const t = await getTranslations("mentor");
  const supabase = await createClient();
  const data = await loadCohortProgress(supabase, cohortId);
  if (!data) notFound();

  const { cohort, program, students, toReview, week, cards, sessions } = data;
  const weeks = Array.from({ length: program.weeks }, (_, i) => i + 1);
  const cardWeek = week === null || week === 0 ? 1 : Math.min(week, program.weeks);
  const ids = students.map((s) => s.profile.id);
  const [lastActive, bloom, gaps] = await Promise.all([loadLastActive(supabase, ids), loadBloomTotals(supabase, ids), loadOpenGaps(supabase, ids)]);

  return (
    <>
      <header className="flex flex-col gap-3">
        {profile.role === "admin" && (
          <Link href={`/admin/groups/${cohortId}`} className="text-sm font-medium text-info">← {t("backToAdmin")}</Link>
        )}
        <h1 className="font-display-tight text-[28px] leading-tight">{cohort.name}</h1>
        <WeekHeadline overview={data} />
        <WeekStrip overview={data} />
      </header>

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="review-heading">
        <h2 id="review-heading" className="font-display-tight text-lg">
          {t("toReview")} <span className="text-soft tabular-nums">({toReview.length})</span>
        </h2>
        {toReview.length === 0 ? (
          <p className="text-sm text-muted">{t("allReviewed")}</p>
        ) : (
          <ul className="-mx-3 flex flex-col">
            {toReview.map(({ submission, student, activity }) => (
              <li key={submission.id}>
                <Link
                  href={`/mentor/groups/${cohortId}/students/${student.id}#activity-${submission.activity_id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-3 hover:bg-surface-2"
                >
                  <span className="flex flex-col">
                    <span className="font-medium">{student.full_name}</span>
                    <span className="text-[13px] text-soft">
                      {activity ? `${t("week", { week: activity.week })} · ${tr(activity.title)}` : ""}
                    </span>
                  </span>
                  <span className="text-[13px] text-soft">{formatDateTime(submission.submitted_at, cohort.timezone)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="students-heading">
        <h2 id="students-heading" className="font-display-tight text-lg">{t("students", { count: students.length })}</h2>
        {students.length === 0 ? (
          <p className="text-sm text-muted">{t("noStudents")}</p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[860px] border-separate border-spacing-y-1 text-sm">
              <thead>
                <tr className="text-left text-soft">
                  <th className="label-caps py-2 pr-3 font-semibold">{t("student")}</th>
                  {weeks.map((w) => (
                    <th key={w} className={`label-caps px-1 py-2 text-center font-semibold ${w === week ? "text-text" : ""}`}>
                      {t("weekShort", { week: w })}
                    </th>
                  ))}
                  <th className="label-caps px-2 py-2 text-center font-semibold">{t("cardFor", { week: cardWeek })}</th>
                  <th className="label-caps px-2 py-2 text-center font-semibold">{t("bloomColumn")}</th>
                  <th className="label-caps px-2 py-2 text-left font-semibold">{t("lastActive")}</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => {
                  const card = cards.find((c) => c.student_id === s.profile.id && c.week === cardWeek);
                  return (
                    <tr key={s.profile.id}>
                      <td className="py-1 pr-3">
                        <Link href={`/mentor/groups/${cohortId}/students/${s.profile.id}`} className="flex flex-col hover:text-info">
                          <span className="font-medium">{s.profile.full_name}</span>
                          <span className="flex items-center gap-1.5 text-[12px] text-soft">
                            {s.membership.age_group && (
                              <Badge tone={AGE_GROUP_TONE[s.membership.age_group]}>{t(`ageGroups.${s.membership.age_group}`)}</Badge>
                            )}
                            {s.overdue > 0 && <span className="text-danger">{t("overdueCount", { count: s.overdue })}</span>}
                            {(gaps.get(s.profile.id)?.length ?? 0) > 0 && (
                              <span className="text-warning">{t("gapsCount", { count: gaps.get(s.profile.id)!.length })}</span>
                            )}
                          </span>
                        </Link>
                      </td>
                      {weeks.map((w) => {
                        const cell = weekCell(s, w);
                        return (
                          <td key={w} className="px-1 py-1 text-center">
                            <span className={`inline-block min-w-11 rounded-lg px-2 py-1 tabular-nums ${cell.tone}`}>{cell.label}</span>
                          </td>
                        );
                      })}
                      <td className="px-2 py-1 text-center">
                        <Badge tone={!card ? "neutral" : card.status === "approved" ? "lime" : "violet"}>
                          {!card ? t("cardNone") : card.status === "approved" ? (card.viewed_at ? t("cardSeen") : t("cardSent")) : t("cardDraft")}
                        </Badge>
                      </td>
                      <td className="px-2 py-1 text-center">
                        {(() => {
                          const b = bloom.get(s.profile.id);
                          return b && b.total > 0 ? (
                            <span className="inline-block min-w-11 rounded-lg bg-violet/10 px-2 py-1 tabular-nums text-ai">{b.done}/{b.total}</span>
                          ) : (
                            <span className="text-soft">—</span>
                          );
                        })()}
                      </td>
                      <td className="whitespace-nowrap px-2 py-1 text-[13px]">
                        <LastActive at={lastActive.get(s.profile.id) ?? null} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[13px] text-soft">{t("legend")}</p>
      </section>

      <section className="card flex flex-col gap-4 p-5" aria-labelledby="sessions-heading">
        <h2 id="sessions-heading" className="font-display-tight text-lg">{t("sessions")}</h2>
        {sessions.length > 0 && (
          <ul className="flex flex-col gap-3">
            {sessions.map((s) => (
              <li key={s.id} className="flex flex-col gap-1.5 rounded-xl bg-surface-2 p-3">
                <span className="font-medium">
                  {s.title || t("liveClass")} · {formatDateTime(s.starts_at, cohort.timezone)}
                </span>
                <span className="flex flex-wrap gap-3 text-sm">
                  {s.join_url && <a href={s.join_url} target="_blank" rel="noopener noreferrer" className="text-info underline">{t("joinLink")}</a>}
                  {s.recording_url && <a href={s.recording_url} target="_blank" rel="noopener noreferrer" className="text-info underline">{t("recording")}</a>}
                </span>
                {!s.recording_url && isPast(s.starts_at) && <RecordingForm sessionId={s.id} />}
              </li>
            ))}
          </ul>
        )}
        <SessionForm cohortId={cohortId} timeZone={cohort.timezone} />
      </section>
    </>
  );
}
