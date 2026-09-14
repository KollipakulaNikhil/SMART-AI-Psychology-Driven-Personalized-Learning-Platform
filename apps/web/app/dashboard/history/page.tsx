import type { Metadata } from "next";
import { HistoryGrid } from "@/features/history/HistoryGrid";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Your lessons</h1>
        <p className="mt-1 text-muted-foreground">
          Everything you have generated — decks, narrations and videos.
        </p>
      </div>
      <HistoryGrid />
    </div>
  );
}
