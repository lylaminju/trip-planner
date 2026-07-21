import { NextResponse } from "next/server";
import { describe, expect, it } from "vitest";

import { nullableCountryCodes } from "@/app/api/_utils";

describe("nullableCountryCodes", () => {
  it("treats undefined and null as no restriction", () => {
    expect(nullableCountryCodes(undefined)).toBeNull();
    expect(nullableCountryCodes(null)).toBeNull();
  });

  it("passes through a valid array of two-letter codes", () => {
    expect(nullableCountryCodes(["JP", "kr"])).toEqual(["JP", "kr"]);
  });

  it.each([
    "JP",
    ["JPN"],
    ["J"],
    ["JP", 1],
    [""],
    Array.from({ length: 16 }, () => "jp"),
  ])("fails closed with a 400 for malformed input %#", (value) => {
    const result = nullableCountryCodes(value);
    expect(result).toBeInstanceOf(NextResponse);
    expect((result as NextResponse).status).toBe(400);
  });
});
