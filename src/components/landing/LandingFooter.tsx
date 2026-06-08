const LINKEDIN_URL = "https://www.linkedin.com/in/lylaminju";

export function LandingFooter() {
  return (
    <footer className="landing-footer" aria-label="Footer">
      <p className="landing-footer-brand">Trip Planner · By Minju Park</p>
      <div className="landing-footer-links">
        <a href={LINKEDIN_URL} target="_blank" rel="noreferrer">
          LinkedIn
        </a>
      </div>
    </footer>
  );
}
