"use client";

import { AppLogo } from "@/components/AppLogo";
import { FooterLinks } from "@/components/FooterLinks";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TextInput } from "@/components/ui/TextInput";
import { FormMode, useLoginPage } from "./login";

const authModes: Array<{ label: string; value: FormMode }> = [
  {
    label: "Login",
    value: "login",
  },
  {
    label: "Register",
    value: "register",
  },
];

export default function LoginPage() {
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

  return (
    <main className="auth-page">
      <section className="space-y-8">
        <div className="space-y-3 text-center">
          {/* Logo */}
          <AppLogo size="large" />
        </div>

        {/* Login */}
        <div className="app-card p-6 shadow-sm">
          <SegmentedControl
            onChange={selectMode}
            options={authModes}
            value={mode}
          />

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {/* User credentials. */}
            <TextInput
              label="Email"
              name="email"
              onChange={(event) => setEmail(event.target.value)}
              required
              type="email"
              value={email}
            />

            <TextInput
              label="Password"
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
                label="Confirm password"
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
                  ? "Creating account..."
                  : "Signing in..."
                : mode === "register"
                  ? "Create account"
                  : "Continue"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <FooterLinks />
      </section>
    </main>
  );
}
