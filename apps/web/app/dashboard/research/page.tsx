import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/marks";
import { ResearchView } from "@/features/research/ResearchView";

export const metadata: Metadata = { title: "Research Lab" };

export default function ResearchPage() {
  return (
    <div className="space-y-8">
      <PageHeader kicker="Research Lab" title="Research Lab" description="Share a research idea — get the papers and patents behind it, see them, understand them, and find your own angle." />
      <ResearchView />
    </div>
  );
}
