const MAP_BLOCKS = [
  { x: -104, y: -96, width: 74, height: 38, tone: "is-soft" },
  { x: -8, y: -96, width: 52, height: 38, tone: "is-muted" },
  { x: 68, y: -96, width: 98, height: 38 },
  { x: 68, y: -42, width: 98, height: 74, tone: "is-muted" },
  { x: 188, y: -42, width: 82, height: 74, tone: "is-soft" },
  { x: -46, y: 56, width: 92, height: 78, tone: "is-soft" },
  { x: 68, y: 56, width: 98, height: 78 },
  { x: -46, y: 158, width: 92, height: 72 },
  { x: 68, y: 158, width: 98, height: 72, tone: "is-park" },
  { x: 188, y: 158, width: 82, height: 72, tone: "is-soft" },
  { x: 292, y: 158, width: 104, height: 72, tone: "is-muted" },
  { x: -46, y: 254, width: 92, height: 46, tone: "is-muted" },
  { x: 68, y: 254, width: 98, height: 46, tone: "is-soft" },
  { x: 188, y: 254, width: 82, height: 46 },
  { x: -104, y: 320, width: 74, height: 50 },
  { x: -8, y: 320, width: 52, height: 50, tone: "is-soft" },
  { x: 68, y: 320, width: 98, height: 50, tone: "is-muted" },
  { x: 188, y: 320, width: 82, height: 50, tone: "is-soft" },
  { x: 292, y: 320, width: 104, height: 50 },
] satisfies Array<{
  x: number;
  y: number;
  width: number;
  height: number;
  tone?: string;
}>;

const MAP_CORNER_BLOCKS = [
  {
    d: "M-46 -42 H46 V32 H12 V-4 H-46 Z",
  },
  {
    d: "M188 56 H270 V134 H228 V94 H188 Z",
    tone: "is-muted",
  },
  {
    d: "M295 55 H342 V90 H408 V135 H295 Z",
    tone: "is-soft",
  },
  {
    d: "M292 254 H396 V300 H352 V278 H292 Z",
  },
] satisfies Array<{
  d: string;
  tone?: string;
}>;

const MAP_ROADS = [
  { d: "M-120 44 H318", type: "secondary" },
  { d: "M-120 146 H500", type: "primary" },
  { d: "M-120 242 H500", type: "secondary" },
  { d: "M56 -96 V376", type: "primary" },
  { d: "M178 -96 V376", type: "primary" },
  { d: "M282 44 V376", type: "secondary" },
  { d: "M-120 -50 H252", type: "minor" },
  { d: "M-120 310 H500", type: "minor" },
] satisfies Array<{
  d: string;
  type: "primary" | "secondary" | "minor";
}>;

export function LandingAbstractMap() {
  return (
    <>
      <rect
        className="landing-abstract-map-ground"
        x="-120"
        y="-96"
        width="620"
        height="472"
      />
      <path
        className="landing-abstract-map-water"
        d="M270 -96 H500 V84 C446 72 402 84 362 56 C324 29 304 -42 270 -96Z"
      />
      <g className="landing-abstract-map-blocks">
        {MAP_BLOCKS.map((block, index) => (
          <rect
            className={[
              "landing-abstract-map-block",
              block.tone ? block.tone : "",
            ]
              .filter(Boolean)
              .join(" ")}
            height={block.height}
            key={`${block.x}-${block.y}-${index}`}
            rx="5"
            width={block.width}
            x={block.x}
            y={block.y}
          />
        ))}
        {MAP_CORNER_BLOCKS.map((block, index) => (
          <path
            className={[
              "landing-abstract-map-block",
              "is-corner",
              block.tone ? block.tone : "",
            ]
              .filter(Boolean)
              .join(" ")}
            d={block.d}
            key={`${block.d}-${index}`}
          />
        ))}
      </g>
      <g className="landing-abstract-map-roads">
        {MAP_ROADS.map((road) => (
          <path
            className={`landing-abstract-map-road-casing is-${road.type}`}
            d={road.d}
            key={`${road.d}-casing`}
          />
        ))}
        {MAP_ROADS.map((road) => (
          <path
            className={`landing-abstract-map-road is-${road.type}`}
            d={road.d}
            key={road.d}
          />
        ))}
      </g>
    </>
  );
}
