import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ApiError } from "@smart-ai/core/utils/ApiError";
import { logger } from "@smart-ai/core/utils/logger";
import { isProd } from "@smart-ai/core/config/env";
import { connectDatabase } from "@smart-ai/core/config/db";
import { checkAuthFailureRateLimit, checkGlobalRateLimit } from "./rateLimit";

type RouteContext = { params: Promise<Record<string, string>> };
type Handler = (req: Request, ctx: RouteContext) => Promise<unknown>;

const STATUS = Symbol("apiHandlerStatus");

/** Every JSON body this API accepts is small; files go straight to Blob storage instead. */
const MAX_JSON_BODY_BYTES = 256 * 1024;

/** API responses are per-user and must never be stored by a browser or a shared cache. */
const API_HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

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
      // Before anything else — including the database — so a flood is cheap to turn away.
      await checkGlobalRateLimit(req);
      if (Number(req.headers.get("content-length") ?? 0) > MAX_JSON_BODY_BYTES) {
        throw new ApiError(413, "Request body too large");
      }
      await connectDatabase();
      const result = await fn(req, ctx);
      if (hasStatus(result)) {
        return NextResponse.json(
          { success: true, data: result.data },
          { status: result[STATUS], headers: API_HEADERS }
        );
      }
      return NextResponse.json({ success: true, data: result }, { headers: API_HEADERS });
    } catch (error) {
      // Repeated bad tokens from one address get cut off rather than checked forever.
      if (error instanceof ApiError && error.statusCode === 401) {
        try {
          await checkAuthFailureRateLimit(req);
        } catch (limited) {
          return toErrorResponse(limited, req);
        }
      }
      return toErrorResponse(error, req);
    }
  };
}

/** Path only: query strings can carry user input that has no business in the logs. */
function pathOf(req: Request): string {
  try {
    return new URL(req.url).pathname;
  } catch {
    return "(unparseable url)";
  }
}

function retryAfter(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || error.statusCode !== 429) return {};
  const seconds = (error.details as { retryAfterSec?: number } | undefined)?.retryAfterSec;
  return typeof seconds === "number" ? { "Retry-After": String(seconds) } : {};
}

export function toErrorResponse(error: unknown, req: Request): NextResponse {
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    }));
    logger.warn(`${req.method} ${pathOf(req)} → 400: Request validation failed`);
    return NextResponse.json(
      { success: false, message: "Request validation failed", details },
      { status: 400, headers: API_HEADERS }
    );
  }

  const isApiError = error instanceof ApiError;
  const statusCode = isApiError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : "Unknown error";

  if (statusCode >= 500) {
    logger.error(`${req.method} ${pathOf(req)} → ${statusCode}`, {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
  } else {
    logger.warn(`${req.method} ${pathOf(req)} → ${statusCode}: ${message}`);
  }

  return NextResponse.json(
    {
      success: false,
      message: isApiError || !isProd ? message : "Something went wrong on our side. Please try again.",
      ...(isApiError && error.details ? { details: error.details } : {}),
    },
    { status: statusCode, headers: { ...API_HEADERS, ...retryAfter(error) } }
  );
}
