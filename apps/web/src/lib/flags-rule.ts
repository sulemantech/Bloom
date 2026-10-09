/**
 * Whether a feature is on. A setting for the group wins over the setting for everyone; with
 * neither, the feature's own default applies (lib/features.ts).
 */
export function resolveFlag(
  flags: readonly { cohort_id: string | null; enabled: boolean }[],
  cohortId?: string,
  fallback = false,
): boolean {
  const cohortFlag = cohortId ? flags.find((f) => f.cohort_id === cohortId) : undefined;
  const globalFlag = flags.find((f) => f.cohort_id === null);
  return (cohortFlag ?? globalFlag)?.enabled ?? fallback;
}
