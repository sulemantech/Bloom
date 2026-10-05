import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Badge, STEP_TONE, type Tone } from "@/components/ui/Badge";
import type { StudentOverview } from "@/lib/data/overview";
import { formatDateTime, tr, type ActivityStatus } from "@/lib/programme";
import type { Json } from "@/lib/supabase/database.types";

/** The few fields the week strip and headline need (satisfied by student and cohort data). */
type WeekInfo = {
  stages: { id: string; key: string; name: Json; week_from: number; week_to: number }[];
  program: { weeks: number };
  week: number | null;
  cohort: { start_date: string | null };
};

const STATUS_TONE: Record<ActivityStatus, Tone> = {
  todo: "neutral",
  overdue: "coral",
  submitted: "sun",
  needs_changes: "coral",
  done: "lime",
};

export async function StatusBadge({ status }: { status: ActivityStatus }) {
  const t = await getTranslations("status");
  return <Badge tone={STATUS_TONE[status]}>{t(status)}</Badge>;
}

export function ProgressBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max === 0 ? 0 : Math.round((value / max) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between text-[13px] text-muted">
        <span>{label}</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-2"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-gradient-to-r from-lime to-cyan" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

const STEP_BAR: Record<string, string> = {
  explore: "bg-lime",
  choose: "bg-cyan",
  build: "bg-violet",
  present: "bg-coral",
};

/** The 8 weeks as a strip coloured by step, with the current week marked. */
export async function WeekStrip({ overview }: { overview: Omit<WeekInfo, "cohort"> }) {
  const t = await getTranslations("course");
  const weeks = Array.from({ length: overview.program.weeks }, (_, i) => i + 1);
  return (
    <ol className="grid grid-cols-8 gap-1" aria-label={t("weeksLabel")}>
      {weeks.map((w) => {
        const stage = overview.stages.find((s) => w >= s.week_from && w <= s.week_to);
        const isCurrent = overview.week === w;
        const isPast = overview.week !== null && w < overview.week;
        return (
          <li key={w} className="flex flex-col items-center gap-1" aria-current={isCurrent ? "step" : undefined}>
            <span
              className={`h-2 w-full rounded-full ${stage ? STEP_BAR[stage.key] : "bg-surface-2"} ${
                isCurrent ? "" : isPast ? "opacity-60" : "opacity-25"
              }`}
            />
            <span className={`text-[12px] tabular-nums ${isCurrent ? "font-semibold text-text" : "text-soft"}`}>{w}</span>
          </li>
        );
      })}
    </ol>
  );
}

export async function StepBadge({ stageKey, name }: { stageKey: string; name: string }) {
  return <Badge tone={STEP_TONE[stageKey] ?? "neutral"}>{name}</Badge>;
}

export async function WeekHeadline({ overview }: { overview: WeekInfo }) {
  const t = await getTranslations("course");
  const { week, program } = overview;
  if (week === null) return <p className="text-muted">{t("startTbc")}</p>;
  if (week === 0) return <p className="text-muted">{t("notStarted", { date: overview.cohort.start_date ?? "" })}</p>;
  if (week > program.weeks) return <p className="text-muted">{t("finished")}</p>;
  const stage = overview.stages.find((s) => week >= s.week_from && week <= s.week_to);
  return (
    <p className="flex flex-wrap items-center gap-2 text-muted">
      <span className="font-medium text-text">{t("weekOf", { week, total: program.weeks })}</span>
      {stage && <StepBadge stageKey={stage.key} name={tr(stage.name)} />}
    </p>
  );
}

type Submission = StudentOverview["submissions"][number];

/** One submission with its files and mentor feedback. */
export async function SubmissionCard({
  submission,
  fileUrls,
  timeZone,
  footer,
}: {
  submission: Submission;
  fileUrls: Map<string, string>;
  timeZone: string;
  footer?: React.ReactNode;
}) {
  const t = await getTranslations("course");
  return (
    <article className="card flex flex-col gap-3 p-5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] text-soft">
          {t("submittedAt", { date: formatDateTime(submission.submitted_at, timeZone) })}
        </span>
        <StatusBadge status={submission.status} />
      </header>
      {submission.body && <p className="whitespace-pre-wrap text-[15px]">{submission.body}</p>}
      {submission.link_url && (
        <a href={submission.link_url} target="_blank" rel="noopener noreferrer" className="break-all text-info underline">
          {submission.link_url}
        </a>
      )}
      {submission.submission_files.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {submission.submission_files.map((f) => {
            const url = fileUrls.get(f.storage_path);
            return (
              <li key={f.id}>
                {url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="btn btn-secondary px-3 py-1.5 text-sm">
                    📎 {f.file_name}
                  </a>
                ) : (
                  <span className="text-sm text-soft">📎 {f.file_name}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {submission.feedback.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          {submission.feedback
            .sort((a, b) => a.created_at.localeCompare(b.created_at))
            .map((fb) => (
              <div key={fb.id} className="rounded-xl bg-cyan/10 p-3">
                <p className="label-caps mb-1 text-info">{t("feedbackFrom", { name: fb.mentor?.full_name || t("mentor") })}</p>
                <p className="whitespace-pre-wrap text-[15px]">{fb.body}</p>
              </div>
            ))}
        </div>
      )}
      {footer}
    </article>
  );
}

/** A row linking to an activity, with its status. */
export async function ActivityRow({
  href,
  title,
  week,
  status,
}: {
  href: string;
  title: string;
  week: number;
  status: ActivityStatus;
}) {
  const t = await getTranslations("course");
  return (
    <li>
      <Link
        href={href}
        className="flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition-colors hover:bg-surface-2"
      >
        <span className="flex flex-col">
          <span className="font-medium">{title}</span>
          <span className="text-[13px] text-soft">{t("week", { week })}</span>
        </span>
        <StatusBadge status={status} />
      </Link>
    </li>
  );
}
