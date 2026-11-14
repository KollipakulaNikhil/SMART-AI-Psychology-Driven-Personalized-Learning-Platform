import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/marks";
import { ProfileView } from "@/features/profile/ProfileView";

export const metadata: Metadata = { title: "Learning profile" };

export default function ProfilePage() {
  return (
    <div className="space-y-8">
      <PageHeader kicker="Learning profile" title="Your learning profile" description="The psychological blueprint behind every lesson SMART AI builds for you." />
      <ProfileView />
    </div>
  );
}
