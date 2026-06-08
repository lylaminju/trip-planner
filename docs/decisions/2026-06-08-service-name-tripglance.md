# Service Name Decision: TripGlance

## Decision

The production service name is **TripGlance**.

The previous names, **Trip Planner** and **Plotinerary**, remain useful as
generic or exploratory descriptions, but they are not the public service name.

## Why TripGlance

TripGlance connects the product's travel-planning category with its core
promise: seeing an itinerary and route context at a glance.

The name fits the product for three reasons:

- It is immediately understandable for public visitors who have not learned the
  product yet.
- It emphasizes glanceability, which matches the one-page timeline-and-map
  planning surface.
- It avoids relying on less common wording such as "plot" while staying more
  distinctive than a generic name such as Trip Planner.

## Tradeoffs

TripGlance is less playful than compound names such as Plotinerary, but that is
acceptable because the landing page needs fast comprehension before brand
novelty. The name also keeps the product category visible, which should help
early public visitors understand the service without reading long copy.

Other variants were considered:

- **Plotinerary** is distinctive, but "plot" is not a strong or familiar public
  trip-planning word.
- **VisuTrip** communicates visualization, but it feels more coined and less
  natural than the phrase "at a glance."
- **TripViz** and **VizTrip** are shorter, but they carry more data-visualization
  or unrelated-product noise.
- **JourneyViz** is broad and less directly connected to short-trip planning.

## Implementation Note

The service title is centralized in `src/lib/service-brand.ts` as
`SERVICE_TITLE`. User-facing service-name strings should reference that constant
where practical so future renaming is traceable.
