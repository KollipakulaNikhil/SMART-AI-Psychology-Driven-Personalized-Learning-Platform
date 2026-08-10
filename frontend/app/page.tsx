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
        <Difference />
        <BoardSection />
        <HowItWorks />
        <Capabilities />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
