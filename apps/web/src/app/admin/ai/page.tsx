import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader, Section, Stat, Tabs } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { summariseUsage, topStudents, usageWindow } from "@/lib/ai/usage";
import { dailyLimitFrom } from "@/lib/ai/util";
import { formatDate } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "AI usage" };

const RANGES = ["7", "30", "90"] as const;

const num = (n: number) => new Intl.NumberFormat("en").format(n);
const secs = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`);

export default async function AiUsagePage({ searchParams }: PageProps<"/admin/ai">) {
  const profile = await requireRole("admin");
  const t = await getTranslations("adminAi");
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r === rangeParam) ?? "7";
  const { days, since } = usageWindow(Number(range), profile.timezone);
  const supabase = await createClient();

  const [{ data: dayRows }, { data: studentRows }] = await Promise.all([
    supabase.rpc("ai_usage_by_day", { p_since: since, p_tz: profile.timezone }),
    supabase.rpc("ai_usage_by_student", { p_since: since }),
  ]);
  const { total, days: perDay, capabilities } = summariseUsage(dayRows ?? [], days);
  const top = topStudents(studentRows ?? []);
  const { data: people } = top.length
    ? await supabase.from("profiles").select("id, full_name, username").in("id", top.map((s) => s.studentId))
    : { data: [] };
  const names = new Map((people ?? []).map((p) => [p.id, p.full_name || p.username || ""]));
  const empty = total.calls === 0 && total.limited === 0;

  const th = "label-caps px-3 py-3 text-right font-semibold first:px-5 first:text-left last:px-5";
  const td = "px-3 py-2.5 text-right tabular-nums first:px-5 first:text-left last:px-5";

  return (
    <>
      <PageHeader title={t("title")} description={t("intro", { limit: dailyLimitFrom(process.env.BLOOM_AI_DAILY_LIMIT) })}>
        <Tabs
          label={t("rangeLabel")}
          current={range}
          tabs={RANGES.map((r) => ({ key: r, label: t("lastDays", { count: Number(r) }), href: `/admin/ai?range=${r}` }))}
        />
      </PageHeader>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <li><Stat value={num(total.calls)} label={t("stats.calls")} /></li>
        <li><Stat value={num(total.inputTokens + total.outputTokens)} label={t("stats.tokens")} /></li>
        <li><Stat value={num(total.limited)} label={t("stats.limited")} tone={total.limited ? "warning" : undefined} /></li>
        <li><Stat value={num(total.notAnswered)} label={t("stats.notAnswered")} tone={total.notAnswered ? "danger" : undefined} /></li>
      </ul>

      {empty ? (
        <EmptyState title={t("empty")} body={t("emptyBody")} />
      ) : (
        <>
          <Section title={t("perDay")} id="per-day">
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-soft">
                    <th className={th}>{t("columns.day")}</th>
                    <th className={th}>{t("columns.calls")}</th>
                    <th className={th}>{t("columns.tokensIn")}</th>
                    <th className={th}>{t("columns.tokensOut")}</th>
                    <th className={th}>{t("columns.avgTime")}</th>
                    <th className={th}>{t("columns.limited")}</th>
                    <th className={th}>{t("columns.notAnswered")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {perDay.map((d) => (
                    <tr key={d.day} className={d.calls === 0 && d.limited === 0 ? "text-soft" : undefined}>
                      <td className={td}>{formatDate(d.day, profile.timezone)}</td>
                      <td className={td}>{num(d.calls)}</td>
                      <td className={td}>{num(d.inputTokens)}</td>
                      <td className={td}>{num(d.outputTokens)}</td>
                      <td className={td}>{secs(d.avgLatencyMs)}</td>
                      <td className={`${td} ${d.limited ? "text-warning" : ""}`}>{num(d.limited)}</td>
                      <td className={`${td} ${d.notAnswered ? "text-danger" : ""}`}>{num(d.notAnswered)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          <Section title={t("perCapability")} id="per-capability">
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border text-soft">
                    <th className={th}>{t("columns.capability")}</th>
                    <th className={th}>{t("columns.calls")}</th>
                    <th className={th}>{t("columns.tokensIn")}</th>
                    <th className={th}>{t("columns.tokensOut")}</th>
                    <th className={th}>{t("columns.avgTime")}</th>
                    <th className={th}>{t("columns.notAnswered")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {capabilities.map((c) => (
                    <tr key={c.capability}>
                      <td className={td}>{t.has(`capabilities.${c.capability}`) ? t(`capabilities.${c.capability}`) : c.capability}</td>
                      <td className={td}>{num(c.calls)}</td>
                      <td className={td}>{num(c.inputTokens)}</td>
                      <td className={td}>{num(c.outputTokens)}</td>
                      <td className={td}>{secs(c.avgLatencyMs)}</td>
                      <td className={td}>{num(c.notAnswered)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {top.length > 0 && (
            <Section title={t("topStudents")} id="students">
              <ul className="card flex flex-col divide-y divide-border">
                {top.map((s) => (
                  <li key={s.studentId} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3 text-sm">
                    <Link href={`/admin/people/${s.studentId}`} className="font-medium hover:text-info">
                      {names.get(s.studentId) || t("unknownStudent")}
                    </Link>
                    <span className="flex gap-4 tabular-nums text-muted">
                      <span>{t("studentCalls", { count: s.calls })}</span>
                      <span>{t("studentTokens", { count: s.inputTokens + s.outputTokens })}</span>
                      {s.limited > 0 && <span className="text-warning">{t("studentLimited", { count: s.limited })}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </>
      )}
    </>
  );
}
