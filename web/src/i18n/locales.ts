export const locales = ["en", "fr", "es"] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = "en";
export const localeCookieName = "cleartrend-locale";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return locales.includes(value as AppLocale);
}

export function getLocaleFromAcceptLanguage(value: string | null) {
  if (!value) {
    return defaultLocale;
  }

  const requestedLocales = value
    .split(",")
    .map((item) => item.split(";")[0]?.trim().toLowerCase())
    .filter(Boolean);

  for (const requestedLocale of requestedLocales) {
    const language = requestedLocale.split("-")[0];

    if (isAppLocale(language)) {
      return language;
    }
  }

  return defaultLocale;
}
