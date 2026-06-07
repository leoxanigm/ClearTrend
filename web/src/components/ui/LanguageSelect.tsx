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

type LanguageSelectProps = {
  className?: string;
};

export function LanguageSelect({
  className = "language-select",
}: LanguageSelectProps) {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const t = useTranslations("language");
  const [isPending, startTransition] = useTransition();

  function handleLocaleChange(nextLocale: AppLocale) {
    document.cookie = `${localeCookieName}=${nextLocale}; path=/; max-age=31536000; SameSite=Lax`;
    startTransition(() => router.refresh());
  }

  return (
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
