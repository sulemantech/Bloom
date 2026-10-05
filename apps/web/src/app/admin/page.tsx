import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader, Section, Stat } from "@/components/AppShell";
import { ProgressBar, WeekHeadline } from "@/components/course";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/lib/auth";
import { daysSince, loadLastActive } from "@/lib/data/bloom";
import { loadCohortProgress } from "@/lib/data/cohort";
import { loadAuthInfo } from "@/lib/data/admin";
import { formatDateTime } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import { describeAudit } from "./activity/describe";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const profile = await requireRole("admin");
  const t = await getTranslations("admin");
  const supabase = await createClient();

  const [{ data: cohorts }, { data: people }, { data: memberships }, { data: recent }, { count: bloomPaths }, auth] = await Promise.all([
    supabase.from("cohorts").select("id").order("created_at"),
    supabase.from("profiles").select("id, role, full_name, username"),
    supabase.from("memberships").select("cohort_id, user_id, role, paid_at, refunded_at"),
    supabase.from("audit_log").select("*").order("at", { ascending: false }).limit(8),
    supabase.from("bloom_paths").select("*", { count: "exact", head: true }),
    loadAuthInfo(),
  ]);

  const all = people ?? [];
  const members = memberships ?? [];
  const students = all.filter((p) => p.role === "student");
  const studentMemberships = members.filter((m) => m.role === "student");
  const unpaid = studentMemberships.filter((m) => !m.paid_at && !m.refunded_at).length;
  const ungrouped = students.filter((s) => !studentMemberships.some((m) => m.user_id === s.id));
  const neverSignedIn = all.filter((p) => p.role !== "student" && !auth.get(p.id)?.lastSignInAt);

  const groups = (await Promise.all((cohorts ?? []).map((c) => loadCohortProgress(supabase, c.id)))).flatMap((g) => (g ? [g] : []));
  const lastActive = await loadLastActive(supabase, students.map((s) => s.id));
  const activeThisWeek = students.filter((s) => (daysSince(lastActive.get(s.id)) ?? 99) < 7).length;
  const toReview = groups.reduce((n, g) => n + g.toReview.length, 0);
  const noMentor = groups.filter((g) => g.mentors.length === 0);
  const nameById = new Map(all.map((p) => [p.id, p.full_name || p.username || ""]));
  const recentText = await Promise.all((recent ?? []).map((r) => describeAudit(r, nameById)));

  const attention = [
    ungrouped.length > 0 && { href: "/admin/people?role=student&filter=ungrouped", text: t("attention.ungrouped", { count: ungrouped.length }) },
    noMentor.length > 0 && { href: "/admin/groups", text: t("attention.noMentor", { count: noMentor.length }) },
    unpaid > 0 && { href: "/admin/payments?status=unpaid", text: t("attention.unpaid", { count: unpaid }) },
    toReview > 0 && { href: "/mentor", text: t("attention.toReview", { count: toReview }) },
    neverSignedIn.length > 0 && { href: "/admin/people?filter=invited", text: t("attention.neverSignedIn", { count: neverSignedIn.length }) },
  ].filter((x): x is { href: string; text: string } => Boolean(x));

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("intro", { name: profile.full_name.split(" ")[0] || "" })}
        actions={
          <>
            <Link href="/admin/people/new?type=student" className="btn btn-primary px-4 py-2 text-sm">
              <Icon name="plus" size={16} />
              {t("addStudent")}
            </Link>
            <Link href="/admin/people/new?type=adult" className="btn btn-secondary px-4 py-2 text-sm">{t("inviteAdult")}</Link>
          </>
        }
      />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <li><Stat value={students.length} label={t("stats.students")} /></li>
        <li><Stat value={activeThisWeek} label={t("stats.activeWeek")} tone="success" /></li>
        <li><Stat value={groups.length} label={t("stats.groups")} /></li>
        <li><Stat value={toReview} label={t("stats.toReview")} tone={toReview ? "warning" : undefined} /></li>
        <li><Stat value={bloomPaths ?? 0} label={t("stats.bloomPaths")} /></li>
        <li><Stat value={unpaid} label={t("stats.unpaid")} tone={unpaid ? "danger" : undefined} /></li>
      </ul>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card flex flex-col gap-3 p-5 lg:col-span-1" aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="font-display-tight text-lg">{t("attentionTitle")}</h2>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <Icon name="check" size={16} />
              {t("allGood")}
            </p>
          ) : (
            <ul className="-mx-3 flex flex-col">
              {attention.map((a) => (
                <li key={a.href}>
                  <Link href={a.href} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[15px] hover:bg-surface-2">
                    <span className="flex items-center gap-2">
                      <Icon name="alert" size={16} className="text-warning" />
                      {a.text}
                    </span>
                    <Icon name="chevron" size={16} className="text-soft" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card flex flex-col gap-3 p-5 lg:col-span-2" aria-labelledby="recent-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="recent-heading" className="font-display-tight text-lg">{t("recentTitle")}</h2>
            <Link href="/admin/activity" className="text-sm font-medium text-info">{t("seeAll")}</Link>
          </div>
          <ul className="flex flex-col divide-y divide-border">
            {(recent ?? []).map((r, i) => (
              <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2 text-sm">
                <span>
                  <span className="font-medium">{r.actor_id ? nameById.get(r.actor_id) || t("someone") : t("system")}</span>{" "}
                  <span className="text-muted">{recentText[i]}</span>
                </span>
                <span className="text-[12px] text-soft">{formatDateTime(r.at, profile.timezone)}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <Section title={t("groupsTitle")} id="groups" actions={<Link href="/admin/groups" className="text-sm font-medium text-info">{t("manageGroups")}</Link>}>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const done = g.students.reduce((n, s) => n + s.done, 0);
            const total = g.students.reduce((n, s) => n + s.total, 0);
            return (
              <li key={g.cohort.id}>
                <Link href={`/admin/groups/${g.cohort.id}`} className="card flex h-full flex-col gap-3 p-5 transition-colors hover:border-cyan">
                  <span className="font-display-tight text-lg">{g.cohort.name}</span>
                  <WeekHeadline overview={g} />
                  <ProgressBar value={done} max={total} label={t("groupProgress")} />
                  <span className="flex flex-wrap gap-2">
                    <Badge>{t("studentsCount", { count: g.students.length })}</Badge>
                    {g.mentors.length === 0 ? <Badge tone="coral">{t("noMentorBadge")}</Badge> : <Badge>{t("mentorsCount", { count: g.mentors.length })}</Badge>}
                    {g.toReview.length > 0 && <Badge tone="sun">{t("reviewCount", { count: g.toReview.length })}</Badge>}
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/admin/groups#new" className="card flex h-full min-h-32 items-center justify-center gap-2 border-dashed p-5 text-muted transition-colors hover:border-cyan hover:text-text">
              <Icon name="plus" />
              {t("newGroup")}
            </Link>
          </li>
        </ul>
      </Section>
    </>
  );
}
