import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { NavigationProgress } from "@/components/NavigationProgress";
import "./globals.css";

// Same fonts as the website, self-hosted by Next.js.
const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  axes: ["opsz"],
});

const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "Youth IdeaLab", template: "%s · Youth IdeaLab" },
  description: "Explore, choose, build and present a real project with a mentor at every step.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fc" },
    { media: "(prefers-color-scheme: dark)", color: "#070d1c" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();
  const t = await getTranslations("shell");

  return (
    <html
      lang={locale}
      dir={locale === "ur" ? "rtl" : "ltr"}
      className={`${bricolage.variable} ${figtree.variable} h-full`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={null}>
          <NavigationProgress label={t("loading")} />
        </Suspense>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
