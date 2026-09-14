import type { Metadata } from "next";
import { ResearchView } from "@/features/research/ResearchView";

export const metadata: Metadata = { title: "Research Lab" };

export default function ResearchPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Research Lab</h1>
        <p className="mt-1 text-muted-foreground">
          Share a research idea — get the papers and patents behind it, see them, understand them, and
          find your own angle.
        </p>
      </div>
      <ResearchView />
    </div>
  );
}
