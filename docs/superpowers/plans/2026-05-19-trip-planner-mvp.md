# Trip Planner MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved local-first single-trip Trip Planner MVP from `docs/superpowers/specs/2026-05-19-trip-planner-design.md`.

**Architecture:** Use Next.js App Router with a client-side planner shell backed by server-only SQLite services. Keep itinerary sorting, route reconciliation, route URL generation, and Google Maps URL parsing in small pure modules with unit tests before connecting API routes and UI.

**Tech Stack:** Next.js App Router, React 19, TypeScript, native CSS, SQLite via `better-sqlite3`, Vitest for unit tests, native HTML drag-and-drop, Google Maps JavaScript API loaded in the browser.

---

## Current Workspace Notes

- The workspace is not currently a git repository. Do not run commit commands until the user initializes git or provides a repository.
- When git exists, use the Lore Commit Protocol from `AGENTS.md` for commit messages.
- Do not add Tailwind, auth, hosted database code, Google Places plain text search, autocomplete, route geometry, or multi-trip support.
- The importer is CLI-only for the MVP and must not appear in the web UI.
- The browser map key is `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` from `.env.local`.

## File Structure

Create or modify these files:

- Create `package.json`: npm scripts and dependencies.
- Create `tsconfig.json`: strict TypeScript configuration.
- Create `next.config.ts`: Next.js config with `better-sqlite3` server externalization.
- Create `.gitignore`: ignore dependencies, build output, env files, and SQLite runtime files.
- Create `data/.gitkeep`: keep the local database directory present.
- Create `src/app/layout.tsx`: root metadata and global CSS import.
- Create `src/app/page.tsx`: server entrypoint rendering the planner shell.
- Create `src/app/globals.css`: full app styling with native CSS.
- Create `src/app/api/places/route.ts`: list and add places.
- Create `src/app/api/places/[id]/route.ts`: edit and delete places.
- Create `src/app/api/places/[id]/schedule/route.ts`: date/time drag-and-drop scheduling changes.
- Create `src/app/api/route-segments/[id]/route.ts`: update segment mode.
- Create `src/components/TripPlannerApp.tsx`: top-level client state and data loading.
- Create `src/components/AddEditPlaceModal.tsx`: add/edit form and URL resolution flow.
- Create `src/components/LeftPanel.tsx`: itinerary, unscheduled list, places list.
- Create `src/components/MapPanel.tsx`: Google Map or fallback list.
- Create `src/components/SegmentRow.tsx`: segment mode selector and external route button.
- Create `src/lib/types.ts`: shared domain types.
- Create `src/lib/itinerary.ts`: sorting, grouping, and itinerary view-model helpers.
- Create `src/lib/route-reconciliation.ts`: pure segment reconciliation logic.
- Create `src/lib/maps-url.ts`: Google Maps route URL generation.
- Create `src/lib/google-maps-url.ts`: Google Maps URL parsing helpers.
- Create `src/server/schema.sql`: canonical SQLite schema.
- Create `src/server/db.ts`: database connection and migration.
- Create `src/server/place-repository.ts`: SQLite reads/writes.
- Create `src/server/place-service.ts`: transactional mutations and route reconciliation.
- Create `src/server/google-url-resolver.ts`: server-side short URL resolution plus parsing.
- Modify `scripts/import-google-list.mjs`: CLI-only upsert importer for the new `places` schema.
- Create `tests/itinerary.test.ts`: sorting/grouping tests.
- Create `tests/route-reconciliation.test.ts`: segment reconciliation tests.
- Create `tests/maps-url.test.ts`: route URL generation tests.
- Create `tests/google-maps-url.test.ts`: URL parser tests.
- Create `tests/importer-matching.test.mjs`: importer matching/preservation tests.
- Create `vitest.config.ts`: Vitest configuration.

## Task 1: Scaffold The Next.js Project

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `.gitignore`
- Create: `data/.gitkeep`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create `package.json`**

Use this exact dependency set. Do not add a drag-and-drop library.

```json
{
  "name": "trip-planner",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "import:google-list": "node scripts/import-google-list.mjs"
  },
  "dependencies": {
    "better-sqlite3": "^12.10.0",
    "next": "^16.2.6",
    "react": "^19.2.6",
    "react-dom": "^19.2.6"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.13",
    "@types/google.maps": "^3.64.1",
    "@types/node": "^25.9.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "typescript": "^6.0.3",
    "vitest": "^4.1.6"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` is created and install exits with code 0.

- [ ] **Step 3: Create TypeScript and Next config**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "es2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

Create `next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.{test,spec}.{ts,mjs}"],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
    },
  },
});
```

- [ ] **Step 4: Create app shell files**

Create `.gitignore`:

```gitignore
node_modules/
.next/
out/
dist/
.env*.local
data/*.sqlite
data/*.sqlite-shm
data/*.sqlite-wal
.DS_Store
```

Create `data/.gitkeep` as an empty file.

Create `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trip Planner",
  description: "Local-first itinerary planner",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

Create `src/app/page.tsx`:

```tsx
import { TripPlannerApp } from "@/components/TripPlannerApp";

export default function HomePage() {
  return <TripPlannerApp />;
}
```

Create a temporary `src/components/TripPlannerApp.tsx` so the scaffold compiles:

```tsx
"use client";

export function TripPlannerApp() {
  return (
    <main className="app-shell">
      <section className="panel panel-left">
        <h1>Trip Planner</h1>
      </section>
      <section className="panel panel-map" aria-label="Map panel">
        <p>Map loading area</p>
      </section>
    </main>
  );
}
```

Create initial `src/app/globals.css`:

```css
:root {
  color-scheme: light;
  --bg: #f5f7f8;
  --panel: #ffffff;
  --text: #1f2933;
  --muted: #64748b;
  --line: #d8dee4;
  --accent: #0f766e;
  --danger: #b42318;
}

* {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
  margin: 0;
}

body {
  background: var(--bg);
  color: var(--text);
  font-family: Arial, Helvetica, sans-serif;
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  display: grid;
  grid-template-columns: minmax(360px, 440px) minmax(0, 1fr);
  height: 100vh;
  overflow: hidden;
}

.panel {
  min-width: 0;
  min-height: 0;
}

.panel-left {
  background: var(--panel);
  border-right: 1px solid var(--line);
  overflow: auto;
  padding: 16px;
}

.panel-map {
  position: relative;
  min-height: 360px;
}

@media (max-width: 900px) {
  .app-shell {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(360px, 48vh) minmax(360px, 52vh);
  }

  .panel-left {
    border-right: 0;
    border-bottom: 1px solid var(--line);
  }
}
```

- [ ] **Step 5: Verify scaffold**

Run:

```bash
npm run build
```

Expected: Next.js build succeeds.

Run:

```bash
npm test
```

Expected: Vitest reports no tests found or exits cleanly after tests are added in later tasks. If Vitest exits non-zero because no tests exist, continue after Task 2 adds tests.

## Task 2: Define Shared Types And Itinerary Sorting

**Files:**

- Create: `src/lib/types.ts`
- Create: `src/lib/itinerary.ts`
- Create: `tests/itinerary.test.ts`

- [ ] **Step 1: Write failing itinerary tests**

Create `tests/itinerary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildItinerary } from "@/lib/itinerary";
import type { Place, RouteSegment } from "@/lib/types";

const basePlace = {
  address: null,
  google_maps_url: "https://www.google.com/maps",
  place_id: null,
  google_place_token: null,
  google_internal_ids: null,
  source_list_url: null,
  latitude: 40,
  longitude: -73,
  notes: null,
  created_at: "2026-05-19 00:00:00",
  updated_at: "2026-05-19 00:00:00",
};

function place(overrides: Partial<Place> & Pick<Place, "id" | "name">): Place {
  return {
    ...basePlace,
    visit_date: null,
    visit_time: null,
    ...overrides,
  };
}

