"use client";

import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LanguageSelect } from "@/components/ui/LanguageSelect";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextInput } from "@/components/ui/TextInput";
import { useTranslations } from "next-intl";
import { FormMode, useLoginPage } from "./login";
import { OAuthButtons } from "./OAuthButtons";

export default function LoginPage() {
  const t = useTranslations("login");
  const {
    confirmPassword,
    email,
    handleSubmit,
    isSubmitting,
    message,
    mode,
    password,
    selectMode,
    setConfirmPassword,
    setEmail,
    setPassword,
  } = useLoginPage();
  const authModes: Array<{ label: string; value: FormMode }> = [
    {
      label: t("modes.login"),
      value: "login",
    },
    {
      label: t("modes.register"),
      value: "register",
    },
  ];

  return (
    <main className="auth-page">
      <section className="auth-main space-y-8">
        <div className="space-y-3 text-center">
          {/* Logo */}
          <AppLogo size="large" />
        </div>

        {/* Login */}
        <Card className="shadow-sm" padded>
          <SegmentedControl
            onChange={selectMode}
            options={authModes}
            value={mode}
          />

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {/* User credentials. */}
            <TextInput
              label={t("fields.email")}
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />

            <TextInput
              label={t("fields.password")}
              name="password"
              onChange={(event) => setPassword(event.target.value)}
              minLength={mode === "register" ? 8 : undefined}
              required
              type="password"
              value={password}
            />

            {/* If register => password confirmation */}
            {mode === "register" && (
              <TextInput
                label={t("fields.confirmPassword")}
                name="confirmPassword"
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={8}
                required
                type="password"
                value={confirmPassword}
              />
            )}

            {message && (
              // User feedback
              <p className={`form-message form-message-${message.type}`}>
                {message.text}
              </p>
            )}

            <Button disabled={isSubmitting} type="submit">
              {isSubmitting
                ? mode === "register"
                  ? t("submit.registerLoading")
                  : t("submit.loginLoading")
                : mode === "register"
                  ? t("submit.register")
                  : t("submit.login")}
            </Button>
          </form>
        </Card>

        {/* OAuth buttons */}
        <OAuthButtons />
      </section>

      <div className="auth-footer-stack">
        <LanguageSelect className="language-select language-select-auth" />
        <FooterLinks className="footer-links auth-footer-links" />
      </div>
    </main>
  );
}
