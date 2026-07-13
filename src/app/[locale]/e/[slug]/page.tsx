import { PublicEventPage } from "@/components/events/public-event-page";
import { routing, type AppLocale } from "@/i18n/routing";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
};

export default async function EventPage({ params }: Props) {
  const { locale, slug } = await params;
  const appLocale = routing.locales.includes(locale as AppLocale)
    ? (locale as AppLocale)
    : routing.defaultLocale;

  return <PublicEventPage slug={slug} locale={appLocale} />;
}
