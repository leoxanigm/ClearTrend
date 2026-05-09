"use client";

import Link from "next/link";
import Image from "next/image";
import { useLoginPage } from "./login";

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
          <picture>
            <source
              media="(prefers-color-scheme: light)"
              srcSet="/logo-draft67.png"
            />
            <Image
              alt="ClearTrend"
              className="brand-logo-large mx-auto"
              height={280}
              priority
              src="/logo-draft10.png"
              width={500}
            />
          </picture>
        </div>

        {/* Login */}
        <div className="app-card p-6 shadow-sm">
          <div className="tab-list">
            {/* Mode selector. */}
            <button
              className={
                mode === "login"
                  ? "tab-button tab-button-active"
                  : "tab-button"
              }
              onClick={() => selectMode("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={
                mode === "register"
                  ? "tab-button tab-button-active"
                  : "tab-button"
              }
              onClick={() => selectMode("register")}
              type="button"
            >
              Register
            </button>
          </div>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            {/* User credentials. */}
            <label className="form-field">
              <span className="form-label">Email</span>
              <input
                className="form-input"
                name="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>

            <label className="form-field">
              <span className="form-label">Password</span>
              <input
                className="form-input"
                name="password"
                onChange={(event) => setPassword(event.target.value)}
                minLength={mode === "register" ? 8 : undefined}
                required
                type="password"
                value={password}
              />
            </label>

            {/* If register => password confirmation */}
            {mode === "register" && (
              <label className="form-field">
                <span className="form-label">Confirm password</span>
                <input
                  className="form-input"
                  name="confirmPassword"
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  minLength={8}
                  required
                  type="password"
                  value={confirmPassword}
                />
              </label>
            )}

            {message && (
              // User feedback
              <p className={`form-message form-message-${message.type}`}>
                {message.text}
              </p>
            )}

            <button
              className="primary-button"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting
                ? mode === "register"
                  ? "Creating account..."
                  : "Signing in..."
                : mode === "register"
                  ? "Create account"
                  : "Continue"}
            </button>
          </form>
        </div>

        {/* Footer */}
        <footer className="footer-links">
          <Link className="app-link" href="/privacy">
            Privacy Policy
          </Link>
          <Link className="app-link" href="/terms">
            Terms of Service
          </Link>
        </footer>
      </section>
    </main>
  );
}
