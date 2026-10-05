/** A flag set for the cohort wins over the global flag; missing flags are off. */
export function resolveFlag(flags: readonly { cohort_id: string | null; enabled: boolean }[], cohortId?: string): boolean {
  const cohortFlag = cohortId ? flags.find((f) => f.cohort_id === cohortId) : undefined;
  const globalFlag = flags.find((f) => f.cohort_id === null);
  return (cohortFlag ?? globalFlag)?.enabled ?? false;
}