describe("buildItinerary", () => {
  it("groups scheduled places by date with timed places before untimed places", () => {
    const result = buildItinerary(
      [
        place({ id: 1, name: "Guggenheim", visit_date: "2026-06-01" }),
        place({
          id: 2,
          name: "A Stop",
          visit_date: "2026-06-01",
          visit_time: "11:00",
        }),
        place({
          id: 3,
          name: "B Stop",
          visit_date: "2026-06-01",
          visit_time: "09:00",
        }),
        place({ id: 4, name: "Central Park", visit_date: "2026-06-01" }),
      ],
      [],
    );

    expect(result.days).toHaveLength(1);
    expect(result.days[0].places.map((item) => item.name)).toEqual([
      "B Stop",
      "A Stop",
      "Central Park",
      "Guggenheim",
    ]);
  });

  it("keeps unscheduled places separate and alphabetized", () => {
    const result = buildItinerary(
      [
        place({ id: 1, name: "Zoo" }),
        place({ id: 2, name: "Aquarium" }),
        place({
          id: 3,
          name: "Museum",
          visit_date: "2026-06-02",
          visit_time: "10:00",
        }),
      ],
      [],
    );

    expect(result.unscheduled.map((item) => item.name)).toEqual([
      "Aquarium",
      "Zoo",
    ]);
    expect(result.days[0].date).toBe("2026-06-02");
  });

  it("attaches route segments only to matching consecutive timed place pairs", () => {
    const segments: RouteSegment[] = [
      {
        id: 20,
        from_place_id: 1,
        to_place_id: 2,
        mode: "walking",
        created_at: "2026-05-19 00:00:00",
        updated_at: "2026-05-19 00:00:00",
      },
    ];

    const result = buildItinerary(
      [
        place({
          id: 1,
          name: "A",
          visit_date: "2026-06-01",
          visit_time: "09:00",
        }),
        place({
          id: 2,
          name: "B",
          visit_date: "2026-06-01",
          visit_time: "10:00",
        }),
        place({ id: 3, name: "C", visit_date: "2026-06-01" }),
      ],
      segments,
    );

    expect(result.days[0].segments).toEqual([
      {
        fromPlaceId: 1,
        toPlaceId: 2,
        segment: segments[0],
      },
    ]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/itinerary.test.ts
```

Expected: FAIL because `@/lib/itinerary` and `@/lib/types` do not exist.

- [ ] **Step 3: Create shared types**

Create `src/lib/types.ts`:

```ts
export type TravelMode = "walking" | "transit" | "bicycling" | "driving";

export type Place = {
  id: number;
  name: string;
  address: string | null;
  google_maps_url: string;
  place_id: string | null;
  google_place_token: string | null;
  google_internal_ids: string | null;
  source_list_url: string | null;
  latitude: number;
  longitude: number;
  visit_date: string | null;
  visit_time: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RouteSegment = {
  id: number;
  from_place_id: number;
  to_place_id: number;
  mode: TravelMode;
  created_at: string;
  updated_at: string;
};

export type SegmentView = {
  fromPlaceId: number;
  toPlaceId: number;
  segment: RouteSegment;
};

export type ItineraryDay = {
  date: string;
  color: string;
  places: Place[];
  segments: SegmentView[];
};

export type ItineraryView = {
  days: ItineraryDay[];
  unscheduled: Place[];
};

export type PlannerSnapshot = {
  places: Place[];
  routeSegments: RouteSegment[];
};
```

- [ ] **Step 4: Implement itinerary sorting**

Create `src/lib/itinerary.ts`:

```ts
import type {
  ItineraryDay,
  ItineraryView,
  Place,
  RouteSegment,
  SegmentView,
} from "./types";

const DAY_COLORS = [
  "#0f766e",
  "#2563eb",
  "#b45309",
  "#7c3aed",
  "#be123c",
  "#15803d",
  "#0369a1",
];

export function buildItinerary(
  places: Place[],
  routeSegments: RouteSegment[],
): ItineraryView {
  const scheduled = places.filter((place) => place.visit_date);
  const unscheduled = places
    .filter((place) => !place.visit_date)
    .toSorted(compareByName);

  const dates = Array.from(
    new Set(scheduled.map((place) => place.visit_date as string)),
  ).toSorted();
  const segmentsByPair = new Map(
    routeSegments.map((segment) => [
      pairKey(segment.from_place_id, segment.to_place_id),
      segment,
    ]),
  );

  const days: ItineraryDay[] = dates.map((date, index) => {
    const dayPlaces = scheduled
      .filter((place) => place.visit_date === date)
      .toSorted(compareScheduledPlaces);

    return {
      date,
      color: DAY_COLORS[index % DAY_COLORS.length],
      places: dayPlaces,
      segments: buildSegmentViews(dayPlaces, segmentsByPair),
    };
  });

  return { days, unscheduled };
}

export function compareScheduledPlaces(a: Place, b: Place): number {
  const aTimed = Boolean(a.visit_time);
  const bTimed = Boolean(b.visit_time);

  if (aTimed !== bTimed) return aTimed ? -1 : 1;
  if (a.visit_time && b.visit_time && a.visit_time !== b.visit_time) {
    return a.visit_time.localeCompare(b.visit_time);
  }

  return compareByName(a, b);
}

function buildSegmentViews(
  places: Place[],
  segmentsByPair: Map<string, RouteSegment>,
): SegmentView[] {
  const timedPlaces = places.filter((place) => place.visit_time);
  const views: SegmentView[] = [];

  for (let index = 0; index < timedPlaces.length - 1; index += 1) {
    const from = timedPlaces[index];
    const to = timedPlaces[index + 1];
    const segment = segmentsByPair.get(pairKey(from.id, to.id));

    if (segment) {
      views.push({ fromPlaceId: from.id, toPlaceId: to.id, segment });
    }
  }

  return views;
}

function compareByName(a: Place, b: Place): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function pairKey(fromPlaceId: number, toPlaceId: number): string {
  return `${fromPlaceId}->${toPlaceId}`;
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm test -- tests/itinerary.test.ts
```

Expected: PASS.

## Task 3: Implement Route Reconciliation Rules

**Files:**

- Create: `src/lib/route-reconciliation.ts`
- Create: `tests/route-reconciliation.test.ts`

- [ ] **Step 1: Write failing reconciliation tests**

Create `tests/route-reconciliation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { reconcileRouteSegments } from "@/lib/route-reconciliation";
import type { Place, RouteSegment } from "@/lib/types";

const stamp = "2026-05-19 00:00:00";

function place(
  id: number,
  name: string,
  visit_date: string | null,
  visit_time: string | null,
): Place {
  return {
    id,
    name,
    address: null,
    google_maps_url: "https://www.google.com/maps",
    place_id: null,
    google_place_token: null,
    google_internal_ids: null,
    source_list_url: null,
    latitude: 40 + id,
    longitude: -73 - id,
    visit_date,
    visit_time,
    notes: null,
    created_at: stamp,
    updated_at: stamp,
  };
}

function segment(
  id: number,
  from_place_id: number,
  to_place_id: number,
  mode: RouteSegment["mode"],
): RouteSegment {
  return {
    id,
    from_place_id,
    to_place_id,
    mode,
    created_at: stamp,
    updated_at: stamp,
  };
}

describe("reconcileRouteSegments", () => {
  it("creates segments only between consecutive timed places", () => {
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "09:00"),
        place(2, "B", "2026-06-01", "10:00"),
        place(3, "C", "2026-06-01", null),
        place(4, "D", null, null),
      ],
      [],
    );

    expect(result.toInsert).toEqual([
      { from_place_id: 1, to_place_id: 2, mode: "walking" },
    ]);
    expect(result.toDeleteIds).toEqual([]);
    expect(result.toKeepIds).toEqual([]);
  });

  it("preserves mode for unchanged valid pairs", () => {
    const existing = segment(8, 1, 2, "transit");
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "09:00"),
        place(2, "B", "2026-06-01", "10:00"),
      ],
      [existing],
    );

    expect(result.toKeepIds).toEqual([8]);
    expect(result.toInsert).toEqual([]);
    expect(result.preservedModes.get("1->2")).toBe("transit");
  });

  it("deletes invalid pairs after time changes reorder the day", () => {
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "11:00"),
        place(2, "B", "2026-06-01", "09:00"),
        place(3, "C", "2026-06-01", "10:00"),
      ],
      [segment(1, 1, 2, "walking"), segment(2, 2, 3, "bicycling")],
    );

    expect(result.toDeleteIds).toEqual([1]);
    expect(result.toKeepIds).toEqual([2]);
    expect(result.toInsert).toEqual([
      { from_place_id: 3, to_place_id: 1, mode: "walking" },
    ]);
  });

  it("deduplicates repeated existing rows for the same valid pair", () => {
    const result = reconcileRouteSegments(
      [
        place(1, "A", "2026-06-01", "09:00"),
        place(2, "B", "2026-06-01", "10:00"),
      ],
      [segment(1, 1, 2, "driving"), segment(2, 1, 2, "walking")],
    );

    expect(result.toKeepIds).toEqual([1]);
    expect(result.toDeleteIds).toEqual([2]);
    expect(result.toInsert).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/route-reconciliation.test.ts
```

Expected: FAIL because `@/lib/route-reconciliation` does not exist.

- [ ] **Step 3: Implement pure reconciliation**

Create `src/lib/route-reconciliation.ts`:

```ts
import { compareScheduledPlaces } from "./itinerary";
import type { Place, RouteSegment, TravelMode } from "./types";

export type SegmentInsert = {
  from_place_id: number;
  to_place_id: number;
  mode: TravelMode;
};

export type ReconciliationPlan = {
  toKeepIds: number[];
  toDeleteIds: number[];
  toInsert: SegmentInsert[];
  preservedModes: Map<string, TravelMode>;
};

export function reconcileRouteSegments(
  places: Place[],
  existingSegments: RouteSegment[],
): ReconciliationPlan {
  const desiredPairs = desiredSegmentPairs(places);
  const desiredPairKeys = new Set(
    desiredPairs.map((pair) => pairKey(pair.from_place_id, pair.to_place_id)),
  );
  const existingByPair = new Map<string, RouteSegment>();
  const toKeepIds: number[] = [];
  const toDeleteIds: number[] = [];
  const preservedModes = new Map<string, TravelMode>();

  for (const segment of existingSegments) {
    const key = pairKey(segment.from_place_id, segment.to_place_id);

    if (!desiredPairKeys.has(key)) {
      toDeleteIds.push(segment.id);
      continue;
    }

    if (existingByPair.has(key)) {
      toDeleteIds.push(segment.id);
      continue;
    }

    existingByPair.set(key, segment);
    preservedModes.set(key, segment.mode);
    toKeepIds.push(segment.id);
  }

  const toInsert = desiredPairs
    .filter(
      (pair) =>
        !existingByPair.has(pairKey(pair.from_place_id, pair.to_place_id)),
    )
    .map((pair) => ({ ...pair, mode: "walking" as const }));

  return { toKeepIds, toDeleteIds, toInsert, preservedModes };
}

function desiredSegmentPairs(
  places: Place[],
): Array<{ from_place_id: number; to_place_id: number }> {
  const dates = Array.from(
    new Set(
      places
        .filter((place) => place.visit_date && place.visit_time)
        .map((place) => place.visit_date as string),
    ),
  ).toSorted();

  const pairs: Array<{ from_place_id: number; to_place_id: number }> = [];

  for (const date of dates) {
    const timedPlaces = places
      .filter((place) => place.visit_date === date && place.visit_time)
      .toSorted(compareScheduledPlaces);

    for (let index = 0; index < timedPlaces.length - 1; index += 1) {
      pairs.push({
        from_place_id: timedPlaces[index].id,
        to_place_id: timedPlaces[index + 1].id,
      });
    }
  }

  return pairs;
}

function pairKey(fromPlaceId: number, toPlaceId: number): string {
  return `${fromPlaceId}->${toPlaceId}`;
}
```

- [ ] **Step 4: Run reconciliation tests**

Run:

```bash
npm test -- tests/route-reconciliation.test.ts tests/itinerary.test.ts
```

Expected: PASS.

## Task 4: Implement Maps URL Utilities

**Files:**

- Create: `src/lib/maps-url.ts`
- Create: `src/lib/google-maps-url.ts`
- Create: `tests/maps-url.test.ts`
- Create: `tests/google-maps-url.test.ts`

- [ ] **Step 1: Write failing route URL tests**

Create `tests/maps-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildGoogleMapsDirectionsUrl } from "@/lib/maps-url";

describe("buildGoogleMapsDirectionsUrl", () => {
  it("uses coordinates and official Google travel mode names", () => {
    const url = buildGoogleMapsDirectionsUrl({
      origin: { latitude: 40.7579747, longitude: -73.9855426 },
      destination: { latitude: 40.7118042, longitude: -74.0118498 },
      mode: "transit",
    });

    expect(url).toBe(
      "https://www.google.com/maps/dir/?api=1&origin=40.7579747%2C-73.9855426&destination=40.7118042%2C-74.0118498&travelmode=transit",
    );
  });
});
```

Create `tests/google-maps-url.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseGoogleMapsUrl } from "@/lib/google-maps-url";

