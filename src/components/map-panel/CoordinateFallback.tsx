import type { ItineraryItem, Place } from "@/lib/types";

export function CoordinateFallback({
  items,
  unscheduledPlaces,
}: {
  items: ItineraryItem[];
  unscheduledPlaces: Place[];
}) {
  return (
    <section className="panel panel-map map-fallback">
      <h2>Coordinates</h2>
      {items.map((item) => (
        <p key={item.id}>
          <strong>{item.place.name}</strong>: {item.place.latitude},{" "}
          {item.place.longitude}
        </p>
      ))}
      {unscheduledPlaces.map((place) => (
        <p key={place.id}>
          <strong>{place.name}</strong>: {place.latitude}, {place.longitude}
        </p>
      ))}
    </section>
  );
}
