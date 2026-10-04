import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Badge, STEP_TONE } from "@/components/ui/Badge";
import { Logo } from "@/components/ui/LogoMark";
import { getCurrentProfile, HOME_PATH } from "@/lib/auth";

const STEPS = [
  { key: "explore", weeks: "1–2" },
  { key: "choose", weeks: "3–4" },
  { key: "build", weeks: "5–6" },
  { key: "present", weeks: "7–8" },
] as const;

export default async function Home() {
  const profile = await getCurrentProfile();
  if (profile) redirect(HOME_PATH[profile.role]);

  const t = await getTranslations();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-4 py-16 sm:px-8">
      <Logo />

      <header className="flex flex-col gap-3">
        <h1 className="font-display-tight text-[28px] leading-tight sm:text-4xl">
          {t("home.titleStart")} <span className="text-gradient">{t("app.name")}</span>
        </h1>
        <p className="max-w-xl text-base text-muted">{t("home.intro")}</p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-4">
        {STEPS.map(({ key, weeks }, i) => (
          <li key={key} className="card flex flex-col gap-2 p-4">
            <Badge tone={STEP_TONE[key]}>{i + 1}</Badge>
            <p className="font-display-tight text-lg">{t(`steps.${key}`)}</p>
            <p className="text-[13px] text-soft">{t("home.weeks", { weeks })}</p>
          </li>
        ))}
      </ol>

      <Link href="/login" className="btn btn-primary self-start">
        {t("home.signIn")}
      </Link>
    </main>
  );
}
