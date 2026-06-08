# Service Name Decision: Plotinerary

## Decision

The production service name is **Plotinerary**.

The previous name, **Trip Planner**, remains useful as a generic product
description, but it is too broad to work as a distinctive public service name.

## Why Plotinerary

Plotinerary combines **plot** and **itinerary**, which matches the product's
core promise: users arrange visits in a dated itinerary while checking the same
plan as markers and route lines on a map.

The name fits the product for three reasons:

- It makes the map relationship explicit without sounding like a generic route
  optimizer.
- It keeps the itinerary concept visible, which matters because the product is
  not only a map viewer.
- It is more searchable and distinctive than broad names such as Trip Planner,
  Tripboard, or Mapday.

## Tradeoffs

Plotinerary is longer than ideal for a daily-use app name. The length is
acceptable because the meaning is clear once seen, and the name is memorable
enough for a public landing page.

Shorter variants were considered:

- **Plotin** is shorter, but search results are dominated by Plotin/Plotinus
  philosophy references and unrelated company/name usage. It also loses the
  itinerary meaning.
- **Flotin** and **Flotiner** are shorter, but they are harder to connect to
  trip planning and easier to misread.
- **Itinplot** is clearer than Plotin, but it feels more technical and less
  natural as a public product name.

## Implementation Note

The service title is centralized in `src/lib/service-brand.ts` as
`SERVICE_TITLE`. User-facing service-name strings should reference that constant
where practical so future renaming is traceable.
