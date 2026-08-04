"use client";

import { placeThumbGlyph } from "@/lib/place-display";
import type { Place } from "@/lib/types";

export function PlaceThumb(props: {
  place: Place;
  compact?: boolean;
  markerLabel?: string | null;
  markerColor?: string;
}) {
  return (
    <span
      className={
        props.compact ? "visit-thumb-frame compact" : "visit-thumb-frame"
      }
    >
      <span className="visit-thumb" aria-hidden="true">
        {props.place.image_url ? (
          <img
            className="visit-thumb-image"
            src={props.place.image_url}
            alt=""
            title={props.place.image_credit ?? undefined}
            loading="lazy"
          />
        ) : (
          placeThumbGlyph(props.place)
        )}
      </span>
      {props.markerLabel && (
        <span
          className="place-marker-label"
          style={{ backgroundColor: props.markerColor }}
          aria-label={`Visit order ${props.markerLabel}`}
        >
          {props.markerLabel}
        </span>
      )}
    </span>
  );
}
