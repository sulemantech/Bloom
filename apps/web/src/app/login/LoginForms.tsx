"use client";

import { useActionState, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Spinner } from "@/components/ui/SubmitButton";
import type { DemoRole } from "@/lib/demo";
import { demoSignIn, devPasswordSignIn, sendSignInLink, studentSignIn, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

const DEMO_STYLE: Record<DemoRole, { icon: IconName; tint: string }> = {
  student: { icon: "sparkle", tint: "bg-violet/15 text-ai" },
  parent: { icon: "users", tint: "bg-cyan/15 text-info" },
  mentor: { icon: "user", tint: "bg-lime/25 text-success" },
  admin: { icon: "settings", tint: "bg-sun/25 text-warning" },
};

/** A text field with an icon on the left and an optional button on the right. */
function Field({ label, icon, trailing, ...input }: { label: string; icon: IconName; trailing?: ReactNode } & React.ComponentProps<"input">) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <span className="relative">
        <Icon name={icon} size={18} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-soft" />
        <input {...input} className={`field pl-11 ${trailing ? "pr-12" : ""}`} />
        {trailing && <span className="absolute top-1/2 right-1.5 -translate-y-1/2">{trailing}</span>}
      </span>
    </label>
  );
}

function PasswordField({ label, name = "password" }: { label: string; name?: string }) {
  const t = useTranslations("login");
  const [shown, setShown] = useState(false);
  return (
    <Field
      label={label}
      icon="lock"
      name={name}
      type={shown ? "text" : "password"}
      autoComplete="current-password"
      required
      trailing={
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-label={shown ? t("hidePassword") : t("showPassword")}
          aria-pressed={shown}
          className="flex size-9 items-center justify-center rounded-lg text-soft transition-colors hover:bg-surface-2 hover:text-text"
        >
          <Icon name={shown ? "eyeOff" : "eye"} size={18} />
        </button>
      }
    />
  );
}

function Submit({ pending, idle, busy, variant = "primary" }: { pending: boolean; idle: string; busy: string; variant?: "primary" | "secondary" }) {
  return (
    <button type="submit" disabled={pending} className={`btn btn-${variant} w-full`}>
      {pending && <Spinner />}
      {pending ? busy : idle}
    </button>
  );
}

function ErrorText({ state }: { state: LoginState }) {
  const t = useTranslations("login");
  if (state.status !== "error") return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-xl bg-coral/12 px-3 py-2.5 text-sm text-danger">
      <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
      {t(`errors.${state.message}`)}
    </p>
  );
}

