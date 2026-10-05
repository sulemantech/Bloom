import { getTranslations } from "next-intl/server";
import type { StudentOverview } from "@/lib/data/overview";
import { formatDateTime, nextSession } from "@/lib/programme";

/** Next class (with join link) and past recordings for a cohort. */
export async function SessionsCard({ sessions, timeZone }: { sessions: StudentOverview["sessions"]; timeZone: string }) {
  const t = await getTranslations("sessions");
  const next = nextSession(sessions);
  const recordings = sessions.filter((s) => s.recording_url).reverse();

  return (
    <section className="card flex flex-col gap-4 p-5" aria-labelledby="sessions-heading">
      <h2 id="sessions-heading" className="label-caps text-soft">{t("title")}</h2>
      {next ? (
        <div className="flex flex-col gap-2">
          <p className="font-display-tight text-lg">{next.title || t("liveClass")}</p>
          <p className="text-sm text-muted">{formatDateTime(next.starts_at, timeZone)}</p>
          {next.join_url && (
            <a href={next.join_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary self-start px-5 py-2 text-sm">
              {t("join")}
            </a>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted">{t("none")}</p>
      )}
      {recordings.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-sm font-medium">{t("recordings")}</p>
          <ul className="flex flex-col gap-1">
            {recordings.map((s) => (
              <li key={s.id}>
                <a href={s.recording_url!} target="_blank" rel="noopener noreferrer" className="text-sm text-info underline">
                  {s.title || t("liveClass")} · {formatDateTime(s.starts_at, timeZone)}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
