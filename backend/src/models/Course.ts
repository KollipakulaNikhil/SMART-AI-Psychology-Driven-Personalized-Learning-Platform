import { Schema, model, Document, Types } from "mongoose";

export type ModuleStatus = "pending" | "generated" | "completed";

export interface CourseModule {
  index: number;
  title: string;
  /** The lesson topic fed into the generation pipeline for this module. */
  topic: string;
  /** Focus hint carried into generation so the module fits the course arc. */
  focus: string;
  /** Section (chapter) this subtopic belongs to, for the roadmap hierarchy. */
  section: string;
  sectionIndex: number;
  status: ModuleStatus;
  presentationId?: Types.ObjectId;
  completedAt?: Date;
}

export interface CourseDocument extends Document<Types.ObjectId> {
  userId: Types.ObjectId;
  goal: string;
  title: string;
  description: string;
  subject: string;
  modules: CourseModule[];
  createdAt: Date;
  updatedAt: Date;
}

const moduleSchema = new Schema<CourseModule>(
  {
    index: { type: Number, required: true },
    title: { type: String, required: true },
    topic: { type: String, required: true },
    focus: { type: String, default: "" },
    section: { type: String, default: "" },
    sectionIndex: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "generated", "completed"], default: "pending" },
    presentationId: { type: Schema.Types.ObjectId, ref: "Presentation" },
    completedAt: { type: Date },
  },
  { _id: false }
);

const courseSchema = new Schema<CourseDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    goal: { type: String, required: true, trim: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    subject: { type: String, default: "General" },
    modules: { type: [moduleSchema], default: [] },
  },
  { timestamps: true }
);

courseSchema.index({ userId: 1, createdAt: -1 });

export const Course = model<CourseDocument>("Course", courseSchema);
