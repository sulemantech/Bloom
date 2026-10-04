"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { addChild, type FormState } from "./actions";

const initial: FormState = { status: "idle" };

export function AddChildForm() {
  const t = useTranslations("parent.addChild");
  const [state, action, pending] = useActionState(addChild, initial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "ok") formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="card flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-display-tight text-lg">{t("title")}</h2>
        <p className="text-sm text-muted">{t("intro")}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("fullName")}</span>
          <input name="fullName" autoComplete="off" required className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("birthYear")}</span>
          <input name="birthYear" type="number" inputMode="numeric" required className="field" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("username")}</span>
          <input
            name="username"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            required
            className="field"
          />
          <span className="text-[13px] text-soft">{t("usernameHint")}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t("password")}</span>
          <input name="password" type="password" autoComplete="new-password" minLength={8} required className="field" />
          <span className="text-[13px] text-soft">{t("passwordHint")}</span>
        </label>
      </div>

      <label className="flex items-start gap-3 rounded-xl bg-surface-2 p-4">
        <input name="consent" type="checkbox" required className="mt-1 size-4 accent-cyan" />
        <span className="text-sm text-muted">
          {t.rich("consent", {
            link: (chunks) => (
              <Link href="/privacy" target="_blank" className="font-medium text-info underline">
                {chunks}
              </Link>
            ),
          })}
        </span>
      </label>

      {state.status === "error" && (
        <p role="alert" className="text-sm text-danger">{t(`errors.${state.message}`)}</p>
      )}
      {state.status === "ok" && (
        <p role="status" className="text-sm text-success">{t("created")}</p>
      )}

      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? t("creating") : t("submit")}
      </button>
    </form>
  );
}
