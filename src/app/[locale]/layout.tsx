import { Providers } from "@/components/providers";
import { routing, type AppLocale } from "@/i18n/routing";
import { laMesaDisplayFallback } from "@/lib/fonts/la-mesa-display";
import { PRODUCTION_SITE_URL, getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import "../globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  display: "swap",
});

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    metadataBase: new URL(getSiteUrl() || PRODUCTION_SITE_URL),
    title: t("title"),
    description: t("description"),
    icons: {
      icon: [
        { url: "/favicon.png", type: "image/png", sizes: "512x512" },
        { url: "/icon", type: "image/png", sizes: "32x32" },
      ],
      apple: [{ url: "/apple-icon", type: "image/png", sizes: "180x180" }],
    },
    alternates: {
      canonical: `/${locale}`,
    },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as AppLocale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${laMesaDisplayFallback.variable} h-full scroll-smooth`}>
      <body className="min-h-full flex flex-col antialiased font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
