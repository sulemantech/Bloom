"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  addTask,
  askQuestion,
  createPath,
  deletePath,
  setPathStatus,
  suggestPaths,
  updateTask,
  writeNextStep,
  type BloomState,
  type SuggestState,
} from "./actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { CheckQuestion } from "@/lib/bloom/adaptive";

const initial: BloomState = { status: "idle" };

function Message({ state }: { state: BloomState }) {
  const t = useTranslations("bloom");
  if (state.status === "error") return <p role="alert" className="text-sm text-danger">{t(`errors.${state.message ?? "failed"}`)}</p>;
  if (state.status === "ok" && state.message) return <p role="status" className="text-sm text-success">{t(`ok.${state.message}`)}</p>;
  return null;
}

/** Clears the form after a successful submit. */
function useReset(state: BloomState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") ref.current?.reset();
  }, [state]);
  return ref;
}

const DEPTHS = ["quick", "standard", "deep"] as const;

function DepthPicker({ name = "depth" }: { name?: string }) {
  const t = useTranslations("bloom");
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{t("depth")}</legend>
      <div className="grid grid-cols-3 gap-2">
        {DEPTHS.map((d) => (
          <label key={d} className="cursor-pointer">
            <input type="radio" name={name} value={d} defaultChecked={d === "standard"} className="peer sr-only" />
            <span className="flex flex-col items-center gap-0.5 rounded-xl border border-border px-2 py-2.5 text-center transition-colors peer-checked:border-violet peer-checked:bg-violet/10 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan">
              <span className="text-sm font-semibold">{t(`depths.${d}`)}</span>
              <span className="text-[12px] text-soft">{t(`depthHints.${d}`)}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Starting something new: Bloom suggests three ideas (when AI is allowed), or the student
 * writes their own topic. Either way, Bloom can plan the steps.
 */
export function StartPath({ aiAllowed }: { aiAllowed: boolean }) {
  const t = useTranslations("bloom");
  const [suggestState, suggest, suggesting] = useActionState(suggestPaths, { status: "idle" } as SuggestState);
  const [createState, create, creating] = useActionState(createPath, initial);
  const [own, setOwn] = useState(!aiAllowed);

  return (
    <div className="flex flex-col gap-4">
      {aiAllowed && !own && (
        <form action={suggest} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("curious")}</span>
            <input name="interest" maxLength={300} placeholder={t("curiousPlaceholder")} className="field" />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton icon={<span aria-hidden="true">✦</span>} pendingLabel={t("thinking")} disabled={creating}>
              {suggestState.suggestions ? t("suggestAgain") : t("suggest")}
            </SubmitButton>
            <button type="button" onClick={() => setOwn(true)} disabled={suggesting} className="text-sm font-medium text-info underline disabled:opacity-50">
              {t("writeOwn")}
            </button>
          </div>
          <Message state={suggestState} />
        </form>
      )}

      {!own && suggestState.suggestions && (
        <ul className="grid gap-3 md:grid-cols-3">
          {suggestState.suggestions.map((s) => (
            <li key={s.title}>
              <form action={create} className="flex h-full flex-col gap-2 rounded-2xl border border-dashed border-ai/50 bg-violet/5 p-4">
                <input type="hidden" name="title" value={s.title} />
                <input type="hidden" name="goal" value={s.goal} />
                <input type="hidden" name="depth" value="standard" />
                <input type="hidden" name="useAi" value="on" />
                <p className="font-display-tight text-[17px] leading-snug">{s.title}</p>
                <p className="text-sm">{s.goal}</p>
                <p className="text-[13px] text-soft">{s.why}</p>
                <SubmitButton pendingLabel={t("planning")} disabled={creating || suggesting} className="btn btn-secondary mt-auto px-4 py-2 text-sm">
                  {t("startThis")}
                </SubmitButton>
              </form>
            </li>
          ))}
        </ul>
      )}

      {own && (
        <form action={create} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("pathTitle")}</span>
            <input name="title" required maxLength={120} placeholder={t("pathTitlePlaceholder")} className="field" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("goal")}</span>
            <textarea name="goal" rows={2} maxLength={1000} placeholder={t("goalPlaceholder")} className="field resize-y" />
          </label>
          <DepthPicker />
          {aiAllowed ? (
            <label className="flex items-start gap-3 rounded-xl bg-violet/10 p-3">
              <input name="useAi" type="checkbox" defaultChecked className="mt-1 size-4 accent-violet" />
              <span className="text-sm">{t("letBloomPlan")}</span>
            </label>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel={t("planning")}>{t("createPath")}</SubmitButton>
            {aiAllowed && (
              <button type="button" onClick={() => setOwn(false)} className="text-sm font-medium text-info underline">
                {t("backToIdeas")}
              </button>
            )}
          </div>
        </form>
      )}
      <Message state={createState} />
      {(creating || suggesting) && aiAllowed && <p className="text-[13px] text-soft">{t("aiWait")}</p>}
    </div>
  );
}

const FEELINGS = ["too_easy", "just_right", "too_hard"] as const;

/** "How did this step go?" — steers how Spark writes the next step. */
function FeelingPicker() {
  const t = useTranslations("bloom");
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium">{t("feeling")}</legend>
      <div className="grid grid-cols-3 gap-2">
        {FEELINGS.map((f) => (
          <label key={f} className="cursor-pointer">
            <input type="radio" name="feeling" value={f} className="peer sr-only" />
            <span className="flex justify-center rounded-xl border border-border px-2 py-2 text-center text-sm font-medium transition-colors peer-checked:border-violet peer-checked:bg-violet/10 peer-focus-visible:ring-2 peer-focus-visible:ring-cyan">
              {t(`feelings.${f}`)}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Answer boxes for the step's check questions; optional, sent in question order as "answer". */
function CheckAnswers({ checks, answers }: { checks: CheckQuestion[]; answers: string[] | null }) {
  const t = useTranslations("bloom");
  return (
    <fieldset className="flex flex-col gap-3 rounded-xl border border-ai/25 bg-violet/5 p-4">
      <legend className="sr-only">{t("checks.title")}</legend>
      <div className="flex flex-col gap-0.5">
        <p className="flex items-center gap-1.5 font-semibold">
          <span aria-hidden="true" className="text-ai">✦</span>
          {t("checks.title")}
          <span className="text-sm font-normal text-soft">{t("checks.optional")}</span>
        </p>
        <p className="text-[13px] text-muted">{t("checks.hint")}</p>
      </div>
      {checks.map((check, i) => (
        <label key={i} className="flex flex-col gap-1.5">
          <span className="text-[15px]">
            <span className="mr-1.5 font-semibold text-ai">{i + 1}.</span>
            {check.question}
          </span>
          <textarea name="answer" rows={2} maxLength={1000} defaultValue={answers?.[i] ?? ""} placeholder={t("checks.placeholder")} className="field resize-y" />
        </label>
      ))}
    </fieldset>
  );
}

/**
 * Start, finish (with an optional reflection) or reopen one task. With `adaptive`, finishing asks
 * how the step went and what to do next, so Spark can write the next step from it; `writesNext`
 * says Spark will write it right away.
 */
export function TaskControls({
  task,
  adaptive = false,
  writesNext = false,
  checks = [],
  answers = null,
}: {
  task: { id: string; status: "todo" | "doing" | "done"; reflection: string | null; kind: string; feeling: string | null };
  adaptive?: boolean;
  writesNext?: boolean;
  /** "Check your understanding" questions to answer when finishing (optional for the student). */
  checks?: CheckQuestion[];
  answers?: string[] | null;
}) {
  const t = useTranslations("bloom");
  const [state, action] = useActionState(updateTask, initial);
  const [open, setOpen] = useState(false);

  if (task.status === "done") {
    return (
      <form action={action} className="flex flex-col gap-2 border-t border-border pt-3">
        <input type="hidden" name="taskId" value={task.id} />
        <input type="hidden" name="status" value="doing" />
        {/* The feedback itself is shown above, with the step (BloomPathDetail). */}
        {task.reflection && <input type="hidden" name="reflection" value={task.reflection} />}
        <SubmitButton className="inline-flex items-center gap-1.5 self-start text-sm font-medium text-info underline disabled:opacity-50">{t("reopen")}</SubmitButton>
        <Message state={state} />
        {state.status === "ok" && state.message === "stepWritten" && (
          <a href="#current-step" className="btn btn-primary self-start px-4 py-2 text-sm">
            {t("seeNext")}
          </a>
        )}
      </form>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 border-t border-border pt-3">
      <input type="hidden" name="taskId" value={task.id} />
      {adaptive && checks.length > 0 && <CheckAnswers checks={checks} answers={answers} />}
      {adaptive && <FeelingPicker />}
      {(open || adaptive || task.kind === "reflect") && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            {task.kind === "reflect" ? t("reflectPrompt") : adaptive ? t("nextPrompt") : t("notePrompt")}
          </span>
          <textarea name="reflection" rows={adaptive ? 2 : 3} maxLength={4000} defaultValue={task.reflection ?? ""} className="field resize-y" />
        </label>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {task.status === "todo" && !adaptive && (
          <SubmitButton name="status" value="doing" className="btn btn-secondary px-4 py-2 text-sm">
            {t("startTask")}
          </SubmitButton>
        )}
        <SubmitButton name="status" value="done" pendingLabel={writesNext ? t("writingNext") : undefined} className="btn btn-primary px-4 py-2 text-sm">
          {t("markDone")}
        </SubmitButton>
        {!open && !adaptive && task.kind !== "reflect" && (
          <button type="button" onClick={() => setOpen(true)} className="text-sm font-medium text-info underline">
            {t("addNote")}
          </button>
        )}
      </div>
      <Message state={state} />
    </form>
  );
}

/** Asks Spark to write the next outline step now (when it couldn't as the last step was finished). */
export function WriteStepButton({ pathId }: { pathId: string }) {
  const t = useTranslations("bloom");
  const [state, action] = useActionState(writeNextStep, initial);
  return (
    <form action={action} className="flex flex-col gap-2 border-t border-border pt-3">
      <input type="hidden" name="pathId" value={pathId} />
      <SubmitButton icon={<span aria-hidden="true">✦</span>} pendingLabel={t("writingNext")} className="btn btn-secondary self-start px-4 py-2 text-sm">
        {t("writeStep")}
      </SubmitButton>
      <Message state={state} />
    </form>
  );
}

export function AddTaskForm({ pathId }: { pathId: string }) {
  const t = useTranslations("bloom");
  const [state, action] = useActionState(addTask, initial);
  const ref = useReset(state);
  return (
    <form ref={ref} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="pathId" value={pathId} />
      <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
        <input name="title" required maxLength={160} placeholder={t("taskTitlePlaceholder")} aria-label={t("taskTitle")} className="field" />
        <select name="kind" defaultValue="do" aria-label={t("taskKind")} className="field">
          {(["learn", "do", "reflect"] as const).map((k) => (
            <option key={k} value={k}>{t(`kinds.${k}`)}</option>
          ))}
        </select>
      </div>
      <textarea name="details" rows={2} maxLength={6000} placeholder={t("taskDetailsPlaceholder")} aria-label={t("taskDetails")} className="field resize-y" />
      <SubmitButton className="btn btn-secondary self-start px-4 py-2 text-sm">{t("addTask")}</SubmitButton>
      <Message state={state} />
    </form>
  );
}

export function AskForm({ pathId, taskId, compact }: { pathId: string; taskId: string | null; compact?: boolean }) {
  const t = useTranslations("bloom");
  const [state, action] = useActionState(askQuestion, initial);
  const ref = useReset(state);
  const [open, setOpen] = useState(!compact);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="self-start text-sm font-medium text-ai">
        <span aria-hidden="true">✦ </span>
        {t("askAboutTask")}
      </button>
    );
  }
  return (
    <form ref={ref} action={action} className="flex flex-col gap-2">
      <input type="hidden" name="pathId" value={pathId} />
      {taskId && <input type="hidden" name="taskId" value={taskId} />}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input name="question" required maxLength={1000} placeholder={t("askPlaceholder")} aria-label={t("askTitle")} className="field" />
        <SubmitButton pendingLabel={t("thinking")} className="btn btn-secondary shrink-0 px-4 py-2 text-sm">
          {t("ask")}
        </SubmitButton>
      </div>
      <Message state={state} />
    </form>
  );
}

export function PathActions({ pathId, status }: { pathId: string; status: "active" | "completed" | "archived" }) {
  const t = useTranslations("bloom");
  const [state, action] = useActionState(setPathStatus, initial);
  const [deleteState, del] = useActionState(deletePath, initial);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form action={action}>
        <input type="hidden" name="pathId" value={pathId} />
        {status === "archived" ? (
          <SubmitButton name="status" value="active" className="btn btn-secondary px-3 py-1.5 text-sm">{t("restore")}</SubmitButton>
        ) : (
          <SubmitButton name="status" value="archived" className="btn btn-secondary px-3 py-1.5 text-sm">{t("archive")}</SubmitButton>
        )}
      </form>
      <form
        action={del}
        onSubmit={(e) => {
          if (!confirm(t("deleteConfirm"))) e.preventDefault();
        }}
      >
        <input type="hidden" name="pathId" value={pathId} />
        <SubmitButton className="inline-flex items-center gap-1.5 px-2 text-sm text-danger underline disabled:opacity-50">{t("delete")}</SubmitButton>
      </form>
      <Message state={state.status === "error" ? state : deleteState} />
    </div>
  );
}
