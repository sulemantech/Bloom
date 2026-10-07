import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ProgressBar } from "@/components/course";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Badge, STEP_TONE, type Tone } from "@/components/ui/Badge";
import { checkAnswers, checkQuestions, checkReview, hasAnswers, stepStates, type CheckReview, type StepState, type Verdict } from "@/lib/bloom/adaptive";
import { parseDetails } from "@/lib/bloom/details";
import type { LearnerState } from "@/lib/bloom/learner";
import { daysSince, type BloomPath, type TimelineEvent } from "@/lib/data/bloom";
import { formatDate, formatDateTime } from "@/lib/programme";

const PATH_STATUS_TONE: Record<BloomPath["status"], Tone> = { active: "cyan", completed: "lime", archived: "neutral" };

type Task = BloomPath["tasks"][number];

/** Step number circles: done (tick), the one to do now (filled), later (plain). */
const STEP_DOT: Record<StepState, string> = {
  done: "bg-lime/25 text-success",
  current: "bg-violet text-white ring-4 ring-violet/25",
  upcoming: "bg-surface-2 text-muted",
};

const FEELING_TEXT: Record<NonNullable<Task["feeling"]>, string> = {
  too_easy: "text-info",
  just_right: "text-success",
  too_hard: "text-warning",
};

const VERDICT_STYLE: Record<Verdict, string> = {
  nailed: "bg-lime/25 text-success",
  nearly: "bg-sun/25 text-warning",
  not_yet: "bg-coral/15 text-danger",
};

/** "2 of 3 nailed" next to a finished step's title. */
async function MarksSummary({ review }: { review: CheckReview[] | null }) {
  const t = await getTranslations("bloom");
  if (!review?.length) return null;
  const nailed = review.filter((r) => r.verdict === "nailed").length;
  return (
    <>
      <span aria-hidden="true">·</span>
      <span className={nailed === review.length ? "text-success" : "text-soft"}>{t("checks.summary", { nailed, total: review.length })}</span>
    </>
  );
}

/**
 * Check your understanding. Unfinished steps list the questions for viewers (the student answers
 * them in the finish form); finished steps show each answer with Spark's review.
 */
