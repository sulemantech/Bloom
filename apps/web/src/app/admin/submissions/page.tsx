import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader, Tabs } from "@/components/AppShell";
import { Badge, SUBMISSION_TONE } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/lib/auth";
import { readAll } from "@/lib/data/operations";
import { clock, daysBetween, isLateReview, latestWork, SERVICE_LEVELS } from "@/lib/operations";
import { formatDate, tr } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Submissions" };

const STATUSES = ["waiting", "needs_changes", "done", "all"] as const;
type StatusFilter = (typeof STATUSES)[number];
const DB_STATUS = { waiting: "submitted", needs_changes: "needs_changes", done: "done" } as const;
const PER_PAGE = 50;

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : "");

export default async function SubmissionsPage({ searchParams }: PageProps<"/admin/submissions">) {
  const admin = await requireRole("admin");
  const t = await getTranslations("adminWork");
  const params = await searchParams;
  const status: StatusFilter = STATUSES.find((s) => s === params.status) ?? "waiting";
  const group = one(params.group);
  const late = one(params.late) === "1";
  const q = one(params.q).trim().toLowerCase();
  const page = Math.max(1, Number.parseInt(one(params.page), 10) || 1);
  const supabase = await createClient();
  const now = clock();

  const [{ data: cohorts }, rows] = await Promise.all([
    supabase.from("cohorts").select("id, name, timezone").order("start_date", { ascending: true, nullsFirst: false }),
    readAll((from, to) => {
      let query = supabase
        .from("submissions")
        .select(
          "id, activity_id, student_id, cohort_id, status, submitted_at, student:profiles(full_name, username), activity:activities(week, title), feedback(created_at, mentor:profiles(full_name))",
        )
        .order("submitted_at", { ascending: false })
        .order("id")
        .range(from, to);
      if (group) query = query.eq("cohort_id", group);
      return query;
    }),
  ]);

  const groupName = new Map((cohorts ?? []).map((c) => [c.id, c.name]));
  // Current state only: a resubmission replaces the earlier row for that activity.
  const current = latestWork(rows).filter(
    (r) => !q || [r.student?.full_name ?? "", r.student?.username ?? ""].some((v) => v.toLowerCase().includes(q)),
  );
  const counts = {
    waiting: current.filter((r) => r.status === "submitted").length,
    needs_changes: current.filter((r) => r.status === "needs_changes").length,
    done: current.filter((r) => r.status === "done").length,
    all: current.length,
  };
  const lateCount = current.filter((r) => isLateReview(r, now)).length;

  const filtered = current
    .filter((r) => status === "all" || r.status === DB_STATUS[status])
    .filter((r) => !late || isLateReview(r, now))
    // Waiting work oldest first (that's the order to review it in); everything else newest first.
    .sort((a, b) => (status === "waiting" ? a.submitted_at.localeCompare(b.submitted_at) : b.submitted_at.localeCompare(a.submitted_at)));
  const pages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const shown = filtered.slice((Math.min(page, pages) - 1) * PER_PAGE, Math.min(page, pages) * PER_PAGE);

  const qs = (next: Record<string, string>) => {
    const merged: Record<string, string> = { status, group, late: late ? "1" : "", q, page: "", ...next };
    const s = new URLSearchParams(Object.entries(merged).filter(([k, v]) => v && !(k === "status" && v === "waiting")));
    return `/admin/submissions${s.size ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("intro", { days: SERVICE_LEVELS.reviewDays })}>
        <Tabs
          label={t("statusLabel")}
          current={status}
          tabs={STATUSES.map((s) => ({ key: s, label: t(`statuses.${s}`), href: qs({ status: s, late: "" }), count: counts[s] }))}
        />
      </PageHeader>

      <form className="flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
        {status !== "waiting" && <input type="hidden" name="status" value={status} />}
        <label className="relative flex-1">
          <span className="sr-only">{t("search")}</span>
          <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-soft" />
          <input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} className="field pl-10" />
        </label>
        <select name="group" defaultValue={group} aria-label={t("groupLabel")} className="field sm:w-64">
          <option value="">{t("allGroups")}</option>
          {(cohorts ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input type="checkbox" name="late" value="1" defaultChecked={late} className="size-4 accent-coral" />
          {t("lateOnly", { days: SERVICE_LEVELS.reviewDays })}
        </label>
        <button type="submit" className="btn btn-secondary px-4 py-2.5 text-sm">{t("apply")}</button>
      </form>

      {lateCount > 0 && !late && (
        <Link href={qs({ status: "waiting", late: "1" })} className="card flex items-center gap-2 border-coral/40 bg-coral/5 p-4 text-sm hover:border-coral">
          <Icon name="alert" size={16} className="text-danger" />
          {t("lateBanner", { count: lateCount, days: SERVICE_LEVELS.reviewDays })}
        </Link>
      )}

      {shown.length === 0 ? (
        <EmptyState title={status === "waiting" && !q && !late ? t("allCaughtUp") : t("noResults")} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[880px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-soft">
                <th className="label-caps px-5 py-3 font-semibold">{t("columns.student")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.activity")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.submitted")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.status")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.feedback")}</th>
                <th className="px-5 py-3"><span className="sr-only">{t("columns.open")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((r) => {
                const days = daysBetween(r.submitted_at, now);
                const lastFeedback = [...r.feedback].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
                const tz = (cohorts ?? []).find((c) => c.id === r.cohort_id)?.timezone ?? admin.timezone;
                return (
                  <tr key={r.id} className="align-top transition-colors hover:bg-surface-2/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/people/${r.student_id}`} className="flex flex-col hover:text-info">
                        <span className="font-medium">{r.student?.full_name}</span>
                        <span className="text-[12px] text-soft">{groupName.get(r.cohort_id)}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-soft">{t("weekShort", { week: r.activity?.week ?? 0 })} · </span>
                      {tr(r.activity?.title)}
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {formatDate(r.submitted_at, tz)}
                      <span className="block text-[12px] text-soft">{t("daysAgo", { days })}</span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="flex flex-wrap gap-1">
                        <Badge tone={SUBMISSION_TONE[r.status]}>{t(`statuses.${r.status === "submitted" ? "waiting" : r.status}`)}</Badge>
                        {isLateReview(r, now) && <Badge tone="coral">{t("lateBadge")}</Badge>}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[13px]">
                      {lastFeedback ? (
                        <>
                          <span className="font-medium">{lastFeedback.mentor?.full_name ?? t("someone")}</span>
                          <span className="block text-soft">{formatDate(lastFeedback.created_at, tz)}</span>
                        </>
                      ) : (
                        <span className="text-soft">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={`/mentor/groups/${r.cohort_id}/students/${r.student_id}#activity-${r.activity_id}`}
                        className="whitespace-nowrap font-medium text-info hover:underline"
                      >
                        {r.status === "submitted" ? t("review") : t("open")} →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 && (
        <nav aria-label={t("pagination")} className="flex items-center justify-between gap-3 text-sm">
          <span className="text-soft">{t("pageOf", { page: Math.min(page, pages), pages, total: filtered.length })}</span>
          <span className="flex gap-2">
            {page > 1 && <Link href={qs({ page: String(page - 1) })} className="btn btn-secondary px-3 py-1.5">{t("previous")}</Link>}
            {page < pages && <Link href={qs({ page: String(page + 1) })} className="btn btn-secondary px-3 py-1.5">{t("next")}</Link>}
          </span>
        </nav>
      )}
    </>
  );
}
