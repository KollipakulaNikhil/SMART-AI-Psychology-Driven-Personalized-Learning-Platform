import "lenis/dist/lenis.css";
import { Hero } from "@/features/landing/home/Hero";
import { SiteFooter, SiteNav } from "@/features/landing/home/HomeSections";
import { Figures, Games, Languages, YourWay } from "@/features/landing/home/MoreSections";
import { AskTutor, FinalCta, ForgettingCurve, LessonKit } from "@/features/landing/home/Showcase";
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
        <LessonKit />
        <Languages />
        <Games />
        <ForgettingCurve figures={<Figures />} />
        <AskTutor />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
