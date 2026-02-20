import { ZodError } from "zod";

export type ErrorCode =
  | "CONNECTION_REFUSED"
  | "TAB_NOT_FOUND"
  | "MAX_TABS_EXCEEDED"
  | "ELEMENT_NOT_FOUND"
  | "NAVIGATION_FAILED"
  | "API_KEY_REQUIRED"
  | "PROFILE_NOT_FOUND"
  | "PROFILE_ERROR"
  | "TIMEOUT"
  | "VALIDATION_ERROR"
  | "INTERNAL_ERROR";

export class AppError extends Error {
  public readonly code: ErrorCode;

  public readonly status?: number;

  constructor(code: ErrorCode, message: string, status?: number) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export interface ToolResult {
  [key: string]: unknown;
  isError?: boolean;
  content: Array<
    | {
        type: "text";
        text: string;
      }
    | {
        type: "image";
        data: string;
        mimeType: string;
      }
  >;
}

export function okResult(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data) }]
  };
}

export function imageResult(base64Png: string): ToolResult {
  return {
    content: [{ type: "image", data: base64Png, mimeType: "image/png" }]
  };
}

export function binaryResult(base64: string, mimeType: string): ToolResult {
  return {
    content: [{ type: "image", data: base64, mimeType }]
  };
}

export function normalizeError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new AppError("VALIDATION_ERROR", error.issues.map((issue) => issue.message).join(", "));
  }

  if (error instanceof Error) {
    return new AppError("INTERNAL_ERROR", error.message);
  }

  return new AppError("INTERNAL_ERROR", "An unknown internal error occurred");
}

export function toErrorResult(error: unknown): ToolResult {
  const appError = normalizeError(error);
  const payload = {
    isError: true,
    code: appError.code,
    message: appError.message
  };

  return {
    isError: true,
    content: [{ type: "text", text: JSON.stringify(payload) }]
  };
}
