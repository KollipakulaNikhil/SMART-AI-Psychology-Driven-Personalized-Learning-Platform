import express from "express";
import { env } from "@smart-ai/core/config/env";
import { connectDatabase, disconnectDatabase } from "@smart-ai/core/config/db";
import { logger } from "@smart-ai/core/utils/logger";
import { startVideoJobPoller } from "./polling/videoJobs";
import { startResearchJobPoller } from "./polling/researchJobs";

async function main() {
  await connectDatabase();
  logger.info("Worker connected to MongoDB");

  const app = express();
  app.get("/health", (_req, res) => res.json({ status: "ok", uptime: process.uptime() }));

  const server = app.listen(env.PORT, () => {
    logger.info(`Worker health endpoint listening on :${env.PORT}`);
  });

  const stopVideoPoller = startVideoJobPoller();
  const stopResearchPoller = startResearchJobPoller();

  const shutdown = async (signal: string) => {
    logger.info(`Worker received ${signal}, shutting down`);
    stopVideoPoller();
    stopResearchPoller();
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error("Worker failed to start", { err: err instanceof Error ? err.message : err });
  process.exit(1);
});
