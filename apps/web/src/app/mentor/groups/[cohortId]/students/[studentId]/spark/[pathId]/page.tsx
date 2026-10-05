import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/AppShell";
import { BloomPathDetail, PathStatusBadge } from "@/components/bloom";
import { Badge, STEP_TONE } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { loadBloomPath } from "@/lib/data/bloom";
import { createClient } from "@/lib/supabase/server";
import { BloomNoteForm } from "../../../../../../forms";

export const metadata: Metadata = { title: "Learning path" };

export default async function MentorBloomPath({ params }: PageProps<"/mentor/groups/[cohortId]/students/[studentId]/spark/[pathId]">) {
  const { cohortId, studentId, pathId } = await params;
  const profile = await requireRole("mentor", "admin");
  const t = await getTranslations("bloom");
  const supabase = await createClient();
  const [path, { data: student }] = await Promise.all([
    loadBloomPath(supabase, pathId),
    supabase.from("profiles").select("full_name").eq("id", studentId).maybeSingle(),
  ]);
  if (!path || path.student_id !== studentId || !student) notFound();

  return (
    <>
      <Link href={`/mentor/groups/${cohortId}/students/${studentId}`} className="text-sm font-medium text-info">
        ← {t("backToStudent", { name: student.full_name })}
      </Link>
      <PageHeader
        eyebrow={
          <>
            <PathStatusBadge status={path.status} />
            {path.stage_key && <Badge tone={STEP_TONE[path.stage_key] ?? "neutral"}>{t(`steps.${path.stage_key}`)}</Badge>}
            {path.ai_generated && <span className="text-ai">✦ {t("byBloom")}</span>}
          </>
        }
        title={path.title}
        description={path.goal || undefined}
      />
      <BloomPathDetail
        path={path}
        timeZone={profile.timezone}
        mentorSlot={<BloomNoteForm pathId={path.id} note={path.mentor_note} />}
      />
    </>
  );
}
