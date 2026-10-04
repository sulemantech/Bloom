"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { sendSignInLink, studentSignIn, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForms({ linkError }: { linkError: boolean }) {
  const t = useTranslations("login");
  const [tab, setTab] = useState<"adult" | "student">("adult");
  const [linkState, linkAction, linkPending] = useActionState(sendSignInLink, initial);
  const [studentState, studentAction, studentPending] = useActionState(studentSignIn, initial);

  return (
    <div className="card flex flex-col gap-6 p-6 sm:p-8">
      <div role="tablist" aria-label={t("chooseAccount")} className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
        {(["adult", "student"] as const).map((key) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              tab === key ? "bg-surface text-text shadow-sm" : "text-muted hover:text-text"
            }`}
          >
            {t(key === "adult" ? "tabAdult" : "tabStudent")}
          </button>
        ))}
      </div>

      {linkError && (
        <p role="alert" className="rounded-xl bg-coral/15 px-4 py-3 text-sm text-danger">
          {t("linkExpired")}
        </p>
      )}

      {tab === "adult" ? (
        linkState.status === "sent" ? (
          <div role="status" className="flex flex-col gap-2">
            <p className="font-display-tight text-lg">{t("checkEmailTitle")}</p>
            <p className="text-muted">{t("checkEmailBody")}</p>
          </div>
        ) : (
          <form action={linkAction} className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t("adultIntro")}</p>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">{t("email")}</span>
              <input name="email" type="email" autoComplete="email" required className="field" />
            </label>
            {linkState.status === "error" && (
              <p role="alert" className="text-sm text-danger">{t(`errors.${linkState.message}`)}</p>
            )}
            <button type="submit" disabled={linkPending} className="btn btn-primary">
              {linkPending ? t("sending") : t("sendLink")}
            </button>
          </form>
        )
      ) : (
        <form action={studentAction} className="flex flex-col gap-4">
          <p className="text-sm text-muted">{t("studentIntro")}</p>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("username")}</span>
            <input
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              className="field"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">{t("password")}</span>
            <input name="password" type="password" autoComplete="current-password" required className="field" />
          </label>
          {studentState.status === "error" && (
            <p role="alert" className="text-sm text-danger">{t(`errors.${studentState.message}`)}</p>
          )}
          <button type="submit" disabled={studentPending} className="btn btn-primary">
            {studentPending ? t("signingIn") : t("signIn")}
          </button>
          <p className="text-[13px] text-soft">{t("forgotStudent")}</p>
        </form>
      )}
    </div>
  );
}
