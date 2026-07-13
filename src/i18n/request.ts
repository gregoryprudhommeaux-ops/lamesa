import { getRequestConfig } from "next-intl/server";
import { routing, type AppLocale } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as AppLocale)) {
    locale = routing.defaultLocale;
  }

  const appLocale = locale as AppLocale;

  return {
    locale: appLocale,
    messages: (await import(`../../messages/${appLocale}.json`)).default,
  };
});
