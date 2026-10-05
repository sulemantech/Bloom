import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { loadMyCohorts } from "@/lib/data/cohort";
import { formatDate } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "My groups" };

export default async function MentorHome() {
  const profile = await requireRole("mentor", "admin");
  const t = await getTranslations("mentor");
  const supabase = await createClient();
  const cohorts = await loadMyCohorts(supabase, profile.id, profile.role === "admin");

  if (profile.role === "mentor" && cohorts.length === 1) redirect(`/mentor/groups/${cohorts[0].id}`);

  return (
    <AppShell profile={profile}>
      <h1 className="font-display-tight text-[28px] leading-tight">{t("myGroups")}</h1>
      {cohorts.length === 0 ? (
        <p className="card p-6 text-muted">{t("noGroups")}</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cohorts.map((c) => (
            <li key={c.id}>
              <Link href={`/mentor/groups/${c.id}`} className="card flex flex-col gap-1 p-5 transition-colors hover:border-cyan">
                <span className="font-display-tight text-lg">{c.name}</span>
                <span className="text-sm text-muted">
                  {c.start_date ? t("starts", { date: formatDate(c.start_date, c.timezone) }) : t("startTbc")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
