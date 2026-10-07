import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/AppShell";
import { BloomPathDetail, PathStatusBadge } from "@/components/bloom";
import { requireRole } from "@/lib/auth";
import { loadBloomPath } from "@/lib/data/bloom";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Learning path" };

/** Read-only: parents follow what their child is learning; row-level security limits it to their own child. */
export default async function ParentBloomPath({ params }: PageProps<"/parent/children/[id]/spark/[pathId]">) {
  const { id, pathId } = await params;
  const profile = await requireRole("parent");
  const t = await getTranslations("bloom");
  const supabase = await createClient();
  const path = await loadBloomPath(supabase, pathId);
  if (!path || path.student_id !== id) notFound();

  return (
    <>
      <Link href={`/parent/children/${id}`} className="text-sm font-medium text-info">← {t("backToChild")}</Link>
      <PageHeader eyebrow={<PathStatusBadge status={path.status} />} title={path.title} description={path.goal || undefined} />
      <BloomPathDetail path={path} timeZone={profile.timezone} showMarks={false} />
    </>
  );
}
