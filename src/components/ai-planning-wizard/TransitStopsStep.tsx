import type {
  AiDestinationTransitHub,
  TripTransitPoint,
} from "@/lib/types";

import {
  TRANSIT_CUSTOM_STOP_EMOJI,
  transitHubChipEmoji,
  transitHubChipLabel,
  type TransitDepartureChoice,
  type TransitStopDraft,
} from "./transit-stop-draft";
import { UrlPreviewHint } from "./UrlPreviewHint";

export function TransitStopsStep({
  currentArrivalPoint,
  currentDeparturePoint,
  onTransitDraftChange,
  transitDraft,
  transitHubs,
  tripId,
}: {
  currentArrivalPoint: TripTransitPoint | null;
  currentDeparturePoint: TripTransitPoint | null;
  onTransitDraftChange: (draft: TransitStopDraft) => void;
  transitDraft: TransitStopDraft;
  transitHubs: AiDestinationTransitHub[];
  tripId: number;
}) {
  return (
    <div className="ai-logistics-step">
      <TransitStopField
        label="Where your trip starts"
        timeLabel="Arrival time"
        idleHint="Day one starts here instead of where you're staying."
        urlPlaceholder="Paste a Google Maps link to your arrival spot"
        currentLabel="Current arrival stop"
        currentPoint={currentArrivalPoint}
        choice={transitDraft.arrivalChoice}
        url={transitDraft.arrivalUrl}
        time={transitDraft.arrivalTime}
        transitHubs={transitHubs}
        tripId={tripId}
        onChoiceChange={(arrivalChoice) =>
          onTransitDraftChange({
            ...transitDraft,
            arrivalChoice: arrivalChoice === "same" ? null : arrivalChoice,
          })
        }
        onUrlChange={(arrivalUrl) =>
          onTransitDraftChange({ ...transitDraft, arrivalUrl })
        }
        onTimeChange={(arrivalTime) =>
          onTransitDraftChange({ ...transitDraft, arrivalTime })
        }
      />

      <TransitStopField
        label="Where your trip ends"
        timeLabel="Departure time"
        idleHint="Your last day wraps up here with time to spare."
        urlPlaceholder="Paste a Google Maps link to your departure spot"
        currentLabel="Current departure stop"
        currentPoint={currentDeparturePoint}
        choice={transitDraft.departureChoice}
        url={transitDraft.departureUrl}
        time={transitDraft.departureTime}
        transitHubs={transitHubs}
        tripId={tripId}
        allowSameAsArrival
        onChoiceChange={(departureChoice) =>
          onTransitDraftChange({ ...transitDraft, departureChoice })
        }
        onUrlChange={(departureUrl) =>
          onTransitDraftChange({ ...transitDraft, departureUrl })
        }
        onTimeChange={(departureTime) =>
          onTransitDraftChange({ ...transitDraft, departureTime })
        }
      />
    </div>
  );
}

function TransitStopField({
  label,
  timeLabel,
  idleHint,
  urlPlaceholder,
  currentLabel,
  currentPoint,
  choice,
  url,
  time,
  transitHubs,
  tripId,
  allowSameAsArrival = false,
  onChoiceChange,
  onUrlChange,
  onTimeChange,
}: {
  label: string;
  timeLabel: string;
  idleHint: string;
  urlPlaceholder: string;
  currentLabel: string;
  currentPoint: TripTransitPoint | null;
  choice: TransitDepartureChoice;
  url: string;
  time: string;
  transitHubs: AiDestinationTransitHub[];
  tripId: number;
  allowSameAsArrival?: boolean;
  onChoiceChange: (choice: TransitDepartureChoice) => void;
  onUrlChange: (url: string) => void;
  onTimeChange: (time: string) => void;
}) {
  return (
    <div className="ai-transit-panel">
      <div className="ai-field-row">
        <div className="ai-field-group">
          <div className="ai-field-label-row">
            <span className="ai-field-label">{label}</span>
            {allowSameAsArrival && (
              <label
                className={
                  choice === "same"
                    ? "ai-label-checkbox selected"
                    : "ai-label-checkbox"
                }
              >
                <input
                  type="checkbox"
                  checked={choice === "same"}
                  onChange={(event) =>
                    onChoiceChange(event.currentTarget.checked ? "same" : null)
                  }
                />
                Same as arrival
              </label>
            )}
          </div>
          {choice === "same" ? (
            <span className="ai-field-hint">
              Your trip ends at your arrival stop.
            </span>
          ) : (
            <div className="ai-chip-grid">
              {transitHubs.map((hub) => {
                const isSelected = choice === hub.id;
                return (
                  <button
                    key={hub.id}
                    type="button"
                    className={isSelected ? "ai-chip selected" : "ai-chip"}
                    aria-pressed={isSelected}
                    onClick={() => onChoiceChange(isSelected ? null : hub.id)}
                  >
                    <span className="ai-chip-emoji" aria-hidden="true">
                      {transitHubChipEmoji(hub)}
                    </span>
                    {transitHubChipLabel(hub)}
                  </button>
                );
              })}
              <button
                type="button"
                className={choice === "custom" ? "ai-chip selected" : "ai-chip"}
                aria-pressed={choice === "custom"}
                onClick={() =>
                  onChoiceChange(choice === "custom" ? null : "custom")
                }
              >
                <span className="ai-chip-emoji" aria-hidden="true">
                  {TRANSIT_CUSTOM_STOP_EMOJI}
                </span>
                Somewhere else
              </button>
            </div>
          )}
          {choice === "custom" && (
            <>
              <input
                type="url"
                value={url}
                placeholder={urlPlaceholder}
                aria-label={`${label} Google Maps link`}
                onChange={(event) => onUrlChange(event.currentTarget.value)}
              />
              <UrlPreviewHint tripId={tripId} url={url} idleHint={idleHint} />
            </>
          )}
        </div>
        <label className="ai-field-group ai-field-time">
          <span className="ai-field-label">{timeLabel}</span>
          <input
            type="time"
            value={time}
            onChange={(event) => onTimeChange(event.currentTarget.value)}
          />
        </label>
      </div>

      {currentPoint && choice === null && (
        <p className="ai-transit-current">
          {currentLabel}: <strong>{currentPoint.name}</strong>
          {currentPoint.event_time ? ` — ${currentPoint.event_time}` : ""}
        </p>
      )}
    </div>
  );
}
