import { afterEach, describe, expect, it, vi } from "vitest";

import type { ToolResult } from "../errors.js";

type EvaluateOk = {
  ok: true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  result: any;
  resultType?: string;
  truncated?: boolean;
};

type EvaluateErr = {
  ok: false;
  error?: string;
  errorType?: string;
};

type EvaluateResult = EvaluateOk | EvaluateErr;

function unwrapToolResult(result: ToolResult): unknown {
  expect(result.isError).toBeUndefined();
  expect(result.content[0]?.type).toBe("text");
  const first = result.content[0];
  if (!first || first.type !== "text") {
    throw new Error("Expected ToolResult to have text content");
  }
  return JSON.parse(first.text);
}

async function getEvaluateHandler(evaluateImpl: (tabId: string, expression: string, userId: string, timeout: number) => Promise<EvaluateResult>) {
  vi.resetModules();

  const getTrackedTabMock = vi.fn((tabId: string) => ({ tabId, userId: "user-1" }));
  const incrementToolCallMock = vi.fn();

  vi.doMock("../state.js", () => ({
    getTrackedTab: getTrackedTabMock,
    incrementToolCall: incrementToolCallMock
  }));

  const { registerInteractionTools } = await import("../tools/interaction.js");

  const server = {
    tool: vi.fn()
  };

  const deps = {
    client: {
      evaluate: vi.fn(evaluateImpl)
    }
  };

  registerInteractionTools(server as unknown as Parameters<typeof registerInteractionTools>[0], deps as unknown as Parameters<typeof registerInteractionTools>[1]);

  const call = server.tool.mock.calls.find((c) => c[0] === "camofox_evaluate_js");
  if (!call) {
    throw new Error("Expected camofox_evaluate_js tool to be registered");
  }

  const handler = call[3] as (input: unknown) => Promise<ToolResult>;

  return {
    handler,
    evaluateMock: deps.client.evaluate as unknown as ReturnType<typeof vi.fn>,
    getTrackedTabMock,
    incrementToolCallMock
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unmock("../state.js");
});

