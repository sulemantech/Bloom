import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/LogoMark";
import { CONSENT_VERSION } from "@/lib/auth";

export const metadata: Metadata = { title: "Privacy and safeguarding" };

const SECTIONS = ["collect", "use", "see", "never", "rights", "contact"] as const;

// DRAFT: the wording must be reviewed by a lawyer before the first group joins.
export default async function PrivacyPage() {
  const t = await getTranslations("privacy");

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12 sm:px-8">
      <Logo />
      <header className="flex flex-col gap-2">
        <h1 className="font-display-tight text-[28px] leading-tight">{t("title")}</h1>
        <p className="text-sm text-soft">{t("version", { version: CONSENT_VERSION })}</p>
        <p className="rounded-xl bg-sun/15 px-4 py-3 text-sm text-warning">{t("draft")}</p>
      </header>
      {SECTIONS.map((key) => (
        <section key={key} className="flex flex-col gap-2">
          <h2 className="font-display-tight text-lg">{t(`${key}.title`)}</h2>
          <p className="text-muted">{t(`${key}.body`)}</p>
        </section>
      ))}
    </main>
  );
}
