import Link from "next/link";
import type { Anchor } from "@/lib/bloom/anchor";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The words for an anchor, from the "bloom" messages (works with server and client translators). */
export function anchorParts(t: Translate, anchor: Pick<Anchor, "kind" | "label" | "week"> & { urgent?: Anchor["urgent"] }) {
  return {
    prefix: t("anchor.helpsWith"),
    label: anchor.kind === "interest" ? t("anchor.kind.interest") : anchor.label,
    detail: anchor.kind === "interest" ? null : t(`anchor.kind.${anchor.kind}`, { week: anchor.week ?? "" }),
    urgent: anchor.urgent ? t(`anchor.urgent.${anchor.urgent}`) : null,
  };
}

/**
 * "Helps with: Talk to 3 people · Course activity, week 3": the real need a learning path serves
 * (lib/bloom/anchor). Links to the activity when `href` is given.
 */
export function AnchorChip({ parts, href, className = "" }: { parts: ReturnType<typeof anchorParts>; href?: string; className?: string }) {
  const label = href ? (
    <Link href={href} className="font-semibold text-info underline-offset-2 hover:underline">
      {parts.label}
    </Link>
  ) : (
    <span className="font-semibold">{parts.label}</span>
  );
  return (
    <p className={`flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] ${className}`}>
      <span className="text-ai">
        <span aria-hidden="true">↳ </span>
        {parts.prefix}
      </span>
      {label}
      {parts.detail && <span className="text-soft">· {parts.detail}</span>}
      {parts.urgent && <span className="rounded-full bg-coral/15 px-2 py-0.5 text-[12px] font-semibold text-danger">{parts.urgent}</span>}
    </p>
  );
}
