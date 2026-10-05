import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/AppShell";
import { BloomPathList, LastActive, Timeline } from "@/components/bloom";
import { ProgressBar } from "@/components/course";
import { AGE_GROUP_TONE, Badge, type Tone } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { displayEmail, isDeactivated, loadAuthInfo } from "@/lib/data/admin";
import { loadTimeline } from "@/lib/data/bloom";
import { loadStudentOverview } from "@/lib/data/overview";
import { formatDate } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import {
  AccountActiveForm,
  DeletePersonForm,
  EditPersonForm,
  LinkGuardianForm,
  ResetStudentPasswordForm,
  SendLinkButton,
  UnlinkButton,
} from "../../forms";

export const metadata: Metadata = { title: "Person" };

const ROLE_TONE: Record<string, Tone> = { student: "lime", parent: "sun", mentor: "cyan", admin: "violet" };

function Card({ title, children, danger }: { title: string; children: React.ReactNode; danger?: boolean }) {
  return (
    <section className={`card flex flex-col gap-3 p-5 ${danger ? "border-coral/40" : ""}`}>
      <h2 className={`font-display-tight text-lg ${danger ? "text-danger" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}

export default async function PersonPage({ params, searchParams }: PageProps<"/admin/people/[id]">) {
  const { id } = await params;
  const { created } = await searchParams;
  const admin = await requireRole("admin");
  const t = await getTranslations("adminPerson");
  const supabase = await createClient();

  const [{ data: person }, { data: memberships }, { data: links }, { data: everyone }, { data: consents }, auth] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
    supabase.from("memberships").select("id, role, age_group, cohort:cohorts(id, name)").eq("user_id", id),
    supabase
      .from("guardian_links")
      .select("id, parent_id, student_id, parent:profiles!guardian_links_parent_id_fkey(id, full_name), student:profiles!guardian_links_student_id_fkey(id, full_name, username)")
      .or(`parent_id.eq.${id},student_id.eq.${id}`),
    supabase.from("profiles").select("id, role, full_name, username").in("role", ["parent", "student"]).order("full_name"),
    supabase.from("consents").select("type, granted_at, revoked_at").eq("student_id", id),
    loadAuthInfo(),
  ]);
  if (!person) notFound();

  const info = auth.get(id);
  const email = displayEmail(info?.email);
  const isStudent = person.role === "student";
  const isSelf = person.id === admin.id;
  const deactivated = isDeactivated(info);
  const linkList = links ?? [];
  const linkedIds = new Set(linkList.map((l) => (isStudent ? l.parent_id : l.student_id)));
  const linkOptions = (everyone ?? [])
    .filter((p) => p.role === (isStudent ? "parent" : "student") && !linkedIds.has(p.id))
    .map((p) => ({ id: p.id, label: p.role === "student" ? `${p.full_name} (@${p.username})` : p.full_name || p.id }));

  const overview = isStudent ? await loadStudentOverview(supabase, id) : null;
  const studentBase = overview ? `/mentor/groups/${overview.cohort.id}/students/${id}` : null;
  const timeline = isStudent
    ? await loadTimeline(supabase, id, overview, { bloomHref: studentBase ? (pathId) => `${studentBase}/bloom/${pathId}` : undefined })
    : null;
  const activeConsents = (consents ?? []).filter((c) => !c.revoked_at);

  return (
    <>
      <Link href={`/admin/people${isStudent ? "?role=student" : ""}`} className="text-sm font-medium text-info">← {t("back")}</Link>

      {created === "invited" && <p className="card border-lime/50 bg-lime/10 p-4 text-success">{t("createdInvited")}</p>}
      {created === "password" && <p className="card border-lime/50 bg-lime/10 p-4 text-success">{t("createdPassword")}</p>}

      <PageHeader
        eyebrow={
          <>
            <Badge tone={ROLE_TONE[person.role]}>{t(`roles.${person.role}`)}</Badge>
            {deactivated && <Badge tone="coral">{t("deactivated")}</Badge>}
            <span>{isStudent ? `@${person.username}` : email}</span>
          </>
        }
        title={person.full_name || email}
        description={t("since", { date: formatDate(person.created_at, admin.timezone) })}
        actions={studentBase ? <Link href={studentBase} className="btn btn-primary px-4 py-2 text-sm">{t("openStudentView")}</Link> : undefined}
      />

      {isStudent && (
        <div className="grid gap-4 lg:grid-cols-3">
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="label-caps text-soft">{t("learning")}</h2>
            {overview ? (
              <>
                <ProgressBar value={overview.stats.done} max={overview.stats.total} label={t("doneOf", { done: overview.stats.done, total: overview.stats.total })} />
                <p className="text-[13px] text-soft">{t("overdue", { count: overview.stats.overdue })}</p>
              </>
            ) : (
              <p className="text-sm text-warning">{t("notInGroup")}</p>
            )}
            <p className="text-sm">
              <LastActive at={timeline?.lastActive ?? null} />
            </p>
          </section>
          <section className="card flex flex-col gap-3 p-5 lg:col-span-2">
            <h2 className="label-caps text-soft">
              <span className="text-ai" aria-hidden="true">✦ </span>
              {t("bloom")}
            </h2>
            {studentBase ? (
              <BloomPathList paths={timeline?.paths ?? []} hrefFor={(pathId) => `${studentBase}/bloom/${pathId}`} />
            ) : (
              <p className="text-sm text-muted">{t("bloomNeedsGroup", { count: timeline?.paths.length ?? 0 })}</p>
            )}
          </section>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Card title={t("details")}>
            <EditPersonForm person={person} email={email} isSelf={isSelf} />
          </Card>

          {timeline && (
            <Card title={t("journey")}>
              <Timeline events={timeline.events} timeZone={overview?.cohort.timezone ?? admin.timezone} limit={15} />
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {(isStudent || person.role === "parent") && (
            <Card title={isStudent ? t("parents") : t("children")}>
              {linkList.length === 0 ? (
                <p className="text-sm text-muted">{isStudent ? t("noParents") : t("noChildren")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-border">
                  {linkList.map((l) => {
                    const other = isStudent ? l.parent : l.student;
                    return (
                      <li key={l.id} className="flex items-center justify-between gap-2 py-2">
                        <Link href={`/admin/people/${other?.id}`} className="font-medium hover:text-info">{other?.full_name}</Link>
                        <UnlinkButton linkId={l.id} />
                      </li>
                    );
                  })}
                </ul>
              )}
              <LinkGuardianForm fixed={isStudent ? "student" : "parent"} fixedId={id} options={linkOptions} />
              {!isStudent && (
                <Link href={`/admin/people/new?type=student&parent=${id}`} className="text-sm font-medium text-info">+ {t("addChild")}</Link>
              )}
            </Card>
          )}

          <Card title={isStudent ? t("group") : t("groups")}>
            {(memberships ?? []).length === 0 ? (
              <p className="text-sm text-muted">{isStudent ? t("notInGroup") : t("mentorsNoGroup")}</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {(memberships ?? []).map((m) => (
                  <li key={m.id} className="flex flex-wrap items-center gap-2">
                    <Link href={`/admin/groups/${m.cohort?.id}`} className="font-medium hover:text-info">{m.cohort?.name}</Link>
                    {m.age_group && <Badge tone={AGE_GROUP_TONE[m.age_group]}>{t(`ageGroups.${m.age_group}`)}</Badge>}
                    {m.role === "mentor" && <Badge tone="cyan">{t("mentorBadge")}</Badge>}
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[13px] text-soft">{t("groupHint")}</p>
          </Card>

          {isStudent && (
            <Card title={t("permissions")}>
              {activeConsents.length === 0 ? (
                <p className="text-sm text-muted">{t("noConsents")}</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {activeConsents.map((c) => (
                    <li key={c.type}>
                      <Badge tone="lime">{t(`consentTypes.${c.type}`)}</Badge>
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-[13px] text-soft">{t("permissionsHint")}</p>
            </Card>
          )}

          <Card title={t("account")}>
            <p className="text-sm text-muted">
              {info?.lastSignInAt ? t("lastSignIn", { date: formatDate(info.lastSignInAt, admin.timezone) }) : t("neverSignedIn")}
            </p>
            {isStudent ? (
              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium">{t("setPassword")}</p>
                <ResetStudentPasswordForm userId={id} />
              </div>
            ) : (
              !isSelf && <SendLinkButton userId={id} />
            )}
            {!isSelf && <AccountActiveForm userId={id} active={!deactivated} />}
          </Card>

          {!isSelf && (
            <Card title={t("dangerZone")} danger>
              <DeletePersonForm userId={id} confirmWith={isStudent ? person.username ?? "" : email} />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
