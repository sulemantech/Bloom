import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { EmptyState, PageHeader, Tabs } from "@/components/AppShell";
import { AGE_GROUP_TONE, Badge, type Tone } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/lib/auth";
import { displayEmail, isDeactivated, loadAuthInfo } from "@/lib/data/admin";
import { formatDate } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "People" };

const ROLES = ["all", "student", "parent", "mentor", "admin"] as const;
const ROLE_TONE: Record<string, Tone> = { student: "lime", parent: "sun", mentor: "cyan", admin: "violet" };

export default async function PeoplePage({ searchParams }: PageProps<"/admin/people">) {
  const profile = await requireRole("admin");
  const t = await getTranslations("adminPeople");
  const params = await searchParams;
  const role = ROLES.find((r) => r === params.role) ?? "all";
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const filter = typeof params.filter === "string" ? params.filter : "";
  const supabase = await createClient();

  const [{ data: people }, { data: memberships }, { data: links }, auth] = await Promise.all([
    supabase.from("profiles").select("id, role, full_name, username, created_at").order("full_name"),
    supabase.from("memberships").select("user_id, role, age_group, cohort:cohorts(id, name)"),
    supabase.from("guardian_links").select("parent_id, student_id"),
    loadAuthInfo(),
  ]);

  const all = people ?? [];
  const nameById = new Map(all.map((p) => [p.id, p.full_name || p.username || ""]));
  const counts = Object.fromEntries(ROLES.map((r) => [r, r === "all" ? all.length : all.filter((p) => p.role === r).length]));

  const rows = all
    .map((p) => {
      const info = auth.get(p.id);
      const groups = (memberships ?? []).filter((m) => m.user_id === p.id && m.cohort);
      const family =
        p.role === "student"
          ? (links ?? []).filter((l) => l.student_id === p.id).map((l) => nameById.get(l.parent_id))
          : (links ?? []).filter((l) => l.parent_id === p.id).map((l) => nameById.get(l.student_id));
      return { ...p, info, email: displayEmail(info?.email), groups, family: family.filter(Boolean) as string[] };
    })
    .filter((p) => role === "all" || p.role === role)
    .filter((p) => !q || [p.full_name, p.username ?? "", p.email].some((v) => v.toLowerCase().includes(q)))
    .filter((p) => {
      if (filter === "ungrouped") return p.role === "student" && p.groups.length === 0;
      if (filter === "invited") return p.role !== "student" && !p.info?.lastSignInAt;
      if (filter === "deactivated") return isDeactivated(p.info);
      return true;
    });

  const qs = (next: Record<string, string>) => {
    const merged: Record<string, string> = { role, q, filter, ...next };
    const s = new URLSearchParams(Object.entries(merged).filter(([k, v]) => v && !(k === "role" && v === "all")));
    return `/admin/people${s.size ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        description={t("intro")}
        actions={
          <>
            <Link href="/admin/people/new?type=student" className="btn btn-primary px-4 py-2 text-sm">
              <Icon name="plus" size={16} />
              {t("addStudent")}
            </Link>
            <Link href="/admin/people/new?type=adult" className="btn btn-secondary px-4 py-2 text-sm">{t("inviteAdult")}</Link>
          </>
        }
      >
        <Tabs
          label={t("rolesLabel")}
          current={role}
          tabs={ROLES.map((r) => ({ key: r, label: t(`roles.${r}`), href: qs({ role: r, filter: "" }), count: counts[r] }))}
        />
      </PageHeader>

      <form className="flex flex-col gap-2 sm:flex-row sm:items-center" role="search">
        {role !== "all" && <input type="hidden" name="role" value={role} />}
        <label className="relative flex-1">
          <span className="sr-only">{t("search")}</span>
          <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-soft" />
          <input name="q" defaultValue={q} placeholder={t("searchPlaceholder")} className="field pl-10" />
        </label>
        <select name="filter" defaultValue={filter} aria-label={t("filterLabel")} className="field sm:w-56">
          <option value="">{t("filters.none")}</option>
          <option value="ungrouped">{t("filters.ungrouped")}</option>
          <option value="invited">{t("filters.invited")}</option>
          <option value="deactivated">{t("filters.deactivated")}</option>
        </select>
        <button type="submit" className="btn btn-secondary px-4 py-2.5 text-sm">{t("apply")}</button>
      </form>

      {rows.length === 0 ? (
        <EmptyState title={t("noResults")} body={q || filter ? t("noResultsHint") : undefined} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-soft">
                <th className="label-caps px-5 py-3 font-semibold">{t("columns.name")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.role")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.groups")}</th>
                <th className="label-caps px-3 py-3 font-semibold">{t("columns.family")}</th>
                <th className="label-caps px-5 py-3 font-semibold">{t("columns.status")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((p) => (
                <tr key={p.id} className="transition-colors hover:bg-surface-2/60">
                  <td className="px-5 py-3">
                    <Link href={`/admin/people/${p.id}`} className="flex flex-col hover:text-info">
                      <span className="font-medium">
                        {p.full_name || p.email || p.username}
                        {p.id === profile.id && <span className="ml-1.5 text-[12px] text-soft">({t("you")})</span>}
                      </span>
                      <span className="text-[13px] text-soft">{p.role === "student" ? `@${p.username}` : p.email}</span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={ROLE_TONE[p.role]}>{t(`roles.${p.role}`)}</Badge>
                  </td>
                  <td className="px-3 py-3">
                    {p.groups.length === 0 ? (
                      <span className={p.role === "student" ? "text-warning" : "text-soft"}>{t("noGroup")}</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {p.groups.map((m) => (
                          <span key={m.cohort!.id} className="flex items-center gap-1">
                            {m.cohort!.name}
                            {m.age_group && <Badge tone={AGE_GROUP_TONE[m.age_group]}>{t(`ageGroups.${m.age_group}`)}</Badge>}
                          </span>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-muted">{p.family.join(", ") || <span className="text-soft">—</span>}</td>
                  <td className="px-5 py-3 text-[13px]">
                    {isDeactivated(p.info) ? (
                      <Badge tone="coral">{t("status.deactivated")}</Badge>
                    ) : p.info?.lastSignInAt ? (
                      <span className="text-muted">{t("status.lastSignIn", { date: formatDate(p.info.lastSignInAt, profile.timezone) })}</span>
                    ) : (
                      <Badge tone="sun">{t("status.neverSignedIn")}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
