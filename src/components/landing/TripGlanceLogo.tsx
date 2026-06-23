import { SERVICE_TITLE } from "@/lib/service-brand";

export function TripGlanceLogo() {
  return (
    <span className="tripglance-logo-lockup">
      <svg
        className="tripglance-logo-mark"
        viewBox="0 0 64 64"
        aria-hidden="true"
        focusable="false"
      >
        <rect width="64" height="64" rx="14" />
        <path d="M14 24L26 18L38 24L50 18V48L38 54L26 48L14 54V24Z" />
        <path d="M26 18V48M38 24V54" />
      </svg>
      <span>{SERVICE_TITLE}</span>
    </span>
  );
}