describe("interaction - camofox_evaluate_js", () => {
  it("success: uses explicit resultType when provided", async () => {
    const { handler, evaluateMock, incrementToolCallMock } = await getEvaluateHandler(async () => ({
      ok: true,
      result: { a: 1 },
      resultType: "custom",
      truncated: false
    }));

    const res = await handler({ tabId: "tab-1", expression: "1+1", timeout: 1234 });
    const payload = unwrapToolResult(res) as { ok: boolean; resultType: string };

    expect(payload).toMatchObject({ ok: true, resultType: "custom" });
    expect(evaluateMock).toHaveBeenCalledWith("tab-1", "1+1", "user-1", 1234);
    expect(incrementToolCallMock).toHaveBeenCalledWith("tab-1");
  });

  it("success: infers resultType 'null' for null result", async () => {
    const { handler, incrementToolCallMock } = await getEvaluateHandler(async () => ({ ok: true, result: null }));

    const res = await handler({ tabId: "tab-1", expression: "null" });
    const payload = unwrapToolResult(res) as { ok: boolean; resultType: string; result: unknown };

    expect(payload).toEqual({ ok: true, result: null, resultType: "null", truncated: false });
    expect(incrementToolCallMock).toHaveBeenCalledWith("tab-1");
  });

  it("success: infers resultType 'array' for array result", async () => {
    const { handler, incrementToolCallMock } = await getEvaluateHandler(async () => ({ ok: true, result: [1, 2, 3] }));

    const res = await handler({ tabId: "tab-1", expression: "[1,2,3]" });
    const payload = unwrapToolResult(res) as { resultType: string; result: unknown };

    expect(payload.resultType).toBe("array");
    expect(payload.result).toEqual([1, 2, 3]);
    expect(incrementToolCallMock).toHaveBeenCalledWith("tab-1");
  });

  it("success: infers resultType 'string'", async () => {
    const { handler, incrementToolCallMock } = await getEvaluateHandler(async () => ({ ok: true, result: "hello" }));

    const res = await handler({ tabId: "tab-1", expression: "'hello'" });
    const payload = unwrapToolResult(res) as { resultType: string; result: unknown };

    expect(payload.resultType).toBe("string");
    expect(payload.result).toBe("hello");
    expect(incrementToolCallMock).toHaveBeenCalledWith("tab-1");
  });

  it("success: infers resultType 'number'", async () => {
    const { handler, incrementToolCallMock } = await getEvaluateHandler(async () => ({ ok: true, result: 42 }));

    const res = await handler({ tabId: "tab-1", expression: "42" });
    const payload = unwrapToolResult(res) as { resultType: string; result: unknown };

    expect(payload.resultType).toBe("number");
    expect(payload.result).toBe(42);
    expect(incrementToolCallMock).toHaveBeenCalledWith("tab-1");
  });

  it("success: infers resultType 'boolean'", async () => {
    const { handler, incrementToolCallMock } = await getEvaluateHandler(async () => ({ ok: true, result: true }));

    const res = await handler({ tabId: "tab-1", expression: "true" });
    const payload = unwrapToolResult(res) as { resultType: string; result: unknown };

    expect(payload.resultType).toBe("boolean");
    expect(payload.result).toBe(true);
    expect(incrementToolCallMock).toHaveBeenCalledWith("tab-1");
  });

  it("error: timeout when errorType contains 'timeout'", async () => {
    const { handler, incrementToolCallMock } = await getEvaluateHandler(async () => ({
      ok: false,
      errorType: "TIMEOUT",
      error: "request took too long"
    }));

    const res = await handler({ tabId: "tab-1", expression: "1", timeout: 2222 });
    const payload = unwrapToolResult(res) as { ok: boolean; error: string; errorType: string };

    expect(payload.ok).toBe(false);
    expect(payload.errorType).toBe("TIMEOUT");
    expect(payload.error).toBe("Evaluation timed out after 2222ms");
    expect(incrementToolCallMock).toHaveBeenCalledWith("tab-1");
  });

  it("error: generic error returns message from result.error", async () => {
    const { handler, incrementToolCallMock } = await getEvaluateHandler(async () => ({
      ok: false,
      errorType: "Error",
      error: "boom"
    }));

    const res = await handler({ tabId: "tab-1", expression: "throw" });
    const payload = unwrapToolResult(res) as { ok: boolean; error: string; errorType: string };

    expect(payload).toEqual({ ok: false, error: "boom", errorType: "Error" });
    expect(incrementToolCallMock).toHaveBeenCalledWith("tab-1");
  });

  it("error: timeout when error string contains 'timeout'", async () => {
    const { handler, incrementToolCallMock } = await getEvaluateHandler(async () => ({
      ok: false,
      errorType: "Error",
      error: "Evaluation Timeout exceeded"
    }));

    const res = await handler({ tabId: "tab-1", expression: "1", timeout: 3333 });
    const payload = unwrapToolResult(res) as { ok: boolean; error: string; errorType: string };

    expect(payload.ok).toBe(false);
    expect(payload.errorType).toBe("Error");
    expect(payload.error).toBe("Evaluation timed out after 3333ms");
    expect(incrementToolCallMock).toHaveBeenCalledWith("tab-1");
  });

  it("success: propagates truncated=true", async () => {
    const { handler, incrementToolCallMock } = await getEvaluateHandler(async () => ({
      ok: true,
      result: "a".repeat(10),
      truncated: true
    }));

    const res = await handler({ tabId: "tab-1", expression: "'aaaaaaaaaa'" });
    const payload = unwrapToolResult(res) as { ok: boolean; truncated: boolean };

    expect(payload.ok).toBe(true);
    expect(payload.truncated).toBe(true);
    expect(incrementToolCallMock).toHaveBeenCalledWith("tab-1");
  });
});
