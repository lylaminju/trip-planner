"use client";

import { useEffect, useState } from "react";

import {
  DEFAULT_QUICK_VISIT_TIME,
  normalizeQuickVisitTime,
} from "@/lib/quick-visit-time";
import { splitVisitTime } from "@/lib/visit-time";

import { ClockIcon } from "../Icons";
import {
  VisitTimeInlineEditor,
  type VisitTimeSegment,
} from "./VisitTimeInlineEditor";

type Props = {
  placeName: string;
  visitTime: string | null;
  displayTimePrefix: string | null;
  canEdit: boolean;
  onTimeChange: (visitTime: string | null) => void | Promise<void>;
};

export function VisitTimeSlot(props: Props) {
  const [isEditingTime, setIsEditingTime] = useState(false);
  const [draftTime, setDraftTime] = useState(
    () => props.visitTime ?? DEFAULT_QUICK_VISIT_TIME,
  );
  const [activeTimeSegment, setActiveTimeSegment] =
    useState<VisitTimeSegment>("hour");
  const [isSavingTime, setIsSavingTime] = useState(false);
  const [timeError, setTimeError] = useState<string | null>(null);
  const displayVisitTime = normalizeQuickVisitTime(props.visitTime);
  const [displayVisitHour, displayVisitMinute] =
    splitVisitTime(displayVisitTime);
  const timeButtonLabel = props.visitTime
    ? `Edit visit time for ${props.placeName}`
    : `Add visit time for ${props.placeName}`;

  useEffect(() => {
    if (!isEditingTime) {
      setDraftTime(props.visitTime ?? DEFAULT_QUICK_VISIT_TIME);
    }
  }, [isEditingTime, props.visitTime]);

  function openTimeEditor(segment: VisitTimeSegment) {
    setDraftTime(props.visitTime ?? DEFAULT_QUICK_VISIT_TIME);
    setActiveTimeSegment(segment);
    setTimeError(null);
    setIsEditingTime(true);
  }

  async function saveVisitTime(nextTime: string | null) {
    setIsSavingTime(true);
    setTimeError(null);
    try {
      await props.onTimeChange(nextTime);
      setIsEditingTime(false);
    } catch (reason) {
      setTimeError(
        reason instanceof Error ? reason.message : "Failed to update time.",
      );
    } finally {
      setIsSavingTime(false);
    }
  }

  function saveDraftTime(nextDraftTime = draftTime) {
    const nextTime =
      nextDraftTime.trim().length === 0
        ? null
        : normalizeQuickVisitTime(nextDraftTime);
    if (nextTime === null) {
      if (nextDraftTime.trim().length === 0) {
        void saveVisitTime(null);
        return;
      }
      setTimeError("Enter a valid time.");
      return;
    }

    void saveVisitTime(nextTime);
  }

  return (
    <span className="visit-time-slot">
      {props.canEdit && isEditingTime ? (
        <VisitTimeInlineEditor
          placeName={props.placeName}
          value={draftTime}
          activeSegment={activeTimeSegment}
          isSaving={isSavingTime}
          error={timeError}
          onValueChange={(value) => {
            setDraftTime(value);
            setTimeError(null);
          }}
          onActiveSegmentChange={setActiveTimeSegment}
          onSave={saveDraftTime}
          onCancel={() => {
            setIsEditingTime(false);
            setTimeError(null);
          }}
        />
      ) : props.canEdit && displayVisitTime ? (
        <span
          className="visit-time-segments"
          aria-label={`Visit time ${displayVisitTime}`}
        >
          <button
            type="button"
            className="visit-time-segment"
            data-time-segment="hour"
            aria-label={`Edit visit hour for ${props.placeName}`}
            title={`Edit visit hour for ${props.placeName}`}
            onClick={() => openTimeEditor("hour")}
          >
            {displayVisitHour}
          </button>
          <span className="visit-time-separator" aria-hidden="true">
            :
          </span>
          <button
            type="button"
            className="visit-time-segment"
            data-time-segment="minute"
            aria-label={`Edit visit minute for ${props.placeName}`}
            title={`Edit visit minute for ${props.placeName}`}
            onClick={() => openTimeEditor("minute")}
          >
            {displayVisitMinute}
          </button>
        </span>
      ) : props.canEdit ? (
        <button
          type="button"
          className="visit-time-chip visit-time-add-control empty"
          aria-label={timeButtonLabel}
          title={timeButtonLabel}
          onClick={() => openTimeEditor("hour")}
        >
          <span className="visit-time-add-plus" aria-hidden="true">
            +
          </span>
          <ClockIcon />
        </button>
      ) : (
        props.displayTimePrefix && (
          <span className="visit-time-text">{props.displayTimePrefix}</span>
        )
      )}
    </span>
  );
}
