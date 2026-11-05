import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { okResult, toErrorResult } from "../errors.js";
import { networkKey, networkRule } from "../network.js";
import type { ToolDeps } from "../server.js";

const owner = {
  userId: z.string().max(256).refine((value) => value.trim().length > 0, "userId is required").optional(),
  networkKey: networkKey.describe("Private, expiring key returned by create_tab. Treat it as a credential.")
};

export function registerNetworkTools(server: McpServer, { client, config }: ToolDeps): void {
  const ownerId = (input: { userId?: string }) => input.userId ?? config.defaultUserId;

  for (const action of ["start", "stop"] as const) {
    server.tool(
      `network_capture_${action}`,
      action === "start"
        ? "Start recording an opted-in tab or session created with networkCapture.start set to false."
        : "Stop recording. Export while an enrolled tab is still open.",
      owner,
      async (input) => {
        try {
          return okResult(await client.setNetworkCaptureState(action, ownerId(input), input.networkKey));
        } catch (error) {
          return toErrorResult(error);
        }
      }
    );
  }

  server.tool(
    "network_list_requests",
    "List a page of sanitized network requests from this capture.",
    { ...owner, after: z.number().int().nonnegative().optional(), limit: z.number().int().min(1).max(50).optional() },
    async (input) => {
      try {
        return okResult(await client.listNetworkRequests(ownerId(input), input.networkKey, input.after, input.limit));
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "network_get_response",
    "Read metadata for one captured request. Set includeBody only when the capture explicitly enabled bodies and the content is needed.",
    { ...owner, requestId: z.number().int().positive(), includeBody: z.boolean().optional() },
    async (input) => {
      try {
        return okResult(await client.getNetworkRequest(ownerId(input), input.networkKey, input.requestId, input.includeBody));
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

  server.tool(
    "network_export_har",
    "Export the capture as sanitized HAR 1.2 JSON. Stop the capture first for a stable export.",
    owner,
    async (input) => {
      try {
        return okResult(await client.exportNetworkHar(ownerId(input), input.networkKey));
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
  server.tool(
    "network_intercept",
    "Replace exact-match fetch/XHR abort or static mock rules on an active tab capture. Pass an empty list to clear them. Requires browser-side interception to be enabled.",
    { ...owner, rules: z.array(networkRule).max(4) },
    async (input) => {
      try {
        return okResult(await client.interceptNetwork(ownerId(input), input.networkKey, input.rules));
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );

}
