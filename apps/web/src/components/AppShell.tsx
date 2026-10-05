import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/login/actions";
import { BottomNav, SideNav, type NavItem } from "@/components/SideNav";
import { Icon } from "@/components/ui/Icon";
import { Logo, LogoMark } from "@/components/ui/LogoMark";
import type { Profile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Each role's menu. Mentors see their groups and parents their children as menu items. */
async function navFor(profile: Profile): Promise<NavItem[]> {
  const t = await getTranslations("nav");
  const supabase = await createClient();

  switch (profile.role) {
    case "student":
      return [
        { href: "/student", label: t("home"), icon: "home", exact: true },
        { href: "/student/bloom", label: t("bloom"), icon: "sparkle" },
        { href: "/student/activities", label: t("activities"), icon: "list" },
        { href: "/student/project", label: t("project"), icon: "folder" },
        { href: "/student/classes", label: t("classes"), icon: "calendar" },
      ];
    case "parent": {
      const { data } = await supabase
        .from("guardian_links")
        .select("student:profiles!guardian_links_student_id_fkey(id, full_name)")
        .eq("parent_id", profile.id);
      const children = (data ?? []).flatMap((l) => (l.student ? [l.student] : []));
      return [
        { href: "/parent", label: t("family"), icon: "users", exact: true },
        ...children.map((c) => ({ href: `/parent/children/${c.id}`, label: c.full_name.split(" ")[0], icon: "user" as const })),
      ];
    }
    case "mentor": {
      const { data } = await supabase
        .from("memberships")
        .select("cohort:cohorts(id, name)")
        .eq("user_id", profile.id)
        .eq("role", "mentor");
      const groups = (data ?? []).flatMap((m) => (m.cohort ? [m.cohort] : []));
      return [
        { href: "/mentor", label: t("dashboard"), icon: "inbox", exact: true },
        ...groups.map((g) => ({ href: `/mentor/groups/${g.id}`, label: g.name, icon: "grid" as const })),
      ];
    }
    case "admin":
      return [
        { href: "/admin", label: t("overview"), icon: "chart", exact: true },
        { href: "/admin/people", label: t("people"), icon: "users" },
        { href: "/admin/groups", label: t("groups"), icon: "grid" },
        { href: "/admin/payments", label: t("payments"), icon: "money" },
        { href: "/admin/programme", label: t("programme"), icon: "book" },
        { href: "/admin/activity", label: t("activityLog"), icon: "log" },
      ];
  }
}

export async function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const t = await getTranslations("shell");
  const items = await navFor(profile);
  const name = profile.full_name || profile.username || "";

  const signOutButton = (compact: boolean) => (
    <form action={signOut}>
      <button
        type="submit"
        className={compact ? "btn btn-secondary px-3 py-1.5 text-sm" : "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium text-muted transition-colors hover:bg-surface/60 hover:text-text"}
      >
        {!compact && <Icon name="logout" />}
        {t("signOut")}
      </button>
    </form>
  );

  return (
    <div className="flex min-h-full flex-1">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-border bg-surface-2 px-4 py-5 lg:flex print:hidden">
        <div className="px-2 pb-6">
          <Logo />
        </div>
        <div className="flex-1 overflow-y-auto">
          <SideNav items={items} label={t("menu")} />
        </div>
        <div className="flex flex-col gap-2 border-t border-border pt-4">
          <div className="flex items-center gap-3 px-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lime to-cyan text-sm font-bold text-ink-950">
              {name.charAt(0).toUpperCase()}
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{name}</span>
              <span className="text-[12px] text-soft">{t(`roles.${profile.role}`)}</span>
            </span>
          </div>
          {signOutButton(false)}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Phone top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border bg-surface-2/95 px-4 py-2.5 backdrop-blur lg:hidden print:hidden">
          <span className="flex items-center gap-2">
            <LogoMark size={28} />
            <span className="max-w-[45vw] truncate text-sm font-semibold">{name}</span>
          </span>
          {signOutButton(true)}
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-28 pt-6 sm:px-8 lg:pb-12 lg:pt-10">
          {children}
        </main>
      </div>

      <BottomNav items={items} label={t("menu")} />
    </div>
  );
}

/** Consistent page heading: optional eyebrow, title, description and actions. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          {eyebrow && <div className="flex flex-wrap items-center gap-2 text-sm text-soft">{eyebrow}</div>}
          <h1 className="font-display-tight text-[26px] leading-tight sm:text-[28px]">{title}</h1>
          {description && <p className="max-w-2xl text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

/** A titled block of content. */
export function Section({
  title,
  description,
  actions,
  children,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <section className="flex flex-col gap-3" aria-labelledby={id} id={id ? `${id}-section` : undefined}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h2 id={id} className="font-display-tight text-lg">{title}</h2>
          {description && <p className="text-sm text-muted">{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

/** A big number with a label, for dashboards. */
export function Stat({ value, label, tone }: { value: ReactNode; label: string; tone?: "danger" | "success" | "warning" }) {
  const color = tone === "danger" ? "text-danger" : tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "";
  return (
    <div className="card flex flex-col gap-1 p-4">
      <span className={`font-display-tight text-[28px] leading-none tabular-nums ${color}`}>{value}</span>
      <span className="text-[13px] text-soft">{label}</span>
    </div>
  );
}

/** Link-style tabs driven by a search parameter (server-rendered, no client state). */
export function Tabs({ tabs, current, label }: { tabs: { key: string; label: string; href: string; count?: number }[]; current: string; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-1 border-b border-border">
        {tabs.map((tab) => {
          const active = tab.key === current;
          return (
            <li key={tab.key}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                  active ? "border-cyan text-text" : "border-transparent text-muted hover:text-text"
                }`}
              >
                {tab.label}
                {tab.count ? (
                  <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[12px] tabular-nums text-muted">{tab.count}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Friendly empty state. */
export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-2 border-dashed p-6">
      <p className="font-display-tight text-lg">{title}</p>
      {body && <p className="text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}
