import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Icon } from "@/components/ui/Icon";
import { LogoMark } from "@/components/ui/LogoMark";
import { getCurrentProfile, HOME_PATH } from "@/lib/auth";
import { demoRoles } from "@/lib/demo";
import { LoginForms } from "./LoginForms";

export const metadata: Metadata = { title: "Sign in" };

const JOURNEY = [
  { key: "explore", weeks: "1–2", dot: "bg-lime" },
  { key: "choose", weeks: "3–4", dot: "bg-cyan" },
  { key: "build", weeks: "5–6", dot: "bg-violet" },
  { key: "present", weeks: "7–8", dot: "bg-coral" },
] as const;

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const profile = await getCurrentProfile();
  if (profile) redirect(HOME_PATH[profile.role]);

  const { error, signin } = await searchParams;
  const roles = demoRoles();
  // A public demo site (ENABLE_DEMO_LOGIN) shows only the demo accounts. The real sign-in stays
  // reachable at /login?signin=1 (and after a failed sign-in link), and is never hidden when no
  // demo account is offered, so nobody can be locked out.
  const demoOnly = process.env.ENABLE_DEMO_LOGIN === "true" && roles.length > 0 && signin !== "1" && error !== "link";
  const t = await getTranslations("login");
  const tSteps = await getTranslations("steps");

  return (
    <main className="grid flex-1 grid-cols-[minmax(0,1fr)] lg:min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand: a compact header on phones, a full panel beside the form on large screens. */}
      <section className="aurora relative overflow-hidden px-6 pt-8 pb-10 text-white sm:px-10 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col lg:justify-between lg:p-14">
        <span className="inline-flex items-center gap-2.5">
          <LogoMark size={36} />
          <span className="font-display-tight text-lg">Youth IdeaLab</span>
        </span>

        <div className="animate-rise mt-8 flex max-w-lg flex-col gap-5 lg:mt-0">
          <h2 className="font-display-tight text-[32px] leading-[1.05] sm:text-[40px] lg:text-[52px]">
            {t("brand.headlineStart")}{" "}
            <span className="bg-gradient-to-r from-lime via-cyan to-violet bg-clip-text text-transparent">{t("brand.headlineEnd")}</span>
          </h2>
          <p className="max-w-md text-[15px] leading-relaxed text-mist sm:text-base">{t("brand.intro")}</p>

          <ol className="mt-2 hidden flex-col gap-3 lg:flex" aria-label={t("brand.journey")}>
            {JOURNEY.map(({ key, weeks, dot }, i) => (
              <li key={key} className="flex items-center gap-4">
                <span className="relative flex size-8 items-center justify-center rounded-full bg-white/10 text-sm font-semibold ring-1 ring-white/15">
                  {i + 1}
                  <span className={`absolute -top-0.5 -right-0.5 size-2.5 rounded-full ${dot}`} aria-hidden="true" />
                </span>
                <span className="font-display-tight text-lg">{tSteps(key)}</span>
                <span className="text-sm text-mist-soft">{t("brand.weeks", { weeks })}</span>
              </li>
            ))}
          </ol>
        </div>

        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-sm text-mist lg:mt-0">
          {(["weeks", "ages", "mentor"] as const).map((point) => (
            <li key={point} className="inline-flex items-center gap-1.5">
              <Icon name="check" size={15} className="text-lime" />
              {t(`brand.points.${point}`)}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col justify-center px-4 py-10 sm:px-8 lg:py-14">
        <div className="animate-rise mx-auto flex w-full max-w-md flex-col gap-6 [animation-delay:80ms]">
          <header className="flex flex-col gap-1.5">
            <h1 className="font-display-tight text-[30px] leading-tight">{t("title")}</h1>
            <p className="text-muted">{t("subtitle")}</p>
          </header>
          <LoginForms
            linkError={error === "link"}
            devPasswordLogin={process.env.ENABLE_DEV_PASSWORD_LOGIN === "true"}
            demoRoles={roles}
            showSignIn={!demoOnly}
          />
          <p className="flex items-center justify-center gap-1.5 text-[13px] text-soft">
            <Icon name="shield" size={14} />
            <Link href="/privacy" className="underline-offset-2 hover:underline">
              {t("privacy")}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
