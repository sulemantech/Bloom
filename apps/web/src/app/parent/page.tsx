import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import { AGE_GROUP_TONE, Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddChildForm } from "./AddChildForm";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = { title: "Your family" };

export default async function ParentHome() {
  const profile = await requireRole("parent");
  const t = await getTranslations("parent");
  const supabase = await createClient();

  const { data: links } = await supabase
    .from("guardian_links")
    .select("student:profiles!guardian_links_student_id_fkey(id, full_name, username, birth_year)")
    .eq("parent_id", profile.id);
  const children = (links ?? []).flatMap((l) => (l.student ? [l.student] : []));

  const { data: memberships } = children.length
    ? await supabase
        .from("memberships")
        .select("user_id, age_group, cohort:cohorts(name)")
        .in("user_id", children.map((c) => c.id))
        .eq("role", "student")
    : { data: [] };

  return (
    <AppShell profile={profile}>
      <header className="flex flex-col gap-1">
        <h1 className="font-display-tight text-[28px] leading-tight">
          {t("title", { name: profile.full_name || "" })}
        </h1>
        <p className="text-muted">{t("intro")}</p>
      </header>

      <section className="flex flex-col gap-3" aria-labelledby="children-heading">
        <h2 id="children-heading" className="label-caps text-soft">{t("children")}</h2>
        {children.length === 0 ? (
          <p className="card p-6 text-muted">{t("noChildren")}</p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {children.map((child) => {
              const membership = memberships?.find((m) => m.user_id === child.id);
              return (
                <li key={child.id} className="card flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display-tight text-lg">{child.full_name}</p>
                      <p className="text-sm text-soft">
                        {t("usernameLabel")}: <span className="font-medium text-muted">{child.username}</span>
                      </p>
                    </div>
                    {membership?.age_group && (
                      <Badge tone={AGE_GROUP_TONE[membership.age_group]}>
                        {t(`ageGroups.${membership.age_group}`)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted">
                    {membership?.cohort?.name
                      ? t("inGroup", { group: membership.cohort.name })
                      : t("notInGroup")}
                  </p>
                  <Link href={`/parent/children/${child.id}`} className="btn btn-primary self-start px-4 py-2 text-sm">
                    {t("viewProgress")}
                  </Link>
                  <ResetPasswordForm studentId={child.id} />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AddChildForm />
    </AppShell>
  );
}
