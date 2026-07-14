import type {
  AiDestinationTransitHub,
  AiPlanningSetup,
  TripTransitPoint,
} from "@/lib/types";

export type TransitStopChoice = number | "custom" | null;

export type TransitDepartureChoice = TransitStopChoice | "same";

export type TransitStopDraft = {
  arrivalChoice: TransitStopChoice;
  arrivalUrl: string;
  arrivalTime: string;
  departureChoice: TransitDepartureChoice;
  departureUrl: string;
  departureTime: string;
};

export function buildTransitStopDraft(
  setup: AiPlanningSetup | null,
): TransitStopDraft {
  const arrivalPoint = setup?.arrivalPoint ?? null;
  const departurePoint = setup?.departurePoint ?? null;
  const departureSameAsArrival =
    arrivalPoint !== null &&
    departurePoint !== null &&
    arrivalPoint.name === departurePoint.name;

  return {
    arrivalChoice: hubIdMatchingPoint(setup?.transitHubs, arrivalPoint),
    arrivalUrl: "",
    arrivalTime: arrivalPoint?.event_time ?? "",
    departureChoice: departureSameAsArrival
      ? "same"
      : hubIdMatchingPoint(setup?.transitHubs, departurePoint),
    departureUrl: "",
    departureTime: departurePoint?.event_time ?? "",
  };
}

export function transitStopPayload(draft: TransitStopDraft): {
  arrival_hub_id: number | null;
  arrival_google_maps_url: string | null;
  arrival_time: string | null;
  departure_hub_id: number | null;
  departure_google_maps_url: string | null;
  departure_time: string | null;
} {
  const departureChoice =
    draft.departureChoice === "same"
      ? draft.arrivalChoice
      : draft.departureChoice;
  const departureUrl =
    draft.departureChoice === "same" ? draft.arrivalUrl : draft.departureUrl;

  return {
    arrival_hub_id:
      typeof draft.arrivalChoice === "number" ? draft.arrivalChoice : null,
    arrival_google_maps_url:
      draft.arrivalChoice === "custom" ? trimmedOrNull(draft.arrivalUrl) : null,
    arrival_time: trimmedOrNull(draft.arrivalTime),
    departure_hub_id:
      typeof departureChoice === "number" ? departureChoice : null,
    departure_google_maps_url:
      departureChoice === "custom" ? trimmedOrNull(departureUrl) : null,
    departure_time: trimmedOrNull(draft.departureTime),
  };
}

export function transitHubChipLabel(hub: AiDestinationTransitHub): string {
  return hub.iata_code ? `${hub.iata_code} · ${hub.name}` : hub.name;
}

export function transitHubShortLabel(hub: AiDestinationTransitHub): string {
  return hub.iata_code ?? hub.name;
}

export function transitStopsSummary(
  transitDraft: TransitStopDraft,
  setup: AiPlanningSetup | null,
): string {
  const hubs = setup?.transitHubs ?? [];
  const arrival = transitStopLabel(
    transitDraft.arrivalChoice,
    transitDraft.arrivalUrl,
    setup?.arrivalPoint?.name ?? null,
    hubs,
  );
  const departure =
    transitDraft.departureChoice === "same"
      ? arrival
      : transitStopLabel(
          transitDraft.departureChoice,
          transitDraft.departureUrl,
          setup?.departurePoint?.name ?? null,
          hubs,
        );
  if (!arrival && !departure) return "Not set";
  return `${arrival ?? "—"} → ${departure ?? "—"}`;
}

function transitStopLabel(
  choice: TransitStopChoice,
  url: string,
  savedName: string | null,
  hubs: AiDestinationTransitHub[],
): string | null {
  if (typeof choice === "number") {
    const hub = hubs.find((entry) => entry.id === choice);
    return hub ? transitHubShortLabel(hub) : null;
  }
  if (choice === "custom") {
    return url.trim() !== "" ? "Custom spot" : null;
  }
  return savedName;
}

function hubIdMatchingPoint(
  transitHubs: AiDestinationTransitHub[] | undefined,
  point: TripTransitPoint | null | undefined,
): number | null {
  if (!transitHubs || !point) return null;
  return transitHubs.find((hub) => hub.name === point.name)?.id ?? null;
}

function trimmedOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
