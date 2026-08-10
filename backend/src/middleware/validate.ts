import { NextFunction, Request, RequestHandler, Response } from "express";
import { AnyZodObject, ZodError } from "zod";
import { ApiError } from "../utils/ApiError";

interface ValidationTargets {
  body?: AnyZodObject;
  params?: AnyZodObject;
  query?: AnyZodObject;
}

/** Zod-validates request parts and replaces them with the parsed (coerced) values. */
export function validate(targets: ValidationTargets): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      if (targets.body) req.body = targets.body.parse(req.body);
      if (targets.params) req.params = targets.params.parse(req.params) as typeof req.params;
      if (targets.query) req.query = targets.query.parse(req.query) as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        }));
        next(ApiError.badRequest("Request validation failed", details));
        return;
      }
      next(error);
    }
  };
}
