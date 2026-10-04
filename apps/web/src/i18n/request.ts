import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

// English only for the MVP. Adding Urdu = add "ur" here and messages/ur.json.
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

function isLocale(value: string | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export default getRequestConfig(async () => {
  const requested = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale = isLocale(requested) ? requested : defaultLocale;

  return {
    locale,
    timeZone: "Asia/Karachi",
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