async function Checks({ task, showMarks, forStudent }: { task: Task; showMarks: boolean; forStudent: boolean }) {
  const t = await getTranslations("bloom");
  const questions = checkQuestions(task.check_questions);
  if (!questions.length || task.planned_only) return null;
  if (task.status !== "done") {
    if (forStudent) return null;
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-ai/25 bg-violet/5 p-4">
        <p className="label-caps text-ai">{t("checks.title")}</p>
        <ol className="flex flex-col gap-1.5 text-[15px]">
          {questions.map((q, i) => (
            <li key={i}>
              <span className="mr-1.5 font-semibold text-ai">{i + 1}.</span>
              {q.question}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  const answers = checkAnswers(task.check_answers);
  const review = checkReview(task.check_review);
  if (!hasAnswers(answers) && !review) return null;
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-ai/25 bg-violet/5 p-4">
      <p className="label-caps text-ai">
        <span aria-hidden="true">✦ </span>
        {t("checks.title")}
      </p>
      <ol className="flex flex-col gap-4">
        {questions.map((q, i) => {
          const answer = answers?.[i];
          const r = review?.[i];
          return (
            <li key={i} className="flex flex-col gap-1.5">
              <p className="text-[15px] font-medium">
                <span className="mr-1.5 text-ai">{i + 1}.</span>
                {q.question}
              </p>
              <div className="flex flex-col gap-1 rounded-lg bg-surface px-3 py-2">
                <p className="label-caps text-soft">{forStudent ? t("checks.yourAnswer") : t("checks.theirAnswer")}</p>
                <p className={`whitespace-pre-wrap text-[15px] ${answer ? "" : "text-soft italic"}`}>{answer || t("checks.notAnswered")}</p>
              </div>
              {showMarks && r && (
                <div className="flex flex-col gap-1">
                  {answer && <span className={`self-start rounded-full px-2.5 py-0.5 text-[13px] font-semibold ${VERDICT_STYLE[r.verdict]}`}>{t(`checks.verdicts.${r.verdict}`)}</span>}
                  {answer && r.feedback && <p className="text-[15px]">{r.feedback}</p>}
                  {r.key_idea && (
                    <p className="text-sm text-muted">
                      <span className="font-semibold">{t("checks.keyIdea")}: </span>
                      {r.key_idea}
                    </p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {showMarks && !review && hasAnswers(answers) && (
        <p className="text-[13px] text-soft">{forStudent ? t("checks.pending") : t("checks.pendingViewer")}</p>
      )}
    </div>
  );
}

/** Spark's response: what it changed in this step, and the feedback it was answering. */
async function Adaptation({ task, source, sourceNumber, forStudent }: { task: Task; source: Task; sourceNumber: number; forStudent: boolean }) {
  const t = await getTranslations("bloom");
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-ai/30 bg-violet/10 p-4">
      <p className="label-caps text-ai">
        <span aria-hidden="true">✦ </span>
        {t("adaptedTitle")}
      </p>
      {(source.feeling || source.reflection) && (
        <p className="text-sm text-muted">
          <a href={`#task-${source.id}`} className="underline">{t(forStudent ? "adaptedBecause" : "adaptedBecauseViewer", { n: sourceNumber })}</a>{" "}
          {source.feeling && <span className="font-medium">{t(`feelings.${source.feeling}`)}</span>}
          {source.feeling && source.reflection && " · "}
          {source.reflection && <span>“{source.reflection}”</span>}
        </p>
      )}
      <p className="text-[15px]">{task.adaptation}</p>
    </div>
  );
}

/** Step instructions as readable blocks: paragraphs, numbered actions and labelled notes. */
async function StepDetails({ text }: { text: string }) {
  const t = await getTranslations("bloom");
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed">
      {parseDetails(text).map((block, i) => {
        if (block.type === "text") return <p key={i}>{block.text}</p>;
        if (block.type === "steps") {
          return (
            <ol key={i} className="flex flex-col gap-2">
              {block.items.map((item, j) => (
                <li key={j} className="flex gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[13px] font-semibold text-muted">
                    {j + 1}
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ol>
          );
        }
        return (
          <p key={i} className={`rounded-xl px-3 py-2 text-sm ${block.type === "tip" ? "bg-lime/15" : "bg-surface-2"}`}>
            <span className="font-semibold">{t(`detailLabels.${block.type}`)}: </span>
            {block.text}
          </p>
        );
      })}
    </div>
  );
}

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
  showMarks = true,
}: {
  path: PathDetail;
  timeZone: string;
  taskControls?: (task: BloomPath["tasks"][number]) => ReactNode;
  mentorSlot?: ReactNode;
  questionSlot?: (taskId: string | null) => ReactNode;
  /** Show Spark's marks on check answers (students, mentors, admins); parents see the answers only. */
  showMarks?: boolean;
}) {
  const t = await getTranslations("bloom");
  const generalQuestions = path.questions.filter((q) => !q.task_id);
  const states = stepStates(path.tasks);
  const number = new Map(path.tasks.map((task, i) => [task.id, i + 1]));
  const current = path.tasks.find((task) => states.get(task.id) === "current");
  // Which later step Spark wrote from each finished step's feedback.
  const usedBy = new Map(path.tasks.filter((task) => task.adapted_from).map((task) => [task.adapted_from!, task]));
  // The step finished most recently stays open, so its feedback and review are in view.
  const latestDone = path.tasks
    .filter((task) => task.status === "done" && task.completed_at)
    .sort((a, b) => b.completed_at!.localeCompare(a.completed_at!))[0];

  return (
    <div className="flex flex-col gap-5">
      <section className="card flex flex-col gap-4 p-5 sm:p-6">
        {path.summary && <p className="text-[15px] leading-relaxed">{path.summary}</p>}
        {path.tasks.length > 0 && (
          <div className="flex flex-col gap-3">
            <p className="font-display-tight text-[17px]">
              {current ? t("stepOf", { n: number.get(current.id)!, total: path.total }) : t("allStepsDone")}
            </p>
            <ProgressBar value={path.done} max={path.total} label={t("tasksDone", { done: path.done, total: path.total })} />
            <ol className="flex flex-wrap gap-2" aria-label={t("tasks")}>
              {path.tasks.map((task) => {
                const state = states.get(task.id)!;
                return (
                  <li key={task.id}>
                    <a
                      href={`#task-${task.id}`}
                      title={task.title}
                      aria-label={`${t("stepN", { n: number.get(task.id)! })}: ${task.title} (${t(`stepState.${state}`)})`}
                      aria-current={state === "current" ? "step" : undefined}
                      className={`flex size-9 items-center justify-center rounded-full text-sm font-bold transition-colors ${STEP_DOT[state]}`}
                    >
                      {state === "done" ? <Icon name="check" size={16} /> : number.get(task.id)}
                    </a>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
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
          {path.tasks.map((task) => {
            const state = states.get(task.id)!;
            const n = number.get(task.id)!;
            const questions = path.questions.filter((q) => q.task_id === task.id);
            const source = task.adapted_from ? path.tasks.find((s) => s.id === task.adapted_from) : undefined;
            const writtenFrom = usedBy.get(task.id);

            const header = (
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${STEP_DOT[state]}`} aria-hidden="true">
                  {state === "done" ? <Icon name="check" size={16} /> : n}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-2 text-[13px] text-soft">
                    {state === "current" && <Badge tone="violet">{t("now")}</Badge>}
                    <span>{t("stepN", { n })}</span>
                    <span aria-hidden="true">·</span>
                    <span>{t(`kinds.${task.kind}`)}</span>
                    {state === "done" && showMarks && <MarksSummary review={checkReview(task.check_review)} />}
                    {state === "done" && task.feeling && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className={FEELING_TEXT[task.feeling]}>{t("feltIt", { feeling: t(`feelings.${task.feeling}`) })}</span>
                      </>
                    )}
                    {state === "upcoming" && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{t("comingUp")}</span>
                      </>
                    )}
                  </span>
                  <span className={`font-display-tight text-[17px] leading-snug ${state === "current" ? "" : "text-muted"}`}>{task.title}</span>
                </span>
              </div>
            );

            const body = (
              <>
                {source && task.adaptation && <Adaptation task={task} source={source} sourceNumber={number.get(source.id)!} forStudent={Boolean(taskControls)} />}
                {task.planned_only ? (
                  <div className="flex flex-col gap-1">
                    {task.details && <p className="text-[15px] text-muted">{task.details}</p>}
                    <p className="text-[13px] text-ai">
                      <span aria-hidden="true">✦ </span>
                      {taskControls ? t("plannedHint") : t("plannedHintViewer")}
                    </p>
                  </div>
                ) : (
                  task.details && <StepDetails text={task.details} />
                )}
                <Checks task={task} showMarks={showMarks} forStudent={Boolean(taskControls)} />
                {(task.feeling || task.reflection) && (
                  <div className="flex flex-col gap-1.5 rounded-xl bg-surface-2 p-3">
                    <p className="label-caps text-soft">{taskControls ? t("yourFeedback") : t("feedback")}</p>
                    {task.feeling && <p className={`text-sm font-medium ${FEELING_TEXT[task.feeling]}`}>{t("feltIt", { feeling: t(`feelings.${task.feeling}`) })}</p>}
                    {task.reflection && <p className="whitespace-pre-wrap text-[15px]">{task.reflection}</p>}
                    {writtenFrom && (
                      <a href={`#task-${writtenFrom.id}`} className="text-sm font-medium text-ai">
                        <span aria-hidden="true">✦ </span>
                        {t("usedFor", { n: number.get(writtenFrom.id)! })}
                      </a>
                    )}
                  </div>
                )}
                {questions.length > 0 && <QuestionList questions={questions} timeZone={timeZone} />}
                {taskControls?.(task)}
                {questionSlot?.(task.id)}
              </>
            );

            if (state === "current") {
              return (
                <li key={task.id} id={`task-${task.id}`} className="card flex scroll-mt-6 flex-col gap-4 border-2 border-violet p-5 sm:p-6">
                  <span id="current-step" className="scroll-mt-6" />
                  {header}
                  {body}
                </li>
              );
            }
            // Done and upcoming steps fold away so the current step stands out.
            return (
              <li key={task.id} id={`task-${task.id}`} className={`card scroll-mt-6 ${state === "upcoming" ? "bg-surface-2/40" : ""}`}>
                <details className="group" open={task.id === latestDone?.id}>
                  <summary className="flex cursor-pointer list-none items-center gap-3 p-4 [&::-webkit-details-marker]:hidden">
                    {header}
                    <Icon name="chevron" size={16} className="shrink-0 text-soft transition-transform group-open:rotate-90" />
                  </summary>
                  <div className="flex flex-col gap-3 border-t border-border px-4 pt-3 pb-4">{body}</div>
                </details>
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

// ---------------------------------------------------------------------------
// Learner state: what Spark knows about a student's learning (lib/bloom/learner)
// ---------------------------------------------------------------------------

/** "What Spark knows about you": understood ideas, ideas to work on, step difficulty and next need. */
export async function LearnerStateCard({ state, forStudent }: { state: LearnerState; forStudent: boolean }) {
  const t = await getTranslations("bloom.learner");
  const need = state.nextNeed;
  return (
    <section className="card flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="learner-heading">
      <div className="flex flex-col gap-1">
        <h2 id="learner-heading" className="flex items-center gap-2 font-display-tight text-xl">
          <span aria-hidden="true" className="text-ai">✦</span>
          {forStudent ? t("title") : t("titleViewer")}
        </h2>
        <p className="text-sm text-muted">{forStudent ? t("intro") : t("introViewer")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="label-caps text-success">{t("understands")}</p>
          {state.understands.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {state.understands.map((idea) => (
                <li key={idea} className="rounded-full bg-lime/20 px-3 py-1 text-sm text-success">{idea}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-soft">{t("understandsEmpty")}</p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="label-caps text-warning">{t("workingOn")}</p>
          {state.strugglesWith.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {state.strugglesWith.map(({ idea, times }) => (
                <li key={idea} className="rounded-full bg-sun/20 px-3 py-1 text-sm text-warning">
                  {idea}
                  {times > 1 && <span className="ml-1 opacity-70">{t("times", { times })}</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-soft">{t("workingOnEmpty")}</p>
          )}
        </div>
      </div>

      <dl className="grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
        <div className="flex flex-col gap-0.5">
          <dt className="text-soft">{t("difficultyLabel")}</dt>
          <dd className="font-medium">{t(`difficulty.${state.difficulty}`)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-soft">{t("nextLabel")}</dt>
          <dd className="font-medium">
            {need?.kind === "practise"
              ? t("nextPractise", { idea: need.idea })
              : need?.kind === "activity"
                ? t(need.overdue ? "nextActivityOverdue" : "nextActivity", { title: need.title, week: need.week })
                : t("nextNone")}
          </dd>
        </div>
      </dl>
    </section>
  );
}
