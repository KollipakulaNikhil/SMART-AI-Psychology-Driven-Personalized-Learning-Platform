import {
  BoardSection,
  Capabilities,
  Difference,
  FinalCta,
  Footer,
  Hero,
  HowItWorks,
  Navbar,
} from "@/features/landing/LandingSections";
import { StatsStrip } from "@/features/landing/StatsStrip";

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Difference />
        <BoardSection />
        <Capabilities />
        <StatsStrip />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
