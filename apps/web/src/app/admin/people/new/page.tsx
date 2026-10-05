import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader, Tabs } from "@/components/AppShell";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AddAdultForm, AddStudentForm } from "../../forms";

export const metadata: Metadata = { title: "Add a person" };

export default async function NewPersonPage({ searchParams }: PageProps<"/admin/people/new">) {
  await requireRole("admin");
  const t = await getTranslations("adminPeople");
  const { type: typeParam, parent, role } = await searchParams;
  const type = typeParam === "adult" ? "adult" : "student";
  const supabase = await createClient();

  const [{ data: cohorts }, { data: parents }] = await Promise.all([
    supabase.from("cohorts").select("id, name").order("created_at"),
    supabase.from("profiles").select("id, full_name").eq("role", "parent").order("full_name"),
  ]);
  const defaultRole = role === "mentor" || role === "admin" ? role : "parent";

  return (
    <>
      <Link href="/admin/people" className="text-sm font-medium text-info">← {t("back")}</Link>
      <PageHeader title={t("newTitle")} description={type === "student" ? t("newStudentIntro") : t("newAdultIntro")}>
        <Tabs
          label={t("newTitle")}
          current={type}
          tabs={[
            { key: "student", label: t("newStudentTab"), href: "/admin/people/new?type=student" },
            { key: "adult", label: t("newAdultTab"), href: "/admin/people/new?type=adult" },
          ]}
        />
      </PageHeader>

      <section className="card p-5 sm:p-6">
        {type === "student" ? (
          (parents ?? []).length === 0 ? (
            <div className="flex flex-col items-start gap-3">
              <p className="text-muted">{t("needParentFirst")}</p>
              <Link href="/admin/people/new?type=adult" className="btn btn-primary px-4 py-2 text-sm">{t("inviteAdult")}</Link>
            </div>
          ) : (
            <AddStudentForm
              parents={(parents ?? []).map((p) => ({ id: p.id, label: p.full_name || p.id }))}
              cohorts={cohorts ?? []}
              defaultParentId={typeof parent === "string" ? parent : undefined}
            />
          )
        ) : (
          <AddAdultForm cohorts={cohorts ?? []} devMode={process.env.ENABLE_DEV_PASSWORD_LOGIN === "true"} defaultRole={defaultRole} />
        )}
      </section>
    </>
  );
}
