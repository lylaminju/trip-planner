import type { ItineraryView, Place } from "@/lib/types";

// The planner panel already carries day grouping and ordering, so this panel
// stays a flat list and only adds what the planner has no affordance for:
// opening a place in Google Maps.
export function MapUnavailablePanel({
  itinerary,
}: {
  itinerary: ItineraryView;
}) {
  const places = dedupeById([
    ...itinerary.days.flatMap((day) => day.items.map((item) => item.place)),
    ...itinerary.unscheduled,
  ]);

  return (
    <section
      className="panel panel-map map-unavailable"
      aria-label="Map unavailable"
    >
      <p className="map-unavailable-message" role="status">
        We couldn&apos;t load the map.
      </p>
      {places.length > 0 && (
        <ul className="map-unavailable-list">
          {places.map((place) => (
            <li key={place.id}>
              <a
                className="map-unavailable-link"
                href={place.google_maps_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {place.name}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// A place scheduled on several days, such as an AI-planned lodging anchor,
// would otherwise repeat with nothing here to distinguish the visits.
function dedupeById(places: Place[]): Place[] {
  return [...new Map(places.map((place) => [place.id, place])).values()];
}
