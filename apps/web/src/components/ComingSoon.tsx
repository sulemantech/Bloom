import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/AppShell";
import type { Profile } from "@/lib/auth";

/** Placeholder home for roles whose screens arrive in Phase 1. */
export async function ComingSoon({ profile }: { profile: Profile }) {
  const t = await getTranslations("comingSoon");

  return (
    <AppShell profile={profile}>
      <header className="flex flex-col gap-1">
        <h1 className="font-display-tight text-[28px] leading-tight">
          {t("hello", { name: profile.full_name || profile.username || "" })}
        </h1>
        <p className="text-muted">{t(`intro.${profile.role}`)}</p>
      </header>
      <div className="card p-6 text-muted">{t("body")}</div>
    </AppShell>
  );
}
