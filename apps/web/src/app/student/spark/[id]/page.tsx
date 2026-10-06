import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/AppShell";
import { BloomPathDetail, PathStatusBadge } from "@/components/bloom";
import { Badge, STEP_TONE } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { aiConfigured } from "@/lib/ai";
import { nextStepToWrite } from "@/lib/bloom/adaptive";
import { hasConsent, loadBloomPath } from "@/lib/data/bloom";
import { bloomV2Enabled } from "@/lib/flags";
import { createClient } from "@/lib/supabase/server";
import { AddTaskForm, AskForm, PathActions, TaskControls, WriteStepButton } from "../forms";

export const metadata: Metadata = { title: "Learning path" };

export default async function StudentPathPage({ params }: PageProps<"/student/spark/[id]">) {
  const { id } = await params;
  const profile = await requireRole("student");
  const t = await getTranslations("bloom");
  const supabase = await createClient();
  const [path, consent, adaptive] = await Promise.all([
    loadBloomPath(supabase, id),
    hasConsent(supabase, profile.id, "bloom_ai"),
    bloomV2Enabled(profile.id),
  ]);
  if (!path || path.student_id !== profile.id) notFound();
  const canAsk = consent && aiConfigured();

  // Outline steps are written by Spark when the student reaches them. The waiting step offers
  // "Write this step" (if finishing the last one couldn't), or plain controls without the AI.
  const waiting = nextStepToWrite(path.tasks);
  const controls = (task: (typeof path.tasks)[number]) => {
    if (task.planned_only) {
      if (task.id !== waiting?.id) return null;
      return canAsk ? <WriteStepButton pathId={path.id} /> : <TaskControls task={task} />;
    }
    const following = path.tasks[path.tasks.indexOf(task) + 1];
    return <TaskControls task={task} adaptive={adaptive} writesNext={canAsk && Boolean(following?.planned_only)} />;
  };

  return (
    <>
      <Link href="/student/spark" className="text-sm font-medium text-info">← {t("back")}</Link>
      <PageHeader
        eyebrow={
          <>
            <PathStatusBadge status={path.status} />
            {path.stage_key && <Badge tone={STEP_TONE[path.stage_key] ?? "neutral"}>{t(`steps.${path.stage_key}`)}</Badge>}
            <span>{t(`depths.${path.depth}`)}</span>
          </>
        }
        title={path.title}
        description={path.goal || undefined}
        actions={<PathActions pathId={path.id} status={path.status} />}
      />

      {path.status === "completed" && (
        <p className="card border-lime/50 bg-lime/10 p-4 text-[15px] text-success">{t("celebrate")}</p>
      )}

      <BloomPathDetail
        path={path}
        timeZone={profile.timezone}
        taskControls={controls}
        questionSlot={canAsk ? (taskId) => <AskForm pathId={path.id} taskId={taskId} compact={taskId !== null} /> : undefined}
      />

      <section className="card flex flex-col gap-3 p-5" aria-labelledby="add-heading">
        <h2 id="add-heading" className="font-display-tight text-lg">{t("addOwnTask")}</h2>
        <AddTaskForm pathId={path.id} />
      </section>
    </>
  );
}
