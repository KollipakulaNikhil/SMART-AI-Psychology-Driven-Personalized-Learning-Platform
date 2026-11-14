import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/marks";
import { MistakeHunt } from "@/features/mistake-hunt/MistakeHunt";

export const metadata: Metadata = { title: "Mistake Hunt" };

export default function MistakeHuntPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        kicker="Mistake Hunt"
        title="Catch the errors before they catch you"
        description="Name any topic. You get a confident, well-written explanation with a few mistakes planted in it. Find them."
      />
      <MistakeHunt />
    </div>
  );
}
