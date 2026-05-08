import Link from "next/link";
import Image from "next/image";

export default function LoginPage() {
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
            <button className="tab-button tab-button-active">Login</button>
            <button className="tab-button">Register</button>
          </div>

          <form className="mt-6 space-y-4">
            <label className="form-field">
              <span className="form-label">Email</span>
              <input
                className="form-input"
                name="email"
                type="email"
              />
            </label>

            <label className="form-field">
              <span className="form-label">Password</span>
              <input
                className="form-input"
                name="password"
                type="password"
              />
            </label>

            <button className="primary-button" type="submit">
              Continue
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
