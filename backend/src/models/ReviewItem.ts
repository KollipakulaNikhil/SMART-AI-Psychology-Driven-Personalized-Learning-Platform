import { Schema, model, Document, Types } from "mongoose";

/**
 * One spaced-repetition schedule per (user, lesson), maintained with an
 * SM-2-style algorithm: strong quiz scores stretch the review interval,
 * weak ones reset it to tomorrow.
 */
export interface ReviewItemDocument extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  presentationId: Types.ObjectId;
  topic: string;
  subject: string;
  /** SM-2 easiness factor (≥ 1.3). */
  easiness: number;
  intervalDays: number;
  /** Consecutive successful reviews. */
  repetitions: number;
  dueAt: Date;
  lastScorePct: number;
  lastReviewedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const reviewItemSchema = new Schema<ReviewItemDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    presentationId: { type: Schema.Types.ObjectId, ref: "Presentation", required: true },
    topic: { type: String, required: true },
    subject: { type: String, default: "General" },
    easiness: { type: Number, default: 2.5 },
    intervalDays: { type: Number, default: 1 },
    repetitions: { type: Number, default: 0 },
    dueAt: { type: Date, required: true, index: true },
    lastScorePct: { type: Number, default: 0 },
    lastReviewedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

reviewItemSchema.index({ userId: 1, presentationId: 1 }, { unique: true });
reviewItemSchema.index({ userId: 1, dueAt: 1 });

export const ReviewItem = model<ReviewItemDocument>("ReviewItem", reviewItemSchema);
