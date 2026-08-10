import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { logger } from "../utils/logger";
import { isProd } from "../config/env";

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const isApiError = error instanceof ApiError;
  const statusCode = isApiError ? error.statusCode : 500;

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} → ${statusCode}`, {
      message: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });
  } else {
    logger.warn(`${req.method} ${req.originalUrl} → ${statusCode}: ${error.message}`);
  }

  res.status(statusCode).json({
    success: false,
    message: isApiError || !isProd ? error.message : "Something went wrong on our side. Please try again.",
    ...(isApiError && error.details ? { details: error.details } : {}),
  });
}
