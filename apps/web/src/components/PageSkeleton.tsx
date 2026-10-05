import { getTranslations } from "next-intl/server";

/** Shown inside the app shell (menu stays) while a page loads. Used by each area's loading.tsx. */
export async function PageSkeleton() {
  const t = await getTranslations("shell");
  const block = "rounded-2xl bg-surface-2 motion-safe:animate-pulse";
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-6">
      <span className="sr-only">{t("loading")}</span>
      <div className="flex flex-col gap-3" aria-hidden="true">
        <div className={`${block} h-4 w-32`} />
        <div className={`${block} h-9 w-2/3 max-w-md`} />
        <div className={`${block} h-4 w-full max-w-xl`} />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`${block} h-20`} />
        ))}
      </div>
      <div className={`${block} h-48`} aria-hidden="true" />
    </div>
  );
}
