import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/marks";
import { HistoryGrid } from "@/features/history/HistoryGrid";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        kicker="History"
        title="Your lessons"
        description="Everything you have generated — decks, narrations and videos."
      />
      <HistoryGrid />
    </div>
  );
}
