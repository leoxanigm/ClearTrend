import {
  defaultLocale,
  getLocaleFromAcceptLanguage,
  isAppLocale,
  localeCookieName,
} from "@/i18n/locales";
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const headerStore = await headers();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = isAppLocale(cookieLocale)
    ? cookieLocale
    : getLocaleFromAcceptLanguage(headerStore.get("accept-language"));

  return {
    locale,
    messages: (await import(`../../langages/${locale ?? defaultLocale}.json`))
      .default,
  };
});
