import type { Metadata } from "next";
import { PathsView } from "@/features/paths/PathsView";

export const metadata: Metadata = { title: "Learning paths" };

export default function PathsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Learning paths</h1>
        <p className="mt-1 text-muted-foreground">
          Turn a goal into a personalized, step-by-step course — one lesson at a time.
        </p>
      </div>
      <PathsView />
    </div>
  );
}
