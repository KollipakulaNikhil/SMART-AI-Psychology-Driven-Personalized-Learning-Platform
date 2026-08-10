import { z } from "zod";
import type { LearnerTraits } from "../models/LearningProfile";
import { generateStructured } from "./aiContent.service";

/**
 * Plans a personalized multi-lesson Learning Path from a single goal.
 * Module count and progression are shaped by the learner's psychology:
 * short attention spans get more, smaller modules; advanced learners skip
 * fundamentals; the motivation frames how the arc is pitched.
 */

export const coursePlanSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().min(20).max(600),
  subject: z.string().min(2).max(60),
  // A roadmap of sections, each with its own subtopic lessons.
  sections: z
    .array(
      z.object({
        title: z.string().min(3).max(100),
        subtopics: z
          .array(
            z.object({
              title: z.string().min(3).max(120),
              topic: z.string().min(3).max(200),
              focus: z.string().min(3).max(300),
            })
          )
          .min(1)
          .max(6),
      })
    )
    .min(2)
    .max(6),
});

export type CoursePlan = z.infer<typeof coursePlanSchema>;

function buildCoursePrompt(goal: string, traits: LearnerTraits): string {
  const moduleGuidance =
    traits.attentionSpan === "low"
      ? "Break the journey into 6-8 small, self-contained modules so each session feels finishable."
      : traits.attentionSpan === "high"
        ? "Use 4-6 substantial modules that each go properly deep."
        : "Use 5-7 well-balanced modules.";

  const startPoint =
    traits.knowledgeLevel === "beginner"
      ? "Assume zero prior knowledge; module 1 must build intuition before any formalism."
      : traits.knowledgeLevel === "advanced"
        ? "Skip fundamentals entirely; start from the intermediate frontier and push into advanced territory."
        : "Open with a rapid refresher of the basics, then move into new ground quickly.";

  const motivationFrame =
    traits.motivation === "career"
      ? "Frame modules around employable, practical skills and real work scenarios."
      : traits.motivation === "exam"
        ? "Sequence modules the way an exam syllabus builds, with heavy emphasis on testable mastery."
        : traits.motivation === "hobby"
          ? "Keep the arc project-flavoured and fun — each module should unlock something the learner can try."
          : "Let curiosity lead: order modules so each one opens an intriguing question the next answers.";

  return `You are SMART AI's curriculum designer. Design a personalized learning roadmap organised into SECTIONS, where each section contains several subtopic lessons.

## THE LEARNER
- Knowledge level: ${traits.knowledgeLevel}
- Attention span: ${traits.attentionSpan}
- Learning style: ${traits.learningStyle}
- Motivation: ${traits.motivation}
- Preferred depth: ${traits.depth}

## THE GOAL
"${goal}"

## REQUIREMENTS — follow exactly
1. Organise the roadmap into 3-5 SECTIONS (major stages/chapters of the journey), each with a clear title.
2. ${moduleGuidance} Distribute those lessons as subtopics across the sections (2-4 subtopics per section).
3. ${startPoint}
4. ${motivationFrame}
5. Sections AND the subtopics within them must build strictly in order — no forward references, no repeats. Early sections are foundational; later sections advance.
6. Each subtopic's "topic" is a self-contained lesson topic (it becomes its own generated lesson). Its "focus" tells the lesson generator what to emphasise so it fits the roadmap.
7. "subject" is the broad category (e.g. "Programming", "Physics", "Business").
8. Every field must contain real, specific content — never an empty string or a placeholder.

## OUTPUT FORMAT
Return ONLY a valid JSON object — no markdown fences, no commentary:
{
  "title": "<inspiring but accurate roadmap title>",
  "description": "<2-3 sentences on where this roadmap takes the learner>",
  "subject": "<broad category>",
  "sections": [
    {
      "title": "<section / chapter name>",
      "subtopics": [
        { "title": "<lesson name>", "topic": "<lesson topic>", "focus": "<what this lesson must emphasise>" }
      ]
    }
  ]
}`;
}

export async function planCourse(goal: string, traits: LearnerTraits): Promise<CoursePlan> {
  return generateStructured(buildCoursePrompt(goal, traits), coursePlanSchema, "course plan");
}
