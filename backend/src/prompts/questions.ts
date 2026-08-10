import type { LearnerTraits } from "../models/LearningProfile";

export type TraitDimension = keyof LearnerTraits;

export interface TraitVote {
  dimension: TraitDimension;
  value: string;
  weight?: number;
}

export interface QuestionOption {
  id: string;
  label: string;
  votes: TraitVote[];
}

export interface PsychologyQuestion {
  id: string;
  category: string;
  text: string;
  options: QuestionOption[];
}

/**
 * The 20-question psychology assessment. Every option casts weighted votes
 * into one or more trait dimensions; the profile builder tallies the votes
 * and picks the dominant value per dimension. Questions deliberately overlap
 * dimensions so a single careless answer can't skew the whole profile.
 */
export const PSYCHOLOGY_QUESTIONS: PsychologyQuestion[] = [
  {
    id: "q1",
    category: "Learning style",
    text: "You need to understand how a jet engine works. What would you reach for first?",
    options: [
      { id: "a", label: "A labeled diagram or animation", votes: [{ dimension: "learningStyle", value: "visual", weight: 2 }] },
      { id: "b", label: "A podcast or someone explaining it aloud", votes: [{ dimension: "learningStyle", value: "auditory", weight: 2 }] },
      { id: "c", label: "A well-written article or book chapter", votes: [{ dimension: "learningStyle", value: "reading", weight: 2 }] },
      { id: "d", label: "A model I can take apart or a simulation to play with", votes: [{ dimension: "learningStyle", value: "kinesthetic", weight: 2 }] },
    ],
  },
  {
    id: "q2",
    category: "Learning style",
    text: "Which classroom moments actually stuck with you over the years?",
    options: [
      { id: "a", label: "Charts, maps and slides the teacher drew", votes: [{ dimension: "learningStyle", value: "visual", weight: 2 }] },
      { id: "b", label: "Stories and explanations told out loud", votes: [{ dimension: "learningStyle", value: "auditory", weight: 2 }, { dimension: "memoryType", value: "story" }] },
      { id: "c", label: "Notes and textbook passages I read and re-read", votes: [{ dimension: "learningStyle", value: "reading", weight: 2 }, { dimension: "memoryType", value: "repetition" }] },
      { id: "d", label: "Labs, experiments and hands-on projects", votes: [{ dimension: "learningStyle", value: "kinesthetic", weight: 2 }] },
    ],
  },
  {
    id: "q3",
    category: "Learning style",
    text: "A friend gives you directions to a new place. You remember them best when…",
    options: [
      { id: "a", label: "I picture the route like a map in my head", votes: [{ dimension: "learningStyle", value: "visual" }, { dimension: "memoryType", value: "association" }] },
      { id: "b", label: "I repeat the directions back out loud", votes: [{ dimension: "learningStyle", value: "auditory" }, { dimension: "memoryType", value: "repetition" }] },
      { id: "c", label: "I write them down as a list of steps", votes: [{ dimension: "learningStyle", value: "reading" }, { dimension: "memoryType", value: "structure" }] },
      { id: "d", label: "I just start walking — I learn the route by doing it", votes: [{ dimension: "learningStyle", value: "kinesthetic" }] },
    ],
  },
  {
    id: "q4",
    category: "Attention span",
    text: "Honestly, how long can you stay deeply focused on studying before your mind starts to wander?",
    options: [
      { id: "a", label: "Under 10 minutes — I need things short and punchy", votes: [{ dimension: "attentionSpan", value: "low", weight: 2 }] },
      { id: "b", label: "Around 20–30 minutes with small breaks", votes: [{ dimension: "attentionSpan", value: "medium", weight: 2 }] },
      { id: "c", label: "An hour or more once I'm in the zone", votes: [{ dimension: "attentionSpan", value: "high", weight: 2 }] },
    ],
  },
  {
    id: "q5",
    category: "Attention span",
    text: "You open a 40-minute educational video. What usually happens?",
    options: [
      { id: "a", label: "I skip around or bump the speed to 2x within minutes", votes: [{ dimension: "attentionSpan", value: "low" }, { dimension: "pace", value: "fast" }] },
      { id: "b", label: "I watch most of it but drift near the end", votes: [{ dimension: "attentionSpan", value: "medium" }] },
      { id: "c", label: "I watch the whole thing and often look for a part two", votes: [{ dimension: "attentionSpan", value: "high" }, { dimension: "depth", value: "deep" }] },
    ],
  },
  {
    id: "q6",
    category: "Attention span",
    text: "Your ideal single lesson feels like…",
    options: [
      { id: "a", label: "An espresso shot — 3–5 minutes, straight to the point", votes: [{ dimension: "attentionSpan", value: "low" }, { dimension: "depth", value: "overview" }] },
      { id: "b", label: "A coffee break — about 10 minutes, focused but complete", votes: [{ dimension: "attentionSpan", value: "medium" }, { dimension: "depth", value: "balanced" }] },
      { id: "c", label: "A full documentary — as long as it needs to be", votes: [{ dimension: "attentionSpan", value: "high" }, { dimension: "depth", value: "deep" }] },
    ],
  },
  {
    id: "q7",
    category: "Pace",
    text: "When someone narrates or teaches, what speed feels right?",
    options: [
      { id: "a", label: "Slow and deliberate — give me time to absorb each idea", votes: [{ dimension: "pace", value: "slow", weight: 2 }] },
      { id: "b", label: "A natural conversational speed", votes: [{ dimension: "pace", value: "moderate", weight: 2 }] },
      { id: "c", label: "Brisk — I get impatient when people talk slowly", votes: [{ dimension: "pace", value: "fast", weight: 2 }] },
    ],
  },
  {
    id: "q8",
    category: "Pace",
    text: "A lesson spends five minutes on something you already understood. You…",
    options: [
      { id: "a", label: "Don't mind — the repetition helps it sink in", votes: [{ dimension: "pace", value: "slow" }, { dimension: "memoryType", value: "repetition" }] },
      { id: "b", label: "Stay patient but wish it would move along", votes: [{ dimension: "pace", value: "moderate" }] },
      { id: "c", label: "Skip ahead immediately", votes: [{ dimension: "pace", value: "fast" }, { dimension: "attentionSpan", value: "low" }] },
    ],
  },
  {
    id: "q9",
    category: "Knowledge level",
    text: "In the subjects you plan to learn here, where do you usually start?",
    options: [
      { id: "a", label: "From zero — assume I know nothing", votes: [{ dimension: "knowledgeLevel", value: "beginner", weight: 2 }] },
      { id: "b", label: "I know the basics and want to go further", votes: [{ dimension: "knowledgeLevel", value: "intermediate", weight: 2 }] },
      { id: "c", label: "I'm experienced — skip the fundamentals", votes: [{ dimension: "knowledgeLevel", value: "advanced", weight: 2 }] },
    ],
  },
  {
    id: "q10",
    category: "Knowledge level",
    text: "How do you feel about technical terminology and jargon?",
    options: [
      { id: "a", label: "Avoid it — everyday words work better for me", votes: [{ dimension: "knowledgeLevel", value: "beginner" }, { dimension: "tone", value: "friendly" }] },
      { id: "b", label: "Use it, but define it the first time", votes: [{ dimension: "knowledgeLevel", value: "intermediate" }, { dimension: "tone", value: "professional" }] },
      { id: "c", label: "Use precise terms freely — that's what I'm here for", votes: [{ dimension: "knowledgeLevel", value: "advanced" }, { dimension: "tone", value: "academic" }] },
    ],
  },
  {
    id: "q11",
    category: "Tone",
    text: "Pick the teacher you'd learn best from:",
    options: [
      { id: "a", label: "The warm mentor who cracks jokes and cheers you on", votes: [{ dimension: "tone", value: "friendly", weight: 2 }] },
      { id: "b", label: "The sharp professional who respects your time", votes: [{ dimension: "tone", value: "professional", weight: 2 }] },
      { id: "c", label: "The rigorous professor who goes deep into theory", votes: [{ dimension: "tone", value: "academic", weight: 2 }, { dimension: "depth", value: "deep" }] },
    ],
  },
  {
    id: "q12",
    category: "Depth",
    text: "You have one hour with a new topic. What's the better use of it?",
    options: [
      { id: "a", label: "A broad map of the whole territory, details later", votes: [{ dimension: "depth", value: "overview", weight: 2 }] },
      { id: "b", label: "Key ideas with enough detail to actually use them", votes: [{ dimension: "depth", value: "balanced", weight: 2 }] },
      { id: "c", label: "One core concept, understood completely", votes: [{ dimension: "depth", value: "deep", weight: 2 }] },
    ],
  },
  {
    id: "q13",
    category: "Visual preference",
    text: "How much do images, diagrams and color matter to your understanding?",
    options: [
      { id: "a", label: "Not much — clean text is enough", votes: [{ dimension: "visualPreference", value: "low", weight: 2 }] },
      { id: "b", label: "Helpful as support for the main text", votes: [{ dimension: "visualPreference", value: "medium", weight: 2 }] },
      { id: "c", label: "Essential — I barely absorb walls of text", votes: [{ dimension: "visualPreference", value: "high", weight: 2 }] },
    ],
  },
  {
    id: "q14",
    category: "Visual preference",
    text: "A slide packed edge-to-edge with text appears. Your honest reaction:",
    options: [
      { id: "a", label: "Great — more information per slide", votes: [{ dimension: "visualPreference", value: "low" }, { dimension: "learningStyle", value: "reading" }] },
      { id: "b", label: "Fine, as long as it's well organized", votes: [{ dimension: "visualPreference", value: "medium" }, { dimension: "memoryType", value: "structure" }] },
      { id: "c", label: "My eyes glaze over instantly", votes: [{ dimension: "visualPreference", value: "high" }, { dimension: "attentionSpan", value: "low" }] },
    ],
  },
  {
    id: "q15",
    category: "Examples",
    text: "When do abstract concepts finally click for you?",
    options: [
      { id: "a", label: "When the definition itself is precise enough", votes: [{ dimension: "examplePreference", value: "low", weight: 2 }] },
      { id: "b", label: "After one solid real-world example", votes: [{ dimension: "examplePreference", value: "medium", weight: 2 }] },
      { id: "c", label: "After several examples and comparisons to things I know", votes: [{ dimension: "examplePreference", value: "high", weight: 2 }, { dimension: "memoryType", value: "association" }] },
    ],
  },
  {
    id: "q16",
    category: "Examples",
    text: "\"RAM is like a kitchen counter — bigger counter, more dishes at once.\" Analogies like this are…",
    options: [
      { id: "a", label: "Distracting — just tell me what RAM actually does", votes: [{ dimension: "examplePreference", value: "low" }, { dimension: "knowledgeLevel", value: "advanced" }] },
      { id: "b", label: "A nice bonus when the idea is tricky", votes: [{ dimension: "examplePreference", value: "medium" }] },
      { id: "c", label: "Exactly how my brain works", votes: [{ dimension: "examplePreference", value: "high" }, { dimension: "memoryType", value: "association" }] },
    ],
  },
  {
    id: "q17",
    category: "Motivation",
    text: "What's really driving you to learn right now?",
    options: [
      { id: "a", label: "Pure curiosity — I love understanding things", votes: [{ dimension: "motivation", value: "curiosity", weight: 2 }] },
      { id: "b", label: "Career growth — skills that pay off at work", votes: [{ dimension: "motivation", value: "career", weight: 2 }] },
      { id: "c", label: "An exam or certification I need to pass", votes: [{ dimension: "motivation", value: "exam", weight: 2 }, { dimension: "revisionFrequency", value: "high" }] },
      { id: "d", label: "A personal hobby or project", votes: [{ dimension: "motivation", value: "hobby", weight: 2 }] },
    ],
  },
  {
    id: "q18",
    category: "Memory",
    text: "A month from now, which version of today's lesson would you still remember?",
    options: [
      { id: "a", label: "The one told as a story with characters and stakes", votes: [{ dimension: "memoryType", value: "story", weight: 2 }] },
      { id: "b", label: "The one I reviewed three times with flashcards", votes: [{ dimension: "memoryType", value: "repetition", weight: 2 }, { dimension: "revisionFrequency", value: "high" }] },
      { id: "c", label: "The one linked to things I already knew", votes: [{ dimension: "memoryType", value: "association", weight: 2 }] },
      { id: "d", label: "The one laid out as a clean numbered framework", votes: [{ dimension: "memoryType", value: "structure", weight: 2 }] },
    ],
  },
  {
    id: "q19",
    category: "Revision",
    text: "After finishing a lesson, how often do you actually come back to review it?",
    options: [
      { id: "a", label: "Rarely — once through is usually it", votes: [{ dimension: "revisionFrequency", value: "low", weight: 2 }] },
      { id: "b", label: "Sometimes, when the topic is important", votes: [{ dimension: "revisionFrequency", value: "medium", weight: 2 }] },
      { id: "c", label: "Regularly — spaced review is part of my routine", votes: [{ dimension: "revisionFrequency", value: "high", weight: 2 }] },
    ],
  },
  {
    id: "q20",
    category: "Confidence",
    text: "Facing a genuinely hard topic alone, how do you feel?",
    options: [
      { id: "a", label: "Intimidated — I need lots of encouragement and small wins", votes: [{ dimension: "confidence", value: "low", weight: 2 }, { dimension: "tone", value: "friendly" }] },
      { id: "b", label: "Cautious but capable with a clear path", votes: [{ dimension: "confidence", value: "medium", weight: 2 }] },
      { id: "c", label: "Energized — hard problems are the fun ones", votes: [{ dimension: "confidence", value: "high", weight: 2 }, { dimension: "depth", value: "deep" }] },
    ],
  },
];

export const QUESTION_COUNT = PSYCHOLOGY_QUESTIONS.length;
