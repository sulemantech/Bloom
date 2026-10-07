import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { EmptyState, Section, Stat } from "@/components/AppShell";
import { BloomPathCard, LearnerStateCard } from "@/components/bloom";
import { requireRole } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai";
import { bloomStats, hasConsent, loadBloomPaths } from "@/lib/data/bloom";
import { loadLearnerState } from "@/lib/data/learner";
import { loadStudentOverview } from "@/lib/data/overview";
import { bloomV2Enabled } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { StartPath } from "./forms";

export const metadata: Metadata = { title: "Spark" };

export default async function BloomHome() {
  const profile = await requireRole("student");
  const t = await getTranslations("bloom");
  const supabase = await createClient();
  const [paths, consent, v2, overview] = await Promise.all([
    loadBloomPaths(supabase, profile.id),
    hasConsent(supabase, profile.id, "bloom_ai"),
    bloomV2Enabled(profile.id),
    loadStudentOverview(supabase, profile.id),
  ]);
  // The learner state drives adaptive steps, so it is shown where those are switched on.
  const learner = v2 ? await loadLearnerState(supabase, profile.id, overview) : null;
  const aiAllowed = consent && aiConfigured();
  const stats = bloomStats(paths);
  const active = paths.filter((p) => p.status === "active");
  const completed = paths.filter((p) => p.status === "completed");
  const archived = paths.filter((p) => p.status === "archived");

  return (
    <>
      <header className="relative overflow-hidden rounded-3xl bg-ink-900 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 size-64 rounded-full bg-violet/30 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-20 left-10 size-56 rounded-full bg-cyan/20 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-2">
          <p className="label-caps flex items-center gap-2 text-lime">
            {t("eyebrow")}
            {v2 && <span className="rounded-full bg-lime/20 px-2 py-0.5">{t("pilot")}</span>}
          </p>
          <h1 className="font-display-tight text-[30px] leading-tight sm:text-[36px]">{t("title")}</h1>
          <p className="max-w-xl text-mist">{t("intro")}</p>
        </div>
      </header>

      {paths.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <li><Stat value={stats.active} label={t("stats.active")} /></li>
          <li><Stat value={stats.completed} label={t("stats.completed")} tone="success" /></li>
          <li><Stat value={stats.tasksDone} label={t("stats.tasksDone")} /></li>
          <li><Stat value={`${stats.tasksTotal ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0}%`} label={t("stats.overall")} /></li>
        </ul>
      )}

      {learner && <LearnerStateCard state={learner} forStudent />}

      <section className="card flex flex-col gap-4 p-5 sm:p-6" aria-labelledby="start-heading">
        <div className="flex flex-col gap-1">
          <h2 id="start-heading" className="font-display-tight text-xl">{t("startTitle")}</h2>
          <p className="text-sm text-muted">{aiAllowed ? t("startIntroAi") : t("startIntroManual")}</p>
        </div>
        {!consent && <p className="rounded-xl bg-sun/15 p-3 text-sm text-warning">{t("noConsentHint")}</p>}
        <StartPath aiAllowed={aiAllowed} />
      </section>

      <Section title={t("activeTitle")} id="active">
        {active.length === 0 ? (
          <EmptyState title={t("noActive")} body={t("noActiveBody")} />
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((p) => (
              <li key={p.id}><BloomPathCard path={p} href={`/student/spark/${p.id}`} /></li>
            ))}
          </ul>
        )}
      </Section>

      {completed.length > 0 && (
        <Section title={t("completedTitle")} id="completed">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {completed.map((p) => (
              <li key={p.id}><BloomPathCard path={p} href={`/student/spark/${p.id}`} /></li>
            ))}
          </ul>
        </Section>
      )}

      {archived.length > 0 && (
        <details className="flex flex-col gap-3">
          <summary className="cursor-pointer text-sm font-medium text-muted">{t("archivedTitle", { count: archived.length })}</summary>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archived.map((p) => (
              <li key={p.id}><BloomPathCard path={p} href={`/student/spark/${p.id}`} /></li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
