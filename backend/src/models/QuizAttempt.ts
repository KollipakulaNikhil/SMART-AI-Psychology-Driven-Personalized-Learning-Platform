import { Schema, model, Document, Types } from "mongoose";

export interface QuizAttemptDocument extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  presentationId: Types.ObjectId;
  topic: string;
  /** Chosen option index per question, in quiz order. */
  answers: number[];
  score: number;
  total: number;
  /** True when this attempt was a scheduled Smart Review, not first study. */
  isReview: boolean;
  createdAt: Date;
}

const quizAttemptSchema = new Schema<QuizAttemptDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    presentationId: { type: Schema.Types.ObjectId, ref: "Presentation", required: true, index: true },
    topic: { type: String, required: true },
    answers: { type: [Number], required: true },
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    isReview: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

quizAttemptSchema.index({ userId: 1, createdAt: -1 });

export const QuizAttempt = model<QuizAttemptDocument>("QuizAttempt", quizAttemptSchema);
