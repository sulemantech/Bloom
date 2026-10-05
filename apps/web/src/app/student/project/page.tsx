import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireRole } from "@/lib/auth";
import { loadStudentOverview } from "@/lib/data/overview";
import { createClient } from "@/lib/supabase/server";
import { ProjectForm } from "../ProjectForm";

export const metadata: Metadata = { title: "My project" };

export default async function ProjectPage() {
  const profile = await requireRole("student");
  const t = await getTranslations("project");
  const supabase = await createClient();
  const overview = await loadStudentOverview(supabase, profile.id);
  if (!overview) redirect("/student");

  return (
    <>
      <Link href="/student" className="text-sm font-medium text-info">← {t("back")}</Link>
      <header className="flex flex-col gap-1">
        <h1 className="font-display-tight text-[28px] leading-tight">{t("heading")}</h1>
        <p className="text-muted">{t("intro")}</p>
      </header>
      <ProjectForm cohortId={overview.cohort.id} project={overview.project} />
    </>
  );
}
