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
  url: z.url({ protocol: /^https?$/ }).max(1024),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"])
};

export const networkRule = z.discriminatedUnion("action", [
  z.strictObject({ ...ruleTarget, action: z.literal("abort") }),
  z.strictObject({
    ...ruleTarget,
    action: z.literal("fulfill"),
    body: z.string().max(16 * 1024),
    status: z.number().int().min(200).max(599),
    contentType: z.enum(["application/json", "text/plain"])
  })
]);
