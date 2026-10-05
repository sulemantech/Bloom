import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/AppShell";
import { SessionsCard } from "@/components/Sessions";
import { requireRole } from "@/lib/auth";
import { loadStudentOverview } from "@/lib/data/overview";
import { formatDateTime, isPast } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Live classes" };

type Schedule = { weekday?: number; start?: string; end?: string } | null;

export default async function StudentClasses() {
  const profile = await requireRole("student");
  const t = await getTranslations("classes");
  const supabase = await createClient();
  const overview = await loadStudentOverview(supabase, profile.id);
  if (!overview) redirect("/student");
  const { cohort, sessions } = overview;
  const schedule = cohort.schedule as Schedule;
  const upcoming = sessions.filter((s) => !isPast(new Date(Date.parse(s.starts_at) + 2 * 3_600_000).toISOString()));

  return (
    <>
      <PageHeader
        title={t("title")}
        description={
          schedule?.weekday !== undefined && schedule.start
            ? t("schedule", { day: t(`days.${schedule.weekday}`), start: schedule.start, end: schedule.end ?? "" })
            : t("scheduleTbc")
        }
      />
      <div className="grid gap-4 md:grid-cols-2">
        <SessionsCard sessions={sessions} timeZone={cohort.timezone} />
        <section className="card flex flex-col gap-3 p-5" aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="label-caps text-soft">{t("upcoming")}</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">{t("none")}</p>
          ) : (
            <ul className="flex flex-col divide-y divide-border">
              {upcoming.map((s) => (
                <li key={s.id} className="flex flex-col py-2.5">
                  <span className="font-medium">{s.title || t("liveClass")}</span>
                  <span className="text-sm text-muted">{formatDateTime(s.starts_at, cohort.timezone)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
