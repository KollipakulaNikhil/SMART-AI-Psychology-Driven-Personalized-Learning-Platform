import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/marks";
import { CrossoverLab } from "@/features/crossover/CrossoverLab";

export const metadata: Metadata = { title: "Crossover" };

export default function CrossoverPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Crossover"
        title="Connect two things you've learned"
        description="Pick any two of your lessons — the further apart the better. You get the idea they share, where the comparison breaks, and one question that needs both."
      />
      <CrossoverLab />
    </div>
  );
}
