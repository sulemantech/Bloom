import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { AGE_GROUP_TONE, Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { formatDate } from "@/lib/programme";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { CreateCohortForm, DeleteStudentForm, InviteForm } from "./forms";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  const profile = await requireRole("admin");
  const t = await getTranslations("admin");
  const supabase = await createClient();

  const [{ data: cohorts }, { data: people }, { data: memberships }, { data: links }, users] = await Promise.all([
    supabase.from("cohorts").select("id, name, start_date, timezone").order("created_at"),
    supabase.from("profiles").select("id, role, full_name, username, created_at").order("full_name"),
    supabase.from("memberships").select("id, cohort_id, user_id, role, age_group, paid_at, refunded_at"),
    supabase.from("guardian_links").select("parent_id, student_id"),
    // Emails live in auth.users; read them server-side for admins only.
    createAdminClient().auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const emailById = new Map((users.data?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const all = people ?? [];
  const members = memberships ?? [];
  const students = all.filter((p) => p.role === "student");
  const parents = all.filter((p) => p.role === "parent");
  const mentors = all.filter((p) => p.role === "mentor" || p.role === "admin");
  const nameById = new Map(all.map((p) => [p.id, p.full_name || p.username || ""]));
  const cohortById = new Map((cohorts ?? []).map((c) => [c.id, c]));
  const studentMemberships = members.filter((m) => m.role === "student");
  const unpaid = studentMemberships.filter((m) => !m.paid_at && !m.refunded_at).length;
  const ungrouped = students.filter((s) => !studentMemberships.some((m) => m.user_id === s.id));

  const stats = [
    { label: t("stats.groups"), value: (cohorts ?? []).length },
    { label: t("stats.students"), value: students.length },
    { label: t("stats.parents"), value: parents.length },
    { label: t("stats.mentors"), value: mentors.length },
    { label: t("stats.unpaid"), value: unpaid, alert: unpaid > 0 },
  ];

  return (
    <AppShell profile={profile}>
      <h1 className="font-display-tight text-[28px] leading-tight">{t("title")}</h1>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <li key={s.label} className="card flex flex-col gap-1 p-4">
            <span className={`font-display-tight text-[28px] tabular-nums ${s.alert ? "text-danger" : ""}`}>{s.value}</span>
            <span className="text-[13px] text-soft">{s.label}</span>
          </li>
        ))}
      </ul>

      <section className="flex flex-col gap-3" aria-labelledby="groups-heading">
        <h2 id="groups-heading" className="label-caps text-soft">{t("groups")}</h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(cohorts ?? []).map((c) => {
            const inGroup = members.filter((m) => m.cohort_id === c.id);
            const groupStudents = inGroup.filter((m) => m.role === "student");
            const groupUnpaid = groupStudents.filter((m) => !m.paid_at && !m.refunded_at).length;
            return (
              <li key={c.id}>
                <Link href={`/admin/groups/${c.id}`} className="card flex flex-col gap-2 p-5 transition-colors hover:border-cyan">
                  <span className="font-display-tight text-lg">{c.name}</span>
                  <span className="text-sm text-muted">
                    {c.start_date ? t("starts", { date: formatDate(c.start_date, c.timezone) }) : t("startTbc")}
                  </span>
                  <span className="flex flex-wrap gap-2 text-[13px]">
                    <Badge>{t("studentsCount", { count: groupStudents.length })}</Badge>
                    <Badge>{t("mentorsCount", { count: inGroup.length - groupStudents.length })}</Badge>
                    {groupUnpaid > 0 && <Badge tone="coral">{t("unpaidCount", { count: groupUnpaid })}</Badge>}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="card p-5">
          <h3 className="mb-3 font-display-tight text-lg">{t("newGroup")}</h3>
          <CreateCohortForm />
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="invite-heading">
        <h2 id="invite-heading" className="font-display-tight text-lg">{t("invite")}</h2>
        <p className="text-sm text-muted">{t("inviteIntro")}</p>
        <InviteForm cohorts={(cohorts ?? []).map((c) => ({ id: c.id, name: c.name }))} devMode={process.env.ENABLE_DEV_PASSWORD_LOGIN === "true"} />
      </section>

      {ungrouped.length > 0 && (
        <section className="card flex flex-col gap-2 border-sun/50 p-5" aria-labelledby="ungrouped-heading">
          <h2 id="ungrouped-heading" className="font-display-tight text-lg text-warning">{t("ungrouped", { count: ungrouped.length })}</h2>
          <p className="text-sm text-muted">{t("ungroupedIntro")}</p>
          <p className="text-sm">{ungrouped.map((s) => s.full_name).join(", ")}</p>
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="people-heading">
        <h2 id="people-heading" className="label-caps text-soft">{t("people")}</h2>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="card flex flex-col gap-3 p-5">
            <h3 className="font-display-tight text-lg">{t("students")}</h3>
            <ul className="flex flex-col divide-y divide-border">
              {students.map((s) => {
                const m = studentMemberships.find((x) => x.user_id === s.id);
                const parentNames = (links ?? []).filter((l) => l.student_id === s.id).map((l) => nameById.get(l.parent_id)).filter(Boolean);
                return (
                  <li key={s.id} className="flex flex-col gap-1 py-2.5">
                    <span className="flex flex-wrap items-center gap-2 font-medium">
                      {s.full_name}
                      {m?.age_group && <Badge tone={AGE_GROUP_TONE[m.age_group]}>{t(`ageGroups.${m.age_group}`)}</Badge>}
                    </span>
                    <span className="text-[13px] text-soft">
                      {s.username} · {m ? cohortById.get(m.cohort_id)?.name : t("noGroup")}
                      {parentNames.length > 0 && ` · ${t("parentOf", { names: parentNames.join(", ") })}`}
                    </span>
                    {s.username && <DeleteStudentForm studentId={s.id} username={s.username} />}
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card flex flex-col gap-3 p-5">
            <h3 className="font-display-tight text-lg">{t("parents")}</h3>
            <ul className="flex flex-col divide-y divide-border">
              {parents.map((p) => {
                const kids = (links ?? []).filter((l) => l.parent_id === p.id).map((l) => nameById.get(l.student_id)).filter(Boolean);
                return (
                  <li key={p.id} className="flex flex-col py-2.5">
                    <span className="font-medium">{p.full_name || emailById.get(p.id)}</span>
                    <span className="break-all text-[13px] text-soft">{emailById.get(p.id)}</span>
                    <span className="text-[13px] text-soft">{kids.length ? t("children", { names: kids.join(", ") }) : t("noChildren")}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <div className="card flex flex-col gap-3 p-5">
            <h3 className="font-display-tight text-lg">{t("mentors")}</h3>
            <ul className="flex flex-col divide-y divide-border">
              {mentors.map((m) => {
                const groups = members.filter((x) => x.user_id === m.id && x.role === "mentor").map((x) => cohortById.get(x.cohort_id)?.name);
                return (
                  <li key={m.id} className="flex flex-col py-2.5">
                    <span className="flex items-center gap-2 font-medium">
                      {m.full_name || emailById.get(m.id)}
                      {m.role === "admin" && <Badge tone="cyan">{t("adminBadge")}</Badge>}
                    </span>
                    <span className="break-all text-[13px] text-soft">{emailById.get(m.id)}</span>
                    <span className="text-[13px] text-soft">{groups.length ? groups.join(", ") : t("noGroup")}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
