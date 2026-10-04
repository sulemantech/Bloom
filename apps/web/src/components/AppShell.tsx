import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/login/actions";
import { Logo } from "@/components/ui/LogoMark";
import type { Profile } from "@/lib/auth";

export async function AppShell({ profile, children }: { profile: Profile; children: ReactNode }) {
  const t = await getTranslations("shell");

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-border bg-surface-2">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
          <Logo />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">
              {profile.full_name || profile.username} · {t(`roles.${profile.role}`)}
            </span>
            <form action={signOut}>
              <button type="submit" className="btn btn-secondary px-4 py-2 text-sm">
                {t("signOut")}
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8">{children}</main>
    </div>
  );
}
