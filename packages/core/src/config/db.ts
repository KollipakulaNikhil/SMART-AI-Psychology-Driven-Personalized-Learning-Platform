import mongoose from "mongoose";
import { env } from "./env";
import { logger } from "../utils/logger";

/**
 * Serverless-safe cached connection: Vercel/Next.js can invoke this module many
 * times per warm lambda, so we stash the in-flight/connected promise on
 * `globalThis` to avoid opening a new Mongo connection on every request.
 */
declare global {
  // eslint-disable-next-line no-var
  var __smartAiMongoose: Promise<typeof mongoose> | undefined;
}

export async function connectDatabase(): Promise<typeof mongoose> {
  if (!globalThis.__smartAiMongoose) {
    mongoose.set("strictQuery", true);
    mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
    mongoose.connection.on("error", (err) => logger.error("MongoDB error", { err: err.message }));
    mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

    globalThis.__smartAiMongoose = mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10_000,
    });
  }

  return globalThis.__smartAiMongoose;
}

/** Only meaningful for the worker's long-lived process (graceful shutdown). */
export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  globalThis.__smartAiMongoose = undefined;
}
