import { Schema, model, Document, Types } from "mongoose";

export interface GeneratedVideoDocument extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  presentationId: Types.ObjectId;
  topic: string;
  filePath: string;
  durationSec: number;
  sizeBytes: number;
  slideCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const generatedVideoSchema = new Schema<GeneratedVideoDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    presentationId: { type: Schema.Types.ObjectId, ref: "Presentation", required: true, index: true },
    topic: { type: String, required: true },
    filePath: { type: String, required: true },
    durationSec: { type: Number, required: true },
    sizeBytes: { type: Number, required: true },
    slideCount: { type: Number, required: true },
  },
  { timestamps: true }
);

export const GeneratedVideo = model<GeneratedVideoDocument>("GeneratedVideo", generatedVideoSchema);