export function LoginForms({
  linkError,
  devPasswordLogin,
  demoRoles,
}: {
  linkError: boolean;
  devPasswordLogin: boolean;
  /** Demo accounts offered as one-click buttons (lib/demo); empty hides the panel. */
  demoRoles: DemoRole[];
}) {
  const t = useTranslations("login");
  const [tab, setTab] = useState<"adult" | "student">("adult");
  const [linkState, linkAction, linkPending] = useActionState(sendSignInLink, initial);
  const [studentState, studentAction, studentPending] = useActionState(studentSignIn, initial);
  const [devState, devAction, devPending] = useActionState(devPasswordSignIn, initial);
  const [demoState, demoAction, demoPending] = useActionState(demoSignIn, initial);
  const [picked, setPicked] = useState<DemoRole | null>(null);
  // After "Check your email", the student can go back and use a different address.
  const [editingEmail, setEditingEmail] = useState(false);
  const linkSent = linkState.status === "sent" && !editingEmail;

  return (
    <div className="flex flex-col gap-5">
      {demoRoles.length > 0 && (
        <>
          <form action={demoAction} className="card flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex flex-col gap-1">
              <p className="label-caps text-ai">{t("demo.eyebrow")}</p>
              <p className="font-display-tight text-lg">{t("demo.title")}</p>
              <p className="text-sm text-muted">{t("demo.intro")}</p>
            </div>
            <div className="flex flex-col gap-2">
              {demoRoles.map((role) => {
                const busy = demoPending && picked === role;
                return (
                  <button
                    key={role}
                    type="submit"
                    name="account"
                    value={role}
                    onClick={() => setPicked(role)}
                    disabled={demoPending}
                    className="group flex items-center gap-3.5 rounded-xl border border-border p-3 text-left transition-all hover:-translate-y-px hover:border-violet/60 hover:bg-violet/5 hover:shadow-sm disabled:translate-y-0 disabled:opacity-60"
                  >
                    <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${DEMO_STYLE[role].tint}`}>
                      <Icon name={DEMO_STYLE[role].icon} size={20} />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-semibold">{t(`demo.as.${role}`)}</span>
                      <span className="text-[13px] leading-snug text-soft">{t(`demo.sees.${role}`)}</span>
                    </span>
                    {busy ? (
                      <Spinner className="size-5 shrink-0 text-ai" />
                    ) : (
                      <Icon name="arrowRight" size={18} className="shrink-0 text-soft transition-transform group-hover:translate-x-0.5 group-hover:text-ai" />
                    )}
                  </button>
                );
              })}
            </div>
            <ErrorText state={demoState} />
            <p className="text-[12px] leading-relaxed text-soft">{t("demo.note")}</p>
          </form>

          <div className="flex items-center gap-3 text-[13px] text-soft" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            {t("demo.or")}
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <div className="card flex flex-col gap-6 p-5 sm:p-7">
        <div role="tablist" aria-label={t("chooseAccount")} className="relative grid grid-cols-2 rounded-full bg-surface-2 p-1">
          <span
            aria-hidden="true"
            className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-surface shadow-sm ring-1 ring-border transition-transform duration-300 ease-out ${
              tab === "student" ? "translate-x-full" : ""
            }`}
          />
          {(["adult", "student"] as const).map((key) => (
            <button
              key={key}
              role="tab"
              type="button"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`relative z-10 rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === key ? "text-text" : "text-muted hover:text-text"
              }`}
            >
              {t(key === "adult" ? "tabAdult" : "tabStudent")}
            </button>
          ))}
        </div>

        {linkError && (
          <p role="alert" className="flex items-start gap-2 rounded-xl bg-coral/12 px-3 py-2.5 text-sm text-danger">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            {t("linkExpired")}
          </p>
        )}

        {tab === "adult" && (
          <div key="adult" className="animate-rise flex flex-col gap-5">
            {linkSent ? (
              <div role="status" className="flex flex-col items-center gap-3 py-2 text-center">
                <span className="flex size-14 items-center justify-center rounded-full bg-lime/20 text-success">
                  <Icon name="mail" size={26} />
                </span>
                <p className="font-display-tight text-xl">{t("checkEmailTitle")}</p>
                <p className="text-sm leading-relaxed text-muted">{t("checkEmailBody")}</p>
                <button type="button" onClick={() => setEditingEmail(true)} className="text-sm font-medium text-info underline-offset-2 hover:underline">
                  {t("useDifferentEmail")}
                </button>
              </div>
            ) : (
              <form action={linkAction} onSubmit={() => setEditingEmail(false)} className="flex flex-col gap-4">
                <p className="text-sm leading-relaxed text-muted">
                  {t("adultIntro")} <span className="text-soft">{t("staffHint")}</span>
                </p>
                <Field label={t("email")} icon="mail" name="email" type="email" autoComplete="email" placeholder={t("emailPlaceholder")} required />
                <ErrorText state={linkState} />
                <Submit pending={linkPending} idle={t("sendLink")} busy={t("sending")} />
              </form>
            )}

            {devPasswordLogin && (
              <form action={devAction} className="flex flex-col gap-3 rounded-xl border border-dashed border-warning/40 bg-sun/5 p-4">
                <p className="label-caps text-warning">{t("devTitle")}</p>
                <Field label={t("email")} icon="mail" name="email" type="email" autoComplete="username" required />
                <PasswordField label={t("password")} />
                <ErrorText state={devState} />
                <Submit pending={devPending} idle={t("signIn")} busy={t("signingIn")} variant="secondary" />
              </form>
            )}
          </div>
        )}

        {tab === "student" && (
          <form key="student" action={studentAction} className="animate-rise flex flex-col gap-4">
            <p className="text-sm leading-relaxed text-muted">{t("studentIntro")}</p>
            <Field
              label={t("username")}
              icon="user"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
            <PasswordField label={t("password")} />
            <ErrorText state={studentState} />
            <Submit pending={studentPending} idle={t("signIn")} busy={t("signingIn")} />
            <p className="text-center text-[13px] text-soft">{t("forgotStudent")}</p>
          </form>
        )}
      </div>
    </div>
  );
}
