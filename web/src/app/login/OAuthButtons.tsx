"use client";

import Image from "next/image";
import { signIn } from "next-auth/react";

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

export function OAuthButtons() {
  return (
    <div
      aria-label="OAuth sign in options"
      className="oauth-actions"
      role="group"
    >
      {oauthProviders.map((provider) => (
        <button
          aria-label={`Continue with ${provider.label}`}
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
