import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/marks";
import { PathsView } from "@/features/paths/PathsView";

export const metadata: Metadata = { title: "Learning paths" };

export default function PathsPage() {
  return (
    <div className="space-y-8">
      <PageHeader kicker="Learning paths" title="Learning paths" description="Turn a goal into a personalized, step-by-step course — one lesson at a time." />
      <PathsView />
    </div>
  );
}
