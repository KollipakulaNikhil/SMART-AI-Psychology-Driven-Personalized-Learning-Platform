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
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
