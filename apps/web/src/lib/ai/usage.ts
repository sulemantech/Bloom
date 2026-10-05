import type { Database } from "@/lib/supabase/database.types";
import { todayInZone, zonedLocalToUtc } from "@/lib/programme";

/** Summaries of ai_runs for the admin AI usage page. Pure, so it can be unit tested. */
type Functions = Database["public"]["Functions"];
export type DayRow = Functions["ai_usage_by_day"]["Returns"][number];
export type StudentRow = Functions["ai_usage_by_student"]["Returns"][number];

/** Outcomes where the model was actually called (and may have cost tokens). */
const REACHED_MODEL = new Set(["ok", "refused", "failed", "rate_limited"]);
const NOT_ANSWERED = new Set(["refused", "failed", "rate_limited"]);

export type Usage = {
  /** Calls that reached the model. */
  calls: number;
  /** Of those, how many gave no answer (refused, error, provider busy). */
  notAnswered: number;
  /** Requests stopped by the student's daily limit. */
  limited: number;
  inputTokens: number;
  outputTokens: number;
  /** Average model time per call, or null without timed calls. */
  avgLatencyMs: number | null;
};

const empty = () => ({ calls: 0, notAnswered: 0, limited: 0, inputTokens: 0, outputTokens: 0, latencyTotal: 0, latencyCalls: 0 });
type Acc = ReturnType<typeof empty>;

function add(acc: Acc, r: Pick<DayRow, "outcome" | "calls" | "input_tokens" | "output_tokens"> & Partial<DayRow>) {
  if (REACHED_MODEL.has(r.outcome)) acc.calls += r.calls;
  if (NOT_ANSWERED.has(r.outcome)) acc.notAnswered += r.calls;
  if (r.outcome === "limited") acc.limited += r.calls;
  acc.inputTokens += r.input_tokens;
  acc.outputTokens += r.output_tokens;
  acc.latencyTotal += r.latency_ms_total ?? 0;
  acc.latencyCalls += r.latency_calls ?? 0;
  return acc;
}

const finish = ({ latencyTotal, latencyCalls, ...rest }: Acc): Usage => ({
  ...rest,
  avgLatencyMs: latencyCalls ? Math.round(latencyTotal / latencyCalls) : null,
});

/** The last `count` days (YYYY-MM-DD) in a time zone, newest first, and when the oldest one began (UTC). */
export function usageWindow(count: number, timeZone: string, now = new Date()) {
  const today = todayInZone(timeZone, now);
  const days = Array.from({ length: count }, (_, i) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - i);
    return d.toISOString().slice(0, 10);
  });
  return { days, since: zonedLocalToUtc(`${days[count - 1]}T00:00`, timeZone) };
}

/** Totals, one entry per day (zero days included) and one per capability. */
export function summariseUsage(rows: readonly DayRow[], days: readonly string[]) {
  const total = empty();
  const perDay = new Map(days.map((d) => [d, empty()]));
  const perCapability = new Map<string, Acc>();
  for (const r of rows) {
    add(total, r);
    const day = perDay.get(r.day);
    if (day) add(day, r);
    if (!perCapability.has(r.capability)) perCapability.set(r.capability, empty());
    add(perCapability.get(r.capability)!, r);
  }
  return {
    total: finish(total),
    days: days.map((day) => ({ day, ...finish(perDay.get(day)!) })),
    capabilities: [...perCapability]
      .map(([capability, acc]) => ({ capability, ...finish(acc) }))
      .sort((a, b) => b.calls - a.calls || a.capability.localeCompare(b.capability)),
  };
}

/** The students with the most calls, with how often they hit the daily limit. */
export function topStudents(rows: readonly StudentRow[], limit = 10) {
  const perStudent = new Map<string, Acc>();
  for (const r of rows) {
    if (!perStudent.has(r.student_id)) perStudent.set(r.student_id, empty());
    add(perStudent.get(r.student_id)!, r);
  }
  return [...perStudent]
    .map(([studentId, acc]) => ({ studentId, ...finish(acc) }))
    .filter((s) => s.calls > 0 || s.limited > 0)
    .sort((a, b) => b.calls - a.calls || b.limited - a.limited)
    .slice(0, limit);
}
