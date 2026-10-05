"use client";

import { startTransition, useActionState } from "react";
import { useTranslations } from "next-intl";
import { AiDraft } from "@/components/ui/Badge";
import { draftCardWithAi, type DraftState } from "./actions";

const initial: DraftState = { status: "idle" };

/** Asks the AI for a draft; the mentor copies it into the card, edits it and approves it. */
export function AiDraftButton({ studentId, cohortId, week }: { studentId: string; cohortId: string; week: number }) {
  const t = useTranslations("aiDraft");
  const [state, action, pending] = useActionState(draftCardWithAi, initial);

  function requestDraft() {
    const formData = new FormData();
    formData.set("studentId", studentId);
    formData.set("cohortId", cohortId);
    formData.set("week", String(week));
    startTransition(() => action(formData));
  }

  function applyDraft() {
    const textarea = document.getElementById(`card-body-${week}`) as HTMLTextAreaElement | null;
    if (textarea && state.text) {
      textarea.value = state.text;
      textarea.focus();
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={requestDraft}
          disabled={pending}
          className="btn border border-ai/40 bg-violet/10 px-4 py-2 text-sm text-ai hover:bg-violet/20"
        >
          <span aria-hidden="true">✦</span> {pending ? t("drafting") : t("button")}
        </button>
        <span className="text-[13px] text-soft">{t("hint")}</span>
      </div>
      {state.status === "error" && <p role="alert" className="text-sm text-danger">{t(`errors.${state.message}`)}</p>}
      {state.status === "ok" && state.text && (
        <AiDraft label={t("label")}>
          <p className="whitespace-pre-wrap text-[15px]">{state.text}</p>
          <button type="button" onClick={applyDraft} className="btn btn-secondary mt-3 px-4 py-2 text-sm">
            {t("use")}
          </button>
        </AiDraft>
      )}
    </div>
  );
}