describe("parseGoogleMapsUrl", () => {
  it("extracts coordinates from @lat,lng URLs", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/Oculus/@40.7118042,-74.0118498,17z",
      ),
    ).toMatchObject({
      latitude: 40.7118042,
      longitude: -74.0118498,
      name: "Oculus",
    });
  });

  it("extracts coordinates from !3dlat!4dlng URLs", () => {
    expect(
      parseGoogleMapsUrl(
        "https://www.google.com/maps/place/Times+Square/data=!3d40.7579747!4d-73.9855426",
      ),
    ).toMatchObject({
      latitude: 40.7579747,
      longitude: -73.9855426,
      name: "Times Square",
    });
  });

  it("returns null coordinates when the URL has no parseable location", () => {
    expect(parseGoogleMapsUrl("https://maps.app.goo.gl/abc123")).toEqual({
      name: null,
      latitude: null,
      longitude: null,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/maps-url.test.ts tests/google-maps-url.test.ts
```

Expected: FAIL because the modules do not exist.

- [ ] **Step 3: Implement route URL builder**

Create `src/lib/maps-url.ts`:

```ts
import type { TravelMode } from "./types";

type Coordinate = {
  latitude: number;
  longitude: number;
};

export function buildGoogleMapsDirectionsUrl(input: {
  origin: Coordinate;
  destination: Coordinate;
  mode: TravelMode;
}): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${input.origin.latitude},${input.origin.longitude}`,
    destination: `${input.destination.latitude},${input.destination.longitude}`,
    travelmode: input.mode,
  });

  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
```

- [ ] **Step 4: Implement Google Maps URL parser**

Create `src/lib/google-maps-url.ts`:

```ts
export type ParsedGoogleMapsUrl = {
  name: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function parseGoogleMapsUrl(rawUrl: string): ParsedGoogleMapsUrl {
  const parsed = safeUrl(rawUrl);
  const source = parsed ? decodeURIComponent(parsed.href) : rawUrl;
  const atMatch = source.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  const dataMatch = source.match(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/);
  const match = atMatch ?? dataMatch;

  return {
    name: extractPlaceName(parsed),
    latitude: match ? Number(match[1]) : null,
    longitude: match ? Number(match[2]) : null,
  };
}

function extractPlaceName(url: URL | null): string | null {
  if (!url) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const placeIndex = parts.findIndex((part) => part === "place");
  const rawName = placeIndex >= 0 ? parts[placeIndex + 1] : null;

  if (!rawName) return null;

  return rawName.replace(/\+/g, " ").trim() || null;
}

function safeUrl(rawUrl: string): URL | null {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}
```

- [ ] **Step 5: Run URL tests**

Run:

```bash
npm test -- tests/maps-url.test.ts tests/google-maps-url.test.ts
```

Expected: PASS.

## Task 5: Add SQLite Schema, DB Connection, And Repository

**Files:**

- Create: `src/server/schema.sql`
- Create: `src/server/db.ts`
- Create: `src/server/place-repository.ts`

- [ ] **Step 1: Create canonical schema**

Create `src/server/schema.sql`:

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS places (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  address TEXT,
  google_maps_url TEXT NOT NULL,
  place_id TEXT,
  google_place_token TEXT,
  google_internal_ids TEXT,
  source_list_url TEXT,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  visit_date TEXT,
  visit_time TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS route_segments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  to_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
  mode TEXT NOT NULL DEFAULT 'walking' CHECK (mode IN ('walking', 'transit', 'bicycling', 'driving')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_places_visit_date_time ON places (visit_date, visit_time, name);
CREATE INDEX IF NOT EXISTS idx_route_segments_from_to ON route_segments (from_place_id, to_place_id);
```

- [ ] **Step 2: Create DB module**

Create `src/server/db.ts`:

```ts
import Database from "better-sqlite3";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

let singleton: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (singleton) return singleton;

  const dbPath =
    process.env.TRIP_PLANNER_DB_PATH ??
    path.join(process.cwd(), "data", "trip-planner.sqlite");
  mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);

  singleton = db;
  return db;
}

export function migrate(db: Database.Database): void {
  const schemaPath = path.join(process.cwd(), "src", "server", "schema.sql");
  db.exec(readFileSync(schemaPath, "utf8"));
}
```

- [ ] **Step 3: Create repository**

Create `src/server/place-repository.ts`:

```ts
import type Database from "better-sqlite3";
import type { Place, RouteSegment, TravelMode } from "@/lib/types";

export type PlaceInsert = {
  name: string;
  address: string | null;
  google_maps_url: string;
  place_id: string | null;
  google_place_token: string | null;
  google_internal_ids: string | null;
  source_list_url: string | null;
  latitude: number;
  longitude: number;
  visit_date: string | null;
  visit_time: string | null;
  notes: string | null;
};

export type PlaceUpdate = Partial<
  Omit<
    PlaceInsert,
    | "place_id"
    | "google_place_token"
    | "google_internal_ids"
    | "source_list_url"
  >
> & {
  place_id?: string | null;
  google_place_token?: string | null;
  google_internal_ids?: string | null;
  source_list_url?: string | null;
};

export function listPlaces(db: Database.Database): Place[] {
  return db
    .prepare(
      "SELECT * FROM places ORDER BY COALESCE(visit_date, ''), COALESCE(visit_time, ''), name",
    )
    .all() as Place[];
}

export function listRouteSegments(db: Database.Database): RouteSegment[] {
  return db
    .prepare("SELECT * FROM route_segments ORDER BY id")
    .all() as RouteSegment[];
}

export function insertPlace(db: Database.Database, input: PlaceInsert): Place {
  const result = db
    .prepare(
      `INSERT INTO places (
        name, address, google_maps_url, place_id, google_place_token, google_internal_ids, source_list_url,
        latitude, longitude, visit_date, visit_time, notes
      ) VALUES (
        @name, @address, @google_maps_url, @place_id, @google_place_token, @google_internal_ids, @source_list_url,
        @latitude, @longitude, @visit_date, @visit_time, @notes
      )`,
    )
    .run(input);

  return getPlace(db, Number(result.lastInsertRowid));
}

export function updatePlace(
  db: Database.Database,
  id: number,
  input: PlaceUpdate,
): Place {
  const fields = Object.entries(input).filter(
    ([, value]) => value !== undefined,
  );
  if (fields.length === 0) return getPlace(db, id);

  const assignments = fields.map(([key]) => `${key} = @${key}`).join(", ");
  db.prepare(
    `UPDATE places SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE id = @id`,
  ).run({ id, ...input });
  return getPlace(db, id);
}

export function deletePlace(db: Database.Database, id: number): void {
  db.prepare("DELETE FROM places WHERE id = ?").run(id);
}

export function updateRouteSegmentMode(
  db: Database.Database,
  id: number,
  mode: TravelMode,
): RouteSegment {
  db.prepare(
    "UPDATE route_segments SET mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ).run(mode, id);
  const segment = db
    .prepare("SELECT * FROM route_segments WHERE id = ?")
    .get(id) as RouteSegment | undefined;
  if (!segment) throw new Error(`Route segment ${id} not found`);
  return segment;
}

export function replaceSegments(
  db: Database.Database,
  deleteIds: number[],
  inserts: Array<{
    from_place_id: number;
    to_place_id: number;
    mode: TravelMode;
  }>,
): void {
  const deleteStatement = db.prepare("DELETE FROM route_segments WHERE id = ?");
  const insertStatement = db.prepare(
    "INSERT INTO route_segments (from_place_id, to_place_id, mode) VALUES (@from_place_id, @to_place_id, @mode)",
  );

  for (const id of deleteIds) deleteStatement.run(id);
  for (const insert of inserts) insertStatement.run(insert);
}

function getPlace(db: Database.Database, id: number): Place {
  const place = db.prepare("SELECT * FROM places WHERE id = ?").get(id) as
    | Place
    | undefined;
  if (!place) throw new Error(`Place ${id} not found`);
  return place;
}
```

- [ ] **Step 4: Run typecheck through build**

Run:

```bash
npm run build
```

Expected: build succeeds or fails only because APIs/components are not complete yet. Fix import/type errors in these three files before moving on.

## Task 6: Add Place Service Transactions

**Files:**

- Create: `src/server/place-service.ts`
- Modify: `src/server/place-repository.ts`

- [ ] **Step 1: Add service module**

Create `src/server/place-service.ts`:

```ts
import { reconcileRouteSegments } from "@/lib/route-reconciliation";
import type { PlannerSnapshot, TravelMode } from "@/lib/types";
import { getDatabase } from "./db";
import {
  deletePlace,
  insertPlace,
  listPlaces,
  listRouteSegments,
  replaceSegments,
  updatePlace,
  updateRouteSegmentMode,
  type PlaceInsert,
  type PlaceUpdate,
} from "./place-repository";

export function getPlannerSnapshot(): PlannerSnapshot {
  const db = getDatabase();
  return {
    places: listPlaces(db),
    routeSegments: listRouteSegments(db),
  };
}

export function createPlace(input: PlaceInsert): PlannerSnapshot {
  const db = getDatabase();
  db.transaction(() => {
    insertPlace(db, input);
    reconcileAllRoutes(db);
  })();
  return getPlannerSnapshot();
}

export function editPlace(id: number, input: PlaceUpdate): PlannerSnapshot {
  const db = getDatabase();
  db.transaction(() => {
    updatePlace(db, id, input);
    reconcileAllRoutes(db);
  })();
  return getPlannerSnapshot();
}

export function removePlace(id: number): PlannerSnapshot {
  const db = getDatabase();
  db.transaction(() => {
    deletePlace(db, id);
    reconcileAllRoutes(db);
  })();
  return getPlannerSnapshot();
}

export function schedulePlace(
  id: number,
  visit_date: string | null,
  visit_time: string | null,
): PlannerSnapshot {
  const db = getDatabase();
  db.transaction(() => {
    updatePlace(db, id, { visit_date, visit_time });
    reconcileAllRoutes(db);
  })();
  return getPlannerSnapshot();
}

export function setRouteSegmentMode(
  id: number,
  mode: TravelMode,
): PlannerSnapshot {
  const db = getDatabase();
  db.transaction(() => {
    updateRouteSegmentMode(db, id, mode);
  })();
  return getPlannerSnapshot();
}

function reconcileAllRoutes(db: ReturnType<typeof getDatabase>): void {
  const places = listPlaces(db);
  const routeSegments = listRouteSegments(db);
  const plan = reconcileRouteSegments(places, routeSegments);
  replaceSegments(db, plan.toDeleteIds, plan.toInsert);
}
```

- [ ] **Step 2: Build to catch service errors**

Run:

```bash
npm run build
```

Expected: no TypeScript errors from `src/server/place-service.ts`.

## Task 7: Implement Server-Side Google URL Resolution

**Files:**

- Create: `src/server/google-url-resolver.ts`
- Modify: `src/server/place-service.ts`

- [ ] **Step 1: Add resolver**

Create `src/server/google-url-resolver.ts`:

```ts
import { parseGoogleMapsUrl } from "@/lib/google-maps-url";

export type ResolvedGoogleMapsUrl = {
  google_maps_url: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
};

export async function resolveGoogleMapsUrl(
  rawUrl: string,
): Promise<ResolvedGoogleMapsUrl> {
  const direct = parseGoogleMapsUrl(rawUrl);
  if (direct.latitude !== null && direct.longitude !== null) {
    return { google_maps_url: rawUrl, ...direct };
  }

  const finalUrl = await resolveRedirect(rawUrl);
  const parsed = parseGoogleMapsUrl(finalUrl);

  return {
    google_maps_url: finalUrl,
    ...parsed,
  };
}

async function resolveRedirect(rawUrl: string): Promise<string> {
  const response = await fetch(rawUrl, {
    method: "GET",
    redirect: "follow",
    headers: {
      "user-agent": "trip-planner-local/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Google Maps URL request failed: ${response.status} ${response.statusText}`,
    );
  }

  return response.url || rawUrl;
}
```

- [ ] **Step 2: Add input validation helpers to service**

Modify `src/server/place-service.ts` by adding these exports:

```ts
import { resolveGoogleMapsUrl } from "./google-url-resolver";

export async function resolvePlaceUrl(
  rawUrl: string,
): Promise<ResolvedPlaceUrl> {
  const resolved = await resolveGoogleMapsUrl(rawUrl);

  return {
    google_maps_url: resolved.google_maps_url,
    name: resolved.name,
    latitude: resolved.latitude,
    longitude: resolved.longitude,
  };
}

export type ResolvedPlaceUrl = {
  google_maps_url: string;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
};
```

Keep the existing service exports.

- [ ] **Step 3: Build**

Run:

```bash
npm run build
```

Expected: TypeScript build succeeds. If it fails because `ResolvedPlaceUrl` is used before import, ensure the type is exported from `place-service.ts` and not imported circularly.

## Task 8: Add API Routes

**Files:**

- Create: `src/app/api/places/route.ts`
- Create: `src/app/api/places/[id]/route.ts`
- Create: `src/app/api/places/[id]/schedule/route.ts`
- Create: `src/app/api/route-segments/[id]/route.ts`

- [ ] **Step 1: Create API helper patterns**

Use `NextResponse.json(...)` directly in each route. Do not add a framework or validation dependency.

Create `src/app/api/places/route.ts`:

```ts
import { NextResponse } from "next/server";
import {
  createPlace,
  getPlannerSnapshot,
  resolvePlaceUrl,
} from "@/server/place-service";

export async function GET() {
  return NextResponse.json(getPlannerSnapshot());
}

export async function POST(request: Request) {
  const body = await request.json();
  const googleMapsUrl = stringOrNull(body.google_maps_url);
  if (!googleMapsUrl) {
    return NextResponse.json(
      { error: "Google Maps URL is required." },
      { status: 400 },
    );
  }

  const resolved = await resolvePlaceUrl(googleMapsUrl);
  const name = stringOrNull(body.name) ?? resolved.name;
  if (!name) {
    return NextResponse.json(
      { error: "Name is required when it cannot be resolved from the URL." },
      { status: 400 },
    );
  }
  if (resolved.latitude === null || resolved.longitude === null) {
    return NextResponse.json(
      { error: "Could not resolve coordinates from the Google Maps URL." },
      { status: 400 },
    );
  }

  return NextResponse.json(
    createPlace({
      name,
      address: stringOrNull(body.address),
      notes: stringOrNull(body.notes),
      google_maps_url: resolved.google_maps_url,
      place_id: null,
      google_place_token: null,
      google_internal_ids: null,
      source_list_url: null,
      latitude: resolved.latitude,
      longitude: resolved.longitude,
      visit_date: dateOrNull(body.visit_date),
      visit_time: timeOrNull(body.visit_time),
    }),
  );
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function dateOrNull(value: unknown): string | null {
  const text = stringOrNull(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function timeOrNull(value: unknown): string | null {
  const text = stringOrNull(value);
  return text && /^\d{2}:\d{2}$/.test(text) ? text : null;
}
```

- [ ] **Step 2: Add edit/delete route**

Create `src/app/api/places/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import {
  editPlace,
  removePlace,
  resolvePlaceUrl,
} from "@/server/place-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const placeId = Number(id);
  const body = await request.json();

  if (!Number.isInteger(placeId)) {
    return NextResponse.json({ error: "Invalid place id." }, { status: 400 });
  }

  const input = {
    name: stringOrUndefined(body.name),
    address: nullableStringOrUndefined(body.address),
    notes: nullableStringOrUndefined(body.notes),
    visit_date: nullableDateOrUndefined(body.visit_date),
    visit_time: nullableTimeOrUndefined(body.visit_time),
    google_maps_url: stringOrUndefined(body.google_maps_url),
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined,
  };

  if (input.google_maps_url) {
    const resolved = await resolvePlaceUrl(input.google_maps_url);
    if (resolved.latitude === null || resolved.longitude === null) {
      return NextResponse.json(
        { error: "Could not resolve coordinates from the Google Maps URL." },
        { status: 400 },
      );
    }
    input.google_maps_url = resolved.google_maps_url;
    input.latitude = resolved.latitude;
    input.longitude = resolved.longitude;
  }

  return NextResponse.json(editPlace(placeId, input));
}

export async function DELETE(_request: Request, { params }: Params) {
  const { id } = await params;
  const placeId = Number(id);

  if (!Number.isInteger(placeId)) {
    return NextResponse.json({ error: "Invalid place id." }, { status: 400 });
  }

  return NextResponse.json(removePlace(placeId));
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function nullableStringOrUndefined(value: unknown): string | null | undefined {
  if (value === null) return null;
  return stringOrUndefined(value);
}

function nullableDateOrUndefined(value: unknown): string | null | undefined {
  if (value === null) return null;
  const text = stringOrUndefined(value);
  return text && /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : undefined;
}

function nullableTimeOrUndefined(value: unknown): string | null | undefined {
  if (value === null) return null;
  const text = stringOrUndefined(value);
  return text && /^\d{2}:\d{2}$/.test(text) ? text : undefined;
}
```

- [ ] **Step 3: Add schedule route**

Create `src/app/api/places/[id]/schedule/route.ts`:

```ts
import { NextResponse } from "next/server";
import { schedulePlace } from "@/server/place-service";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const placeId = Number(id);
  const body = await request.json();

  if (!Number.isInteger(placeId)) {
    return NextResponse.json({ error: "Invalid place id." }, { status: 400 });
  }

  const visitDate =
    body.visit_date === null ? null : parseDate(body.visit_date);
  const visitTime =
    visitDate === null
      ? null
      : body.visit_time === null
        ? null
        : parseTime(body.visit_time);

  return NextResponse.json(schedulePlace(placeId, visitDate, visitTime));
}

function parseDate(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : null;
}

function parseTime(value: unknown): string | null {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value)
    ? value
    : null;
}
```

- [ ] **Step 4: Add segment mode route**

Create `src/app/api/route-segments/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { setRouteSegmentMode } from "@/server/place-service";
import type { TravelMode } from "@/lib/types";

const MODES = new Set<TravelMode>([
  "walking",
  "transit",
  "bicycling",
  "driving",
]);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const { id } = await params;
  const segmentId = Number(id);
  const body = await request.json();

  if (!Number.isInteger(segmentId)) {
    return NextResponse.json({ error: "Invalid segment id." }, { status: 400 });
  }

  if (!MODES.has(body.mode)) {
    return NextResponse.json(
      { error: "Invalid travel mode." },
      { status: 400 },
    );
  }

  return NextResponse.json(setRouteSegmentMode(segmentId, body.mode));
}
```

- [ ] **Step 5: Build**

Run:

```bash
npm run build
```

Expected: PASS.

## Task 9: Update CLI-Only Google List Importer

**Files:**

- Modify: `scripts/import-google-list.mjs`
- Create: `tests/importer-matching.test.mjs`

- [ ] **Step 1: Write importer matching tests**

Create `tests/importer-matching.test.mjs`:

```js
import { describe, expect, it } from "vitest";

function findExistingPlace(imported, existingRows) {
  if (imported.place_id)
    return (
      existingRows.find((row) => row.place_id === imported.place_id) ?? null
    );
  if (imported.google_place_token) {
    return (
      existingRows.find(
        (row) => row.google_place_token === imported.google_place_token,
      ) ?? null
    );
  }
  if (imported.google_internal_ids) {
    return (
      existingRows.find(
        (row) => row.google_internal_ids === imported.google_internal_ids,
      ) ?? null
    );
  }
  return null;
}

describe("importer matching contract", () => {
  it("matches by google_internal_ids before falling back", () => {
    const existing = {
      id: 1,
      google_internal_ids: '["a","b"]',
      name: "User Name",
    };
    expect(
      findExistingPlace({ google_internal_ids: '["a","b"]' }, [existing]),
    ).toBe(existing);
  });

  it("does not match weak rows without stable identity", () => {
    expect(
      findExistingPlace(
        { name: "Central Park", google_internal_ids: null },
        [],
      ),
    ).toBeNull();
  });
});
```

This test documents the matching behavior. The script will keep its own copy of the same matching order because it runs as plain Node ESM.

- [ ] **Step 2: Modify importer schema and upsert behavior**

Modify `scripts/import-google-list.mjs` so `migrate(database)` creates `places` instead of `destinations`, and so import no longer deletes all rows. Use this transaction shape:

```js
const importRows = db.transaction(() => {
  const existingRows = db.prepare("SELECT * FROM places").all();
  const update = db.prepare(`
    UPDATE places SET
      google_maps_url = @googleMapsUrl,
      place_id = @placeId,
      google_place_token = @googlePlaceToken,
      google_internal_ids = @googleInternalIds,
      source_list_url = @sourceListUrl,
      latitude = @latitude,
      longitude = @longitude,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = @id
  `);

  const insert = db.prepare(`
    INSERT INTO places (
      name,
      address,
      google_maps_url,
      place_id,
      google_place_token,
      google_internal_ids,
      source_list_url,
      latitude,
      longitude,
      visit_date,
      visit_time,
      notes
    ) VALUES (
      @name,
      @address,
      @googleMapsUrl,
      @placeId,
      @googlePlaceToken,
      @googleInternalIds,
      @sourceListUrl,
      @latitude,
      @longitude,
      NULL,
      NULL,
      @notes
    )
  `);

  for (const place of places) {
    const existing = findExistingPlace(place, existingRows);
    if (existing) {
      update.run({ ...place, id: existing.id });
    } else {
      insert.run(place);
    }
  }
});
```

Add this helper to the script:

```js
function findExistingPlace(imported, existingRows) {
  if (imported.placeId) {
    const match = existingRows.find((row) => row.place_id === imported.placeId);
    if (match) return match;
  }

  if (imported.googlePlaceToken) {
    const match = existingRows.find(
      (row) => row.google_place_token === imported.googlePlaceToken,
    );
    if (match) return match;
  }

  if (imported.googleInternalIds) {
    const match = existingRows.find(
      (row) => row.google_internal_ids === imported.googleInternalIds,
    );
    if (match) return match;
  }

  return null;
}
```

Use this schema inside `migrate(database)`:

```js
database.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS places (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT,
    google_maps_url TEXT NOT NULL,
    place_id TEXT,
    google_place_token TEXT,
    google_internal_ids TEXT,
    source_list_url TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    visit_date TEXT,
    visit_time TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS route_segments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    to_place_id INTEGER NOT NULL REFERENCES places(id) ON DELETE CASCADE,
    mode TEXT NOT NULL DEFAULT 'walking' CHECK (mode IN ('walking', 'transit', 'bicycling', 'driving')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);
```

- [ ] **Step 3: Run importer tests**

Run:

```bash
npm test -- tests/importer-matching.test.mjs
```

Expected: PASS.

- [ ] **Step 4: Run CLI importer**

Run:

```bash
npm run import:google-list
```

Expected: command exits with code 0, creates `data/trip-planner.sqlite`, and prints imported row count.

Verify:

```bash
sqlite3 data/trip-planner.sqlite 'select count(*) from places;'
```

Expected: count is greater than 0.

## Task 10: Build Client State Shell And API Calls

**Files:**

- Replace: `src/components/TripPlannerApp.tsx`

- [ ] **Step 1: Replace `TripPlannerApp`**

Use this client state shell:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { buildItinerary } from "@/lib/itinerary";
import type { PlannerSnapshot, Place, TravelMode } from "@/lib/types";
import { AddEditPlaceModal } from "./AddEditPlaceModal";
import { LeftPanel } from "./LeftPanel";
import { MapPanel } from "./MapPanel";

const EMPTY_SNAPSHOT: PlannerSnapshot = { places: [], routeSegments: [] };

export function TripPlannerApp() {
  const [snapshot, setSnapshot] = useState<PlannerSnapshot>(EMPTY_SNAPSHOT);
  const [activePlaceId, setActivePlaceId] = useState<number | null>(null);
  const [activeSegmentId, setActiveSegmentId] = useState<number | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const itinerary = useMemo(
    () => buildItinerary(snapshot.places, snapshot.routeSegments),
    [snapshot],
  );

  const reload = useCallback(async () => {
    const response = await fetch("/api/places");
    if (!response.ok) throw new Error("Failed to load places.");
    setSnapshot(await response.json());
  }, []);

  useEffect(() => {
    reload().catch((reason) =>
      setError(
        reason instanceof Error ? reason.message : "Failed to load places.",
      ),
    );
  }, [reload]);

  async function savePlace(payload: Record<string, unknown>, id?: number) {
    const response = await fetch(id ? `/api/places/${id}` : "/api/places", {
      method: id ? "PATCH" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Failed to save place.");
    setSnapshot(data);
    setIsAdding(false);
    setEditingPlace(null);
  }

  async function deletePlace(id: number) {
    const response = await fetch(`/api/places/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? "Failed to delete place.");
    setSnapshot(data);
  }

  async function schedulePlace(
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) {
    const response = await fetch(`/api/places/${id}/schedule`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ visit_date: visitDate, visit_time: visitTime }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error ?? "Failed to schedule place.");
    setSnapshot(data);
  }

  async function updateSegmentMode(id: number, mode: TravelMode) {
    const response = await fetch(`/api/route-segments/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    const data = await response.json();
    if (!response.ok)
      throw new Error(data.error ?? "Failed to update route mode.");
    setSnapshot(data);
  }

  return (
    <main className="app-shell">
      <LeftPanel
        itinerary={itinerary}
        places={snapshot.places}
        activePlaceId={activePlaceId}
        activeSegmentId={activeSegmentId}
        error={error}
        onAdd={() => setIsAdding(true)}
        onEdit={setEditingPlace}
        onDelete={(id) =>
          deletePlace(id).catch((reason) => setError(reason.message))
        }
        onSelectPlace={setActivePlaceId}
        onSelectSegment={setActiveSegmentId}
        onSchedulePlace={(id, date, time) =>
          schedulePlace(id, date, time).catch((reason) =>
            setError(reason.message),
          )
        }
        onModeChange={(id, mode) =>
          updateSegmentMode(id, mode).catch((reason) =>
            setError(reason.message),
          )
        }
      />
      <MapPanel
        places={snapshot.places}
        itinerary={itinerary}
        routeSegments={snapshot.routeSegments}
        activePlaceId={activePlaceId}
        activeSegmentId={activeSegmentId}
        onSelectPlace={setActivePlaceId}
        onSelectSegment={setActiveSegmentId}
      />
      {(isAdding || editingPlace) && (
        <AddEditPlaceModal
          place={editingPlace}
          onCancel={() => {
            setIsAdding(false);
            setEditingPlace(null);
          }}
          onSave={(payload) =>
            savePlace(payload, editingPlace?.id).catch((reason) =>
              setError(reason.message),
            )
          }
        />
      )}
    </main>
  );
}
```

- [ ] **Step 2: Build**

Run:

```bash
npm run build
```

Expected: FAIL because child components do not exist. Continue to Task 11.

## Task 11: Build Left Panel, Modal, And Segment Row

**Files:**

- Create: `src/components/AddEditPlaceModal.tsx`
- Create: `src/components/LeftPanel.tsx`
- Create: `src/components/SegmentRow.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create add/edit modal**

Create `src/components/AddEditPlaceModal.tsx`:

```tsx
"use client";

import { FormEvent, useState } from "react";
import type { Place } from "@/lib/types";

type Props = {
  place: Place | null;
  onCancel: () => void;
  onSave: (payload: Record<string, unknown>) => void;
};

export function AddEditPlaceModal({ place, onCancel, onSave }: Props) {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      google_maps_url: stringValue(form, "google_maps_url"),
      name: stringValue(form, "name"),
      address: nullableValue(form, "address"),
      notes: nullableValue(form, "notes"),
      visit_date: nullableValue(form, "visit_date"),
      visit_time: nullableValue(form, "visit_time"),
    };

    try {
      await onSave(payload);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Failed to save place.",
      );
      setIsSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <form className="modal" onSubmit={submit}>
        <header className="modal-header">
          <h2>{place ? "Edit Place" : "Add Place"}</h2>
          <button
            type="button"
            className="icon-button"
            onClick={onCancel}
            aria-label="Close"
          >
            X
          </button>
        </header>
        <label>
          Google Maps URL
          <input
            name="google_maps_url"
            required
            defaultValue={place?.google_maps_url ?? ""}
          />
        </label>
        <label>
          Name
          <input
            name="name"
            defaultValue={place?.name ?? ""}
            placeholder="Auto-filled when possible"
          />
        </label>
        <label>
          Address
          <input name="address" defaultValue={place?.address ?? ""} />
        </label>
        <div className="form-grid">
          <label>
            Date
            <input
              type="date"
              name="visit_date"
              defaultValue={place?.visit_date ?? ""}
            />
          </label>
          <label>
            Time
            <input
              type="time"
              name="visit_time"
              defaultValue={place?.visit_time ?? ""}
            />
          </label>
        </div>
        <label>
          Notes
          <textarea name="notes" rows={5} defaultValue={place?.notes ?? ""} />
        </label>
        {error && <p className="error-text">{error}</p>}
        <footer className="modal-actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Saving..." : "Save"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function stringValue(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

function nullableValue(form: FormData, key: string): string | null {
  const value = stringValue(form, key);
  return value || null;
}
```

- [ ] **Step 2: Create segment row**

Create `src/components/SegmentRow.tsx`:

```tsx
"use client";

import { buildGoogleMapsDirectionsUrl } from "@/lib/maps-url";
import type { Place, RouteSegment, TravelMode } from "@/lib/types";

const MODES: TravelMode[] = ["walking", "transit", "bicycling", "driving"];

type Props = {
  segment: RouteSegment;
  from: Place;
  to: Place;
  active: boolean;
  onSelect: () => void;
  onModeChange: (mode: TravelMode) => void;
};

export function SegmentRow({
  segment,
  from,
  to,
  active,
  onSelect,
  onModeChange,
}: Props) {
  const url = buildGoogleMapsDirectionsUrl({
    origin: { latitude: from.latitude, longitude: from.longitude },
    destination: { latitude: to.latitude, longitude: to.longitude },
    mode: segment.mode,
  });

  return (
    <div className={`segment-row ${active ? "active" : ""}`} onClick={onSelect}>
      <select
        aria-label={`Travel mode from ${from.name} to ${to.name}`}
        value={segment.mode}
        onChange={(event) =>
          onModeChange(event.currentTarget.value as TravelMode)
        }
      >
        {MODES.map((mode) => (
          <option key={mode} value={mode}>
            {mode}
          </option>
        ))}
      </select>
      <a className="small-button" href={url} target="_blank" rel="noreferrer">
        Open in Google Maps
      </a>
    </div>
  );
}
```

- [ ] **Step 3: Create left panel**

Create `src/components/LeftPanel.tsx`:

```tsx
"use client";

import type { ItineraryView, Place, TravelMode } from "@/lib/types";
import { SegmentRow } from "./SegmentRow";

type Props = {
  itinerary: ItineraryView;
  places: Place[];
  activePlaceId: number | null;
  activeSegmentId: number | null;
  error: string | null;
  onAdd: () => void;
  onEdit: (place: Place) => void;
  onDelete: (id: number) => void;
  onSelectPlace: (id: number) => void;
  onSelectSegment: (id: number) => void;
  onSchedulePlace: (
    id: number,
    visitDate: string | null,
    visitTime: string | null,
  ) => void;
  onModeChange: (id: number, mode: TravelMode) => void;
};

export function LeftPanel(props: Props) {
  return (
    <section className="panel panel-left">
      <header className="app-header">
        <h1>Trip Planner</h1>
        <button onClick={props.onAdd}>Add Place</button>
      </header>
      {props.error && <p className="error-text">{props.error}</p>}
      <section className="section-block">
        <h2>Itineraries</h2>
        {props.itinerary.days.map((day) => (
          <div
            key={day.date}
            className="day-block"
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              const id = Number(event.dataTransfer.getData("text/place-id"));
              if (Number.isInteger(id))
                props.onSchedulePlace(id, day.date, null);
            }}
          >
            <h3 style={{ borderColor: day.color }}>{day.date}</h3>
            {day.places.map((place, index) => {
              const nextPlace = day.places[index + 1];
              const segmentView = day.segments.find(
                (segment) => segment.fromPlaceId === place.id,
              );
              return (
                <div key={place.id}>
                  <PlaceRow
                    place={place}
                    active={props.activePlaceId === place.id}
                    draggable
                    onSelect={() => props.onSelectPlace(place.id)}
                    onEdit={() => props.onEdit(place)}
                    onDelete={() => props.onDelete(place.id)}
                  />
                  {segmentView && nextPlace && (
                    <SegmentRow
                      segment={segmentView.segment}
                      from={place}
                      to={nextPlace}
                      active={props.activeSegmentId === segmentView.segment.id}
                      onSelect={() =>
                        props.onSelectSegment(segmentView.segment.id)
                      }
                      onModeChange={(mode) =>
                        props.onModeChange(segmentView.segment.id, mode)
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </section>
      <section
        className="section-block"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          const id = Number(event.dataTransfer.getData("text/place-id"));
          if (Number.isInteger(id)) props.onSchedulePlace(id, null, null);
        }}
      >
        <h2>Unscheduled</h2>
        {props.itinerary.unscheduled.map((place) => (
          <PlaceRow
            key={place.id}
            place={place}
            active={props.activePlaceId === place.id}
            draggable
            onSelect={() => props.onSelectPlace(place.id)}
            onEdit={() => props.onEdit(place)}
            onDelete={() => props.onDelete(place.id)}
          />
        ))}
      </section>
      <section className="section-block">
        <h2>Places</h2>
        {props.places.map((place) => (
          <PlaceRow
            key={place.id}
            place={place}
            active={props.activePlaceId === place.id}
            draggable={false}
            onSelect={() => props.onSelectPlace(place.id)}
            onEdit={() => props.onEdit(place)}
            onDelete={() => props.onDelete(place.id)}
          />
        ))}
      </section>
    </section>
  );
}

function PlaceRow(props: {
  place: Place;
  active: boolean;
  draggable: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`place-row ${props.active ? "active" : ""}`}
      draggable={props.draggable}
      onDragStart={(event) =>
        event.dataTransfer.setData("text/place-id", String(props.place.id))
      }
    >
      <button className="place-main" onClick={props.onSelect}>
        <strong>{props.place.name}</strong>
        <span>{formatSchedule(props.place)}</span>
      </button>
      <button onClick={props.onEdit}>Edit</button>
      <button className="danger-button" onClick={props.onDelete}>
        Delete
      </button>
    </div>
  );
}

function formatSchedule(place: Place): string {
  if (place.visit_date && place.visit_time)
    return `${place.visit_date} ${place.visit_time}`;
  if (place.visit_date) return `${place.visit_date} no time`;
  return place.address ?? "Unscheduled";
}
```

- [ ] **Step 4: Append panel CSS**

Append to `src/app/globals.css`:

```css
.app-header,
.modal-header,
.modal-actions,
.place-row,
.segment-row {
  align-items: center;
  display: flex;
  gap: 8px;
}

.app-header {
  justify-content: space-between;
}

.section-block {
  border-top: 1px solid var(--line);
  margin-top: 16px;
  padding-top: 16px;
}

.day-block {
  border: 1px solid var(--line);
  border-radius: 8px;
  margin: 12px 0;
  padding: 10px;
}

.day-block h3 {
  border-left: 4px solid;
  margin: 0 0 8px;
  padding-left: 8px;
}

.place-row {
  border: 1px solid var(--line);
  border-radius: 8px;
  margin: 6px 0;
  padding: 6px;
}

.place-row.active,
.segment-row.active {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}

.place-main {
  background: transparent;
  border: 0;
  color: inherit;
  display: grid;
  flex: 1;
  min-width: 0;
  padding: 4px;
  text-align: left;
}

.place-main span {
  color: var(--muted);
  overflow-wrap: anywhere;
}

.segment-row {
  border-left: 2px solid var(--line);
  margin-left: 14px;
  padding: 4px 0 4px 10px;
}

.small-button,
button {
  background: #ffffff;
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--text);
  cursor: pointer;
  padding: 6px 8px;
  text-decoration: none;
}

.danger-button {
  color: var(--danger);
}

.error-text {
  color: var(--danger);
}

.modal-backdrop {
  align-items: center;
  background: rgba(15, 23, 42, 0.38);
  display: flex;
  inset: 0;
  justify-content: center;
  position: fixed;
  z-index: 20;
}

.modal {
  background: var(--panel);
  border-radius: 8px;
  display: grid;
  gap: 12px;
  max-height: calc(100vh - 32px);
  max-width: 420px;
  overflow: auto;
  padding: 16px;
  width: calc(100vw - 32px);
}

.modal-header,
.modal-actions {
  justify-content: space-between;
}

.modal label {
  display: grid;
  gap: 4px;
}

.modal input,
.modal textarea,
.modal select {
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 8px;
  width: 100%;
}

.form-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: 1fr 1fr;
}

.icon-button {
  min-width: 36px;
}
```

- [ ] **Step 5: Build**

Run:

```bash
npm run build
```

Expected: FAIL only because `MapPanel` does not exist. Continue to Task 12.

## Task 12: Build Map Panel And Fallback

**Files:**

- Create: `src/components/MapPanel.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Create `MapPanel`**

Create `src/components/MapPanel.tsx`:

```tsx
"use client";

import { useEffect, useMemo, useRef } from "react";
import type { ItineraryView, Place, RouteSegment } from "@/lib/types";

type Props = {
  places: Place[];
  itinerary: ItineraryView;
  routeSegments: RouteSegment[];
  activePlaceId: number | null;
  activeSegmentId: number | null;
  onSelectPlace: (id: number) => void;
  onSelectSegment: (id: number) => void;
};

export function MapPanel(props: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const placeColors = useMemo(
    () => buildPlaceColors(props.itinerary),
    [props.itinerary],
  );

  useEffect(() => {
    if (!apiKey || !mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps(apiKey)
      .then(() => {
        if (cancelled || !mapRef.current || !window.google) return;
        renderMap(mapRef.current, props, placeColors);
      })
      .catch(() => {
        if (mapRef.current) mapRef.current.dataset.failed = "true";
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, props, placeColors]);

  if (!apiKey) {
    return <CoordinateFallback places={props.places} />;
  }

  return (
    <section className="panel panel-map" ref={mapRef} aria-label="Google map" />
  );
}

function CoordinateFallback({ places }: { places: Place[] }) {
  return (
    <section className="panel panel-map map-fallback">
      <h2>Coordinates</h2>
      {places.map((place) => (
        <p key={place.id}>
          <strong>{place.name}</strong>: {place.latitude}, {place.longitude}
        </p>
      ))}
    </section>
  );
}

function buildPlaceColors(itinerary: ItineraryView): Map<number, string> {
  const colors = new Map<number, string>();
  for (const day of itinerary.days) {
    for (const place of day.places) colors.set(place.id, day.color);
  }
  return colors;
}

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (window.google?.maps) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(
    "script[data-google-maps]",
  );
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Google Maps failed to load")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.dataset.googleMaps = "true";
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&libraries=marker`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });
}

function renderMap(
  container: HTMLElement,
  props: Props,
  placeColors: Map<number, string>,
): void {
  const center = props.places[0]
    ? { lat: props.places[0].latitude, lng: props.places[0].longitude }
    : { lat: 40.7128, lng: -74.006 };
  const map = new google.maps.Map(container, {
    center,
    zoom: 12,
    mapId: "trip-planner-map",
  });
  const bounds = new google.maps.LatLngBounds();
  const placesById = new Map(props.places.map((place) => [place.id, place]));

  for (const place of props.places) {
    const position = { lat: place.latitude, lng: place.longitude };
    bounds.extend(position);
    const marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position,
      title: place.name,
      content: markerContent(
        placeColors.get(place.id) ?? "#64748b",
        props.activePlaceId === place.id,
      ),
    });
    marker.addListener("click", () => props.onSelectPlace(place.id));
  }

  for (const segment of props.routeSegments) {
    const from = placesById.get(segment.from_place_id);
    const to = placesById.get(segment.to_place_id);
    if (!from || !to) continue;

    const active = props.activeSegmentId === segment.id;
    const color = placeColors.get(from.id) ?? "#64748b";
    const polyline = new google.maps.Polyline({
      map,
      path: [
        { lat: from.latitude, lng: from.longitude },
        { lat: to.latitude, lng: to.longitude },
      ],
      strokeColor: color,
      strokeOpacity: active ? 0.95 : 0.55,
      strokeWeight: active ? 5 : 3,
    });
    polyline.addListener("click", () => props.onSelectSegment(segment.id));
  }

  if (!bounds.isEmpty()) map.fitBounds(bounds, 48);
}

function markerContent(color: string, active: boolean): HTMLElement {
  const element = document.createElement("div");
  element.className = active ? "map-marker active" : "map-marker";
  element.style.backgroundColor = color;
  return element;
}
```

Add this global declaration to the bottom of `src/components/MapPanel.tsx`:

```ts
declare global {
  interface Window {
    google?: typeof google;
  }
}
```

- [ ] **Step 2: Add map CSS**

Append to `src/app/globals.css`:

```css
.panel-map {
  background: #eef2f6;
  height: 100%;
  width: 100%;
}

.map-fallback {
  overflow: auto;
  padding: 16px;
}

.map-marker {
  border: 2px solid #ffffff;
  border-radius: 999px;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.28);
  height: 16px;
  width: 16px;
}

.map-marker.active {
  height: 22px;
  width: 22px;
}
```

- [ ] **Step 3: Build**

Run:

```bash
npm run build
```

Expected: PASS. If `google` type declarations conflict, remove the custom `Window.google` declaration and rely on `@types/google.maps`.

## Task 13: Full Verification Pass

**Files:**

- No planned edits unless verification fails.

- [ ] **Step 1: Run all unit tests**

Run:

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 3: Import real saved-list data**

Run:

```bash
npm run import:google-list
```

Expected: import succeeds and creates or updates `data/trip-planner.sqlite`.

- [ ] **Step 4: Verify database shape**

Run:

```bash
sqlite3 data/trip-planner.sqlite '.tables'
```

Expected output includes:

```text
places          route_segments
```

Run:

```bash
sqlite3 data/trip-planner.sqlite 'select count(*) from places;'
```

Expected: count is greater than 0.

- [ ] **Step 5: Run local app**

Run:

```bash
npm run dev
```

Expected: local server prints a URL such as `http://localhost:3000`.

- [ ] **Step 6: Manual browser verification**

Open the local URL and verify:

- Places load from SQLite.
- Unscheduled places appear in the unscheduled section.
- Places section is not reorderable.
- Dragging an unscheduled place into a date bucket assigns `visit_date` and leaves `visit_time` empty.
- Editing a place to add date and time creates segments only between consecutive timed places.
- Untimed places appear below timed places and do not create segments.
- Segment mode selector accepts `walking`, `transit`, `bicycling`, `driving`.
- "Open in Google Maps" opens a new tab with `api=1`, coordinate origin/destination, and `travelmode`.
- Delete removes a place and cleans up related segments.
- With `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` absent, coordinate fallback appears.

## Plan Self-Review

- Spec coverage: This plan covers local/serverful stack, schema without `sort_order`, timed-only route segments, CLI-only importer, URL-based add/edit, drag date assignment, external Google Maps route handoff, map fallback, and tests.
- Placeholder scan: No placeholder markers or unspecified edge-handling steps are intentionally left in the plan.
- Type consistency: Shared `Place`, `RouteSegment`, `TravelMode`, and `PlannerSnapshot` types are defined before use. API and component payloads use the same snake_case field names as SQLite and the spec.
