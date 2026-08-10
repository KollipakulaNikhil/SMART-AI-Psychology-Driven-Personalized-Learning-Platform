import { Schema, model, Document, Types } from "mongoose";

export interface RecentTopicDocument extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  topic: string;
  subject: string;
  count: number;
  lastUsedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const recentTopicSchema = new Schema<RecentTopicDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    topic: { type: String, required: true, trim: true },
    subject: { type: String, default: "General" },
    count: { type: Number, default: 1 },
    lastUsedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

recentTopicSchema.index({ userId: 1, topic: 1 }, { unique: true });
recentTopicSchema.index({ userId: 1, lastUsedAt: -1 });

export const RecentTopic = model<RecentTopicDocument>("RecentTopic", recentTopicSchema);
