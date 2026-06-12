"use client";

import {
  localeCookieName,
  locales,
  type AppLocale,
} from "@/i18n/locales";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SelectField } from "./SelectField";

// Locale selector shared by authentication and authenticated application views.
type LanguageSelectProps = {
  // Screen-specific layout classes can be applied without changing behavior.
  className?: string;
};

export function LanguageSelect({
  className = "language-select",
}: LanguageSelectProps) {
  // next-intl exposes the locale resolved for the current server request.
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const t = useTranslations("language");
  const [isPending, startTransition] = useTransition();

  // A transition keeps the existing interface responsive during router refresh.
  function handleLocaleChange(nextLocale: AppLocale) {
    // Store the language explicitly selected by the user for one year.
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // Refresh server components so next-intl resolves the new cookie immediately.
    startTransition(() => router.refresh());
  }

  return (
    // Options are translated in the currently active language.
    <SelectField
      ariaLabel={t("ariaLabel")}
      containerClassName={className}
      disabled={isPending}
      label={t("label")}
      onValueChange={handleLocaleChange}
      options={locales.map((option) => ({
        label: t(`options.${option}`),
        value: option,
      }))}
      value={locale}
    />
  );
}
