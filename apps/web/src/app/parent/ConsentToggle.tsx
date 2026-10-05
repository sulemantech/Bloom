"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setConsent, type FormState } from "./actions";

const initial: FormState = { status: "idle" };

/** One optional consent (AI help, public portfolio, Demo Day media) with an on/off switch. */
export function ConsentToggle({ studentId, type, granted }: { studentId: string; type: string; granted: boolean }) {
  const t = useTranslations("consents");
  const [state, action, pending] = useActionState(setConsent, initial);

  return (
    <form action={action} className="flex items-start justify-between gap-4 py-3">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="grant" value={String(!granted)} />
      <div className="flex flex-col gap-0.5">
        <span className="font-medium">{t(`${type}.title`)}</span>
        <span className="text-sm text-muted">{t(`${type}.body`)}</span>
        {state.status === "error" && <span role="alert" className="text-sm text-danger">{t("failed")}</span>}
      </div>
      <button
        type="submit"
        role="switch"
        aria-checked={granted}
        aria-label={t(`${type}.title`)}
        disabled={pending}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${granted ? "bg-gradient-to-r from-lime to-cyan" : "bg-surface-2 ring-1 ring-border"}`}
      >
        <span className={`absolute top-1 size-5 rounded-full bg-white shadow transition-all ${granted ? "left-6" : "left-1"}`} />
      </button>
    </form>
  );
}
