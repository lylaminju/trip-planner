export class PlaceNotFoundError extends Error {
  constructor(id: number) {
    super(`Place ${id} not found`);
    this.name = "PlaceNotFoundError";
  }
}

export class RouteSegmentNotFoundError extends Error {
  constructor(id: number) {
    super(`Route segment ${id} not found`);
    this.name = "RouteSegmentNotFoundError";
  }
}

export class ItineraryItemNotFoundError extends Error {
  constructor(id: number) {
    super(`Itinerary item ${id} not found`);
    this.name = "ItineraryItemNotFoundError";
  }
}

export class TripAccessDeniedError extends Error {
  constructor(readonly tripId: number) {
    super("Trip access denied.");
    this.name = "TripAccessDeniedError";
  }
}

export class GoogleMapsUrlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleMapsUrlValidationError";
  }
}

export class GoogleMapsUrlUpstreamError extends Error {
  readonly status: 502 | 504;

  constructor(message: string, status: 502 | 504) {
    super(message);
    this.name = "GoogleMapsUrlUpstreamError";
    this.status = status;
  }
}

export class GoogleRoutesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleRoutesConfigError";
  }
}

export class GoogleRoutesUpstreamError extends Error {
  readonly status: 502 | 504;

  constructor(message: string, status: 502 | 504) {
    super(message);
    this.name = "GoogleRoutesUpstreamError";
    this.status = status;
  }
}
