import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { AddEditPlaceModal } from "@/components/AddEditPlaceModal";
import type { PlaceSearchSelection } from "@/components/AddPlaceSearchStep";

const MAP_SELECTION: PlaceSearchSelection = {
  place_id: "poi-123",
  name: "Blue Bottle Coffee",
  latitude: 37.7,
  longitude: -122.4,
  google_maps_url: "https://www.google.com/maps/place/?q=place_id%3Apoi-123",
  photo_name: null,
  photo_attribution: null,
  image_url: null,
  image_credit: null,
};

function renderAddModal(initialSearchPlace: PlaceSearchSelection) {
  return renderToStaticMarkup(
    createElement(AddEditPlaceModal, {
      tripId: 1,
      place: null,
      savedPlaces: [],
      hasCuratedCandidates: false,
      visitDateOptions: [],
      initialSearchPlace,
      onCancel: vi.fn(),
      onResolveUrl: vi.fn(),
      onSave: vi.fn(),
    }),
  );
}

describe("AddEditPlaceModal with a map-picked selection", () => {
  it("opens on the details step with the picked place name", () => {
    const markup = renderAddModal(MAP_SELECTION);

    // The search step is skipped entirely.
    expect(markup).not.toContain('role="combobox"');
    expect(markup).toContain('value="Blue Bottle Coffee"');
    expect(markup).toContain("Found on Google Maps");
  });

  it("asks for a name when the map could not provide one", () => {
    const markup = renderAddModal({ ...MAP_SELECTION, name: "" });

    expect(markup).not.toContain('role="combobox"');
    expect(markup).toContain("Add a name for this place");
  });

  it("renders the photo hero section on the details step", () => {
    const markup = renderAddModal(MAP_SELECTION);

    expect(markup).toContain("place-photo-hero");
  });

  it("shows a curated candidate's stored image in the hero", () => {
    const markup = renderAddModal({
      ...MAP_SELECTION,
      image_url: "https://cdn.example.com/storage/candidate.jpg",
      image_credit: "Jane Doe",
    });

    expect(markup).toContain(
      'src="https://cdn.example.com/storage/candidate.jpg"',
    );
  });
});
