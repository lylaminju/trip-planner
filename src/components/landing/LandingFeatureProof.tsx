const FEATURES = [
  {
    title: "Saved places",
    body: "Start with places and map links, then decide when each visit belongs.",
  },
  {
    title: "Daily timeline",
    body: "Group visits by date and keep the day readable as plans change.",
  },
  {
    title: "Route segments",
    body: "Choose travel mode between consecutive visits without leaving the plan.",
  },
  {
    title: "Map view",
    body: "Use markers and route lines to check whether the day makes sense visually.",
  },
];

export function LandingFeatureProof() {
  return (
    <section
      className="landing-feature-proof"
      aria-label="Trip Planner feature summary"
    >
      {FEATURES.map((feature) => (
        <article key={feature.title} className="landing-feature-item">
          <h2>{feature.title}</h2>
          <p>{feature.body}</p>
        </article>
      ))}
    </section>
  );
}
