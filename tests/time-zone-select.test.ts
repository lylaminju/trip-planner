import { readFileSync } from "node:fs";

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
      value: "America/North_Dakota/Beulah",
      label: "UTC-06:00 CDT - America/North_Dakota/Beulah",
    },
    {
      value: "Asia/Tokyo",
      label: "UTC+09:00 - Asia/Tokyo",
    },
  ];

  it("filters by city, region, offset, and abbreviation", () => {
    expect(filterTimeZoneOptions(options, "toronto")).toEqual([options[0]]);
    expect(filterTimeZoneOptions(options, "north dakota")).toEqual([
      options[1],
    ]);
    expect(filterTimeZoneOptions(options, "edt")).toEqual([options[0]]);
    expect(filterTimeZoneOptions(options, "+09")).toEqual([options[2]]);
  });

  it("parses timezone labels into searchable parts", () => {
    expect(timeZoneOptionParts(options[0])).toEqual({
      name: "America/Toronto",
      meta: "UTC-04:00 EDT",
      offset: "UTC-04:00",
      abbreviation: "EDT",
      city: "Toronto",
    });

    expect(timeZoneOptionParts(options[1])).toEqual({
      name: "America/North Dakota/Beulah",
      meta: "UTC-06:00 CDT",
      offset: "UTC-06:00",
      abbreviation: "CDT",
      city: "Beulah",
    });

    expect(timeZoneOptionParts(options[2])).toEqual({
      name: "Asia/Tokyo",
      meta: "UTC+09:00",
      offset: "UTC+09:00",
      abbreviation: "",
      city: "Tokyo",
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
    expect(markup).toContain("America/North Dakota/Beulah");
    expect(markup).toContain("UTC-04:00 EDT");
    expect(markup).not.toContain("timezone-select-city");
    expect(markup).toContain("timezone-select-offset");
    expect(markup).toContain("timezone-select-abbreviation");
    expect(markup).toContain(
      '<span class="timezone-select-abbreviation"></span>',
    );
  });

  it("renders each dropdown option on one row", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );

    expect(css).toMatch(
      /\.timezone-select-option-main\s*{[^}]*align-items:\s*baseline;[^}]*display:\s*flex;/s,
    );
    expect(css).toMatch(
      /\.timezone-select-option-meta\s*{[^}]*display:\s*flex;[^}]*justify-content:\s*flex-end;/s,
    );
    expect(css).toMatch(
      /\.timezone-select-abbreviation\s*{[^}]*width:\s*4ch;/s,
    );
  });

  it("keeps the closed dropdown menu out of the dashboard layout", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );

    expect(css).toMatch(
      /\.timezone-select-popover\[hidden\]\s*{\s*display:\s*none;\s*}/,
    );
  });

  it("positions the open dropdown menu without shifting the form layout", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );

    expect(css).toMatch(/\.timezone-select\s*{[^}]*position:\s*relative;/s);
    expect(css).toMatch(
      /\.timezone-select-popover\s*{[^}]*position:\s*absolute;[^}]*top:\s*calc\(100% \+ 6px\);/s,
    );
  });

  it("lets the open menu scan wider than the closed dashboard field", () => {
    const css = readFileSync(
      "src/styles/components/trips-dashboard.css",
      "utf8",
    );

    expect(css).toMatch(
      /\.timezone-select-popover\s*{[^}]*right:\s*0;[^}]*width:\s*min\(400px, calc\(100vw - 32px\)\);/s,
    );
    expect(css).toMatch(
      /\.modal \.timezone-select-popover\s*{[^}]*left:\s*0;[^}]*width:\s*auto;/s,
    );
  });
});
