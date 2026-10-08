import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Section } from "@/components/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/lib/auth";
import { ageInDays, daysAgoIso, feeSummary, onTrack, rupees } from "@/lib/admin-metrics";
import { nudgeReasons } from "@/lib/bloom/nudge";
import { daysSince, loadLastActive } from "@/lib/data/bloom";
import { loadCohortProgress, type CohortProgress } from "@/lib/data/cohort";
import { loadAuthInfo } from "@/lib/data/admin";
import { loadOpenGaps } from "@/lib/data/learner";
import { formatDate, formatDateTime, isPast } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import { describeAudit } from "./activity/describe";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const profile = await requireRole("admin");
  const t = await getTranslations("admin");
  const d = await getTranslations("admin.dashboard");
  const supabase = await createClient();
  const since = daysAgoIso(7);

  const [{ data: cohorts }, { data: people }, { data: memberships }, { data: recent }, { count: bloomPaths }, { count: stepsDone }, { data: aiRuns }, auth] =
    await Promise.all([
      supabase.from("cohorts").select("id").order("start_date", { ascending: true, nullsFirst: false }),
      supabase.from("profiles").select("id, role, full_name, username"),
      supabase.from("memberships").select("cohort_id, user_id, role, fee_amount, discount_reason, paid_at, refunded_at"),
      // What people did; automated changes (no actor) stay on the full activity page.
      supabase.from("audit_log").select("*").not("actor_id", "is", null).order("at", { ascending: false }).limit(8),
      supabase.from("bloom_paths").select("*", { count: "exact", head: true }).neq("status", "archived"),
      supabase.from("bloom_tasks").select("*", { count: "exact", head: true }).gte("completed_at", since),
      supabase.from("ai_runs").select("outcome").gte("created_at", since),
      loadAuthInfo(),
    ]);

  const all = people ?? [];
  const members = memberships ?? [];
  const students = all.filter((p) => p.role === "student");
  const studentMemberships = members.filter((m) => m.role === "student");
  const ungrouped = students.filter((s) => !studentMemberships.some((m) => m.user_id === s.id));
  const neverSignedIn = all.filter((p) => p.role !== "student" && !auth.get(p.id)?.lastSignInAt);
  const fees = feeSummary(members);

  const groups = (await Promise.all((cohorts ?? []).map((c) => loadCohortProgress(supabase, c.id)))).flatMap((g) => (g ? [g] : []));
  const running = groups.filter((g) => g.week !== null && g.week >= 1 && g.week <= g.program.weeks);
  const runningStudents = running.flatMap((g) => g.students);
  const studentIds = students.map((s) => s.id);
  const [lastActive, gaps] = await Promise.all([loadLastActive(supabase, studentIds), loadOpenGaps(supabase, studentIds)]);
  const activeThisWeek = runningStudents.filter((s) => (daysSince(lastActive.get(s.profile.id)) ?? 99) < 7).length;

  // The same rule mentors see on their dashboard (lib/bloom/nudge), across every running group.
  const nudge = (g: CohortProgress) =>
    g.students.filter(
      (s) => nudgeReasons({ overdue: s.overdue, daysQuiet: daysSince(lastActive.get(s.profile.id)), gaps: gaps.get(s.profile.id)?.length ?? 0 }).length > 0,
    ).length;
  const toNudge = running.reduce((n, g) => n + nudge(g), 0);
  const withGaps = studentIds.filter((id) => (gaps.get(id)?.length ?? 0) > 0).length;

  const toReview = groups.flatMap((g) => g.toReview);
  const oldestReview = ageInDays(toReview.map((r) => r.submission.submitted_at).sort()[0]);
  const noMentor = groups.filter((g) => g.mentors.length === 0);
  const aiProblems = (aiRuns ?? []).filter((r) => r.outcome !== "ok").length;

  const upcoming = groups
    .flatMap((g) => g.sessions.filter((s) => !isPast(s.starts_at)).slice(0, 1).map((s) => ({ ...s, group: g })))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
    .slice(0, 4);

  const nameById = new Map(all.map((p) => [p.id, p.full_name || p.username || ""]));
  const recentText = await Promise.all((recent ?? []).map((r) => describeAudit(r, nameById)));

  const attention = [
    toReview.length > 0 && { href: "/mentor", text: t("attention.toReview", { count: toReview.length }), tone: "warning" },
    toNudge > 0 && { href: "/mentor", text: d("nudge", { count: toNudge }), tone: "warning" },
    noMentor.length > 0 && { href: "/admin/groups", text: t("attention.noMentor", { count: noMentor.length }), tone: "danger" },
    fees.unpaid > 0 && { href: "/admin/payments?status=unpaid", text: t("attention.unpaid", { count: fees.unpaid }), tone: "danger" },
    ungrouped.length > 0 && { href: "/admin/people?role=student&filter=ungrouped", text: t("attention.ungrouped", { count: ungrouped.length }), tone: "warning" },
    neverSignedIn.length > 0 && { href: "/admin/people?filter=invited", text: t("attention.neverSignedIn", { count: neverSignedIn.length }), tone: "neutral" },
  ].filter((x): x is { href: string; text: string; tone: string } => Boolean(x));

  const kpis = [
    { label: d("kpi.students"), value: studentMemberships.length, sub: d("kpi.studentsSub", { groups: groups.length, ungrouped: ungrouped.length }) },
    {
      label: d("kpi.active"),
      value: runningStudents.length ? `${Math.round((activeThisWeek / runningStudents.length) * 100)}%` : "—",
      sub: d("kpi.activeSub", { active: activeThisWeek, total: runningStudents.length }),
    },
    { label: d("kpi.fees"), value: `Rs ${rupees(fees.collected)}`, sub: fees.outstanding ? d("kpi.feesSub", { amount: rupees(fees.outstanding) }) : d("kpi.feesAllPaid") },
    {
      label: d("kpi.review"),
      value: toReview.length,
      sub: toReview.length ? d("kpi.reviewSub", { days: oldestReview ?? 0 }) : d("kpi.reviewNone"),
    },
  ];

  return (
    <>
      <header className="relative overflow-hidden rounded-3xl bg-ink-900 p-6 text-white sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-cyan/25 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-violet/25 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-2">
              <p className="label-caps text-lime">{d("eyebrow", { date: formatDate(daysAgoIso(0), profile.timezone) })}</p>
              <h1 className="font-display-tight text-[30px] leading-tight sm:text-[36px]">{t("title")}</h1>
              <p className="max-w-xl text-mist">{t("intro", { name: profile.full_name.split(" ")[0] || "" })}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href="/admin/people/new?type=student" className="btn btn-primary px-4 py-2 text-sm">
                <Icon name="plus" size={16} />
                {t("addStudent")}
              </Link>
              <Link href="/admin/people/new?type=adult" className="btn border border-white/20 bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20">
                {t("inviteAdult")}
              </Link>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => (
              <li key={k.label} className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <span className="text-[13px] text-mist">{k.label}</span>
                <span className="font-display-tight text-[28px] leading-none tabular-nums">{k.value}</span>
                <span className="text-[12px] text-mist/80">{k.sub}</span>
              </li>
            ))}
          </ul>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card flex flex-col gap-3 p-5" aria-labelledby="attention-heading">
          <h2 id="attention-heading" className="font-display-tight text-lg">{t("attentionTitle")}</h2>
          {attention.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-success">
              <Icon name="check" size={16} />
              {t("allGood")}
            </p>
          ) : (
            <ul className="-mx-3 flex flex-col">
              {attention.map((a) => (
                <li key={a.text}>
                  <Link href={a.href} className="flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-[15px] hover:bg-surface-2">
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`size-2 shrink-0 rounded-full ${a.tone === "danger" ? "bg-coral" : a.tone === "warning" ? "bg-sun" : "bg-soft"}`}
                        aria-hidden="true"
                      />
                      {a.text}
                    </span>
                    <Icon name="chevron" size={16} className="text-soft" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card flex flex-col gap-3 p-5" aria-labelledby="classes-heading">
          <h2 id="classes-heading" className="font-display-tight text-lg">{d("classesTitle")}</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted">{d("classesNone")}</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {upcoming.map((s) => (
                <li key={s.id} className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan/15 text-info" aria-hidden="true">
                    <Icon name="calendar" size={16} />
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{s.group.cohort.name}</span>
                    <span className="text-[13px] text-soft">{formatDateTime(s.starts_at, s.group.cohort.timezone)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card flex flex-col gap-4 p-5" aria-labelledby="spark-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="spark-heading" className="flex items-center gap-2 font-display-tight text-lg">
              <span className="text-ai" aria-hidden="true">✦</span>
              {d("sparkTitle")}
            </h2>
            <Link href="/admin/ai" className="text-sm font-medium text-info">{d("aiLink")}</Link>
          </div>
          <dl className="grid grid-cols-2 gap-3">
            {[
              [d("sparkPaths"), bloomPaths ?? 0],
              [d("sparkSteps"), stepsDone ?? 0],
              [d("sparkGaps"), withGaps],
              [d("aiRuns"), (aiRuns ?? []).length],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex flex-col gap-0.5 rounded-xl bg-violet/5 p-3">
                <dt className="text-[12px] text-soft">{label}</dt>
                <dd className="font-display-tight text-[22px] leading-none tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
          <p className={`text-[13px] ${aiProblems ? "text-warning" : "text-soft"}`}>{d("aiProblems", { count: aiProblems })}</p>
        </section>
      </div>

      <Section title={t("groupsTitle")} id="groups" actions={<Link href="/admin/groups" className="text-sm font-medium text-info">{t("manageGroups")}</Link>}>
        <ul className="grid gap-3 md:grid-cols-2">
          {groups.map((g) => {
            const track = onTrack(g.students);
            const unpaid = g.students.filter((s) => !s.membership.paid_at).length;
            const next = g.sessions.find((s) => !isPast(s.starts_at));
            const started = g.week !== null && g.week >= 1;
            const nudges = started ? nudge(g) : 0;
            return (
              <li key={g.cohort.id}>
                <Link href={`/admin/groups/${g.cohort.id}`} className="card flex h-full flex-col gap-4 p-5 transition-colors hover:border-cyan">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-display-tight text-lg leading-snug">{g.cohort.name}</span>
                      <span className="text-[13px] text-soft">
                        {g.mentors.length
                          ? g.mentors.map((m) => m.user!.full_name).join(" · ")
                          : <span className="text-danger">{d("mentorsNone")}</span>}
                      </span>
                    </div>
                    <Badge tone={started ? "cyan" : "neutral"}>
                      {g.week === null
                        ? t("startTbc")
                        : !started
                          ? d("groupNotStarted", { date: formatDate(g.cohort.start_date!, g.cohort.timezone) })
                          : g.week > g.program.weeks
                            ? d("groupFinished")
                            : d("groupWeek", { week: g.week, weeks: g.program.weeks })}
                    </Badge>
                  </div>

                  <ol className="flex gap-1" aria-hidden="true">
                    {Array.from({ length: g.program.weeks }, (_, i) => (
                      <li
                        key={i}
                        className={`h-1.5 flex-1 rounded-full ${g.week !== null && i + 1 < g.week ? "bg-cyan" : g.week === i + 1 ? "bg-violet" : "bg-surface-2"}`}
                      />
                    ))}
                  </ol>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="flex flex-col rounded-xl bg-surface-2 p-2">
                      <span className="font-display-tight text-xl tabular-nums">{g.students.length}</span>
                      <span className="text-[12px] text-soft">{d("studentsLabel")}</span>
                    </div>
                    <div className="flex flex-col rounded-xl bg-surface-2 p-2">
                      <span className={`font-display-tight text-xl tabular-nums ${started && track.percent < 70 ? "text-warning" : "text-success"}`}>
                        {started ? `${track.percent}%` : "—"}
                      </span>
                      <span className="text-[12px] text-soft">{d("onTrack")}</span>
                    </div>
                    <div className="flex flex-col rounded-xl bg-surface-2 p-2">
                      <span className="font-display-tight text-xl tabular-nums">{g.toReview.length}</span>
                      <span className="text-[12px] text-soft">{d("reviewLabel")}</span>
                    </div>
                  </div>

                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    {nudges > 0 && <Badge tone="sun">{d("nudgeCount", { count: nudges })}</Badge>}
                    {unpaid > 0 && <Badge tone="coral">{t("unpaidCount", { count: unpaid })}</Badge>}
                    {next && <span className="text-[12px] text-soft">{d("nextClass", { date: formatDateTime(next.starts_at, g.cohort.timezone) })}</span>}
                  </div>
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

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="card flex flex-col gap-4 p-5" aria-labelledby="fees-heading">
          <div className="flex items-center justify-between gap-2">
            <h2 id="fees-heading" className="font-display-tight text-lg">{d("feesTitle")}</h2>
            <Link href="/admin/payments" className="text-sm font-medium text-info">{t("seeAll")}</Link>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={d("feesBar", { collected: rupees(fees.collected), outstanding: rupees(fees.outstanding) })}>
              <span className="bg-lime" style={{ width: `${(fees.collected / Math.max(fees.collected + fees.outstanding, 1)) * 100}%` }} />
              <span className="bg-coral/60" style={{ width: `${(fees.outstanding / Math.max(fees.collected + fees.outstanding, 1)) * 100}%` }} />
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="flex items-center gap-1.5 text-soft"><span className="size-2 rounded-full bg-lime" aria-hidden="true" />{d("feesCollected")}</dt>
                <dd className="font-display-tight text-xl tabular-nums">Rs {rupees(fees.collected)}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1.5 text-soft"><span className="size-2 rounded-full bg-coral/60" aria-hidden="true" />{d("feesOutstanding")}</dt>
                <dd className="font-display-tight text-xl tabular-nums">Rs {rupees(fees.outstanding)}</dd>
              </div>
            </dl>
          </div>
          {fees.discounts > 0 && <p className="text-[13px] text-soft">{d("feesDiscounts", { count: fees.discounts })}</p>}
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
    </>
  );
}
