import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader, Tabs } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import { describeAudit } from "./describe";

export const metadata: Metadata = { title: "Activity log" };

const PAGE_SIZE = 50;

const FILTERS: Record<string, string[] | null> = {
  all: null,
  people: ["profiles", "guardian_links", "consents", "invitations"],
  groups: ["cohorts", "memberships"],
  work: ["submissions", "submission_files", "feedback", "progress_cards", "projects"],
  bloom: ["bloom_paths", "bloom_tasks", "bloom_questions"],
};

export default async function ActivityLog({ searchParams }: PageProps<"/admin/activity">) {
  const profile = await requireRole("admin");
  const t = await getTranslations("audit");
  const { filter: filterParam, page: pageParam } = await searchParams;
  const filter = typeof filterParam === "string" && filterParam in FILTERS ? filterParam : "all";
  const page = Math.max(1, Number(pageParam) || 1);
  const supabase = await createClient();

  let query = supabase.from("audit_log").select("*").order("at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  if (FILTERS[filter]) query = query.in("entity", FILTERS[filter]!);
  const [{ data: rows }, { data: people }] = await Promise.all([query, supabase.from("profiles").select("id, full_name, username")]);

  const names = new Map((people ?? []).map((p) => [p.id, p.full_name || p.username || ""]));
  const list = (rows ?? []).slice(0, PAGE_SIZE);
  const hasMore = (rows ?? []).length > PAGE_SIZE;
  const descriptions = await Promise.all(list.map((r) => describeAudit(r, names)));
  const href = (f: string, p = 1) => `/admin/activity?filter=${f}${p > 1 ? `&page=${p}` : ""}`;

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")}>
        <Tabs
          label={t("filterLabel")}
          current={filter}
          tabs={Object.keys(FILTERS).map((f) => ({ key: f, label: t(`filters.${f}`), href: href(f) }))}
        />
      </PageHeader>

      {list.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <div className="card overflow-hidden">
          <ul className="flex flex-col divide-y divide-border">
            {list.map((r, i) => (
              <li key={r.id} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                <span className="text-[15px]">
                  <span className="font-medium">{r.actor_id ? names.get(r.actor_id) || t("someone") : t("system")}</span>{" "}
                  <span className="text-muted">{descriptions[i]}</span>
                </span>
                <span className="shrink-0 text-[13px] text-soft">{formatDateTime(r.at, profile.timezone)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <nav className="flex items-center justify-between gap-2" aria-label={t("pages")}>
        {page > 1 ? <Link href={href(filter, page - 1)} className="btn btn-secondary px-4 py-2 text-sm">← {t("newer")}</Link> : <span />}
        {hasMore && <Link href={href(filter, page + 1)} className="btn btn-secondary px-4 py-2 text-sm">{t("older")} →</Link>}
      </nav>
    </>
  );
}
