import { Schema, model, Document, Types } from "mongoose";

export interface UserDocument extends Document<Types.ObjectId> {
  firebaseUid: string;
  email: string;
  name: string;
  photoUrl?: string;
  authProvider: "google" | "password" | "unknown";
  lastLoginAt: Date;
  /** Consecutive days with real learning activity (lesson or quiz). */
  studyStreak: number;
  /** Local calendar day (YYYY-MM-DD) of the last counted activity. */
  lastStudyDate?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDocument>(
  {
    firebaseUid: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    photoUrl: { type: String },
    authProvider: { type: String, enum: ["google", "password", "unknown"], default: "unknown" },
    lastLoginAt: { type: Date, default: Date.now },
    studyStreak: { type: Number, default: 0 },
    lastStudyDate: { type: String },
  },
  { timestamps: true }
);

export const User = model<UserDocument>("User", userSchema);
