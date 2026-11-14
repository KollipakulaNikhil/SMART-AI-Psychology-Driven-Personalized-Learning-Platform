import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/marks";
import { DiscoveryLab } from "@/features/questionnaire/DiscoveryLab";

export const metadata: Metadata = { title: "Learning discovery" };

export default function QuestionnairePage() {
  return (
    <div>
      <PageHeader
        className="mx-auto mb-10 max-w-2xl"
        kicker="Learning discovery · about three minutes"
        title="Let&apos;s see how you learn"
        description="Six short activities. No survey — we learn from what you actually do, and that shapes every lesson we build for you."
      />
      <DiscoveryLab />
    </div>
  );
}
