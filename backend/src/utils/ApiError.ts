export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(statusCode: number, message: string, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, details);
  }
  static unauthorized(message = "Authentication required"): ApiError {
    return new ApiError(401, message);
  }
  static forbidden(message = "You do not have access to this resource"): ApiError {
    return new ApiError(403, message);
  }
  static notFound(message = "Resource not found"): ApiError {
    return new ApiError(404, message);
  }
  static conflict(message: string): ApiError {
    return new ApiError(409, message);
  }
  static unprocessable(message: string, details?: unknown): ApiError {
    return new ApiError(422, message, details);
  }
  static serviceUnavailable(message: string): ApiError {
    return new ApiError(503, message);
  }
}
