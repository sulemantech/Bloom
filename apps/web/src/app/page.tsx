import { getTranslations } from "next-intl/server";

const STEPS = ["explore", "choose", "build", "present"] as const;

export default async function Home() {
  const t = await getTranslations();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-10 px-4 py-16 sm:px-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm font-medium uppercase tracking-widest text-zinc-500">{t("app.name")}</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{t("home.title")}</h1>
        <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">{t("home.intro")}</p>
      </header>

      <ol className="grid gap-3 sm:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
            <span className="text-sm text-zinc-500">{i + 1}</span>
            <p className="font-medium">{t(`steps.${step}`)}</p>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled
          className="w-fit rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white opacity-60 dark:bg-white dark:text-zinc-900"
        >
          {t("home.signIn")}
        </button>
        <p className="text-sm text-zinc-500">{t("home.comingSoon")}</p>
      </div>
    </main>
  );
}
