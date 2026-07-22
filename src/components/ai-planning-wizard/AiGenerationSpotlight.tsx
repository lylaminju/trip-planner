import { useEffect, useMemo, useState } from "react";

import type { AiDestinationCandidate } from "@/lib/types";

import { MapPinIcon } from "../Icons";
import {
  SPOTLIGHT_ROTATE_MS,
  selectSpotlightCandidates,
} from "./generation-spotlight";

// Decorative rotating cards shown while the itinerary generates. The parent
// screen owns the live status region, so this block stays aria-hidden to keep
// the rotation from spamming assistive tech.
export function AiGenerationSpotlight({
  candidates,
  selectedIds,
  destination,
}: {
  candidates: AiDestinationCandidate[];
  selectedIds: number[];
  destination: string;
}) {
  const { items, fromSelection } = useMemo(
    () => selectSpotlightCandidates(candidates, selectedIds),
    [candidates, selectedIds],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, SPOTLIGHT_ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length]);

  if (items.length === 0) return null;

  const active = items[index] ?? items[0];
  const eyebrow = fromSelection
    ? "Your must-sees"
    : `Popular in ${destination}`;

  return (
    <div className="ai-generation-spotlight" aria-hidden="true">
      <span className="ai-spotlight-eyebrow">{eyebrow}</span>
      {/* key remounts the card each rotation so the fade-in animation replays */}
      <div key={active.id} className="ai-spotlight-card">
        <span className="ai-spotlight-thumb">
          {active.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote Supabase Storage thumbnail; fixed box, no next/image domain config needed
            <img
              className="ai-spotlight-thumb-img"
              src={active.image_url}
              alt=""
              loading="lazy"
              width={108}
              height={104}
            />
          ) : (
            <span className="ai-spotlight-thumb-fallback">
              <MapPinIcon />
            </span>
          )}
        </span>
        <span className="ai-spotlight-body">
          <span className="ai-spotlight-name">{active.name}</span>
          <span className="ai-spotlight-meta">{active.area ?? ""}</span>
          <span className="ai-spotlight-blurb">{active.blurb ?? ""}</span>
        </span>
      </div>
      {items.length > 1 && (
        <span className="ai-spotlight-dots">
          {items.map((item, dotIndex) => (
            <span
              key={item.id}
              className={
                dotIndex === index
                  ? "ai-spotlight-dot active"
                  : "ai-spotlight-dot"
              }
            />
          ))}
        </span>
      )}
    </div>
  );
}
