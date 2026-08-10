import { Schema, model, Document, Types } from "mongoose";

export type HistoryAction =
  | "profile_created"
  | "profile_updated"
  | "content_generated"
  | "ppt_generated"
  | "audio_generated"
  | "video_generated"
  | "quiz_completed"
  | "asset_downloaded";

export interface HistoryDocument extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  action: HistoryAction;
  presentationId?: Types.ObjectId;
  topic?: string;
  meta?: Record<string, unknown>;
  createdAt: Date;
}

const historySchema = new Schema<HistoryDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: {
      type: String,
      enum: [
        "profile_created",
        "profile_updated",
        "content_generated",
        "ppt_generated",
        "audio_generated",
        "video_generated",
        "quiz_completed",
        "asset_downloaded",
      ],
      required: true,
    },
    presentationId: { type: Schema.Types.ObjectId, ref: "Presentation" },
    topic: { type: String },
    meta: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

historySchema.index({ userId: 1, createdAt: -1 });

export const History = model<HistoryDocument>("History", historySchema);
