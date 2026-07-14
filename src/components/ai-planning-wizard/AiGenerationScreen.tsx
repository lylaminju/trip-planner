import { useEffect, useMemo, useState } from "react";

const STATUS_INTERVAL_MS = 900;

export function AiGenerationScreen({
  destination,
  days,
  paceRange,
  modeLabels,
}: {
  destination: string;
  days: number;
  paceRange: string;
  modeLabels: string[];
}) {
  const statusMessages = useMemo(
    () => [
      "Reading your preferences…",
      `Mapping must-see spots across ${destination}…`,
      `Balancing ${paceRange} stops a day…`,
      `Optimizing ${
        modeLabels.join(" & ").toLowerCase() || "your"
      } routes…`,
      `Assembling your ${days}-day itinerary…`,
    ],
    [destination, days, paceRange, modeLabels],
  );
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStatusIndex((current) => (current + 1) % statusMessages.length);
    }, STATUS_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [statusMessages.length]);

  return (
    <div
      className="ai-generation-screen"
      role="status"
      aria-label="Creating itinerary"
    >
      <div className="ai-generation-icons" aria-hidden="true">
        <svg className="ai-generation-icon" viewBox="0 0 32 32">
          <path d="M16 28s9-7.4 9-16A9 9 0 0 0 7 12c0 8.6 9 16 9 16Z" />
          <circle cx="16" cy="12" r="3.5" />
        </svg>
        <svg className="ai-generation-icon" viewBox="0 0 32 32">
          <path d="M7 22c4.5-8 14-2 18-10" />
          <circle cx="7" cy="22" r="2.5" />
          <circle cx="25" cy="12" r="2.5" />
        </svg>
        <svg className="ai-generation-icon" viewBox="0 0 32 32">
          <path d="M9 6v4" />
          <path d="M23 6v4" />
          <path d="M6 10h20v16H6z" />
          <path d="M6 15h20" />
          <path d="m12 21 3 3 6-7" />
        </svg>
      </div>
      <div className="ai-generation-copy">
        <h2 className="ai-generation-title">
          Building your {destination} itinerary
        </h2>
        <p className="ai-generation-status-message">
          {statusMessages[statusIndex]}
        </p>
      </div>
      <div className="ai-generation-bar" aria-hidden="true">
        <span className="ai-generation-bar-fill" />
      </div>
    </div>
  );
}
