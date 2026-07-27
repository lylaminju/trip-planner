const MAP_WIDTH = 480;
const MAP_HEIGHT = 360;
const MAP_ROTATION_DEG = -28;
const MAP_ROTATION_ORIGIN_X = 240;
const MAP_ROTATION_ORIGIN_Y = 180;

export const LANDING_MAP_VIEW_BOX = `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`;
/* Tilts the island and its street grid the way a real city map sits on screen. */
export const LANDING_MAP_GRID_TRANSFORM = `rotate(${MAP_ROTATION_DEG} ${MAP_ROTATION_ORIGIN_X} ${MAP_ROTATION_ORIGIN_Y})`;
/* Counter-rotation that keeps markers upright inside the tilted grid. */
export const LANDING_MAP_UPRIGHT_TRANSFORM = `rotate(${-MAP_ROTATION_DEG})`;

const ISLAND_CLIP_ID = "landing-map-island-clip";
const WEST_SHORE_CLIP_ID = "landing-map-west-shore-clip";
const EAST_SHORE_CLIP_ID = "landing-map-east-shore-clip";

const ISLAND_PATH =
  "M148 -220 C144 -120 152 -20 150 70 C148 160 156 250 166 340 C172 400 178 480 186 580 L340 580 C336 470 342 360 338 260 C334 160 340 60 336 -40 C333 -110 337 -170 338 -220 Z";
const WEST_SHORE_PATH =
  "M-140 -220 H62 C58 -100 68 20 60 140 C52 260 66 380 58 580 H-140 Z";
const EAST_SHORE_PATH =
  "M418 -220 H620 V580 H408 C402 460 414 340 406 220 C400 120 414 20 418 -220 Z";

const AVENUE_X_START = 160;
const AVENUE_X_END = 328;
const AVENUE_X_SPACING = 24;
const AVENUE_Y_START = -230;
const AVENUE_Y_END = 590;

const STREET_Y_START = -200;
const STREET_Y_END = 560;
const STREET_Y_SPACING = 20;
const STREET_X_START = 138;
const STREET_X_END = 350;
const MAJOR_STREET_INTERVAL = 5;

const BROADWAY_PATH =
  "M328 -220 C306 -80 288 20 272 110 C256 200 226 300 206 400 C196 450 190 520 186 580";

const SHORE_DRIVE_PATHS = [
  "M155 -220 C151 -110 159 -10 157 80 C155 170 163 255 173 345 C179 405 185 490 193 580",
  "M330 -220 C327 -110 331 -30 329 60 C326 160 331 260 333 360 C335 465 330 500 333 580",
];

const BRIDGE_PATHS = ["M336 140 H452", "M338 330 H450"];

const PARKS = [
  { x: 236, y: 0, width: 60, height: 160 },
  { x: 160, y: 260, width: 24, height: 30 },
];

/* Transverse roads that cross the large park, like a real city greenspace. */
const PARK_CROSSING_PATHS = ["M236 54 H296", "M236 110 H296"];

const BUILDINGS = [
  { x: 165, y: -16, width: 14, height: 12 },
  { x: 213, y: 4, width: 14, height: 12 },
  { x: 189, y: 24, width: 14, height: 8 },
  { x: 309, y: 24, width: 14, height: 12 },
  { x: 165, y: 64, width: 14, height: 12 },
  { x: 309, y: 84, width: 14, height: 8 },
  { x: 189, y: 104, width: 14, height: 12 },
  { x: 213, y: 144, width: 14, height: 12 },
  { x: 285, y: 164, width: 14, height: 12 },
  { x: 237, y: 184, width: 14, height: 8 },
  { x: 165, y: 204, width: 14, height: 12 },
  { x: 309, y: 204, width: 14, height: 12 },
  { x: 189, y: 224, width: 14, height: 12 },
  { x: 261, y: 244, width: 14, height: 8 },
  { x: 213, y: 284, width: 14, height: 12 },
  { x: 285, y: 304, width: 14, height: 12 },
  { x: 189, y: 324, width: 14, height: 8 },
  { x: 237, y: 344, width: 14, height: 12 },
];

type ShoreGridLines = {
  start: number;
  end: number;
  spacing: number;
  from: number;
  to: number;
};

type ShoreGridConfig = {
  streets: ShoreGridLines;
  avenues: ShoreGridLines;
  highways?: string[];
};

const WEST_SHORE_GRID: ShoreGridConfig = {
  streets: { start: -300, end: 600, spacing: 26, from: -300, to: 180 },
  avenues: { start: -260, end: 100, spacing: 30, from: -360, to: 700 },
  /* A riverside expressway plus two approaches that meet it at the water. */
  highways: [
    "M48 -220 C44 -100 54 20 46 140 C38 260 52 380 44 580",
    "M-180 236 C-104 228 -40 208 6 186 C26 177 48 172 70 168",
    "M-180 340 C-100 328 -34 290 14 244 C32 226 52 200 70 172",
  ],
};

