"use client";

import type { DragEvent } from "react";

export function InsertionDropZone(props: {
  active: boolean;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`itinerary-insertion-zone ${props.active ? "active" : ""}`}
      aria-hidden="true"
      onDragEnter={(event) => {
        event.stopPropagation();
        props.onDragEnter(event);
      }}
      onDragOver={(event) => {
        event.stopPropagation();
        props.onDragOver(event);
      }}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
    >
      <span />
    </div>
  );
}

export function EndInsertionDropZone(props: {
  active: boolean;
  onDragEnter: (event: DragEvent<HTMLDivElement>) => void;
  onDragOver: (event: DragEvent<HTMLDivElement>) => void;
  onDragLeave: (event: DragEvent<HTMLDivElement>) => void;
  onDrop: (event: DragEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={`itinerary-end-insertion-zone ${props.active ? "active" : ""}`}
      aria-hidden="true"
      onDragEnter={(event) => {
        event.stopPropagation();
        props.onDragEnter(event);
      }}
      onDragOver={(event) => {
        event.stopPropagation();
        props.onDragOver(event);
      }}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
    >
      <span />
    </div>
  );
}
