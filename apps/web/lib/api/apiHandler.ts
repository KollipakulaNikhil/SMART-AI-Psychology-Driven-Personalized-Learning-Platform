import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { logger } from "@smart-ai/core/utils/logger";
import { isProd } from "@smart-ai/core/config/env";
import { connectDatabase } from "@smart-ai/core/config/db";

type RouteContext = { params: Promise<Record<string, string>> };
type Handler = (req: Request, ctx: RouteContext) => Promise<unknown>;

const STATUS = Symbol("apiHandlerStatus");

/** Wrap a return value to send a non-200 success status (e.g. 201 Created, 202 Accepted). */
export function withStatus<T>(data: T, status: number): { [STATUS]: number; data: T } {
  return { [STATUS]: status, data };
}

function hasStatus(value: unknown): value is { [STATUS]: number; data: unknown } {
  return typeof value === "object" && value !== null && STATUS in value;
}

/**
 * Wraps a Route Handler body so it can just `return data` or `throw ApiError`
 * — mirrors the old Express `asyncHandler` + `errorHandler` pair, and keeps
 * the `{ success, data }` / `{ success: false, message }` envelope the
 * frontend's services/api.ts already expects.
 */
export function apiHandler(fn: Handler) {
  return async (req: Request, ctx: RouteContext): Promise<NextResponse> => {
    try {
      await connectDatabase();
      const result = await fn(req, ctx);
      if (hasStatus(result)) {
        return NextResponse.json({ success: true, data: result.data }, { status: result[STATUS] });
      }
      return NextResponse.json({ success: true, data: result });
    } catch (error) {
      return toErrorResponse(error, req);
    }
  };
}

function toErrorResponse(error: unknown, req: Request): NextResponse {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    logger.warn(`${req.method} ${req.url} → 400: Request validation failed`);
    return NextResponse.json(
      { success: false, message: "Request validation failed", details },
      { status: 400 }
    );
  }

  const isApiError = error instanceof ApiError;
  const statusCode = isApiError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : "Unknown error";

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.url} → ${statusCode}`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
  } else {
    logger.warn(`${req.method} ${req.url} → ${statusCode}: ${message}`);
  }

  return NextResponse.json(
    {
      success: false,
      message: isApiError || !isProd ? message : "Something went wrong on our side. Please try again.",
      ...(isApiError && error.details ? { details: error.details } : {}),
    },
    { status: statusCode }
  );
}
