"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName; exact?: boolean; badge?: number };

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

/** Desktop sidebar links. */
export function SideNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label}>
      <ul className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-colors ${
                  active ? "bg-surface text-text shadow-sm ring-1 ring-border" : "text-muted hover:bg-surface/60 hover:text-text"
                }`}
              >
                <Icon name={item.icon} className={active ? "text-info" : ""} />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge ? (
                  <span className="rounded-full bg-sun/25 px-2 py-0.5 text-[12px] font-semibold tabular-nums text-warning">{item.badge}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Phone bottom tab bar (first five items). */
export function BottomNav({ items, label }: { items: NavItem[]; label: string }) {
  const pathname = usePathname();
  const visible = items.slice(0, 5);
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${visible.length}, minmax(0, 1fr))` }}>
        {visible.map((item) => {
          const active = isActive(pathname, item);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-col items-center gap-1 px-1 py-2 text-[11px] font-medium ${active ? "text-info" : "text-soft"}`}
              >
                <Icon name={item.icon} size={22} />
                <span className="max-w-full truncate">{item.label}</span>
                {item.badge ? (
                  <span className="absolute right-[22%] top-1 size-2 rounded-full bg-sun" aria-label={String(item.badge)} />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
