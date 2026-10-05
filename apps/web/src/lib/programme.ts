import type { Database, Json } from "@/lib/supabase/database.types";

type Enums = Database["public"]["Enums"];
export type ActivityRow = Database["public"]["Tables"]["activities"]["Row"];
export type StageRow = Database["public"]["Tables"]["stages"]["Row"];
export type SubmissionRow = Database["public"]["Tables"]["submissions"]["Row"];

/** Read a translatable jsonb field ({"en": "...", "ur": "..."}), falling back to English. */
export function tr(value: Json | null | undefined, locale = "en"): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "";
  const map = value as Record<string, Json>;
  return String(map[locale] ?? map.en ?? "");
}

/** Today's date (YYYY-MM-DD) in a time zone. */
export function todayInZone(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function daysBetween(fromIso: string, toIso: string) {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86_400_000);
}

/**
 * Programme week for a cohort: 0 before the start, 1..weeks during, weeks+1 after.
 * Null when the start date isn't set yet.
 */
export function currentWeek(startDate: string | null, timeZone: string, weeks: number, now = new Date()) {
  if (!startDate) return null;
  const days = daysBetween(startDate, todayInZone(timeZone, now));
  if (days < 0) return 0;
  return Math.min(Math.floor(days / 7) + 1, weeks + 1);
}

/** Convert a wall-clock time in a time zone ("2026-10-10T11:00") to a UTC ISO string. */
export function zonedLocalToUtc(local: string, timeZone: string): string {
  const asUtc = new Date(local + ":00Z");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(asUtc).map((p) => [p.type, p.value]),
  );
  const zoneAsUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(asUtc.getTime() - (zoneAsUtc - asUtc.getTime())).toISOString();
}

export function formatDateTime(iso: string, timeZone: string, locale = "en") {
  return new Intl.DateTimeFormat(locale, {
    timeZone, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));
}

export function formatDate(iso: string, timeZone: string, locale = "en") {
  return new Intl.DateTimeFormat(locale, { timeZone, day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso),
  );
}

export type ActivityStatus = "todo" | "overdue" | Enums["submission_status"];

/** Status of one activity for a student, from their latest submission and the current week. */
export function activityStatus(
  activity: Pick<ActivityRow, "week">,
  latest: Pick<SubmissionRow, "status"> | undefined,
  week: number | null,
): ActivityStatus {
  if (latest) return latest.status;
  if (week !== null && activity.week < week) return "overdue";
  return "todo";
}

/** Activities that apply to an age group (null age_group = everyone). */
export function forAgeGroup<T extends Pick<ActivityRow, "age_group">>(activities: T[], ageGroup: Enums["age_group"] | null) {
  return activities.filter((a) => a.age_group === null || a.age_group === ageGroup);
}

/** Latest submission per activity. */
export function latestByActivity<T extends Pick<SubmissionRow, "activity_id" | "submitted_at">>(submissions: T[]) {
  const map = new Map<string, T>();
  for (const s of [...submissions].sort((a, b) => b.submitted_at.localeCompare(a.submitted_at))) {
    if (!map.has(s.activity_id)) map.set(s.activity_id, s);
  }
  return map;
}

export function stageForWeek<T extends Pick<StageRow, "week_from" | "week_to">>(stages: T[], week: number) {
  return stages.find((s) => week >= s.week_from && week <= s.week_to);
}

/** True once a moment has passed. */
export function isPast(iso: string, now = new Date()) {
  return Date.parse(iso) < now.getTime();
}

/** The next class: a session stays "next" until 2 hours after it starts. */
export function nextSession<T extends { starts_at: string }>(sessions: T[], now = new Date()) {
  return sessions.find((s) => Date.parse(s.starts_at) + 2 * 3_600_000 > now.getTime());
}
