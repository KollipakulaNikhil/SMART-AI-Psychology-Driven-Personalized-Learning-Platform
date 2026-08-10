import express from "express";
import helmet from "helmet";
import cors from "cors";
import { env } from "./config/env";
import { DIRS } from "./utils/paths";
import { logger } from "./utils/logger";
import { globalRateLimiter } from "./middleware/rateLimiter";
import { errorHandler, notFoundHandler } from "./middleware/error";
import apiRoutes from "./routes";

export function createApp(): express.Express {
  const app = express();

  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(
    helmet({
      // Slide previews and videos are consumed by the Next.js origin.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    })
  );

  const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim());
  app.use(
    cors({
      origin: allowedOrigins,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));

  // Request logging with duration.
  app.use((req, res, next) => {
    const startedAt = Date.now();
    res.on("finish", () => {
      const message = `${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`;
      if (res.statusCode >= 500) logger.error(message);
      else if (res.statusCode >= 400) logger.warn(message);
      else logger.info(message);
    });
    next();
  });

  // Generated media previews (slide PNGs, lesson video streaming in the app).
  // Download endpoints under /api/download stay fully authenticated.
  app.use("/static/uploads", express.static(DIRS.uploads, { maxAge: "7d", immutable: true }));
  app.use("/static/generated", express.static(DIRS.generated, { maxAge: "1h" }));

  app.use("/api", globalRateLimiter, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