const EAST_SHORE_GRID: ShoreGridConfig = {
  streets: { start: -300, end: 600, spacing: 28, from: 360, to: 720 },
  avenues: { start: 380, end: 700, spacing: 32, from: -360, to: 700 },
};

function range(start: number, end: number, spacing: number) {
  const values: number[] = [];
  for (let value = start; value <= end; value += spacing) {
    values.push(value);
  }
  return values;
}

function Highways({ paths }: { paths: string[] }) {
  return (
    <>
      {paths.map((d) => (
        <path
          className="landing-abstract-map-highway-casing"
          d={d}
          key={`${d}-casing`}
        />
      ))}
      {paths.map((d) => (
        <path className="landing-abstract-map-highway" d={d} key={d} />
      ))}
    </>
  );
}

function ShoreGrid({
  clipId,
  grid,
  shorePath,
}: {
  clipId: string;
  grid: ShoreGridConfig;
  shorePath: string;
}) {
  return (
    <>
      <path className="landing-abstract-map-land" d={shorePath} />
      <g clipPath={`url(#${clipId})`}>
        {range(grid.streets.start, grid.streets.end, grid.streets.spacing).map(
          (y) => (
            <path
              className="landing-abstract-map-street is-outer"
              d={`M${grid.streets.from} ${y} H${grid.streets.to}`}
              key={`shore-street-${y}`}
            />
          ),
        )}
        {range(grid.avenues.start, grid.avenues.end, grid.avenues.spacing).map(
          (x) => (
            <path
              className="landing-abstract-map-street is-outer"
              d={`M${x} ${grid.avenues.from} V${grid.avenues.to}`}
              key={`shore-avenue-${x}`}
            />
          ),
        )}
        {grid.highways ? <Highways paths={grid.highways} /> : null}
      </g>
    </>
  );
}

export function LandingAbstractMap() {
  return (
    <>
      <defs>
        <clipPath id={ISLAND_CLIP_ID}>
          <path d={ISLAND_PATH} />
        </clipPath>
        <clipPath id={WEST_SHORE_CLIP_ID}>
          <path d={WEST_SHORE_PATH} />
        </clipPath>
        <clipPath id={EAST_SHORE_CLIP_ID}>
          <path d={EAST_SHORE_PATH} />
        </clipPath>
      </defs>
      <rect
        className="landing-abstract-map-water"
        height={MAP_HEIGHT}
        width={MAP_WIDTH}
        x="0"
        y="0"
      />
      <g transform={LANDING_MAP_GRID_TRANSFORM}>
        <ShoreGrid
          clipId={WEST_SHORE_CLIP_ID}
          grid={WEST_SHORE_GRID}
          shorePath={WEST_SHORE_PATH}
        />
        <ShoreGrid
          clipId={EAST_SHORE_CLIP_ID}
          grid={EAST_SHORE_GRID}
          shorePath={EAST_SHORE_PATH}
        />
        <path className="landing-abstract-map-land" d={ISLAND_PATH} />
        <g clipPath={`url(#${ISLAND_CLIP_ID})`}>
          {range(STREET_Y_START, STREET_Y_END, STREET_Y_SPACING).map(
            (y, index) => (
              <path
                className={
                  index % MAJOR_STREET_INTERVAL === 0
                    ? "landing-abstract-map-street is-major"
                    : "landing-abstract-map-street"
                }
                d={`M${STREET_X_START} ${y} H${STREET_X_END}`}
                key={`street-${y}`}
              />
            ),
          )}
          {range(AVENUE_X_START, AVENUE_X_END, AVENUE_X_SPACING).map((x) => (
            <path
              className="landing-abstract-map-street-casing"
              d={`M${x} ${AVENUE_Y_START} V${AVENUE_Y_END}`}
              key={`avenue-casing-${x}`}
            />
          ))}
          {range(AVENUE_X_START, AVENUE_X_END, AVENUE_X_SPACING).map((x) => (
            <path
              className="landing-abstract-map-street is-avenue"
              d={`M${x} ${AVENUE_Y_START} V${AVENUE_Y_END}`}
              key={`avenue-${x}`}
            />
          ))}
          <path
            className="landing-abstract-map-street-casing"
            d={BROADWAY_PATH}
          />
          <path
            className="landing-abstract-map-street is-avenue"
            d={BROADWAY_PATH}
          />
          {PARKS.map((park) => (
            <rect
              className="landing-abstract-map-park"
              height={park.height}
              key={`park-${park.x}-${park.y}`}
              rx="3"
              width={park.width}
              x={park.x}
              y={park.y}
            />
          ))}
          {PARK_CROSSING_PATHS.map((d) => (
            <path className="landing-abstract-map-street" d={d} key={d} />
          ))}
          {BUILDINGS.map((building) => (
            <rect
              className="landing-abstract-map-block"
              height={building.height}
              key={`block-${building.x}-${building.y}`}
              rx="1.5"
              width={building.width}
              x={building.x}
              y={building.y}
            />
          ))}
          <Highways paths={SHORE_DRIVE_PATHS} />
        </g>
        <Highways paths={BRIDGE_PATHS} />
      </g>
    </>
  );
}
