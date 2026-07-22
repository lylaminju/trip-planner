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

export class TripValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TripValidationError";
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

export class AiPlannerConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiPlannerConfigError";
  }
}

export class AiGenerationRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiGenerationRateLimitError";
  }
}

// OpenAI itself rejected the call with a 429 (tokens-per-minute budget),
// as opposed to our own daily generation cap above. The message stays generic
// for users; upstreamDetail carries OpenAI's exact limit diagnostics for logs.
export class AiUpstreamRateLimitError extends Error {
  constructor(readonly upstreamDetail: string | null = null) {
    super(
      "The AI service is handling too many requests right now. Please try again in a minute.",
    );
    this.name = "AiUpstreamRateLimitError";
  }
}

export class GoogleRoutesRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoogleRoutesRateLimitError";
  }
}

export class GooglePlacesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GooglePlacesConfigError";
  }
}

export class GooglePlacesUpstreamError extends Error {
  readonly status: 502 | 504;

  constructor(message: string, status: 502 | 504) {
    super(message);
    this.name = "GooglePlacesUpstreamError";
    this.status = status;
  }
}

export class GooglePlacesRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GooglePlacesRateLimitError";
  }
}
