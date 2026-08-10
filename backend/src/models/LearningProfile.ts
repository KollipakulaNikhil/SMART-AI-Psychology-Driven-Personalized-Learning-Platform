import { Schema, model, Document, Types } from "mongoose";

export type LearningStyle = "visual" | "auditory" | "reading" | "kinesthetic";
export type AttentionSpan = "low" | "medium" | "high";
export type Pace = "slow" | "moderate" | "fast";
export type KnowledgeLevel = "beginner" | "intermediate" | "advanced";
export type Tone = "friendly" | "professional" | "academic";
export type Depth = "overview" | "balanced" | "deep";
export type PreferenceLevel = "low" | "medium" | "high";
export type Motivation = "curiosity" | "career" | "exam" | "hobby";
export type MemoryType = "story" | "repetition" | "association" | "structure";

export interface LearnerTraits {
  learningStyle: LearningStyle;
  attentionSpan: AttentionSpan;
  pace: Pace;
  knowledgeLevel: KnowledgeLevel;
  tone: Tone;
  depth: Depth;
  visualPreference: PreferenceLevel;
  examplePreference: PreferenceLevel;
  motivation: Motivation;
  memoryType: MemoryType;
  confidence: PreferenceLevel;
  revisionFrequency: PreferenceLevel;
}

export interface QuestionnaireAnswer {
  questionId: string;
  /** One or more selected options — every selection casts its trait votes. */
  optionIds: string[];
}

export interface LearningProfileDocument extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  traits: LearnerTraits;
  answers: QuestionnaireAnswer[];
  version: number;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const traitsSchema = new Schema<LearnerTraits>(
  {
    learningStyle: { type: String, enum: ["visual", "auditory", "reading", "kinesthetic"], required: true },
    attentionSpan: { type: String, enum: ["low", "medium", "high"], required: true },
    pace: { type: String, enum: ["slow", "moderate", "fast"], required: true },
    knowledgeLevel: { type: String, enum: ["beginner", "intermediate", "advanced"], required: true },
    tone: { type: String, enum: ["friendly", "professional", "academic"], required: true },
    depth: { type: String, enum: ["overview", "balanced", "deep"], required: true },
    visualPreference: { type: String, enum: ["low", "medium", "high"], required: true },
    examplePreference: { type: String, enum: ["low", "medium", "high"], required: true },
    motivation: { type: String, enum: ["curiosity", "career", "exam", "hobby"], required: true },
    memoryType: { type: String, enum: ["story", "repetition", "association", "structure"], required: true },
    confidence: { type: String, enum: ["low", "medium", "high"], required: true },
    revisionFrequency: { type: String, enum: ["low", "medium", "high"], required: true },
  },
  { _id: false }
);

const learningProfileSchema = new Schema<LearningProfileDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    traits: { type: traitsSchema, required: true },
    answers: [
      {
        _id: false,
        questionId: { type: String, required: true },
        optionIds: { type: [String], required: true },
      },
    ],
    version: { type: Number, default: 1 },
    completedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const LearningProfile = model<LearningProfileDocument>("LearningProfile", learningProfileSchema);
