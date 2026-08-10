import type { Metadata } from "next";
import { ProfileView } from "@/features/profile/ProfileView";

export const metadata: Metadata = { title: "Learning profile" };

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Your learning profile</h1>
        <p className="mt-1 text-muted-foreground">
          The psychological blueprint behind every lesson SMART AI builds for you.
        </p>
      </div>
      <ProfileView />
    </div>
  );
}
