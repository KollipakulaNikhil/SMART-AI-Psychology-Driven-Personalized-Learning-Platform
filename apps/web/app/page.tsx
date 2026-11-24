import { ClosingCta, Faq, MoreThan, SiteFooter, SiteNav } from "@/features/landing/home/HomeSections";
import { StoryHero } from "@/features/landing/home/StoryHero";

export default function LandingPage() {
  return (
    <>
      <SiteNav />
      <main className="pt-16">
        <StoryHero />
        <MoreThan />
        <Faq />
        <ClosingCta />
      </main>
      <SiteFooter />
    </>
  );
}
