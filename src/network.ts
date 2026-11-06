import { z } from "zod";

export const networkKey = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Invalid network capture key");
export const networkCaptureOptions = z.strictObject({
  scope: z.enum(["tab", "session"]).optional(),
  start: z.boolean().optional(),
  captureBodies: z.boolean().optional(),
  joinKey: networkKey.optional()
}).refine(
  (options) => !options.joinKey || (options.scope === "session" && options.start !== false && options.captureBodies !== true),
  "Joining requires session scope and active recording"
);

export const captureState = z.enum(["ready", "recording", "stopped"]);
export const networkRequest = z.object({
  id: z.number().int().positive(),
  tabId: z.string(),
  startedAt: z.number(),
  method: z.string(),
  url: z.string(),
  resourceType: z.string(),
  requestHeaders: z.array(z.object({ name: z.string(), value: z.string() })).max(3).optional(),
  responseHeaders: z.array(z.object({ name: z.string(), value: z.string() })).max(3).optional(),
  state: z.enum(["pending", "finished", "failed"]),
  redirectedFrom: z.number().int().positive().optional(),
  redirectUrl: z.string().optional(),
  status: z.number().int().optional(),
  mimeType: z.string().optional(),
  durationMs: z.number().nonnegative().optional(),
  responseSize: z.number().nonnegative().optional(),
  failure: z.string().optional(),
  bodyState: z.enum(["pending", "skipped", "available", "unavailable"]).optional()
});

export const networkRequestDetail = networkRequest.extend({ body: z.string().max(16 * 1024).optional() });

export const networkPage = z.object({
  state: captureState,
  dropped: z.number().int().nonnegative(),
  requests: z.array(networkRequest).max(50),
  nextCursor: z.number().int().positive().nullable()
});

export const networkHar = z.object({
  log: z.object({
    version: z.literal("1.2"),
    creator: z.object({ name: z.string(), version: z.string() }),
    entries: z.array(z.object({
      startedDateTime: z.string(),
      request: z.object({ method: z.string(), url: z.string() }).passthrough(),
      response: z.object({ status: z.number().int() }).passthrough()
    }).passthrough()).max(256)
  }).passthrough()
});

const ruleTarget = {
  url: z.url({ protocol: /^https?$/ }).max(1024).refine((value) => {
    if (!URL.canParse(value)) return false;
    const target = new URL(value);
    return !target.username && !target.password && !target.hash;
  }, "Interception URLs must not contain credentials or a fragment")
    .describe("Exact HTTP(S) target URL, at most 1024 characters, without credentials or a fragment."),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
};

export const networkRule = z.discriminatedUnion("action", [
  z.strictObject({ ...ruleTarget, action: z.literal("abort") }),
  z.strictObject({
    ...ruleTarget,
    action: z.literal("fulfill"),
    body: z.string().max(16 * 1024)
      .refine((value) => Buffer.byteLength(value, "utf8") <= 16 * 1024, "Body must not exceed 16384 UTF-8 bytes")
      .describe("Static response body, at most 16384 UTF-8 bytes (not characters)."),
    status: z.union([
      z.number().int().min(200).max(203),
      z.number().int().min(206).max(299),
      z.number().int().min(400).max(599)
    ]).describe("HTTP status: 200..299 except 204/205, or 400..599; redirects are not supported."),
    contentType: z.enum(["application/json", "text/plain"])
  })
]);
