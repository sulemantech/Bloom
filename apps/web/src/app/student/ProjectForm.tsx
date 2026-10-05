"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { Database } from "@/lib/supabase/database.types";
import { saveProject, type ActionState } from "./actions";

type Project = Database["public"]["Tables"]["projects"]["Row"];

const AREAS = [
  { key: "technology", tone: "has-[:checked]:bg-cyan/15 has-[:checked]:text-info" },
  { key: "design", tone: "has-[:checked]:bg-violet/15 has-[:checked]:text-ai" },
  { key: "business", tone: "has-[:checked]:bg-sun/15 has-[:checked]:text-warning" },
  { key: "social_impact", tone: "has-[:checked]:bg-coral/15 has-[:checked]:text-danger" },
  { key: "undecided", tone: "has-[:checked]:bg-soft/10 has-[:checked]:text-text" },
] as const;
const STATUSES = ["exploring", "chosen", "building", "presenting", "done"] as const;
const initial: ActionState = { status: "idle" };

export function ProjectForm({ cohortId, project }: { cohortId: string; project: Project | null }) {
  const t = useTranslations("project");
  const [state, action, pending] = useActionState(saveProject, initial);

  return (
    <form action={action} className="card flex flex-col gap-5 p-6">
      <input type="hidden" name="cohortId" value={cohortId} />

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">{t("area")}</legend>
        <div className="flex flex-wrap gap-2">
          {AREAS.map(({ key, tone }) => (
            <label
              key={key}
              className={`cursor-pointer rounded-full border border-border px-4 py-2 text-sm font-medium text-muted transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-cyan ${tone}`}
            >
              <input
                type="radio"
                name="area"
                value={key}
                defaultChecked={(project?.area ?? "undecided") === key}
                className="sr-only"
              />
              {t(`areas.${key}`)}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("title")}</span>
        <input name="title" defaultValue={project?.title ?? ""} maxLength={120} placeholder={t("titlePlaceholder")} className="field" />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{t("problem")}</span>
        <textarea
          name="problem"
          rows={4}
          defaultValue={project?.problem ?? ""}
          maxLength={2000}
          placeholder={t("problemPlaceholder")}
          className="field resize-y"
        />
      </label>

      <label className="flex flex-col gap-1.5 sm:max-w-xs">
        <span className="text-sm font-medium">{t("status")}</span>
        <select name="status" defaultValue={project?.status ?? "exploring"} className="field">
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`statuses.${s}`)}
            </option>
          ))}
        </select>
      </label>

      {state.status === "error" && <p role="alert" className="text-sm text-danger">{t("error")}</p>}
      {state.status === "ok" && <p role="status" className="text-sm text-success">{t("saved")}</p>}

      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? t("saving") : t("save")}
      </button>
    </form>
  );
}
