"use client";

import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { addSession, reviewSubmission, saveBloomNote, saveProgressCard, setRecording, type ActionState } from "./actions";

const initial: ActionState = { status: "idle" };

function Feedback({ state, ns }: { state: ActionState; ns: string }) {
  const t = useTranslations(ns);
  if (state.status === "error") return <p role="alert" className="text-sm text-danger">{t(`errors.${state.message}`)}</p>;
  if (state.status === "ok") return <p role="status" className="text-sm text-success">{t(state.message ?? "saved")}</p>;
  return null;
}

/** Mentor feedback on a submission, with a decision. */
export function ReviewForm({ submissionId }: { submissionId: string }) {
  const t = useTranslations("review");
  const [state, action, pending] = useActionState(reviewSubmission, initial);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3 border-t border-border pt-3">
      <input type="hidden" name="submissionId" value={submissionId} />
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("feedback")}</span>
        <textarea name="feedback" rows={3} maxLength={5000} placeholder={t("placeholder")} className="field resize-y" />
      </label>
      <Feedback state={state} ns="review" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="decision" value="done" disabled={pending} className="btn btn-primary px-4 py-2 text-sm">
          {t("markDone")}
        </button>
        <button type="submit" name="decision" value="needs_changes" disabled={pending} className="btn btn-secondary px-4 py-2 text-sm">
          {t("askChanges")}
        </button>
        <button type="submit" name="decision" value="comment" disabled={pending} className="btn btn-secondary px-4 py-2 text-sm">
          {t("commentOnly")}
        </button>
      </div>
    </form>
  );
}

/** Weekly progress card: save as draft or approve for the parent. */
export function ProgressCardForm({
  studentId,
  cohortId,
  week,
  initialBody,
  approved,
  aiDraftSlot,
}: {
  studentId: string;
  cohortId: string;
  week: number;
  initialBody: string;
  approved: boolean;
  aiDraftSlot?: React.ReactNode;
}) {
  const t = useTranslations("cards");
  const [state, action, pending] = useActionState(saveProgressCard, initial);

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="week" value={week} />
      {aiDraftSlot}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("bodyLabel", { week })}</span>
        <textarea
          key={initialBody}
          id={`card-body-${week}`}
          name="body"
          rows={6}
          maxLength={5000}
          defaultValue={initialBody}
          placeholder={t("placeholder")}
          className="field resize-y"
        />
      </label>
      <Feedback state={state} ns="cards" />
      <div className="flex flex-wrap gap-2">
        <button type="submit" name="intent" value="approve" disabled={pending} className="btn btn-primary px-4 py-2 text-sm">
          {approved ? t("updateApproved") : t("approve")}
        </button>
        <button type="submit" name="intent" value="draft" disabled={pending} className="btn btn-secondary px-4 py-2 text-sm">
          {approved ? t("backToDraft") : t("saveDraft")}
        </button>
      </div>
    </form>
  );
}

/** Add a live class session. */
export function SessionForm({ cohortId, timeZone }: { cohortId: string; timeZone: string }) {
  const t = useTranslations("sessionForm");
  const [state, action, pending] = useActionState(addSession, initial);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <input type="hidden" name="cohortId" value={cohortId} />
      <input type="hidden" name="timeZone" value={timeZone} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("startsAt", { zone: timeZone })}</span>
          <input name="startsAt" type="datetime-local" required className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("title")}</span>
          <input name="title" maxLength={120} placeholder={t("titlePlaceholder")} className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("joinUrl")}</span>
          <input name="joinUrl" type="url" placeholder="https://zoom.us/j/…" className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("recordingUrl")}</span>
          <input name="recordingUrl" type="url" placeholder="https://" className="field" />
        </label>
      </div>
      <Feedback state={state} ns="sessionForm" />
      <button type="submit" disabled={pending} className="btn btn-secondary self-start px-4 py-2 text-sm">
        {t("add")}
      </button>
    </form>
  );
}

/** Add a recording link to a session. */
export function RecordingForm({ sessionId }: { sessionId: string }) {
  const t = useTranslations("sessionForm");
  const [state, action, pending] = useActionState(setRecording, initial);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="sessionId" value={sessionId} />
      <input name="recordingUrl" type="url" required placeholder={t("recordingUrl")} aria-label={t("recordingUrl")} className="field max-w-xs py-1.5 text-sm" />
      <button type="submit" disabled={pending} className="btn btn-secondary px-3 py-1.5 text-sm">
        {t("saveRecording")}
      </button>
      <Feedback state={state} ns="sessionForm" />
    </form>
  );
}

/** Encouragement or a nudge on a student's Bloom path; the student and parent see it. */
export function BloomNoteForm({ pathId, note }: { pathId: string; note: string | null }) {
  const t = useTranslations("bloom");
  const [state, action, pending] = useActionState(saveBloomNote, initial);
  return (
    <form action={action} className="mt-2 flex flex-col gap-2">
      <input type="hidden" name="pathId" value={pathId} />
      <textarea
        name="note"
        rows={3}
        maxLength={2000}
        defaultValue={note ?? ""}
        placeholder={t("mentorNotePlaceholder")}
        aria-label={t("mentorNote")}
        className="field resize-y"
      />
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-secondary px-4 py-2 text-sm">{t("saveNote")}</button>
        {state.status === "ok" && <span role="status" className="text-sm text-success">{t("ok.noteSaved")}</span>}
        {state.status === "error" && <span role="alert" className="text-sm text-danger">{t("errors.failed")}</span>}
      </div>
    </form>
  );
}
