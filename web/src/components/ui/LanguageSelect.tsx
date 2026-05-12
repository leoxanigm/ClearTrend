"use client";

import {
  localeCookieName,
  locales,
  type AppLocale,
} from "@/i18n/locales";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

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
    <label className={className}>
      <span className="language-select-label">{t("label")}</span>
      <select
        aria-label={t("ariaLabel")}
        className="language-select-control"
        disabled={isPending}
        onChange={(event) => handleLocaleChange(event.target.value as AppLocale)}
        value={locale}
      >
        {locales.map((option) => (
          <option key={option} value={option}>
            {t(`options.${option}`)}
          </option>
        ))}
      </select>
    </label>
  );
}
