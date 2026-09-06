import { PublicEventPage } from "@/components/events/public-event-page";
import { routing, type AppLocale } from "@/i18n/routing";
import {
  buildEventShareMetadata,
  getPublishedEventShareMeta,
} from "@/lib/events/event-share-meta";
import { getPublishedEventBySlug } from "@/lib/events/get-published-event";
import { PRODUCTION_SITE_URL, getSiteUrl } from "@/lib/site-url";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = routing.locales.includes(rawLocale as AppLocale)
    ? (rawLocale as AppLocale)
    : routing.defaultLocale;

  const tMeta = await getTranslations({ locale, namespace: "meta" });
  const siteDescription = tMeta("description");
  const event = await getPublishedEventShareMeta(slug);

  const { title, description } = event
    ? buildEventShareMetadata(event, locale, siteDescription)
    : { title: tMeta("title"), description: siteDescription };

  const ogImage = {
    url: "/og-image.png",
    width: 1200,
    height: 630,
    alt: title,
    type: "image/png" as const,
  };
  const path = `/${locale}/e/${encodeURIComponent(slug)}`;
  const base = getSiteUrl() || PRODUCTION_SITE_URL;

  return {
    metadataBase: new URL(base),
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: locale === "es" ? "es_MX" : locale === "fr" ? "fr_FR" : "en_US",
      siteName: "LA MESA",
      url: path,
      title,
      description,
      images: [ogImage],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage.url],
    },
  };
}

export default async function EventPage({ params }: Props) {
  const { locale, slug } = await params;
  const appLocale = routing.locales.includes(locale as AppLocale)
    ? (locale as AppLocale)
    : routing.defaultLocale;
  const initialEvent = await getPublishedEventBySlug(slug);

  return (
    <Suspense fallback={null}>
      <PublicEventPage slug={slug} locale={appLocale} initialEvent={initialEvent} />
    </Suspense>
  );
}
