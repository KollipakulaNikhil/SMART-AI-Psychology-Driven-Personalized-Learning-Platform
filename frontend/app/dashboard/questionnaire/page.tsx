import type { Metadata } from "next";
import { QuestionnaireWizard } from "@/features/questionnaire/QuestionnaireWizard";

export const metadata: Metadata = { title: "Learning assessment" };

export default function QuestionnairePage() {
  return (
    <div>
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">Let&apos;s map how you learn</h1>
        <p className="mt-2 text-muted-foreground">
          20 quick questions — no wrong answers. Be honest, not aspirational: the profile drives
          every lesson we build for you.
        </p>
      </div>
      <QuestionnaireWizard />
    </div>
  );
}
