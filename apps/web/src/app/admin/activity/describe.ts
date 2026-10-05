import "server-only";
import { getTranslations } from "next-intl/server";
import type { Database } from "@/lib/supabase/database.types";

type AuditRow = Database["public"]["Tables"]["audit_log"]["Row"];

/** "updated a membership (paid_at) · Ali Khan" from an audit row (ids and column names only). */
export async function describeAudit(row: AuditRow, names: Map<string, string>) {
  const t = await getTranslations("audit");
  const verb = t.has(`actions.${row.action}`) ? t(`actions.${row.action}`) : row.action.replace(/_/g, " ");
  const entity = t.has(`entities.${row.entity}`) ? t(`entities.${row.entity}`) : row.entity.replace(/_/g, " ");
  const who = row.entity === "profiles" && row.entity_id ? names.get(row.entity_id) : undefined;
  const columns = row.changed_columns?.length ? ` (${row.changed_columns.join(", ")})` : "";
  return `${verb} ${entity}${columns}${who ? ` · ${who}` : ""}`;
}
