import http from "http";
import { env } from "./config/env";
import { logger } from "./utils/logger";
import { ensureRuntimeDirs } from "./utils/paths";
import { connectDatabase, disconnectDatabase } from "./config/db";
import { initFirebase } from "./config/firebase";
import { createApp } from "./app";
import { reclaimOrphanedVideoJobs } from "./controllers/generate.controller";

async function bootstrap(): Promise<void> {
  ensureRuntimeDirs();

  initFirebase();
  await connectDatabase();

  // Background video renders live in this process, so any that were "processing"
  // when we last stopped are gone. Fail them so their lessons offer a retry
  // instead of spinning forever.
  const reclaimed = await reclaimOrphanedVideoJobs();
  if (reclaimed > 0) logger.warn(`Reset ${reclaimed} video render(s) orphaned by a previous shutdown`);

  const app = createApp();
  const server = http.createServer(app);

  // Video/audio generation can legitimately take minutes.
  server.requestTimeout = 15 * 60 * 1000;
  server.headersTimeout = 16 * 60 * 1000;

  server.listen(env.PORT, () => {
    logger.info(`SMART AI API listening on http://localhost:${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = (signal: string) => {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Force-exit if connections refuse to drain.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", { reason: reason instanceof Error ? reason.stack : reason });
  });
  process.on("uncaughtException", (error) => {
    logger.error("Uncaught exception — exiting", { stack: error.stack });
    process.exit(1);
  });
}

bootstrap().catch((error) => {
  logger.error(`Failed to start SMART AI API: ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
