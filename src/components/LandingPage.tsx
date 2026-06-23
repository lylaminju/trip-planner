import { LandingFooter } from "./landing/LandingFooter";
import { LandingFeatureProof } from "./landing/LandingFeatureProof";
import { LandingHero } from "./landing/LandingHero";
import { LandingWorkflowShowcase } from "./landing/LandingWorkflowShowcase";
import { SampleTripPreview } from "./landing/SampleTripPreview";

export function LandingPage() {
  return (
    <main className="landing-shell">
      <LandingHero />
      <SampleTripPreview />
      <LandingWorkflowShowcase />
      <LandingFeatureProof />
      <LandingFooter />
    </main>
  );
}
