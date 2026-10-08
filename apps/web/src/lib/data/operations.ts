import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadCohortProgress } from "@/lib/data/cohort";
import { groupDuties, type GroupDuties } from "@/lib/operations";
import type { Database } from "@/lib/supabase/database.types";

type Client = SupabaseClient<Database>;

/** Rows per request: PostgREST caps responses (1,000 by default), so long lists are read in pages. */
const PAGE = 1000;

/** Every row a query returns, page by page (the query is built afresh for each page). */
export async function readAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

/** Every group with what its mentors owe right now (lib/operations groupDuties). Admins only. */
export async function loadGroupDuties(supabase: Client, now: Date): Promise<GroupDuties[]> {
  const { data: cohorts } = await supabase.from("cohorts").select("id").order("start_date", { ascending: true, nullsFirst: false });
  const groups = (await Promise.all((cohorts ?? []).map((c) => loadCohortProgress(supabase, c.id)))).flatMap((g) => (g ? [g] : []));
  return groups.map((g) =>
    groupDuties(
      {
        id: g.cohort.id,
        name: g.cohort.name,
        week: g.week,
        weeks: g.program.weeks,
        studentIds: g.students.map((s) => s.profile.id),
        waiting: g.toReview.map((r) => r.submission),
        approvedCards: g.cards.filter((c) => c.status === "approved"),
      },
      now,
    ),
  );
}
