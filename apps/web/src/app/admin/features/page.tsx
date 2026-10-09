import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/lib/auth";
import { FEATURE_KEYS, FEATURES } from "@/lib/features";
import { resolveFlag } from "@/lib/flags-rule";
import { createClient } from "@/lib/supabase/server";
import { FeatureSwitch, type SwitchValue } from "./FeatureSwitch";

export const metadata: Metadata = { title: "Features" };

type Row = { key: string; cohort_id: string | null; enabled: boolean };

const valueOf = (row: Row | undefined): SwitchValue => (!row ? "default" : row.enabled ? "on" : "off");

export default async function FeaturesPage() {
  await requireRole("admin");
  const t = await getTranslations("adminFeatures");
  const supabase = await createClient();
  const [{ data: flags }, { data: cohorts }] = await Promise.all([
    supabase.from("feature_flags").select("key, cohort_id, enabled"),
    supabase.from("cohorts").select("id, name").order("start_date", { ascending: true, nullsFirst: false }),
  ]);
  const rows = flags ?? [];
  const aiOn = resolveFlag(rows.filter((r) => r.key === "ai" && r.cohort_id === null), undefined, FEATURES.ai.default);

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")} />

      {!aiOn && (
        <p role="status" className="card flex items-center gap-2 border-coral/50 bg-coral/10 p-4 text-sm font-medium text-danger">
          <Icon name="alert" size={18} />
          {t("aiPausedBanner")}
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {FEATURE_KEYS.map((key) => {
          const feature = FEATURES[key];
          const own = rows.filter((r) => r.key === key);
          const everyone = own.find((r) => r.cohort_id === null);
          const everyoneOn = resolveFlag(own, undefined, feature.default);
          return (
            <li key={key} className={`card flex flex-col gap-4 p-5 ${key === "ai" && !aiOn ? "border-coral/50" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex max-w-2xl flex-col gap-1">
                  <h2 className="flex flex-wrap items-center gap-2 font-display-tight text-lg">
                    {t(`items.${key}.name`)}
                    <Badge tone={feature.scope === "global" ? "violet" : "cyan"}>{t(`scope.${feature.scope}`)}</Badge>
                  </h2>
                  <p className="text-sm text-muted">{t(`items.${key}.description`)}</p>
                  <p className="text-[12px] text-soft">
                    {t("builtInDefault", { value: t(feature.default ? "values.on" : "values.off") })} · <code>{key}</code>
                  </p>
                </div>
              </div>

              <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
                <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className="flex flex-col">
                    <span className="font-medium">{t("everyone")}</span>
                    <span className={`text-[13px] ${everyoneOn ? "text-success" : "text-soft"}`}>
                      {t(everyone ? "effective.set" : "effective.default", { value: t(everyoneOn ? "values.on" : "values.off") })}
                    </span>
                  </span>
                  <FeatureSwitch featureKey={key} value={valueOf(everyone)} label={`${t(`items.${key}.name`)}: ${t("everyone")}`} />
                </li>
                {feature.scope === "group" &&
                  (cohorts ?? []).map((c) => {
                    const own_ = own.find((r) => r.cohort_id === c.id);
                    const on = resolveFlag(own, c.id, feature.default);
                    return (
                      <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                        <span className="flex flex-col">
                          <span className="font-medium">{c.name}</span>
                          <span className={`text-[13px] ${on ? "text-success" : "text-soft"}`}>
                            {t(own_ ? "effective.group" : "effective.followsEveryone", { value: t(on ? "values.on" : "values.off") })}
                          </span>
                        </span>
                        <FeatureSwitch featureKey={key} cohortId={c.id} value={valueOf(own_)} label={`${t(`items.${key}.name`)}: ${c.name}`} />
                      </li>
                    );
                  })}
              </ul>
            </li>
          );
        })}
      </ul>

      <p className="flex items-start gap-2 text-[13px] text-soft">
        <Icon name="shield" size={16} className="mt-0.5 shrink-0" />
        {t("rules")}
      </p>
    </>
  );
}
