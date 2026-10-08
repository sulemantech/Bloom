import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/AppShell";
import { LastActive } from "@/components/bloom";
import { ProgressBar, WeekHeadline, WeekStrip } from "@/components/course";
import { AGE_GROUP_TONE, Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { requireRole } from "@/lib/auth";
import { loadAuthInfo } from "@/lib/data/admin";
import { loadLastActive } from "@/lib/data/bloom";
import { loadCohortProgress } from "@/lib/data/cohort";
import { cardsRead } from "@/lib/operations";
import { createClient } from "@/lib/supabase/server";
import { AddMemberForm, CohortSettingsForm, DeleteCohortForm, MembershipForm, RemoveMemberButton } from "../../forms";

export const metadata: Metadata = { title: "Group" };

type Schedule = { weekday?: number; start?: string; end?: string } | null;

export default async function AdminGroupPage({ params }: PageProps<"/admin/groups/[id]">) {
  const { id } = await params;
  await requireRole("admin");
  const t = await getTranslations("adminGroup");
  const supabase = await createClient();

  const [progress, { data: members }, { data: people }, { data: allStudentMemberships }, { count: submissions }] = await Promise.all([
    loadCohortProgress(supabase, id),
    supabase
      .from("memberships")
      .select("id, role, age_group, fee_amount, discount_reason, paid_at, refunded_at, user:profiles(id, full_name, username)")
      .eq("cohort_id", id),
    supabase.from("profiles").select("id, role, full_name, username").order("full_name"),
    supabase.from("memberships").select("user_id").eq("role", "student"),
    supabase.from("submissions").select("*", { count: "exact", head: true }).eq("cohort_id", id),
  ]);
  if (!progress) notFound();
  const { cohort } = progress;

  const memberList = members ?? [];
  const students = memberList.filter((m) => m.role === "student" && m.user).sort((a, b) => a.user!.full_name.localeCompare(b.user!.full_name));
  const mentors = memberList.filter((m) => m.role === "mentor" && m.user);
  const inAnyGroup = new Set((allStudentMemberships ?? []).map((m) => m.user_id));
  const freeStudents = (people ?? [])
    .filter((p) => p.role === "student" && !inAnyGroup.has(p.id))
    .map((p) => ({ id: p.id, label: `${p.full_name} (@${p.username})` }));
  const freeMentors = (people ?? [])
    .filter((p) => (p.role === "mentor" || p.role === "admin") && !mentors.some((m) => m.user!.id === p.id))
    .map((p) => ({ id: p.id, label: p.full_name || p.id }));
  const studentIds = students.map((s) => s.user!.id);
  const [lastActive, { data: guardians }, auth] = await Promise.all([
    loadLastActive(supabase, studentIds),
    supabase.from("guardian_links").select("student_id, parent:profiles!guardian_links_parent_id_fkey(id, full_name)").in("student_id", studentIds),
    loadAuthInfo(),
  ]);
  // Families: who the parents are, whether they have ever signed in, and which progress cards they read.
  const parentsOf = (studentId: string) =>
    (guardians ?? []).filter((g) => g.student_id === studentId && g.parent).map((g) => ({ ...g.parent!, signedIn: Boolean(auth.get(g.parent!.id)?.lastSignInAt) }));
  const cardsFor = (studentId: string) => cardsRead(progress.cards.filter((c) => c.student_id === studentId));
  const groupCards = cardsRead(progress.cards);
  const quietParents = new Set((guardians ?? []).filter((g) => g.parent && !auth.get(g.parent.id)?.lastSignInAt).map((g) => g.parent!.id)).size;
  const progressById = new Map(progress.students.map((s) => [s.profile.id, s]));

  return (
    <>
      <Link href="/admin/groups" className="text-sm font-medium text-info">← {t("back")}</Link>
      <PageHeader
        title={cohort.name}
        actions={
          <Link href={`/mentor/groups/${id}`} className="btn btn-primary px-4 py-2 text-sm">
            {t("openMentorView")}
          </Link>
        }
      >
        <WeekHeadline overview={progress} />
        <WeekStrip overview={progress} />
      </PageHeader>

      <section className="card flex flex-col gap-4 p-5" aria-labelledby="students-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="students-heading" className="font-display-tight text-lg">{t("students", { count: students.length })}</h2>
          <Link href="/admin/people/new?type=student" className="flex items-center gap-1 text-sm font-medium text-info">
            <Icon name="plus" size={16} />
            {t("createStudent")}
          </Link>
        </div>
        {students.length > 0 && (
          <p className="text-[13px] text-soft">
            {groupCards.sent ? t("familyCards", { read: groupCards.read, sent: groupCards.sent }) : t("familyNoCards")}
            {quietParents > 0 && <span className="text-warning"> · {t("familyQuiet", { count: quietParents })}</span>}
          </p>
        )}
        {students.length === 0 && <p className="text-sm text-muted">{t("noStudents")}</p>}
        <ul className="flex flex-col divide-y divide-border">
          {students.map((m) => {
            const p = progressById.get(m.user!.id);
            return (
              <li key={m.id} className="flex flex-col gap-3 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="flex flex-col">
                    <Link href={`/admin/people/${m.user!.id}`} className="flex flex-wrap items-center gap-2 font-medium hover:text-info">
                      {m.user!.full_name}
                      {m.age_group && <Badge tone={AGE_GROUP_TONE[m.age_group]}>{t(`ageGroups.${m.age_group}`)}</Badge>}
                      <Badge tone={m.refunded_at ? "neutral" : m.paid_at ? "lime" : "coral"}>
                        {m.refunded_at ? t("refunded") : m.paid_at ? t("paid") : t("unpaid")}
                      </Badge>
                    </Link>
                    <span className="text-[13px]">
                      <span className="text-soft">@{m.user!.username} · </span>
                      <LastActive at={lastActive.get(m.user!.id) ?? null} />
                    </span>
                    <span className="flex flex-wrap items-center gap-x-1.5 text-[12px] text-soft">
                      {parentsOf(m.user!.id).length === 0 ? (
                        <span className="text-warning">{t("noParent")}</span>
                      ) : (
                        parentsOf(m.user!.id).map((p) => (
                          <span key={p.id}>
                            <Link href={`/admin/people/${p.id}`} className="hover:text-info">{p.full_name}</Link>
                            {!p.signedIn && <span className="text-warning"> ({t("parentNeverSignedIn")})</span>}
                          </span>
                        ))
                      )}
                      {cardsFor(m.user!.id).sent > 0 && (
                        <span>· {t("cardsRead", { read: cardsFor(m.user!.id).read, sent: cardsFor(m.user!.id).sent })}</span>
                      )}
                    </span>
                  </span>
                  {p && (
                    <div className="w-full sm:w-56">
                      <ProgressBar value={p.done} max={p.total} label={t("doneOf", { done: p.done, total: p.total })} />
                    </div>
                  )}
                </div>
                <details>
                  <summary className="cursor-pointer text-sm font-medium text-info">{t("editEnrolment")}</summary>
                  <div className="mt-3 flex flex-col gap-3">
                    <MembershipForm membership={m} />
                    <RemoveMemberButton membershipId={m.id} />
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">{t("addStudent")}</p>
          <AddMemberForm cohortId={id} role="student" people={freeStudents} />
        </div>
      </section>

      <section className="card flex flex-col gap-4 p-5" aria-labelledby="mentors-heading">
        <h2 id="mentors-heading" className="font-display-tight text-lg">{t("mentors", { count: mentors.length })}</h2>
        {mentors.length === 0 && <p className="text-sm text-warning">{t("noMentors")}</p>}
        <ul className="flex flex-col divide-y divide-border">
          {mentors.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
              <Link href={`/admin/people/${m.user!.id}`} className="font-medium hover:text-info">{m.user!.full_name}</Link>
              <RemoveMemberButton membershipId={m.id} />
            </li>
          ))}
        </ul>
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-sm font-medium">{t("addMentor")}</p>
          <AddMemberForm cohortId={id} role="mentor" people={freeMentors} />
        </div>
      </section>

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="settings-heading">
        <h2 id="settings-heading" className="font-display-tight text-lg">{t("settings")}</h2>
        <CohortSettingsForm cohort={{ ...cohort, schedule: cohort.schedule as Schedule }} />
      </section>

      <section className="card flex flex-col gap-3 border-coral/40 p-5" aria-labelledby="delete-heading">
        <h2 id="delete-heading" className="font-display-tight text-lg text-danger">{t("dangerZone")}</h2>
        {submissions ? <p className="text-sm text-muted">{t("cantDelete")}</p> : <DeleteCohortForm cohortId={id} name={cohort.name} />}
      </section>
    </>
  );
}
