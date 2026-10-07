/** Marks a check question that checks an open gap again (lib/bloom/gaps). */
export function RecheckBadge({ label }: { label: string }) {
  return (
    <span className="mb-1 inline-flex items-center gap-1 self-start rounded-full bg-sun/20 px-2 py-0.5 text-[12px] font-semibold text-warning">
      <span aria-hidden="true">↻</span>
      {label}
    </span>
  );
}
