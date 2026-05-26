import { decodePolyline, type LatLngLiteral } from "@/lib/encoded-polyline";
import type { Place, RouteGeometry } from "@/lib/types";

export function routePath(
  from: Place,
  to: Place,
  geometry: RouteGeometry | undefined,
): LatLngLiteral[] {
  if (geometry?.status === "ok" && geometry.encoded_polyline) {
    try {
      const path = decodePolyline(geometry.encoded_polyline);
      if (path.length > 1) {
        return path;
      }
    } catch {
      return straightRoutePath(from, to);
    }
  }

  return straightRoutePath(from, to);
}

function straightRoutePath(from: Place, to: Place): LatLngLiteral[] {
  return [
    { lat: from.latitude, lng: from.longitude },
    { lat: to.latitude, lng: to.longitude },
  ];
}
