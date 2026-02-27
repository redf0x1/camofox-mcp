import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

import { okResult, toErrorResult } from "../errors.js";
import type { ToolDeps } from "../server.js";

export function registerYouTubeTools(server: McpServer, deps: ToolDeps): void {
  server.tool(
    "youtube_transcript",
    "Extract transcript from a YouTube video. Returns timestamped text. No tab required.",
    {
      url: z.string().describe("YouTube video URL"),
      languages: z.array(z.string()).optional().describe("Preferred languages (default: [\"en\"])")
    },
    async (input: unknown) => {
      try {
        const parsed = z
          .object({
            url: z.string().describe("YouTube video URL"),
            languages: z.array(z.string()).optional().describe("Preferred languages (default: [\"en\"])")
          })
          .parse(input);

        const result = await deps.client.youtubeTranscript(parsed.url, parsed.languages);
        return okResult(result);
      } catch (error) {
        return toErrorResult(error);
      }
    }
  );
}
