import { describe, expect, it } from "vitest";
import { z } from "zod";

import { AppError, binaryResult, normalizeError, okResult, toErrorResult } from "../errors.js";

describe("errors", () => {
  it("normalizeError() returns AppError input as-is", () => {
    const appError = new AppError("TIMEOUT", "Took too long", 408);
    expect(normalizeError(appError)).toBe(appError);
  });

  it("normalizeError() converts ZodError to VALIDATION_ERROR", () => {
    const schema = z.object({ name: z.string() });

    let thrown: unknown;
    try {
      schema.parse({ name: 123 });
    } catch (err) {
      thrown = err;
    }

    const normalized = normalizeError(thrown);
    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.code).toBe("VALIDATION_ERROR");
    expect(normalized.message.length).toBeGreaterThan(0);
  });

  it("normalizeError() converts Error to INTERNAL_ERROR", () => {
    const normalized = normalizeError(new Error("boom"));
    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.message).toBe("boom");
  });

  it("normalizeError() converts unknown to INTERNAL_ERROR with generic message", () => {
    const normalized = normalizeError("oops");
    expect(normalized).toBeInstanceOf(AppError);
    expect(normalized.code).toBe("INTERNAL_ERROR");
    expect(normalized.message).toMatch(/unknown internal error/i);
  });

  it("toErrorResult() formats AppError payload", () => {
    const result = toErrorResult(new AppError("TAB_NOT_FOUND", "missing"));
    expect(result.isError).toBe(true);
    expect(result.content[0].type).toBe("text");

    const first = result.content[0];
    if (first.type !== "text") {
      throw new Error("Expected toErrorResult() to return text content");
    }

    const payload = JSON.parse(first.text);
    expect(payload).toEqual({ isError: true, code: "TAB_NOT_FOUND", message: "missing" });
  });

  it("toErrorResult() normalizes generic errors", () => {
    const result = toErrorResult(new Error("nope"));
    const first = result.content[0];
    if (first.type !== "text") {
      throw new Error("Expected toErrorResult() to return text content");
    }

    const payload = JSON.parse(first.text);

    expect(payload.isError).toBe(true);
    expect(payload.code).toBe("INTERNAL_ERROR");
    expect(payload.message).toBe("nope");
  });

  it("okResult() returns MCP text content with JSON stringified payload", () => {
    const result = okResult({ a: 1 });
    expect(result.isError).toBeUndefined();
    expect(result.content).toEqual([{ type: "text", text: JSON.stringify({ a: 1 }) }]);
  });

  it("binaryResult returns image content with given mimeType", () => {
    const result = binaryResult("base64data", "image/png");
    expect(result.content).toEqual([{ type: "image", data: "base64data", mimeType: "image/png" }]);
  });
});
