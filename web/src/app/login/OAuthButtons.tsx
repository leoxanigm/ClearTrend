"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

const oauthProviders = [
  {
    id: "google",
    icon: "/google.svg",
    label: "Google",
    monochrome: false,
  },
  {
    id: "github",
    icon: "/github.svg",
    label: "GitHub",
    monochrome: true,
  },
  {
    id: "42-school",
    icon: "/42.svg",
    label: "42 School",
    monochrome: true,
  },
] as const;

type NextAuthProvider = {
  id: string;
};

export function OAuthButtons() {
  const t = useTranslations("oauth");
  const [configuredProviderIds, setConfiguredProviderIds] = useState<
    Set<string> | null
  >(null);
  const visibleProviders = oauthProviders.filter((provider) =>
    configuredProviderIds?.has(provider.id)
  );

  useEffect(() => {
    let cancelled = false;

    async function loadConfiguredProviders() {
      const response = await fetch("/api/auth/providers", {
        cache: "no-store",
      }).catch(() => null);

      if (!response?.ok) {
        if (!cancelled) {
          setConfiguredProviderIds(new Set());
        }
        return;
      }

      const providers = (await response.json().catch(() => null)) as Record<
        string,
        NextAuthProvider
      > | null;

      if (!cancelled) {
        setConfiguredProviderIds(
          new Set(Object.values(providers ?? {}).map((provider) => provider.id))
        );
      }
    }

    void loadConfiguredProviders();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!configuredProviderIds || visibleProviders.length === 0) {
    return null;
  }

  return (
    <div
      aria-label={t("groupLabel")}
      className="oauth-actions"
      role="group"
    >
      {visibleProviders.map((provider) => (
        <button
          aria-label={t("continueWith", {
            provider: provider.label,
          })}
          className="oauth-button"
          key={provider.id}
          onClick={() =>
            void signIn(provider.id, { callbackUrl: "/dashboard" })
          }
          title={provider.label}
          type="button"
        >
          <Image
            alt=""
            aria-hidden={true}
            className={`oauth-button-icon${
              provider.monochrome ? " oauth-button-icon-monochrome" : ""
            }`}
            height={32}
            src={provider.icon}
            width={32}
          />
        </button>
      ))}
    </div>
  );
}
