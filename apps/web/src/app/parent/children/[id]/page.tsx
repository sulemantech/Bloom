import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BloomPathList, LastActive, Timeline } from "@/components/bloom";
import { ProgressBar, StatusBadge, SubmissionCard, WeekHeadline, WeekStrip } from "@/components/course";
import { SessionsCard } from "@/components/Sessions";
import { AGE_GROUP_TONE, AREA_TONE, Badge } from "@/components/ui/Badge";
import { requireRole } from "@/lib/auth";
import { bloomStats, loadTimeline } from "@/lib/data/bloom";
import { loadStudentOverview, signFiles } from "@/lib/data/overview";
import { formatDate, tr } from "@/lib/programme";
import { createClient } from "@/lib/supabase/server";
import { ConsentToggle } from "../../ConsentToggle";

export const metadata: Metadata = { title: "Your child" };

const OPTIONAL_CONSENTS = ["bloom_ai", "ai", "media", "public_portfolio"] as const;

export default async function ParentChildPage({ params }: PageProps<"/parent/children/[id]">) {
  const { id } = await params;
  const profile = await requireRole("parent");
  const t = await getTranslations("parentChild");
  const supabase = await createClient();

  // Row-level security returns the link only for this parent's own child.
  const { data: link } = await supabase
    .from("guardian_links")
    .select("student:profiles!guardian_links_student_id_fkey(id, full_name, username)")
    .eq("parent_id", profile.id)
    .eq("student_id", id)
    .maybeSingle();
  const child = link?.student;
  if (!child) notFound();

  const [overview, { data: cards }, { data: consents }] = await Promise.all([
    loadStudentOverview(supabase, id),
    supabase.from("progress_cards").select("id, week, body, approved_at, viewed_at").eq("student_id", id).order("week", { ascending: false }),
    supabase.from("consents").select("type, revoked_at").eq("student_id", id),
  ]);

  // Opening the page counts as reading the cards.
  await Promise.all(
    (cards ?? []).filter((c) => !c.viewed_at).map((c) => supabase.rpc("mark_progress_card_viewed", { p_card: c.id })),
  );

  const { events, lastActive, paths } = await loadTimeline(supabase, id, overview, {
    bloomHref: (pathId) => `/parent/children/${id}/spark/${pathId}`,
  });
  const bloom = bloomStats(paths);
  const timeZone = overview?.cohort.timezone ?? profile.timezone;

  const active = new Set((consents ?? []).filter((c) => !c.revoked_at).map((c) => c.type));
  const recent = overview
    ? overview.submissions.filter((s) => s.feedback.length > 0 || s.status !== "submitted").slice(0, 4)
    : [];
  const fileUrls = overview ? await signFiles(supabase, recent.flatMap((s) => s.submission_files.map((f) => f.storage_path))) : new Map();

  return (
    <>
      <Link href="/parent" className="text-sm font-medium text-info">← {t("back")}</Link>

      <header className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {overview && <span className="text-sm text-soft">{overview.cohort.name}</span>}
          {overview?.membership.age_group && (
            <Badge tone={AGE_GROUP_TONE[overview.membership.age_group]}>{t(`ageGroups.${overview.membership.age_group}`)}</Badge>
          )}
        </div>
        <h1 className="font-display-tight text-[28px] leading-tight">{child.full_name}</h1>
        <p className="text-sm">
          <LastActive at={lastActive} />
        </p>
        {overview ? (
          <>
            <WeekHeadline overview={overview} />
            <WeekStrip overview={overview} />
          </>
        ) : (
          <p className="text-muted">{t("noGroup")}</p>
        )}
      </header>

      {overview && (
        <div className="grid gap-4 md:grid-cols-3">
          <section className="card flex flex-col gap-3 p-5">
            <h2 className="label-caps text-soft">{t("progress")}</h2>
            <ProgressBar value={overview.stats.done} max={overview.stats.total} label={t("doneOf", { done: overview.stats.done, total: overview.stats.total })} />
            <p className="text-[13px] text-soft">{t("overdue", { count: overview.stats.overdue })}</p>
          </section>
          <section className="card flex flex-col gap-2 p-5">
            <h2 className="label-caps text-soft">{t("project")}</h2>
            {overview.project ? (
              <>
                <p className="font-display-tight text-lg">{overview.project.title || t("untitled")}</p>
                <Badge tone={AREA_TONE[overview.project.area]}>{t(`areas.${overview.project.area}`)}</Badge>
                {overview.project.problem && <p className="text-sm text-muted">{overview.project.problem}</p>}
              </>
            ) : (
              <p className="text-sm text-muted">{t("noProject")}</p>
            )}
          </section>
          <SessionsCard sessions={overview.sessions} timeZone={overview.cohort.timezone} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <section className="card flex flex-col gap-3 p-5 lg:col-span-3" aria-labelledby="bloom-heading">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="bloom-heading" className="font-display-tight text-lg">
              <span aria-hidden="true" className="text-ai">✦ </span>
              {t("bloom")}
            </h2>
            <span className="text-[13px] text-soft">{t("bloomSummary", { paths: bloom.paths, done: bloom.tasksDone })}</span>
          </div>
          <p className="text-[13px] text-soft">{t("bloomHint")}</p>
          <BloomPathList paths={paths} hrefFor={(pathId) => `/parent/children/${id}/spark/${pathId}`} />
        </section>
        <section className="card flex flex-col gap-3 p-5 lg:col-span-2" aria-labelledby="journey-heading">
          <h2 id="journey-heading" className="font-display-tight text-lg">{t("journey")}</h2>
          <Timeline events={events} timeZone={timeZone} limit={10} />
        </section>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="cards-heading">
        <h2 id="cards-heading" className="label-caps text-soft">{t("cards")}</h2>
        {(cards ?? []).length === 0 ? (
          <p className="card p-5 text-sm text-muted">{t("noCards")}</p>
        ) : (
          (cards ?? []).map((c) => (
            <article key={c.id} className="card flex flex-col gap-2 p-5">
              <header className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-display-tight text-lg">{t("cardTitle", { week: c.week })}</h3>
                {c.approved_at && overview && (
                  <span className="text-[13px] text-soft">{formatDate(c.approved_at, overview.cohort.timezone)}</span>
                )}
              </header>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </article>
          ))
        )}
      </section>

      {overview && recent.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="work-heading">
          <h2 id="work-heading" className="label-caps text-soft">{t("recentWork")}</h2>
          {recent.map((s) => {
            const activity = overview.activities.find((a) => a.id === s.activity_id);
            return (
              <div key={s.id} className="flex flex-col gap-2">
                <p className="flex flex-wrap items-center gap-2 font-medium">
                  {activity ? tr(activity.title) : ""}
                  <StatusBadge status={s.status} />
                </p>
                <SubmissionCard submission={s} fileUrls={fileUrls} timeZone={overview.cohort.timezone} />
              </div>
            );
          })}
        </section>
      )}

      <section className="card flex flex-col p-5" aria-labelledby="consent-heading">
        <h2 id="consent-heading" className="label-caps mb-1 text-soft">{t("permissions")}</h2>
        <p className="text-sm text-muted">{t("permissionsIntro")}</p>
        <div className="divide-y divide-border">
          {OPTIONAL_CONSENTS.map((type) => (
            <ConsentToggle key={type} studentId={id} type={type} granted={active.has(type)} />
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <a href={`/parent/children/${id}/export`} className="btn btn-secondary px-4 py-2 text-sm">{t("download")}</a>
          <span className="text-[13px] text-soft">{t("deleteHint")}</span>
        </div>
      </section>
    </>
  );
}
