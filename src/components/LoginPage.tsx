"use client";

import { useState } from "react";

import { LandingFooter } from "./landing/LandingFooter";
import { LandingFeatureProof } from "./landing/LandingFeatureProof";
import { LandingHero } from "./landing/LandingHero";

export function LoginPage() {
  const [emailLocalPart, setEmailLocalPart] = useState("");
  const [emailDomain, setEmailDomain] = useState("gmail.com");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const email = `${emailLocalPart.trim()}@${emailDomain}`;

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Login failed.");
        return;
      }

      window.location.assign("/");
    } catch {
      setError("Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-shell landing-shell">
      <LandingHero />
      <LandingFeatureProof />

      <section
        className="login-card landing-sign-in"
        id="sign-in"
        aria-labelledby="sign-in-title"
      >
        <div className="login-copy">
          <h2 id="sign-in-title">Sign in</h2>
        </div>
        <form className="login-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <span className="login-email-row">
              <input
                autoComplete="email"
                className="login-email-local"
                name="email_local"
                type="text"
                value={emailLocalPart}
                onChange={(event) =>
                  setEmailLocalPart(event.currentTarget.value)
                }
              />
              <span className="login-email-at" aria-hidden="true">
                @
              </span>
              <input
                className="login-email-domain"
                name="email_domain"
                type="text"
                value={emailDomain}
                onChange={(event) => setEmailDomain(event.currentTarget.value)}
              />
            </span>
          </label>
          <label>
            <span>Password</span>
            <input
              autoComplete="current-password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.currentTarget.value)}
            />
          </label>
          {error && <p className="error-text">{error}</p>}
          <button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </section>

      <LandingFooter />
    </main>
  );
}
