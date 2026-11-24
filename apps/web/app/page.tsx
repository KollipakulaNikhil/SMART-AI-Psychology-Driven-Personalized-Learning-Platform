import "lenis/dist/lenis.css";
import { Hero } from "@/features/landing/home/Hero";
import { ClosingCta, Faq, MoreThan, SiteFooter, SiteNav } from "@/features/landing/home/HomeSections";
import { Games, Languages, Numbers, YourWay } from "@/features/landing/home/MoreSections";
import { SmoothScroll } from "@/features/landing/home/SmoothScroll";
import { StoryHero } from "@/features/landing/home/StoryHero";

export default function LandingPage() {
  return (
    <>
      <SmoothScroll />
      <SiteNav />
      <main className="pt-16">
        <Hero />
        <StoryHero />
        <YourWay />
        <MoreThan />
        <Languages />
        <Games />
        <Numbers />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
