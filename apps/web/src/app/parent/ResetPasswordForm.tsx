"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { resetChildPassword, type FormState } from "./actions";

const initial: FormState = { status: "idle" };

export function ResetPasswordForm({ studentId }: { studentId: string }) {
  const t = useTranslations("parent.reset");
  const [state, action, pending] = useActionState(resetChildPassword, initial);

  return (
    <details className="group">
      <summary className="cursor-pointer text-sm font-medium text-info">{t("open")}</summary>
      <form action={action} className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
        <input type="hidden" name="studentId" value={studentId} />
        <label className="flex flex-1 flex-col gap-1.5">
          <span className="sr-only">{t("newPassword")}</span>
          <input
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            placeholder={t("newPassword")}
            className="field"
          />
        </label>
        <button type="submit" disabled={pending} className="btn btn-secondary">
          {pending ? t("saving") : t("save")}
        </button>
      </form>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-sm text-danger">{t(`errors.${state.message}`)}</p>
      )}
      {state.status === "ok" && (
        <p role="status" className="mt-2 text-sm text-success">{t("done")}</p>
      )}
    </details>
  );
}
