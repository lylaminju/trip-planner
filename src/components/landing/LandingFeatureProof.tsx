import { SERVICE_TITLE } from "@/lib/service-brand";

const FEATURES = [
  {
    title: "Google Maps places",
    body: "Paste a Google Maps link to add the stop with its map data ready.",
  },
  {
    title: "Daily timeline",
    body: "Group visits by date and keep the day readable as plans change.",
  },
  {
    title: "Route segments",
    body: "Choose travel mode between consecutive visits.",
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
      aria-label={`${SERVICE_TITLE} feature summary`}
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
