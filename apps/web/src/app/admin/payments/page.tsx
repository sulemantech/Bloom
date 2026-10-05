import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader, Stat, Tabs } from "@/components/AppShell";
import { Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { MembershipForm } from "../forms";

export const metadata: Metadata = { title: "Payments" };

const STATUSES = ["all", "unpaid", "paid", "refunded"] as const;
type PaymentStatus = Exclude<(typeof STATUSES)[number], "all">;

const money = (n: number) => `Rs ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(n)}`;

export default async function PaymentsPage({ searchParams }: PageProps<"/admin/payments">) {
  await requireRole("admin");
  const t = await getTranslations("adminPayments");
  const params = await searchParams;
  const status = STATUSES.find((s) => s === params.status) ?? "all";
  const group = typeof params.group === "string" ? params.group : "";
  const supabase = await createClient();

  const [{ data: rows }, { data: cohorts }] = await Promise.all([
    supabase
      .from("memberships")
      .select("id, cohort_id, age_group, fee_amount, discount_reason, paid_at, refunded_at, user:profiles(id, full_name, username)")
      .eq("role", "student"),
    supabase.from("cohorts").select("id, name").order("created_at"),
  ]);

  const statusOf = (m: { paid_at: string | null; refunded_at: string | null }): PaymentStatus =>
    m.refunded_at ? "refunded" : m.paid_at ? "paid" : "unpaid";
  const inGroup = (rows ?? []).filter((m) => m.user && (!group || m.cohort_id === group));
  const list = inGroup
    .filter((m) => status === "all" || statusOf(m) === status)
    .sort((a, b) => a.user!.full_name.localeCompare(b.user!.full_name));

  const sum = (s: PaymentStatus) => inGroup.filter((m) => statusOf(m) === s).reduce((n, m) => n + Number(m.fee_amount ?? 0), 0);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, s === "all" ? inGroup.length : inGroup.filter((m) => statusOf(m) === s).length]));
  const cohortName = new Map((cohorts ?? []).map((c) => [c.id, c.name]));
  const href = (next: { status?: string; group?: string }) => {
    const p = new URLSearchParams(Object.entries({ status, group, ...next }).filter(([k, v]) => v && !(k === "status" && v === "all")));
    return `/admin/payments${p.size ? `?${p}` : ""}`;
  };

  return (
    <>
      <PageHeader title={t("title")} description={t("intro")}>
        <Tabs
          label={t("statusLabel")}
          current={status}
          tabs={STATUSES.map((s) => ({ key: s, label: t(`statuses.${s}`), href: href({ status: s }), count: counts[s] }))}
        />
      </PageHeader>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <li><Stat value={money(sum("paid"))} label={t("collected")} tone="success" /></li>
        <li><Stat value={money(sum("unpaid"))} label={t("outstanding", { count: counts.unpaid })} tone={counts.unpaid ? "danger" : undefined} /></li>
        <li><Stat value={money(sum("refunded"))} label={t("refunded")} /></li>
      </ul>

      {(cohorts ?? []).length > 1 && (
        <nav className="flex flex-wrap gap-2" aria-label={t("groupLabel")}>
          <Link href={href({ group: "" })} className={`rounded-full px-3 py-1 text-sm ${!group ? "bg-text text-bg" : "bg-surface-2 text-muted"}`}>
            {t("allGroups")}
          </Link>
          {(cohorts ?? []).map((c) => (
            <Link key={c.id} href={href({ group: c.id })} className={`rounded-full px-3 py-1 text-sm ${group === c.id ? "bg-text text-bg" : "bg-surface-2 text-muted"}`}>
              {c.name}
            </Link>
          ))}
        </nav>
      )}

      {list.length === 0 ? (
        <EmptyState title={t("empty")} />
      ) : (
        <ul className="card flex flex-col divide-y divide-border">
          {list.map((m) => {
            const s = statusOf(m);
            return (
              <li key={m.id} className="flex flex-col gap-3 p-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex flex-col">
                    <Link href={`/admin/people/${m.user!.id}`} className="font-medium hover:text-info">{m.user!.full_name}</Link>
                    <span className="text-[13px] text-soft">
                      {cohortName.get(m.cohort_id)}
                      {m.discount_reason ? ` · ${m.discount_reason}` : ""}
                    </span>
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums">{m.fee_amount !== null ? money(Number(m.fee_amount)) : <span className="text-soft">{t("noFee")}</span>}</span>
                    <Badge tone={s === "paid" ? "lime" : s === "refunded" ? "neutral" : "coral"}>{t(`statuses.${s}`)}</Badge>
                  </span>
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-info">{t("update")}</summary>
                  <div className="mt-3">
                    <MembershipForm membership={m} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
