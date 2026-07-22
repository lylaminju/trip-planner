import { describe, expect, it } from "vitest";

import {
  AIRPORT_ARRIVAL_BUFFER_MINUTES,
  AIRPORT_DEPARTURE_BUFFER_MINUTES,
  DEFAULT_ARRIVAL_BUFFER_MINUTES,
  DEFAULT_DEPARTURE_BUFFER_MINUTES,
  arrivalBufferMinutes,
  departureBufferMinutes,
  firstDayEarliestStartFromArrival,
  lastDayLatestEndFromDeparture,
} from "@/lib/transit-buffers";
import type { AiTransitHubType } from "@/lib/types";

describe("transit buffer minutes by hub type", () => {
  const cases: Array<{
    hubType: AiTransitHubType | null;
    arrival: number;
    departure: number;
  }> = [
    {
      hubType: "airport",
      arrival: AIRPORT_ARRIVAL_BUFFER_MINUTES,
      departure: AIRPORT_DEPARTURE_BUFFER_MINUTES,
    },
    {
      hubType: "train_station",
      arrival: DEFAULT_ARRIVAL_BUFFER_MINUTES,
      departure: DEFAULT_DEPARTURE_BUFFER_MINUTES,
    },
    {
      hubType: "bus_terminal",
      arrival: DEFAULT_ARRIVAL_BUFFER_MINUTES,
      departure: DEFAULT_DEPARTURE_BUFFER_MINUTES,
    },
    {
      hubType: "ferry_terminal",
      arrival: DEFAULT_ARRIVAL_BUFFER_MINUTES,
      departure: DEFAULT_DEPARTURE_BUFFER_MINUTES,
    },
    {
      hubType: null,
      arrival: DEFAULT_ARRIVAL_BUFFER_MINUTES,
      departure: DEFAULT_DEPARTURE_BUFFER_MINUTES,
    },
  ];

  it.each(cases)(
    "gives airport the largest buffers and the rest the default ($hubType)",
    ({ hubType, arrival, departure }) => {
      expect(arrivalBufferMinutes(hubType)).toBe(arrival);
      expect(departureBufferMinutes(hubType)).toBe(departure);
    },
  );

  it("keeps airports well ahead of other hubs", () => {
    expect(AIRPORT_ARRIVAL_BUFFER_MINUTES).toBeGreaterThan(
      DEFAULT_ARRIVAL_BUFFER_MINUTES,
    );
    expect(AIRPORT_DEPARTURE_BUFFER_MINUTES).toBeGreaterThan(
      DEFAULT_DEPARTURE_BUFFER_MINUTES,
    );
  });
});

describe("firstDayEarliestStartFromArrival", () => {
  it("pushes the first-day floor past the airport egress buffer", () => {
    expect(
      firstDayEarliestStartFromArrival({
        hub_type: "airport",
        event_time: "15:00",
      }),
    ).toBe("16:00");
  });

  it("uses the smaller buffer for a train station", () => {
    expect(
      firstDayEarliestStartFromArrival({
        hub_type: "train_station",
        event_time: "15:00",
      }),
    ).toBe("15:15");
  });

  it("treats an unknown custom point as a non-airport hub", () => {
    expect(
      firstDayEarliestStartFromArrival({ hub_type: null, event_time: "15:00" }),
    ).toBe("15:15");
  });

  it("returns null when the arrival point has no time or is absent", () => {
    expect(
      firstDayEarliestStartFromArrival({ hub_type: "airport", event_time: null }),
    ).toBeNull();
    expect(firstDayEarliestStartFromArrival(null)).toBeNull();
  });

  it("clamps a very late landing to the end of the day", () => {
    expect(
      firstDayEarliestStartFromArrival({
        hub_type: "airport",
        event_time: "23:30",
      }),
    ).toBe("23:59");
  });
});

describe("lastDayLatestEndFromDeparture", () => {
  it("pulls the last-day ceiling ahead of the airport pre-departure buffer", () => {
    expect(
      lastDayLatestEndFromDeparture({
        hub_type: "airport",
        event_time: "21:00",
      }),
    ).toBe("18:30");
  });

  it("uses the smaller buffer for a train station", () => {
    expect(
      lastDayLatestEndFromDeparture({
        hub_type: "train_station",
        event_time: "21:00",
      }),
    ).toBe("20:30");
  });

  it("returns null when the departure point has no time or is absent", () => {
    expect(
      lastDayLatestEndFromDeparture({
        hub_type: "airport",
        event_time: null,
      }),
    ).toBeNull();
    expect(lastDayLatestEndFromDeparture(null)).toBeNull();
  });

  it("clamps a pre-dawn departure to the start of the day", () => {
    expect(
      lastDayLatestEndFromDeparture({
        hub_type: "airport",
        event_time: "01:00",
      }),
    ).toBe("00:00");
  });
});
