import { LandingFooter } from "./landing/LandingFooter";
import { MarketingHeader } from "./landing/MarketingHeader";
import { SignInForm } from "./SignInForm";

export function SignInPage() {
  return (
    <div className="sign-in-page-shell">
      <MarketingHeader context="sign-in" />
      <main className="auth-shell">
        <section className="auth-card" aria-labelledby="sign-in-title">
          <SignInForm />
        </section>
      </main>
      <LandingFooter />
    </div>
  );
}
