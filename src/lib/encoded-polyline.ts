export type LatLngLiteral = {
  lat: number;
  lng: number;
};

export function decodePolyline(encoded: string): LatLngLiteral[] {
  const points: LatLngLiteral[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    const latitudeResult = decodeCoordinate(encoded, index);
    index = latitudeResult.nextIndex;
    latitude += latitudeResult.delta;

    const longitudeResult = decodeCoordinate(encoded, index);
    index = longitudeResult.nextIndex;
    longitude += longitudeResult.delta;

    points.push({
      lat: roundCoordinate(latitude / 1e5),
      lng: roundCoordinate(longitude / 1e5),
    });
  }

  return points;
}

function decodeCoordinate(
  encoded: string,
  startIndex: number,
): { delta: number; nextIndex: number } {
  let result = 0;
  let shift = 0;
  let index = startIndex;
  let byte: number;

  do {
    if (index >= encoded.length) {
      throw new Error("Invalid encoded polyline.");
    }

    byte = encoded.charCodeAt(index) - 63;
    index += 1;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);

  return {
    delta: result & 1 ? ~(result >> 1) : result >> 1,
    nextIndex: index,
  };
}

function roundCoordinate(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
