"use client";

import { useState } from "react";

import { requestAccessHref } from "./landing/access";

export function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Sign in failed.");
        return;
      }

      window.location.assign("/trips");
    } catch {
      setError("Sign in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <h1 id="sign-in-title">Sign in</h1>
      <p className="intro">
        Use the email tied to your invite to continue to your saved trips and
        day-by-day plans.
      </p>
      <form className="signin-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            autoComplete="email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            autoComplete="current-password"
            name="password"
            placeholder="Enter your password"
            required
            type="password"
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
          />
        </label>
        {error && <p className="error-text">{error}</p>}
        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
      <p className="access-row">
        Need access? <a href={requestAccessHref}>Request an invite</a> and we
        will follow up.
      </p>
    </>
  );
}
