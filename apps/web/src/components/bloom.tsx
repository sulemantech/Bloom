import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ProgressBar } from "@/components/course";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Badge, STEP_TONE, type Tone } from "@/components/ui/Badge";
import { daysSince, type BloomPath, type TimelineEvent } from "@/lib/data/bloom";
import { formatDate, formatDateTime } from "@/lib/programme";

const PATH_STATUS_TONE: Record<BloomPath["status"], Tone> = { active: "cyan", completed: "lime", archived: "neutral" };
const TASK_STATUS_TONE: Record<BloomPath["tasks"][number]["status"], Tone> = { todo: "neutral", doing: "sun", done: "lime" };
const KIND_TONE: Record<BloomPath["tasks"][number]["kind"], Tone> = { learn: "cyan", do: "violet", reflect: "coral" };

export async function PathStatusBadge({ status }: { status: BloomPath["status"] }) {
  const t = await getTranslations("bloom");
  return <Badge tone={PATH_STATUS_TONE[status]}>{t(`pathStatus.${status}`)}</Badge>;
}

/** A learning path as a clickable card with its progress. */
export async function BloomPathCard({ path, href }: { path: BloomPath; href: string }) {
  const t = await getTranslations("bloom");
  return (
    <Link href={href} className="card flex h-full flex-col gap-3 p-5 transition-colors hover:border-violet">
      <div className="flex flex-wrap items-center gap-2">
        <PathStatusBadge status={path.status} />
        {path.stage_key && <Badge tone={STEP_TONE[path.stage_key] ?? "neutral"}>{t(`steps.${path.stage_key}`)}</Badge>}
        {path.ai_generated && (
          <span className="text-[12px] text-ai">
            <span aria-hidden="true">✦ </span>
            {t("byBloom")}
          </span>
        )}
      </div>
      <p className="font-display-tight text-lg leading-snug">{path.title}</p>
      {path.goal && <p className="line-clamp-2 text-sm text-muted">{path.goal}</p>}
      <div className="mt-auto">
        <ProgressBar value={path.done} max={path.total} label={t("tasksDone", { done: path.done, total: path.total })} />
      </div>
      {path.mentor_note && (
        <p className="flex items-center gap-1.5 text-[13px] text-info">
          <Icon name="check" size={14} />
          {t("hasMentorNote")}
        </p>
      )}
    </Link>
  );
}

type PathDetail = BloomPath & { questions: { id: string; task_id: string | null; question: string; answer: string; created_at: string }[] };

/**
 * The full path: summary, mentor note, tasks with reflections, and questions to Bloom.
 * Students pass `taskControls` to edit tasks; mentors pass `mentorSlot` for their note form.
 */
