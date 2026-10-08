import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader, Stat } from "@/components/AppShell";
import { Badge, type Tone } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { daysAgoIso } from "@/lib/admin-metrics";
import { displayEmail, isDeactivated, loadAuthInfo } from "@/lib/data/admin";
import { loadGroupDuties, readAll } from "@/lib/data/operations";
import { clock, feedbackStats, mentorFlags, SERVICE_LEVELS, type MentorFlag } from "@/lib/operations";
import { formatDate } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mentors" };

const FLAG_TONE: Record<MentorFlag, Tone> = { late_reviews: "coral", cards_due: "sun", quiet: "sun", never_signed_in: "neutral", no_group: "neutral" };

export default async function MentorsPage() {
  const admin = await requireRole("admin");
  const t = await getTranslations("adminMentors");
  const supabase = await createClient();
  const now = clock();

  const [groups, { data: staff }, { data: memberships }, feedback, auth] = await Promise.all([
    loadGroupDuties(supabase, now),
    supabase.from("profiles").select("id, role, full_name").in("role", ["mentor", "admin"]).order("full_name"),
    supabase.from("memberships").select("cohort_id, user_id").eq("role", "mentor"),
    // Response times over the last 30 days: enough to be fair, recent enough to matter.
    readAll((from, to) =>
      supabase
        .from("feedback")
        .select("mentor_id, created_at, submission:submissions(submitted_at)")
        .gte("created_at", daysAgoIso(30))
        .order("created_at")
        .range(from, to),
    ),
    loadAuthInfo(),
  ]);

  const groupById = new Map(groups.map((g) => [g.id, g]));
  const mentorIds = new Set((memberships ?? []).map((m) => m.user_id));
  // Mentors, plus admins who mentor a group themselves.
  const rows = (staff ?? [])
    .filter((p) => p.role === "mentor" || mentorIds.has(p.id))
    .map((p) => {
      const info = auth.get(p.id);
      const own = (memberships ?? []).filter((m) => m.user_id === p.id).flatMap((m) => groupById.get(m.cohort_id) ?? []);
      const given = feedbackStats(
        feedback.filter((f) => f.mentor_id === p.id).map((f) => ({ created_at: f.created_at, submitted_at: f.submission?.submitted_at ?? null })),
        now,
      );
      const flags = mentorFlags({ groups: own, lastSignInAt: info?.lastSignInAt ?? null }, now);
      return {
        ...p,
        email: displayEmail(info?.email),
        lastSignInAt: info?.lastSignInAt ?? null,
        deactivated: isDeactivated(info),
        groups: own,
        students: own.reduce((n, g) => n + g.students, 0),
        waiting: own.reduce((n, g) => n + g.waiting, 0),
        late: own.reduce((n, g) => n + g.late, 0),
        oldestDays: Math.max(-1, ...own.map((g) => g.oldestDays ?? -1)),
        cardsMissing: own.reduce((n, g) => n + g.cardsMissing, 0),
        given,
        flags,
      };
    })
    .sort((a, b) => b.flags.length - a.flags.length || b.late - a.late || a.full_name.localeCompare(b.full_name));

  // Totals count each group once, however many mentors share it.
  const lateTotal = groups.reduce((n, g) => n + g.late, 0);
  const cardsTotal = groups.reduce((n, g) => n + g.cardsMissing, 0);
  const unstaffed = groups.filter((g) => !(memberships ?? []).some((m) => m.cohort_id === g.id));

  return (
    <>
      <PageHeader title={t("title")} description={t("intro", { days: SERVICE_LEVELS.reviewDays })} />

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <li><Stat value={rows.length} label={t("stats.mentors")} /></li>
        <li><Stat value={lateTotal} label={t("stats.late", { days: SERVICE_LEVELS.reviewDays })} tone={lateTotal ? "danger" : "success"} /></li>
        <li><Stat value={cardsTotal} label={t("stats.cards")} tone={cardsTotal ? "warning" : "success"} /></li>
        <li><Stat value={unstaffed.length} label={t("stats.unstaffed")} tone={unstaffed.length ? "danger" : "success"} /></li>
      </ul>

      {unstaffed.length > 0 && (
        <p className="card border-coral/40 bg-coral/5 p-4 text-sm">
          {t("unstaffed")}{" "}
          {unstaffed.map((g, i) => (
            <span key={g.id}>
              {i > 0 && ", "}
              <Link href={`/admin/groups/${g.id}`} className="font-medium text-info hover:underline">{g.name}</Link>
            </span>
          ))}
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState title={t("none")} body={t("noneBody")} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-soft">
                <th className="label-caps px-5 py-3 font-semibold">{t("columns.mentor")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.groups")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.reviews")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.feedback")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.cards")}</th>
                <th className="label-caps px-5 py-3 font-semibold">{t("columns.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((m) => (
                <tr key={m.id} className="align-top transition-colors hover:bg-surface-2/60">
                  <td className="px-5 py-3">
                    <Link href={`/admin/people/${m.id}`} className="flex flex-col hover:text-info">
                      <span className="font-medium">{m.full_name || m.email}</span>
                      <span className="text-[13px] text-soft">{m.email}</span>
                    </Link>
                    <span className="text-[12px] text-soft">
                      {m.lastSignInAt ? t("lastSignIn", { date: formatDate(m.lastSignInAt, admin.timezone) }) : t("neverSignedIn")}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {m.groups.length === 0 ? (
                      <span className="text-soft">{t("noGroup")}</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {m.groups.map((g) => (
                          <li key={g.id}>
                            <Link href={`/mentor/groups/${g.id}`} className="font-medium hover:text-info">{g.name}</Link>
                            <span className="block text-[12px] text-soft">
                              {g.week === null || g.week < 1 ? t("notStarted") : t("week", { week: Math.min(g.week, g.weeks), weeks: g.weeks })} ·{" "}
                              {t("students", { count: g.students })}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={`font-semibold tabular-nums ${m.late ? "text-danger" : ""}`}>{m.waiting}</span>
                    <span className="block text-[12px] text-soft">
                      {m.waiting === 0 ? t("allReviewed") : m.late ? t("late", { count: m.late }) : t("oldest", { days: m.oldestDays })}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="font-semibold tabular-nums">{m.given.lastWeek}</span>
                    <span className="block text-[12px] text-soft">
                      {m.given.medianHours === null
                        ? t("noFeedbackYet")
                        : m.given.medianHours < 48
                          ? t("medianResponse", { hours: m.given.medianHours })
                          : t("medianResponseDays", { days: Math.round(m.given.medianHours / 24) })}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    {m.groups.every((g) => g.cardWeek === null) ? (
                      <span className="text-soft">—</span>
                    ) : m.cardsMissing ? (
                      <span className="text-warning">{t("cardsMissing", { count: m.cardsMissing })}</span>
                    ) : (
                      <span className="text-success">{t("cardsDone")}</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <span className="flex flex-wrap gap-1">
                      {m.deactivated && <Badge tone="coral">{t("deactivated")}</Badge>}
                      {m.flags.length === 0 && !m.deactivated && <Badge tone="lime">{t("flags.ok")}</Badge>}
                      {m.flags.map((f) => (
                        <Badge key={f} tone={FLAG_TONE[f]}>{t(`flags.${f}`)}</Badge>
                      ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[13px] text-soft">{t("shared")}</p>
    </>
  );
}
