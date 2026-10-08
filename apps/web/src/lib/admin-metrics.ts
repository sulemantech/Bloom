/**
 * Numbers for the admin overview. Pure, so the money and "on track" figures are unit tested rather
 * than worked out inside the page.
 */

type Enrolment = { role: string; fee_amount: number | string | null; paid_at: string | null; refunded_at: string | null; discount_reason?: string | null };

/** Fees in rupees: collected (paid, not refunded), outstanding (not paid yet) and how many are unpaid. */
export function feeSummary(enrolments: readonly Enrolment[]) {
  let collected = 0;
  let outstanding = 0;
  let unpaid = 0;
  let discounts = 0;
  for (const m of enrolments) {
    if (m.role !== "student" || m.refunded_at) continue;
    const fee = Number(m.fee_amount ?? 0);
    if (m.discount_reason) discounts++;
    if (m.paid_at) collected += fee;
    else {
      outstanding += fee;
      unpaid++;
    }
  }
  return { collected, outstanding, unpaid, discounts };
}

/** Students with no overdue work, out of all students (a group that hasn't started counts as on track). */
export function onTrack(students: readonly { overdue: number }[]) {
  const done = students.filter((s) => s.overdue === 0).length;
  return { done, total: students.length, percent: students.length ? Math.round((done / students.length) * 100) : 100 };
}

/** Whole days since a moment (0 = today), or null. */
export function ageInDays(iso: string | null | undefined, now = new Date()) {
  return iso ? Math.max(0, Math.floor((now.getTime() - Date.parse(iso)) / 86_400_000)) : null;
}

/** The moment `days` days ago, as an ISO string (0 = now). */
export const daysAgoIso = (days: number, now = new Date()) => new Date(now.getTime() - days * 86_400_000).toISOString();

/** "180,000" — rupee amounts as Pakistan writes them, without decimals. */
export const rupees = (amount: number) => new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(amount);