export async function BloomPathDetail({
  path,
  timeZone,
  taskControls,
  mentorSlot,
  questionSlot,
}: {
  path: PathDetail;
  timeZone: string;
  taskControls?: (task: BloomPath["tasks"][number]) => ReactNode;
  mentorSlot?: ReactNode;
  questionSlot?: (taskId: string | null) => ReactNode;
}) {
  const t = await getTranslations("bloom");
  const generalQuestions = path.questions.filter((q) => !q.task_id);

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        {path.summary && <p className="text-[15px] leading-relaxed">{path.summary}</p>}
        <ProgressBar value={path.done} max={path.total} label={t("tasksDone", { done: path.done, total: path.total })} />
        {(path.mentor_note || mentorSlot) && (
          <div className="rounded-xl bg-cyan/10 p-4">
            <p className="label-caps mb-1 text-info">
              {path.mentor_note ? t("mentorNoteFrom", { name: path.mentor?.full_name || t("yourMentor") }) : t("mentorNote")}
            </p>
            {path.mentor_note && <p className="whitespace-pre-wrap text-[15px]">{path.mentor_note}</p>}
            {mentorSlot}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="tasks-heading">
        <h2 id="tasks-heading" className="label-caps text-soft">{t("tasks")}</h2>
        {path.tasks.length === 0 && <p className="card p-5 text-sm text-muted">{t("noTasks")}</p>}
        <ol className="flex flex-col gap-3">
          {path.tasks.map((task, i) => {
            const questions = path.questions.filter((q) => q.task_id === task.id);
            return (
              <li key={task.id} id={`task-${task.id}`} className="card flex scroll-mt-6 flex-col gap-3 p-5">
                <div className="flex items-start gap-3">
                  <span
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      task.status === "done" ? "bg-lime/25 text-success" : "bg-surface-2 text-muted"
                    }`}
                    aria-hidden="true"
                  >
                    {task.status === "done" ? <Icon name="check" size={16} /> : i + 1}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={KIND_TONE[task.kind]}>{t(`kinds.${task.kind}`)}</Badge>
                      <Badge tone={TASK_STATUS_TONE[task.status]}>{t(`taskStatus.${task.status}`)}</Badge>
                    </div>
                    <p className={`font-display-tight text-[17px] ${task.status === "done" ? "text-muted" : ""}`}>{task.title}</p>
                  </div>
                </div>
                {task.planned_only ? (
                  <div className="flex flex-col gap-1">
                    {task.details && <p className="text-[15px] text-muted">{task.details}</p>}
                    <p className="text-[13px] text-ai">
                      <span aria-hidden="true">✦ </span>
                      {taskControls ? t("plannedHint") : t("plannedHintViewer")}
                    </p>
                  </div>
                ) : (
                  task.details && (
                    <details className="group" open={task.status !== "done"}>
                      <summary className="cursor-pointer text-sm font-medium text-info">{t("howTo")}</summary>
                      <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-muted">{task.details}</p>
                    </details>
                  )
                )}
                {task.feeling && !taskControls && <p className="text-sm text-muted">{t("feltIt", { feeling: t(`feelings.${task.feeling}`) })}</p>}
                {task.reflection && !taskControls && (
                  <div className="rounded-xl bg-surface-2 p-3">
                    <p className="label-caps mb-1 text-soft">{t("reflection")}</p>
                    <p className="whitespace-pre-wrap text-[15px]">{task.reflection}</p>
                  </div>
                )}
                {questions.length > 0 && <QuestionList questions={questions} timeZone={timeZone} />}
                {taskControls?.(task)}
                {questionSlot?.(task.id)}
              </li>
            );
          })}
        </ol>
      </section>

      {(generalQuestions.length > 0 || questionSlot) && (
        <section className="card flex flex-col gap-3 p-5" aria-labelledby="questions-heading">
          <h2 id="questions-heading" className="font-display-tight text-lg">{t("askTitle")}</h2>
          {generalQuestions.length > 0 && <QuestionList questions={generalQuestions} timeZone={timeZone} />}
          {questionSlot?.(null)}
        </section>
      )}
    </div>
  );
}

async function QuestionList({
  questions,
  timeZone,
}: {
  questions: { id: string; question: string; answer: string; created_at: string }[];
  timeZone: string;
}) {
  const t = await getTranslations("bloom");
  return (
    <ul className="flex flex-col gap-3">
      {questions.map((q) => (
        <li key={q.id} className="flex flex-col gap-2">
          <div className="self-end rounded-2xl rounded-br-md bg-surface-2 px-4 py-2.5 text-[15px] sm:max-w-[85%]">
            <p className="whitespace-pre-wrap">{q.question}</p>
            <p className="mt-1 text-right text-[11px] text-soft">{formatDateTime(q.created_at, timeZone)}</p>
          </div>
          <div className="rounded-2xl rounded-bl-md border border-dashed border-ai/40 bg-violet/10 px-4 py-2.5 text-[15px] sm:max-w-[85%]">
            <p className="label-caps mb-1 text-ai">
              <span aria-hidden="true">✦ </span>
              {t("bloomSays")}
            </p>
            <p className="whitespace-pre-wrap">{q.answer}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

const EVENT_STYLE: Record<TimelineEvent["kind"], { icon: IconName; tone: string }> = {
  submitted: { icon: "inbox", tone: "bg-sun/20 text-warning" },
  reviewed_done: { icon: "check", tone: "bg-lime/20 text-success" },
  reviewed_changes: { icon: "alert", tone: "bg-coral/15 text-danger" },
  feedback: { icon: "user", tone: "bg-cyan/15 text-info" },
  card: { icon: "card", tone: "bg-cyan/15 text-info" },
  project: { icon: "folder", tone: "bg-violet/15 text-ai" },
  path_started: { icon: "sparkle", tone: "bg-violet/15 text-ai" },
  path_completed: { icon: "sparkle", tone: "bg-lime/20 text-success" },
  task_done: { icon: "check", tone: "bg-lime/20 text-success" },
  question: { icon: "search", tone: "bg-violet/15 text-ai" },
};

/** "What has this student done?" — newest first, grouped by day. */
export async function Timeline({
  events,
  timeZone,
  limit,
  emptyText,
}: {
  events: TimelineEvent[];
  timeZone: string;
  limit?: number;
  emptyText?: string;
}) {
  const t = await getTranslations("timeline");
  const shown = limit ? events.slice(0, limit) : events;
  if (shown.length === 0) return <p className="text-sm text-muted">{emptyText ?? t("empty")}</p>;

  const groups = new Map<string, TimelineEvent[]>();
  for (const e of shown) {
    const day = formatDate(e.at, timeZone);
    groups.set(day, [...(groups.get(day) ?? []), e]);
  }

  return (
    <div className="flex flex-col gap-4">
      {[...groups.entries()].map(([day, items]) => (
        <section key={day} className="flex flex-col gap-1">
          <h3 className="label-caps text-soft">{day}</h3>
          <ol className="relative flex flex-col">
            {items.map((e) => {
              const style = EVENT_STYLE[e.kind];
              const body = (
                <>
                  <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${style.tone}`} aria-hidden="true">
                    <Icon name={style.icon} size={16} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[15px]">
                      <span className="text-muted">{t(`kinds.${e.kind}`)} </span>
                      <span className="font-medium">{e.kind === "card" ? t("weekN", { week: e.title }) : e.title}</span>
                    </span>
                    {e.detail && <span className="line-clamp-2 text-[13px] text-soft">{e.detail}</span>}
                  </span>
                </>
              );
              return (
                <li key={e.id}>
                  {e.href ? (
                    <Link href={e.href} className="flex items-start gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-surface-2">
                      {body}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 px-2 py-2">{body}</div>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}

/** "Active today / 3 days ago / no activity yet" with a warning colour after a week. */
export async function LastActive({ at }: { at: string | null }) {
  const t = await getTranslations("timeline");
  if (!at) return <span className="text-soft">{t("neverActive")}</span>;
  const days = daysSince(at) ?? 0;
  const label = days <= 0 ? t("activeToday") : t("activeDaysAgo", { days });
  return <span className={days >= 7 ? "text-danger" : days >= 4 ? "text-warning" : "text-success"}>{label}</span>;
}

/** Compact list of a student's paths, for mentor, parent and admin views. */
export async function BloomPathList({ paths, hrefFor }: { paths: BloomPath[]; hrefFor: (pathId: string) => string }) {
  const t = await getTranslations("bloom");
  if (paths.length === 0) return <p className="text-sm text-muted">{t("noPathsYet")}</p>;
  return (
    <ul className="-mx-3 flex flex-col">
      {paths.map((p) => (
        <li key={p.id}>
          <Link href={hrefFor(p.id)} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-surface-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet/15 text-ai" aria-hidden="true">
              <Icon name="sparkle" size={16} />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-medium">{p.title}</span>
              <span className="text-[13px] text-soft">
                {t("tasksDone", { done: p.done, total: p.total })}
                {p.mentor_note ? ` · ${t("hasMentorNote")}` : ""}
              </span>
            </span>
            <PathStatusBadge status={p.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
