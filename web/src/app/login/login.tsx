"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

export type FormMode = "login" | "register";
type MessageType = "error" | "success";

// Hook that owns the login/register form behavior
export function useLoginPage() {
  const t = useTranslations("login.feedback");
  // Router is used for client-side redirects after auth checks
  const router = useRouter();

  // Current tab selected by the user
  const [mode, setMode] = useState<FormMode>("login");

  // Email input value
  const [email, setEmail] = useState("");

  // Password input value
  const [password, setPassword] = useState("");

  // Register-only password confirmation value
  const [confirmPassword, setConfirmPassword] = useState("");

  // User-facing error or success message
  const [message, setMessage] = useState<{
    type: MessageType;
    text: string;
  } | null>(null);

  // Submission flag used to disable the button and show loading text
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect logged-in users away from the auth page
  useEffect(() => {
    // Ask the server if the HttpOnly session cookie is valid
    async function redirectIfAuthenticated() {
      const response = await fetch("/api/auth/session", {
        cache: "no-store",
      }).catch(() => null);

      // Keep the login page usable if the session check fails
      if (!response?.ok) {
        return;
      }

      // Parse the session response defensively
      const body = await response.json().catch(() => null);

      // Already authenticated users should land on the dashboard
      if (body?.authenticated) {
        router.replace("/dashboard");
      }
    }

    redirectIfAuthenticated();
  }, [router]);

  // Switch between login and register modes
  function selectMode(nextMode: FormMode) {
    setMode(nextMode);
    setMessage(null);
  }

  // Handle both login and register form submissions
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    // Keep the browser on the current page while we call the API
    event.preventDefault();

    // Clear stale feedback before validating or submitting
    setMessage(null);

    // Register requires both password fields to match
    if (mode === "register" && password !== confirmPassword) {
      setMessage({
        type: "error",
        text: t("passwordMismatch"),
      });
      return;
    }

    // Mirror the backend minimum password length on the client
    if (mode === "register" && password.length < 8) {
      setMessage({
        type: "error",
        text: t("passwordTooShort"),
      });
      return;
    }

    // Pick the backend route based on the active tab
    const endpoint =
      mode === "login" ? "/api/auth/login" : "/api/auth/register";

    // Generic fallback text if the backend sends no usable error
    const fallbackError =
      mode === "login" ? t("loginFailed") : t("registrationFailed");

    // Disable the form submit button while the request is running
    setIsSubmitting(true);

    try {
      // Send credentials to the selected auth endpoint
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      // Surface backend validation/auth errors to the user
      if (!response.ok) {
        const body = await response.json().catch(() => null);

        setMessage({
          type: "error",
          text: translateAuthError(body?.error, fallbackError),
        });
        return;
      }

      // Successful login creates a cookie server-side, then enters the app
      if (mode === "login") {
        setMessage({
          type: "success",
          text: t("loggedIn"),
        });
        router.replace("/dashboard");
        return;
      }

      // Successful registration resets the form and returns to login mode
      setEmail("");
      setPassword("");
      setConfirmPassword("");
      setMode("login");
      setMessage({
        type: "success",
        text: t("accountCreated"),
      });
    } catch {
      // Network or unexpected client-side failures use the fallback message
      setMessage({
        type: "error",
        text: fallbackError,
      });
    } finally {
      // Always re-enable submission after the request finishes
      setIsSubmitting(false);
    }
  }

  function translateAuthError(error: unknown, fallback: string) {
    if (typeof error !== "string") {
      return fallback;
    }

    const messages: Record<string, string> = {
      "Email already exists.": t("emailAlreadyExists"),
      "Invalid email or password.": t("invalidCredentials"),
      "Invalid email.": t("invalidEmail"),
      "Invalid request body.": fallback,
      "Missing fields": t("missingFields"),
      "Password must be at least 8 characters.": t("passwordTooShort"),
      "Server error": t("serverError"),
    };

    return messages[error] ?? fallback;
  }

  // Expose state and actions to the page component
  return {
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
  };
}
