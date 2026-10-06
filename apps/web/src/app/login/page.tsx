import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/ui/LogoMark";
import { getCurrentProfile, HOME_PATH } from "@/lib/auth";
import { demoRoles } from "@/lib/demo";
import { LoginForms } from "./LoginForms";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const profile = await getCurrentProfile();
  if (profile) redirect(HOME_PATH[profile.role]);

  const { error } = await searchParams;
  const t = await getTranslations("login");

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-12">
      <Logo />
      <header className="flex flex-col gap-2">
        <h1 className="font-display-tight text-[28px] leading-tight">
          <span className="text-gradient">{t("title")}</span>
        </h1>
        <p className="text-muted">{t("subtitle")}</p>
      </header>
      <LoginForms
        linkError={error === "link"}
        devPasswordLogin={process.env.ENABLE_DEV_PASSWORD_LOGIN === "true"}
        demoRoles={demoRoles()}
      />
    </main>
  );
}
