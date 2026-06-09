import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import {
  filterTimeZoneOptions,
  TimeZoneSelect,
  timeZoneOptionParts,
} from "@/components/TimeZoneSelect";
import type { TimeZoneOption } from "@/lib/timezones";

describe("TimeZoneSelect", () => {
  const options: TimeZoneOption[] = [
    {
      value: "America/Toronto",
      label: "UTC-04:00 EDT - America/Toronto",
    },
    {
      value: "Asia/Tokyo",
      label: "UTC+09:00 - Asia/Tokyo",
    },
  ];

  it("filters by city, region, offset, and abbreviation", () => {
    expect(filterTimeZoneOptions(options, "toronto")).toEqual([options[0]]);
    expect(filterTimeZoneOptions(options, "america")).toEqual([options[0]]);
    expect(filterTimeZoneOptions(options, "edt")).toEqual([options[0]]);
    expect(filterTimeZoneOptions(options, "+09")).toEqual([options[1]]);
  });

  it("splits dense timezone labels into readable row parts", () => {
    expect(timeZoneOptionParts(options[0])).toEqual({
      name: "America/Toronto",
      meta: "UTC-04:00 EDT",
      city: "Toronto",
    });
  });

  it("renders a searchable combobox with option rows", () => {
    const markup = renderToStaticMarkup(
      createElement(TimeZoneSelect, {
        value: "America/Toronto",
        options,
        onChange: vi.fn(),
        ariaLabel: "Timezone",
      }),
    );

    expect(markup).toContain('role="combobox"');
    expect(markup).toContain('aria-label="Timezone"');
    expect(markup).toContain('placeholder="Search timezones"');
    expect(markup).toContain("America/Toronto");
    expect(markup).toContain("UTC-04:00 EDT");
  });
});
