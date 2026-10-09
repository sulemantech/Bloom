"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { setFeature, type ActionState } from "../actions";

const VALUES = ["default", "on", "off"] as const;
export type SwitchValue = (typeof VALUES)[number];

/**
 * Default · On · Off for one feature, for everyone or one group. "Default" removes the setting,
 * so the group follows everyone (or the feature's built-in default).
 */
export function FeatureSwitch({ featureKey, cohortId, value, label }: { featureKey: string; cohortId?: string; value: SwitchValue; label: string }) {
  const t = useTranslations("adminFeatures");
  const [state, action, pending] = useActionState(setFeature, { status: "idle" } as ActionState);
  return (
    <form action={action} className="flex flex-col items-end gap-1">
      <input type="hidden" name="key" value={featureKey} />
      {cohortId && <input type="hidden" name="cohort" value={cohortId} />}
      <div role="group" aria-label={label} className="inline-flex rounded-full bg-surface-2 p-0.5 text-[13px]">
        {VALUES.map((v) => {
          const active = v === value;
          return (
            <button
              key={v}
              type="submit"
              name="value"
              value={v}
              disabled={pending || active}
              aria-pressed={active}
              className={`rounded-full px-3 py-1 font-medium transition-colors disabled:cursor-default ${
                active
                  ? v === "on"
                    ? "bg-lime/30 text-success"
                    : v === "off"
                      ? "bg-coral/20 text-danger"
                      : "bg-surface text-text shadow-sm"
                  : "text-muted hover:text-text"
              } ${pending && !active ? "opacity-50" : ""}`}
            >
              {t(`values.${v}`)}
            </button>
          );
        })}
      </div>
      {state.status === "error" && <span role="alert" className="text-[12px] text-danger">{t("saveFailed")}</span>}
    </form>
  );
}
