import { SERVICE_TITLE } from "@/lib/service-brand";

const LINKEDIN_URL = "https://www.linkedin.com/in/lylaminju";

export function LandingFooter() {
  return (
    <footer className="landing-footer" aria-label="Footer">
      <p className="landing-footer-brand">{SERVICE_TITLE} · By Minju Park</p>
      <div className="landing-footer-links">
        <a href={LINKEDIN_URL} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      </div>
    </footer>
  );
}
