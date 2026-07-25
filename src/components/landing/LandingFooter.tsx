import { FeedbackButton } from "@/components/FeedbackButton";

const CONTACT_EMAIL = "mjuudev@gmail.com";
const LINKEDIN_URL = "https://www.linkedin.com/in/lylaminju";

export function LandingFooter() {
  return (
    <footer className="landing-footer" aria-label="Footer">
      <div className="landing-footer-links">
        <a
          className="landing-footer-icon-link"
          href={`mailto:${CONTACT_EMAIL}`}
          aria-label="Email"
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="m3.5 5.5 7.893 6.036a1 1 0 0 0 1.214 0L20.5 5.5M4 19h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1Z"
            />
          </svg>
        </a>
        <a
          className="landing-footer-icon-link"
          href={LINKEDIN_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="LinkedIn"
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12.51 8.796v1.697a3.738 3.738 0 0 1 3.288-1.684c3.455 0 4.202 2.16 4.202 4.97V19.5h-3.2v-5.072c0-1.21-.244-2.766-2.128-2.766-1.827 0-2.139 1.317-2.139 2.676V19.5h-3.19V8.796h3.168ZM7.2 6.106a1.61 1.61 0 0 1-.988 1.483 1.595 1.595 0 0 1-1.743-.348A1.607 1.607 0 0 1 5.6 4.5a1.601 1.601 0 0 1 1.6 1.606Z"
            />
            <path d="M7.2 8.809H4V19.5h3.2V8.809Z" />
          </svg>
        </a>
      </div>
      <p>
        © 2026 Minju (Lyla) Park ·{" "}
        <FeedbackButton className="landing-footer-feedback">
          Send feedback
        </FeedbackButton>
      </p>
    </footer>
  );
}
