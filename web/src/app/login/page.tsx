"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import Image from "next/image";

type FormMode = "login" | "register";
type MessageType = "error" | "success";

export default function LoginPage() {
  // Form state
  const [mode, setMode] = useState<FormMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{
    type: MessageType;
    text: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register is connected, login is still waiting for its backend route
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (mode === "login") {
      setMessage({
        type: "error",
        text: "Login is not connected yet.",
      });
      return;
    }

    // Keep password confirmation on the client for now
    if (password !== confirmPassword) {
      setMessage({
        type: "error",
        text: "Passwords do not match.",
      });
      return;
    }

    // Call the register API
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      // The current backend returns a generic error for duplicate emails
      if (!response.ok) {
        const body = await response.json().catch(() => null);

        setMessage({
          type: "error",
          text: body?.error ?? "Registration failed.",
        });
        return;
      }

      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setMessage({
        type: "success",
        text: "Account created.",
      });
    } catch {
      setMessage({
        type: "error",
        text: "Registration failed.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

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
              alt="ClearTrend logo"
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
              onClick={() => {
                setMode("login");
                setMessage(null);
              }}
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
              onClick={() => {
                setMode("register");
                setMessage(null);
              }}
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
              {mode === "register" ? "Create account" : "Continue"}
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
